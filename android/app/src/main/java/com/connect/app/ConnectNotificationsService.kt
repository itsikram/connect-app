package com.connect.app

import android.content.Context
import expo.modules.notifications.notifications.model.Notification
import expo.modules.notifications.notifications.model.NotificationBehaviorRecord
import expo.modules.notifications.notifications.model.triggers.FirebaseNotificationTrigger
import expo.modules.notifications.service.NotificationsService
import expo.modules.notifications.service.delegates.ExpoPresentationDelegate
import expo.modules.notifications.service.interfaces.PresentationDelegate

/**
 * Replaces Expo's NotificationsService receiver (see AndroidManifest.xml) so
 * chat pushes are drawn as conversations with the sender's photo. Everything
 * else (foreground handler, taps, scheduling) is still Expo's.
 */
class ConnectNotificationsService : NotificationsService() {
  override fun getPresentationDelegate(context: Context): PresentationDelegate =
    ConnectPresentationDelegate(context)
}

class ConnectPresentationDelegate(context: Context) : ExpoPresentationDelegate(context) {
  override suspend fun createNotification(
    notification: Notification,
    notificationBehavior: NotificationBehaviorRecord?
  ): android.app.Notification {
    val built = super.createNotification(notification, notificationBehavior)
    val data = (notification.notificationRequest.trigger as? FirebaseNotificationTrigger)
      ?.remoteMessage?.data ?: return built
    return ConversationNotifications.restyle(context, built, data)
  }
}
