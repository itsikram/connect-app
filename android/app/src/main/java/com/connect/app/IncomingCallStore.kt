package com.connect.app

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import org.json.JSONObject

object IncomingCallStore {
  private const val PREFS = "incoming_call_store"
  private const val KEY_API = "api_base_url"
  private const val KEY_AUTH = "auth_token"
  private const val KEY_PENDING = "pending_action"
  @Volatile var reactRunning: Boolean = false

  private fun prefs(context: Context): SharedPreferences {
    return context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  }

  fun savePushConfig(context: Context, apiBaseUrl: String?, authToken: String?) {
    prefs(context).edit()
      .putString(KEY_API, apiBaseUrl ?: "")
      .putString(KEY_AUTH, authToken ?: "")
      .apply()
  }

  fun clearPushConfig(context: Context) {
    prefs(context).edit()
      .remove(KEY_API)
      .remove(KEY_AUTH)
      .apply()
  }

  fun apiBaseUrl(context: Context): String = prefs(context).getString(KEY_API, "") ?: ""

  fun authToken(context: Context): String = prefs(context).getString(KEY_AUTH, "") ?: ""

  fun savePendingFromIntent(context: Context, intent: Intent?) {
    if (intent == null) return
    val action = intent.getStringExtra("callAction")
      ?: intent.getStringExtra("action")
      ?: return
    if (action != "accept_call" && action != "decline_call" && action != "incoming_call") return

    val json = JSONObject()
    json.put("action", if (action == "incoming_call") "open" else action)
    json.put("callerId", intent.getStringExtra("callerId") ?: "")
    json.put("callerName", intent.getStringExtra("callerName") ?: "")
    json.put("callerProfilePic", intent.getStringExtra("callerProfilePic") ?: "")
    json.put("channelName", intent.getStringExtra("channelName") ?: "")
    json.put("isAudio", intent.getBooleanExtra("autoAudio", intent.getStringExtra("isAudio") != "false"))
    json.put("isAudioText", intent.getStringExtra("isAudio") ?: "true")
    json.put("ringtoneId", intent.getStringExtra("ringtoneId") ?: "1")
    json.put("autoAccept", action == "accept_call" || intent.getBooleanExtra("autoAccept", false))
    json.put("ts", System.currentTimeMillis())
    prefs(context).edit().putString(KEY_PENDING, json.toString()).apply()
  }

  fun savePendingJson(context: Context, json: String) {
    prefs(context).edit().putString(KEY_PENDING, json).apply()
  }

  fun peekPendingJson(context: Context): String? = prefs(context).getString(KEY_PENDING, null)

  fun consumePendingJson(context: Context): String? {
    val value = prefs(context).getString(KEY_PENDING, null)
    if (value != null) {
      prefs(context).edit().remove(KEY_PENDING).apply()
    }
    return value
  }

  fun putCallExtras(intent: Intent, data: Map<String, String>, callAction: String, autoAccept: Boolean) {
    val isAudio = data["isAudio"] != "false"
    intent.putExtra("type", "incoming_call")
    intent.putExtra("action", callAction)
    intent.putExtra("callAction", callAction)
    intent.putExtra("callerId", data["callerId"] ?: data["from"] ?: "")
    intent.putExtra("callerName", data["callerName"] ?: "Someone")
    intent.putExtra("callerProfilePic", data["callerProfilePic"] ?: "")
    intent.putExtra("channelName", data["channelName"] ?: "")
    intent.putExtra("isAudio", if (isAudio) "true" else "false")
    intent.putExtra("autoAudio", isAudio)
    intent.putExtra("ringtoneId", data["ringtoneId"] ?: "1")
    intent.putExtra("autoAccept", autoAccept)
  }
}
