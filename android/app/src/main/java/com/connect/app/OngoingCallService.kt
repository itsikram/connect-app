package com.connect.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground service for the duration of an audio / video call.
 *
 * The call audio runs in a WebView (Agora Web SDK). Android 9+ stops an app
 * that is not visible from capturing the microphone, and Android 11+ only
 * allows it through a foreground service of type "microphone" started while
 * the app was on screen. Without it the other side hears silence as soon as
 * the screen is turned off or the user leaves the app mid-call. The service
 * also keeps the process from being frozen while the call runs.
 */
class OngoingCallService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val isVideo = intent?.getBooleanExtra(EXTRA_VIDEO, false) ?: false
    val peerName = intent?.getStringExtra(EXTRA_PEER)?.takeIf { it.isNotBlank() }
    val notification = buildNotification(peerName, isVideo)

    if (!enterForeground(notification)) {
      stopSelf()
    }
    return START_NOT_STICKY
  }

  /** Microphone first; media playback if Android refuses it (e.g. no mic permission yet). */
  private fun enterForeground(notification: Notification): Boolean {
    val types = when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ->
        listOf(ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ->
        listOf(ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
      else -> emptyList()
    }
    if (types.isEmpty()) {
      return try {
        startForeground(NOTIFICATION_ID, notification)
        true
      } catch (error: Exception) {
        Log.e(TAG, "startForeground failed", error)
        false
      }
    }
    for (type in types) {
      try {
        startForeground(NOTIFICATION_ID, notification, type)
        return true
      } catch (error: Exception) {
        Log.w(TAG, "startForeground failed (type=$type)", error)
      }
    }
    return false
  }

  private fun buildNotification(peerName: String?, isVideo: Boolean): Notification {
    ensureChannel()
    val openApp = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val openPi = PendingIntent.getActivity(
      this, NOTIFICATION_ID, openApp, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val label = if (isVideo) "Video call" else "Audio call"
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(peerName?.let { "$label with $it" } ?: "$label in progress")
      .setContentText("Tap to return to the call")
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setUsesChronometer(true)
      .setWhen(System.currentTimeMillis())
      .setContentIntent(openPi)
      .build()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Ongoing calls", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Shown while an audio or video call is in progress"
        setSound(null, null)
        enableVibration(false)
      }
    )
  }

  companion object {
    private const val TAG = "OngoingCallService"
    private const val CHANNEL_ID = "ongoing_calls_v1"
    private const val NOTIFICATION_ID = 42001
    private const val EXTRA_VIDEO = "isVideo"
    private const val EXTRA_PEER = "peerName"

    /** @return false when Android refused to start it (app not on screen). */
    fun start(context: Context, peerName: String?, isVideo: Boolean): Boolean {
      val intent = Intent(context, OngoingCallService::class.java)
        .putExtra(EXTRA_VIDEO, isVideo)
        .putExtra(EXTRA_PEER, peerName)
      return try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        true
      } catch (error: Exception) {
        Log.w(TAG, "Could not start the ongoing call service", error)
        false
      }
    }

    fun stop(context: Context) {
      try {
        context.stopService(Intent(context, OngoingCallService::class.java))
      } catch (_: Exception) {
      }
    }
  }
}
