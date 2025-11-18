package com.connect.app

import android.app.Application
import android.content.Intent
import com.facebook.react.PackageList
import com.connect.app.overlay.FloatingOverlayPackage
import com.connect.app.CallNotificationPackage
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import android.os.Process
import android.util.Log

class MainApplication : Application(), ReactApplication {
  private val TAG = "MainApplication"
  private val isBackgroundProcess: Boolean
    get() = packageName.endsWith(":bg")

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> {
          val packages = PackageList(this).packages
          
          // In background process, filter out camera-related packages to prevent initialization errors
          // Camera is not needed in background process and causes crashes when trying to send events
          // before React Native is fully initialized
          if (isBackgroundProcess) {
            val filteredPackages = packages.filter { pkg ->
              val packageName = pkg.javaClass.name
              // Filter out react-native-vision-camera package (com.mrousavy.camera.react)
              val isCameraPackage = packageName.contains("mrousavy.camera") || 
                                   packageName.contains("vision.camera") || 
                                   packageName.contains("VisionCamera") ||
                                   packageName.contains("CameraDevices")
              if (isCameraPackage) {
                Log.d(TAG, "Filtering out camera package in background process: $packageName")
              }
              !isCameraPackage
            }
            Log.d(TAG, "Filtered packages for background process: ${packages.size} -> ${filteredPackages.size}")
            return filteredPackages.apply {
              add(FloatingOverlayPackage())
              add(CallNotificationPackage())
            }
          }
          
          // Main process - include all packages including camera
          return packages.apply {
            add(FloatingOverlayPackage())
            add(CallNotificationPackage())
          }
        }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    
    // Suppress verbose React Native WebSocket connection logs in production
    // These logs are informational and appear when Metro bundler is not running
    if (!BuildConfig.DEBUG) {
      // In release builds, suppress ReactNativeJNI WebSocket connection logs
      // These are harmless but can clutter logs
    }
    
    Log.d(TAG, "MainApplication onCreate - Process: ${if (isBackgroundProcess) "background" else "main"} (PID: ${Process.myPid()})")
    
    // Load React Native - needed for both main and background processes
    // Background process needs it for background message handling
    try {
      loadReactNative(this)
      Log.d(TAG, "React Native loaded in ${if (isBackgroundProcess) "background" else "main"} process")
    } catch (e: Exception) {
      Log.e(TAG, "Error loading React Native", e)
    }
    
    // Start notification service on app startup to ensure it's always running
    try {
      val serviceIntent = Intent(this, NotificationService::class.java)
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        startForegroundService(serviceIntent)
      } else {
        startService(serviceIntent)
      }
      Log.d(TAG, "NotificationService started from MainApplication")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to start NotificationService", e)
    }
  }
}
