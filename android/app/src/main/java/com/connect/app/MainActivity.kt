package com.connect.app

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
        this,
        BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
        object : DefaultReactActivityDelegate(
            this,
            mainComponentName,
            fabricEnabled
        ) {})
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(null)
    handleIncomingCallIntent(intent)
  }

  private fun handleIncomingCallIntent(intent: Intent?) {
    if (intent == null) return

    val callType = intent.getStringExtra("type")
    val callAction = intent.getStringExtra("callAction") ?: intent.getStringExtra("action")
    val isCall = callType == "incoming_call" ||
        callAction == "incoming_call" ||
        callAction == "accept_call" ||
        callAction == "decline_call"
    if (!isCall) return

    Log.d("MainActivity", "Incoming call intent action=$callAction")
    IncomingCallStore.savePendingFromIntent(this, intent)
    IncomingCallNotifier.cancel(this, intent.getStringExtra("channelName"))

    val pendingJson = IncomingCallStore.peekPendingJson(this)
    val payload = CallNotificationModule.jsonToMap(pendingJson)
    if (payload != null) {
      CallNotificationModule.emitIncomingCallAction(payload)
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIncomingCallIntent(intent)
  }

  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }
    super.invokeDefaultOnBackPressed()
  }
}
