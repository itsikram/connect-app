package com.connect.app

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Connect"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Set the status bar to be transparent and draw system bar backgrounds
    // This ensures proper status bar handling with React Native's StatusBar component
    
    // NotificationService removed - all background notifications are now handled by 
    // react-native-background-actions plugin (pushBackgroundService.ts)
    
    // Handle incoming call intents when app is launched from notification
    handleIncomingCallIntent(intent)
  }
  
  private fun handleIncomingCallIntent(intent: Intent?) {
    if (intent == null) return
    
    // Handle incoming call intents (check both "type" and "action" for compatibility)
    val callType = intent.getStringExtra("type")
    val callAction = intent.getStringExtra("action")
    if (callType == "incoming_call" || callAction == "incoming_call") {
      Log.d("MainActivity", "Received incoming call intent in onCreate - type: $callType, action: $callAction")
      // The React Native side will handle the navigation via useNotifications hook
      // This just ensures the app is brought to foreground
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)

    // Handle incoming call intents when app is already running
    handleIncomingCallIntent(intent)
  }
}
