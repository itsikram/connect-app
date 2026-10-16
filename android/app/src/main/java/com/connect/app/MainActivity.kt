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
    LockScreenCallMode.attach(this)
    handleIncomingCallIntent(intent)
  }

  override fun onDestroy() {
    LockScreenCallMode.detach(this)
    super.onDestroy()
  }

  private fun handleIncomingCallIntent(intent: Intent?) {
    val callType = intent?.getStringExtra("type")
    val callAction = intent?.getStringExtra("callAction") ?: intent?.getStringExtra("action")
    val isCall = callType == "incoming_call" ||
        callAction == "incoming_call" ||
        callAction == "accept_call" ||
        callAction == "decline_call"
    if (intent == null || !isCall) {
      // Not a call: keep the app behind the lock screen (asks to unlock if locked).
      LockScreenCallMode.onNonCallIntent(this)
      return
    }

    Log.d("MainActivity", "Incoming call intent action=$callAction")
    // Show over the lock screen and wake the display before the first frame.
    if (callAction == "decline_call") {
      LockScreenCallMode.releaseIfNoCall()
    } else {
      LockScreenCallMode.onCallIntent(ringing = callAction != "accept_call")
    }
    IncomingCallStore.savePendingFromIntent(this, intent)
    // Accept / decline end the native ringing here. When the call screen is
    // only being shown, keep ringing (and keep the Accept/Decline
    // notification) until the JS call screen takes over and calls
    // CallNotificationModule.cancelNativeIncomingCall, so a cold start does
    // not go silent while React Native loads.
    if (callAction == "accept_call" || callAction == "decline_call") {
      IncomingCallNotifier.cancel(this, intent.getStringExtra("channelName"))
    }

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
