package com.connect.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

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

    // Notifications from a person arrive data-only with their avatar in
    // `image` (see avatarMulticastPayload on the server), so the OS never
    // draws them with the app logo. Hand them to Expo as a notification
    // message: it shows the image as the large icon and keeps the JS
    // foreground handler and tap navigation working.
    if (remoteMessage.notification == null && !data["image"].isNullOrBlank() && !data["title"].isNullOrBlank()) {
      super.onMessageReceived(withAvatarNotification(remoteMessage))
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

  /** Same message plus FCM notification fields (`gcm.n.*`) built from its data. */
  private fun withAvatarNotification(remoteMessage: RemoteMessage): RemoteMessage {
    val data = remoteMessage.data
    val bundle = Bundle(remoteMessage.toIntent().extras ?: Bundle())
    bundle.putString("gcm.n.e", "1")
    bundle.putString("gcm.n.title", data["title"])
    bundle.putString("gcm.n.body", data["body"] ?: data["message"] ?: "")
    bundle.putString("gcm.n.image", data["image"])
    bundle.putString("gcm.n.android_channel_id", data["channelId"] ?: "messages_chat_peek_v3")
    bundle.putString("gcm.n.sound2", "default")
    return RemoteMessage(bundle)
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
    NotificationAvatar.load(data["image"])?.let { builder.setLargeIcon(it) }

    manager.notify(notificationId, builder.build())
  }
}
