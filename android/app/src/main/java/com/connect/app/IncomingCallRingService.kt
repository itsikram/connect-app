package com.connect.app

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.util.Log

class IncomingCallRingService : Service() {
  private var player: MediaPlayer? = null
  private var currentNotificationId = DEFAULT_NOTIFICATION_ID
  private val ringStopHandler = Handler(Looper.getMainLooper())
  private val ringStopRunnable = Runnable {
    IncomingCallNotifier.clearActive()
    LockScreenCallMode.releaseIfNoCall()
    stopRinging()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    running = true
    if (intent?.action == ACTION_STOP) {
      stopRinging()
      return START_NOT_STICKY
    }

    val data = HashMap<String, String>()
    intent?.extras?.keySet()?.forEach { key ->
      val value = intent.extras?.get(key)
      if (value != null) data[key] = value.toString()
    }

    val channelName = data["channelName"] ?: ""
    currentNotificationId = notificationIdFor(channelName)

    if (!enterForeground(data)) {
      // Could not become a foreground service: the notification rings by itself.
      IncomingCallNotifier.postWithoutService(this, data)
      IncomingCallNotifier.launchCallScreen(this, data)
      stopSelf()
      return START_NOT_STICKY
    }

    startRingtone(data["ringtoneId"] ?: "1")
    ringStopHandler.removeCallbacks(ringStopRunnable)
    ringStopHandler.postDelayed(ringStopRunnable, CALL_RING_DURATION_MS)
    IncomingCallNotifier.launchCallScreen(this, data)
    // Not sticky: a restart after the process dies would arrive without the
    // call payload and ring for a call that is long gone.
    return START_NOT_STICKY
  }

  /** Call-style notification first, then a plain one if Android rejects it. */
  private fun enterForeground(data: Map<String, String>): Boolean {
    for (callStyle in listOf(true, false)) {
      try {
        val notification = IncomingCallNotifier.buildNotification(this, data, callStyle = callStyle)
        startForegroundCompat(notification)
        return true
      } catch (error: Exception) {
        Log.e(TAG, "startForeground failed (callStyle=$callStyle)", error)
      }
    }
    return false
  }

  private fun startForegroundCompat(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        currentNotificationId,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      )
    } else {
      startForeground(currentNotificationId, notification)
    }
  }

  override fun onDestroy() {
    running = false
    stopRingingInternal()
    super.onDestroy()
  }

  private fun startRingtone(ringtoneId: String) {
    stopRingingInternal()
    val resName = "ringtone_" + ringtoneId.filter { it.isDigit() }.ifEmpty { "1" }
    val resId = resources.getIdentifier(resName, "raw", packageName)
    if (resId == 0) return
    try {
      player = MediaPlayer().apply {
        try {
          setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          )
        } catch (aaEx: Exception) {
          // Ignore audio attributes failures on old devices
        }

        try {
          setDataSource(this@IncomingCallRingService, Uri.parse("android.resource://$packageName/$resId"))
        } catch (dsEx: Exception) {
          // Failed to set data source - abort
          Log.e(TAG, "Failed to set data source for ringtone: $resName", dsEx)
          return
        }

        isLooping = true

        try {
          setOnPreparedListener { mp ->
            try {
              mp.start()
            } catch (startEx: Exception) {
              Log.e(TAG, "Failed to start ringtone playback", startEx)
            }
          }
          prepareAsync()
        } catch (prepEx: Exception) {
          // Fallback to synchronous prepare/start on devices where async fails
          try {
            prepare()
            start()
          } catch (syncEx: Exception) {
            Log.e(TAG, "Ringtone prepare/start failed", syncEx)
          }
        }
      }
    } catch (outer: Exception) {
      Log.e(TAG, "Unexpected error starting ringtone", outer)
    }
  }

  private fun stopRinging() {
    stopRingingInternal()
    try {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (_: Exception) {
    }
    stopSelf()
  }

  private fun stopRingingInternal() {
    ringStopHandler.removeCallbacks(ringStopRunnable)
    try {
      player?.stop()
    } catch (_: Exception) {
    }
    try {
      // Remove listeners to avoid callbacks after release
      try { player?.setOnPreparedListener(null) } catch (_: Exception) {}
      player?.release()
    } catch (_: Exception) {
    }
    player = null
  }

  companion object {
    private const val TAG = "IncomingCallRingService"
    const val ACTION_STOP = "com.connect.app.STOP_INCOMING_CALL"
    const val DEFAULT_NOTIFICATION_ID = 41001
    // Matches the server's ring timeout (CALL_RING_TIMEOUT_MS, 60 s by default).
    const val CALL_RING_DURATION_MS = 60_000L

    @Volatile private var running = false

    fun notificationIdFor(channelName: String): Int {
      if (channelName.isEmpty()) return DEFAULT_NOTIFICATION_ID
      return DEFAULT_NOTIFICATION_ID + (channelName.hashCode() and 0xfff)
    }

    /** @return false when Android refused to start the foreground service. */
    fun start(context: Context, data: Map<String, String>): Boolean {
      val intent = Intent(context, IncomingCallRingService::class.java)
      IncomingCallStore.putCallExtras(intent, data, "incoming_call", false)
      return try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        running = true
        true
      } catch (error: Exception) {
        // ForegroundServiceStartNotAllowedException (Android 12+) when the
        // push was not delivered with high priority, or IllegalStateException.
        Log.e(TAG, "Could not start the ring service", error)
        false
      }
    }

    fun stop(context: Context) {
      if (!running) return
      try {
        context.startService(Intent(context, IncomingCallRingService::class.java).setAction(ACTION_STOP))
      } catch (_: Exception) {
      }
      try {
        context.stopService(Intent(context, IncomingCallRingService::class.java))
      } catch (_: Exception) {
      }
    }
  }
}
