package com.connect.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.res.Configuration
import android.os.Process
import android.util.Log
import android.os.Build
import com.connect.app.CallNotificationPackage
import com.connect.app.overlay.FloatingOverlayPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {
  private val TAG = "MainApplication"
  private val isBackgroundProcess: Boolean
    get() = packageName.endsWith(":bg")

  override val reactNativeHost: ReactNativeHost =
      ReactNativeHostWrapper(
          this,
          object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> {
              val packages = PackageList(this).packages.toMutableList()

              if (isBackgroundProcess) {
                Log.d(TAG, "All packages before filtering (${packages.size} total):")
                packages.forEach { pkg ->
                  Log.d(TAG, "  - ${pkg.javaClass.name}")
                }

                val filteredPackages = packages.filter { pkg ->
                  val packageName = pkg.javaClass.name
                  val simpleName = pkg.javaClass.simpleName
                  val packageNameLower = packageName.lowercase()
                  val simpleNameLower = simpleName.lowercase()

                  val isCameraPackage = packageNameLower.contains("mrousavy") ||
                      packageNameLower.contains("vision.camera") ||
                      packageNameLower.contains("visioncamera") ||
                      packageNameLower.contains("cameradevices") ||
                      packageNameLower.contains("cameradevicesmanager") ||
                      packageNameLower.contains("camera.react") ||
                      packageNameLower.contains("react.camera") ||
                      simpleNameLower == "visioncamerapackage" ||
                      simpleNameLower.contains("visioncamera") ||
                      simpleNameLower.contains("camerapackage") ||
                      (simpleNameLower.contains("camera") &&
                          (simpleNameLower.contains("device") ||
                              simpleNameLower.contains("vision") ||
                              simpleNameLower.contains("mrousavy") ||
                              simpleNameLower.contains("react") ||
                              simpleNameLower.contains("package")))

                  if (isCameraPackage) {
                    Log.w(TAG, "Filtering out camera package in background process: $packageName (simple: $simpleName)")
                  }
                  !isCameraPackage
                }.toMutableList()

                val remainingCameraPackages = filteredPackages.filter { pkg ->
                  val name = pkg.javaClass.name.lowercase()
                  name.contains("mrousavy") || name.contains("visioncamera") || name.contains("camera.react")
                }
                remainingCameraPackages.forEach { filteredPackages.remove(it) }

                filteredPackages.add(FloatingOverlayPackage())
                filteredPackages.add(CallNotificationPackage())
                return filteredPackages
              }

              packages.add(FloatingOverlayPackage())
              packages.add(CallNotificationPackage())
              return packages
            }

            override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
          }
      )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(
        NotificationChannel(
          "messages_chat_peek_v3",
          "Chat messages",
          NotificationManager.IMPORTANCE_HIGH
        )
      )
    }

    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }

    Log.d(TAG, "MainApplication onCreate - Process: ${if (isBackgroundProcess) "background" else "main"} (PID: ${Process.myPid()})")

    try {
      loadReactNative(this)
      Log.d(TAG, "React Native loaded in ${if (isBackgroundProcess) "background" else "main"} process")
    } catch (e: Exception) {
      Log.e(TAG, "Error loading React Native in ${if (isBackgroundProcess) "background" else "main"} process", e)
      if (isBackgroundProcess) {
        Log.w(TAG, "Background process React Native initialization failed, but continuing...")
        return
      }
      Log.w(TAG, "Main process React Native initialization had errors, but continuing...")
    }

    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
