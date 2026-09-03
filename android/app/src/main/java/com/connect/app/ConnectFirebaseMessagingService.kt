package com.connect.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

class ConnectFirebaseMessagingService : ExpoFirebaseMessagingService() {
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

    val notification = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .build()

    manager.notify(notificationId, notification)
  }
}
