package com.connect.app.overlay

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class FloatingOverlayModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "FloatingOverlay"

  @ReactMethod
  fun canDrawOverlays(promise: Promise) {
    val allowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(reactContext) else true
    promise.resolve(allowed)
  }

  @ReactMethod
  fun requestOverlayPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
      try {
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + reactContext.packageName))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("overlay_perm_error", e)
      }
    } else {
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun startOverlay(promise: Promise) {
    try {
      val intent = Intent(reactContext, FloatingOverlayService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(intent)
      } else {
        reactContext.startService(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("overlay_start_error", e)
    }
  }

  @ReactMethod
  fun stopOverlay(promise: Promise) {
    try {
      val intent = Intent(reactContext, FloatingOverlayService::class.java)
      reactContext.stopService(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("overlay_stop_error", e)
    }
  }

  @ReactMethod
  fun setMenuOptions(options: ReadableArray, promise: Promise) {
    try {
      val service = FloatingOverlayService.getInstance()
      if (service != null) {
        val menuOptionsList = mutableListOf<MenuOption>()
        for (i in 0 until options.size()) {
          val item = options.getMap(i)
          if (item != null) {
            val id = item.getString("id") ?: ""
            val label = item.getString("label") ?: ""
            val icon = item.getString("icon") ?: ""
            menuOptionsList.add(MenuOption(id, label, icon))
          }
        }
        
        service.setMenuOptions(menuOptionsList) { optionId ->
          // Send event to React Native when menu item is clicked
          sendMenuClickEvent(optionId)
        }
        promise.resolve(true)
      } else {
        promise.reject("service_not_running", "Floating overlay service is not running")
      }
    } catch (e: Exception) {
      promise.reject("menu_options_error", e)
    }
  }

  private fun sendMenuClickEvent(optionId: String) {
    val params = Arguments.createMap()
    params.putString("optionId", optionId)
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("FloatingOverlayMenuItemClick", params)
  }
}
