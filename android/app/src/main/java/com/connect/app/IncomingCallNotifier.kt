package com.connect.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person

/**
 * Incoming call UI while the React Native app is not running (swiped away /
 * process killed). Rings through [IncomingCallRingService], posts a call-style
 * notification with a full-screen intent, and opens the call screen directly
 * when Android allows it.
 */
object IncomingCallNotifier {
  private const val TAG = "IncomingCallNotifier"

  // The ring service plays the ringtone itself, so its notification channel
  // stays silent. (The JS-created incoming_calls_r*_v7 channels carry a sound
  // and would ring a second time on top of the service.)
  private const val SILENT_CHANNEL_ID = "incoming_calls_native_silent_v1"

  // Only used when the ring service cannot start: the channel sound, looped
  // with FLAG_INSISTENT, is the ringtone.
  private const val RINGING_CHANNEL_PREFIX = "incoming_calls_native_ring_r"

  private val VIBRATION = longArrayOf(0, 400, 200, 400, 200, 400)

  @Volatile var activeCallerId: String? = null
    private set
  @Volatile var activeChannelName: String? = null
    private set

  fun hasActiveCall(): Boolean = activeCallerId != null || activeChannelName != null

  fun show(context: Context, data: Map<String, String>) {
    activeCallerId = (data["callerId"] ?: data["from"]).orEmpty()
    activeChannelName = data["channelName"].orEmpty()
    if (!IncomingCallRingService.start(context, data)) {
      // Background start limits refused the foreground service: let the
      // notification ring by itself.
      postWithoutService(context, data)
      launchCallScreen(context, data)
    }
  }

  fun cancel(context: Context, channelName: String? = null) {
    val ringingChannel = activeChannelName
    clearActive()
    IncomingCallRingService.stop(context)
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    listOf(channelName, ringingChannel)
      .filterNot { it.isNullOrEmpty() }
      .distinct()
      .forEach { manager.cancel(IncomingCallRingService.notificationIdFor(it!!)) }
    manager.cancel(IncomingCallRingService.DEFAULT_NOTIFICATION_ID)
  }

  /** Caller hung up or the call timed out: stop ringing if it is this caller's call. */
  fun cancelIfRingingFor(context: Context, callerId: String?) {
    if (callerId.isNullOrEmpty() || activeCallerId != callerId) return
    IncomingCallStore.discardPendingOpenFor(context, callerId)
    cancel(context, null)
    LockScreenCallMode.releaseIfNoCall()
  }

  internal fun clearActive() {
    activeCallerId = null
    activeChannelName = null
  }

  /**
   * Open the call screen now. A full-screen intent only opens the activity
   * while the device is locked or the screen is off; when the phone is in use
   * Android shows a heads-up notification instead. Starting an activity from
   * the background is allowed once the user granted "Display over other apps"
   * (and always before Android 10).
   */
  fun launchCallScreen(context: Context, data: Map<String, String>) {
    val allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || Settings.canDrawOverlays(context)
    if (!allowed) return
    try {
      context.startActivity(callScreenIntent(context, data, "incoming_call", false))
    } catch (error: Exception) {
      Log.w(TAG, "Could not open the incoming call screen", error)
    }
  }

