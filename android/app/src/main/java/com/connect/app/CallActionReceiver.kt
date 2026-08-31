package com.connect.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class CallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != ACTION_DECLINE) return

    IncomingCallStore.savePendingFromIntent(context, intent)
    val channelName = intent.getStringExtra("channelName")
    IncomingCallNotifier.cancel(context, channelName)

    val callerId = intent.getStringExtra("callerId") ?: return
    val channel = intent.getStringExtra("channelName") ?: return
    val isAudio = intent.getStringExtra("isAudio") ?: "true"
    rejectOnServer(context, callerId, channel, isAudio)
  }

  private fun rejectOnServer(context: Context, callerId: String, channelName: String, isAudio: String) {
    val apiBase = IncomingCallStore.apiBaseUrl(context)
    val authToken = IncomingCallStore.authToken(context)
    if (apiBase.isBlank() || authToken.isBlank()) return

    thread {
      try {
        val url = URL(apiBase.trimEnd('/') + "/notification/call/reject-push")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 15000
        conn.readTimeout = 15000
        conn.setRequestProperty("Authorization", authToken)
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true
        val body = JSONObject()
          .put("callerId", callerId)
          .put("channelName", channelName)
          .put("isAudio", isAudio)
          .toString()
        OutputStreamWriter(conn.outputStream).use { it.write(body) }
        conn.responseCode
        conn.disconnect()
      } catch (_: Exception) {
      }
    }
  }

  companion object {
    const val ACTION_DECLINE = "com.connect.app.DECLINE_INCOMING_CALL"
  }
}
