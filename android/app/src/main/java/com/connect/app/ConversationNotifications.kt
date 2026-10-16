package com.connect.app

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat

/**
 * Chat pushes as Android conversation notifications. A plain notification
 * always shows the app logo on the left, with the sender's photo only as a
 * small picture on the right. A MessagingStyle notification tied to a
 * long-lived conversation shortcut shows the sender's photo in place of the
 * logo (Android 11+; older versions show it next to the message).
 */
object ConversationNotifications {
  private const val TAG = "ConnectConversation"
  private val CHAT_TYPES = setOf("chat", "message", "new_message")
  private const val MAX_MESSAGES = 6

  /** [notification] restyled as a conversation with the sender in [data], or unchanged. */
  fun restyle(context: Context, notification: Notification, data: Map<String, String>): Notification {
    if (data["type"] !in CHAT_TYPES) return notification
    val senderId = data["senderId"]?.takeIf { it.isNotBlank() } ?: return notification
    val name = (data["senderName"]?.takeIf { it.isNotBlank() } ?: data["title"])
      ?.takeIf { it.isNotBlank() } ?: return notification
    val text = data["body"] ?: data["message"] ?: ""

    return try {
      val avatar = NotificationAvatar.load(data["image"])?.let { IconCompat.createWithBitmap(it) }
      val sender = Person.Builder()
        .setKey(senderId)
        .setName(name)
        .setIcon(avatar)
        .setImportant(true)
        .build()
      val shortcut = publishShortcut(context, "chat_$senderId", sender, avatar)

      // One notification per conversation: earlier unread messages from this
      // sender move into the new one, which replaces them.
      val manager = context.getSystemService(NotificationManager::class.java)
      val earlier = manager.activeNotifications
        .filter { NotificationCompat.getShortcutId(it.notification) == shortcut.id }
        .sortedBy { it.postTime }
      val style = NotificationCompat.MessagingStyle(Person.Builder().setName("You").build())
      earlier
        .flatMap {
          NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(it.notification)
            ?.messages.orEmpty()
        }
        .takeLast(MAX_MESSAGES - 1)
        .forEach { style.addMessage(it) }
      style.addMessage(text, System.currentTimeMillis(), sender)

      val restyled = NotificationCompat.Builder(context, notification)
        .setStyle(style)
        .setShortcutInfo(shortcut)
        .setCategory(NotificationCompat.CATEGORY_MESSAGE)
        .apply {
          // The photo is now on the person; don't repeat it on the right.
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) setLargeIcon(null as Bitmap?)
        }
        .build()
      earlier.forEach { manager.cancel(it.tag, it.id) }
      restyled
    } catch (e: Exception) {
      Log.w(TAG, "Showing the plain chat notification instead", e)
      notification
    }
  }

  private fun publishShortcut(
    context: Context,
    id: String,
    sender: Person,
    avatar: IconCompat?
  ): ShortcutInfoCompat {
    val shortcut = ShortcutInfoCompat.Builder(context, id)
      .setShortLabel(sender.name ?: "Chat")
      .setLongLived(true)
      .setPerson(sender)
      .setIcon(avatar ?: IconCompat.createWithResource(context, R.mipmap.ic_launcher))
      .setIntent(Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW))
      .build()
    try {
      ShortcutManagerCompat.pushDynamicShortcut(context, shortcut)
    } catch (e: Exception) {
      // Still a normal MessagingStyle notification, just not a conversation.
      Log.w(TAG, "Could not publish conversation shortcut", e)
    }
    return shortcut
  }
}