  /** Fallback when [IncomingCallRingService] cannot run. */
  fun postWithoutService(context: Context, data: Map<String, String>) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val id = IncomingCallRingService.notificationIdFor(data["channelName"] ?: "")
    for (callStyle in listOf(true, false)) {
      try {
        val notification = buildNotification(context, data, ringing = true, callStyle = callStyle)
        notification.flags = notification.flags or Notification.FLAG_INSISTENT
        manager.notify(id, notification)
        return
      } catch (error: Exception) {
        Log.e(TAG, "Failed to post incoming call notification (callStyle=$callStyle)", error)
      }
    }
  }

  /**
   * @param ringing true when the notification itself must ring (no ring
   * service). It then times out after the ring window and has no delete
   * intent, so the timeout is not reported to the caller as a decline.
   * @param callStyle false builds a plain notification with Accept/Decline
   * actions, for when Android rejects the call style.
   */
  fun buildNotification(
    context: Context,
    data: Map<String, String>,
    ringing: Boolean = false,
    callStyle: Boolean = true
  ): Notification {
    val ringtoneId = ringtoneIdOf(data)
    val channelId = if (ringing) ensureRingingChannel(context, ringtoneId) else ensureSilentChannel(context)
    val callerName = data["callerName"]?.takeIf { it.isNotBlank() } ?: "Someone"
    val isAudio = data["isAudio"] != "false"
    val callLabel = if (isAudio) "Incoming audio call" else "Incoming video call"
    val channelName = data["channelName"] ?: ""
    val notificationId = IncomingCallRingService.notificationIdFor(channelName)
    val flags = pendingFlags()

    val acceptPi = PendingIntent.getActivity(
      context, notificationId + 1, callScreenIntent(context, data, "accept_call", true), flags
    )
    val openPi = PendingIntent.getActivity(
      context, notificationId + 2, callScreenIntent(context, data, "incoming_call", false), flags
    )
    val declineIntent = Intent(context, CallActionReceiver::class.java).apply {
      action = CallActionReceiver.ACTION_DECLINE
      IncomingCallStore.putCallExtras(this, data, "decline_call", false)
    }
    val declinePi = PendingIntent.getBroadcast(context, notificationId + 3, declineIntent, flags)

    fun baseBuilder(): NotificationCompat.Builder {
      val builder = NotificationCompat.Builder(context, channelId)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(callerName)
        .setContentText(callLabel)
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setOngoing(true)
        .setAutoCancel(false)
        .setContentIntent(openPi)
        .setFullScreenIntent(openPi, true)
        .setColor(0xFFE53935.toInt())
        .setVibrate(VIBRATION)
      if (ringing) {
        builder.setSound(ringtoneUri(context, ringtoneId))
        builder.setTimeoutAfter(IncomingCallRingService.CALL_RING_DURATION_MS)
      } else {
        builder.setDeleteIntent(declinePi)
      }
      return builder
    }

    // Call style ranks the notification as a call, keeps the heads-up on
    // screen and stops Android 14+ from letting it be swiped away.
    if (callStyle) {
      try {
        val caller = Person.Builder().setName(callerName).setImportant(true).build()
        return baseBuilder()
          .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declinePi, acceptPi))
          .build()
      } catch (error: Exception) {
        Log.w(TAG, "Call style unavailable, using a plain call notification", error)
      }
    }
    return baseBuilder()
      .addAction(0, "Accept", acceptPi)
      .addAction(0, "Decline", declinePi)
      .build()
  }

  private fun callScreenIntent(
    context: Context,
    data: Map<String, String>,
    callAction: String,
    autoAccept: Boolean
  ): Intent {
    return Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      IncomingCallStore.putCallExtras(this, data, callAction, autoAccept)
    }
  }

  private fun ringtoneIdOf(data: Map<String, String>): String =
    (data["ringtoneId"] ?: "1").filter { it.isDigit() }.ifEmpty { "1" }

  private fun ringtoneUri(context: Context, ringtoneId: String): Uri {
    val resId = context.resources.getIdentifier("ringtone_$ringtoneId", "raw", context.packageName)
    return if (resId != 0) {
      Uri.parse("android.resource://${context.packageName}/$resId")
    } else {
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    }
  }

  private fun ensureSilentChannel(context: Context): String {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(SILENT_CHANNEL_ID) == null) {
        manager.createNotificationChannel(
          NotificationChannel(SILENT_CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Incoming audio and video calls"
            setBypassDnd(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = VIBRATION
            setSound(null, null)
          }
        )
      }
    }
    return SILENT_CHANNEL_ID
  }

  private fun ensureRingingChannel(context: Context, ringtoneId: String): String {
    val channelId = "${RINGING_CHANNEL_PREFIX}${ringtoneId}_v1"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(channelId) == null) {
        manager.createNotificationChannel(
          NotificationChannel(channelId, "Incoming calls (ringtone)", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Incoming calls when the ringtone cannot play in the background"
            setBypassDnd(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = VIBRATION
            setSound(
              ringtoneUri(context, ringtoneId),
              AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            )
          }
        )
      }
    }
    return channelId
  }

  private fun pendingFlags(): Int {
    return PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  }
}
