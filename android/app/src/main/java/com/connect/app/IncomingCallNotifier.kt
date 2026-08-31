package com.connect.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat

object IncomingCallNotifier {
  private const val CHANNEL_PREFIX = "incoming_calls_r"

  fun show(context: Context, data: Map<String, String>) {
    IncomingCallRingService.start(context, data)
  }

  fun cancel(context: Context, channelName: String? = null) {
    IncomingCallRingService.stop(context)
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (!channelName.isNullOrEmpty()) {
      manager.cancel(IncomingCallRingService.notificationIdFor(channelName))
    }
    manager.cancel(IncomingCallRingService.DEFAULT_NOTIFICATION_ID)
  }

  fun buildNotification(context: Context, data: Map<String, String>): Notification {
    val ringtoneId = (data["ringtoneId"] ?: "1").filter { it.isDigit() }.ifEmpty { "1" }
    val channelId = ensureChannel(context, ringtoneId)
    val callerName = data["callerName"] ?: "Someone"
    val isAudio = data["isAudio"] != "false"
    val title = if (isAudio) "Incoming audio call" else "Incoming video call"
    val channelName = data["channelName"] ?: ""
    val notificationId = IncomingCallRingService.notificationIdFor(channelName)
    val flags = pendingFlags()

    val acceptIntent = Intent(context, MainActivity::class.java).apply {
      this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      IncomingCallStore.putCallExtras(this, data, "accept_call", true)
    }
    val acceptPi = PendingIntent.getActivity(context, notificationId + 1, acceptIntent, flags)

    val openIntent = Intent(context, MainActivity::class.java).apply {
      this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      IncomingCallStore.putCallExtras(this, data, "incoming_call", false)
    }
    val openPi = PendingIntent.getActivity(context, notificationId + 2, openIntent, flags)

    val declineIntent = Intent(context, CallActionReceiver::class.java).apply {
      action = CallActionReceiver.ACTION_DECLINE
      IncomingCallStore.putCallExtras(this, data, "decline_call", false)
    }
    val declinePi = PendingIntent.getBroadcast(context, notificationId + 3, declineIntent, flags)

    val builder = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(title)
      .setContentText("$callerName is calling")
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(openPi)
      .setFullScreenIntent(openPi, true)
      .setDeleteIntent(declinePi)
      .addAction(0, "Accept", acceptPi)
      .addAction(0, "Decline", declinePi)
      .setColor(0xFFE53935.toInt())
      .setDefaults(0)

    return builder.build()
  }

  private fun ensureChannel(context: Context, ringtoneId: String): String {
    val channelId = "${CHANNEL_PREFIX}${ringtoneId}_v6"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(channelId) == null) {
        val channel = NotificationChannel(
          channelId,
          "Incoming Calls",
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = "Incoming audio and video calls"
          setBypassDnd(true)
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
          enableVibration(true)
          vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)
          val resId = context.resources.getIdentifier("ringtone_$ringtoneId", "raw", context.packageName)
          if (resId != 0) {
            val soundUri = Uri.parse("android.resource://${context.packageName}/$resId")
            val attrs = AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
            setSound(soundUri, attrs)
          }
        }
        manager.createNotificationChannel(channel)
      }
    }
    return channelId
  }

  private fun pendingFlags(): Int {
    return PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  }
}
