package com.connect.overlay

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

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
}



