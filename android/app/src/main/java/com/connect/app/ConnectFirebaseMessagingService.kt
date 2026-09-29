package com.connect.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Shader
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import java.net.HttpURLConnection
import java.net.URL

class ConnectFirebaseMessagingService : ExpoFirebaseMessagingService() {
  companion object {
    private const val TAG = "ConnectFCM"
    private const val PREFS = "connect_push"
    private const val TOKEN_KEY = "fcm_token"
  }

  override fun onNewToken(token: String) {
    super.onNewToken(token)
    // Persist rotation immediately. JavaScript re-registers this value with the
    // authenticated API the next time the user opens the app.
    getSharedPreferences(PREFS, MODE_PRIVATE)
      .edit()
      .putString(TOKEN_KEY, token)
      .apply()
    Log.i(TAG, "FCM token refreshed")
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    if (data["type"] == "incoming_call") {
      if (IncomingCallStore.reactRunning) {
        super.onMessageReceived(remoteMessage)
      } else {
        IncomingCallNotifier.show(applicationContext, data)
      }
      return
    }

    // A data-only FCM message cannot be rendered by Android automatically.
    // Render it here because this service is also invoked after the app is
    // swiped away and the React Native runtime is unavailable.
    if (remoteMessage.notification == null && data.isNotEmpty()) {
      showDataNotification(data)
      return
    }

    super.onMessageReceived(remoteMessage)
  }

  private fun showDataNotification(data: Map<String, String>) {
    val channelId = data["channelId"] ?: "messages_chat_peek_v3"
    val title = data["title"] ?: "Connect"
    val body = data["body"] ?: data["message"] ?: "You have a new notification"
    val notificationId = (data["messageId"] ?: System.currentTimeMillis().toString()).hashCode()

    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      manager.getNotificationChannel(channelId) == null
    ) {
      manager.createNotificationChannel(
        NotificationChannel(
          channelId,
          "Connect notifications",
          NotificationManager.IMPORTANCE_HIGH
        )
      )
    }

    val intent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_CLEAR_TOP or
        Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("notificationData", HashMap(data))
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      notificationId,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
    loadAvatar(data["image"])?.let { builder.setLargeIcon(it) }

    manager.notify(notificationId, builder.build())
  }

  /** Sender profile picture, cropped to a circle. Runs on the FCM worker thread. */
  private fun loadAvatar(url: String?): Bitmap? {
    if (url.isNullOrBlank() || !url.startsWith("http")) return null
    return try {
      val connection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 5000
        readTimeout = 5000
      }
      val source = connection.inputStream.use { BitmapFactory.decodeStream(it) } ?: return null
      val size = minOf(source.width, source.height)
      val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply {
          setLocalMatrix(Matrix().apply {
            setTranslate(-(source.width - size) / 2f, -(source.height - size) / 2f)
          })
        }
      }
      Canvas(output).drawCircle(size / 2f, size / 2f, size / 2f, paint)
      output
    } catch (e: Exception) {
      Log.w(TAG, "Failed to load notification avatar", e)
      null
    }
  }
}
