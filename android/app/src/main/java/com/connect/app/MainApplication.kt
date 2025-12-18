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
          val packages = PackageList(this).packages.toMutableList()
          
          // In background process, filter out camera-related packages to prevent initialization errors
          // Camera is not needed in background process and causes crashes when trying to send events
          // before React Native is fully initialized
          if (isBackgroundProcess) {
            val filteredPackages = packages.filter { pkg ->
              val packageName = pkg.javaClass.name
              val simpleName = pkg.javaClass.simpleName
              val packageNameLower = packageName.lowercase()
              val simpleNameLower = simpleName.lowercase()
              // Filter out react-native-vision-camera package (com.mrousavy.camera.react)
              // Check both full package name and simple class name for better coverage
              val isCameraPackage = packageNameLower.contains("mrousavy.camera") || 
                                   packageNameLower.contains("vision.camera") || 
                                   packageNameLower.contains("visioncamera") ||
                                   packageNameLower.contains("cameradevices") ||
                                   packageNameLower.contains("cameradevicesmanager") ||
                                   (simpleNameLower.contains("camera") && 
                                   (simpleNameLower.contains("device") || simpleNameLower.contains("vision") || simpleNameLower.contains("mrousavy")))
              if (isCameraPackage) {
                Log.w(TAG, "Filtering out camera package in background process: $packageName (simple: $simpleName)")
              }
              !isCameraPackage
            }.toMutableList()
            Log.d(TAG, "Filtered packages for background process: ${packages.size} -> ${filteredPackages.size}")
            filteredPackages.add(FloatingOverlayPackage())
            filteredPackages.add(CallNotificationPackage())
            return filteredPackages
          }
          
          // Main process - include all packages including camera
          packages.add(FloatingOverlayPackage())
          packages.add(CallNotificationPackage())
          return packages
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
    
    // Note: The "Failed to connect to localhost/127.0.0.1:8081" errors in logcat
    // are harmless - they occur when React Native tries to connect to Metro bundler
    // for debugging. In production builds (BuildConfig.DEBUG = false), getUseDeveloperSupport()
    // returns false, but React Native still attempts an initial connection.
    // These errors can be safely ignored and don't affect app functionality.
    
    Log.d(TAG, "MainApplication onCreate - Process: ${if (isBackgroundProcess) "background" else "main"} (PID: ${Process.myPid()})")
    
    // Load React Native - needed for both main and background processes
    // Background process needs it for background message handling
    try {
      loadReactNative(this)
      Log.d(TAG, "React Native loaded in ${if (isBackgroundProcess) "background" else "main"} process")
    } catch (e: Exception) {
      Log.e(TAG, "Error loading React Native in ${if (isBackgroundProcess) "background" else "main"} process", e)
      // In background process, don't crash the app if React Native fails to load
      // The background process might not always need React Native immediately
      if (isBackgroundProcess) {
        Log.w(TAG, "Background process React Native initialization failed, but continuing...")
        // Return early to prevent further initialization that depends on React Native
        return
      } else {
        // In main process, log the error but continue - app might still be usable
        Log.w(TAG, "Main process React Native initialization had errors, but continuing...")
      }
    }
    
    // NotificationService removed - all background notifications are now handled by 
    // react-native-background-actions plugin (pushBackgroundService.ts)
    // This avoids duplicate background service notifications
  }
}
