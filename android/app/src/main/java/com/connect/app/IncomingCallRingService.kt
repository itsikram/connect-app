package com.connect.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder

class IncomingCallRingService : Service() {
  private var player: MediaPlayer? = null
  private var currentNotificationId = DEFAULT_NOTIFICATION_ID

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
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
    val notification = IncomingCallNotifier.buildNotification(this, data)

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          currentNotificationId,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        )
      } else {
        startForeground(currentNotificationId, notification)
      }
    } catch (error: Exception) {
      startForeground(currentNotificationId, notification)
    }

    startRingtone(data["ringtoneId"] ?: "1")
    return START_STICKY
  }

  override fun onDestroy() {
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
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        setDataSource(this@IncomingCallRingService, Uri.parse("android.resource://$packageName/$resId"))
        isLooping = true
        prepare()
        start()
      }
    } catch (_: Exception) {
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
    try {
      player?.stop()
    } catch (_: Exception) {
    }
    try {
      player?.release()
    } catch (_: Exception) {
    }
    player = null
  }

  companion object {
    const val ACTION_STOP = "com.connect.app.STOP_INCOMING_CALL"
    const val DEFAULT_NOTIFICATION_ID = 41001

    fun notificationIdFor(channelName: String): Int {
      if (channelName.isEmpty()) return DEFAULT_NOTIFICATION_ID
      return DEFAULT_NOTIFICATION_ID + (channelName.hashCode() and 0xfff)
    }

    fun start(context: Context, data: Map<String, String>) {
      val intent = Intent(context, IncomingCallRingService::class.java)
      IncomingCallStore.putCallExtras(intent, data, "incoming_call", false)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
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
