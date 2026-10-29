package com.connect.app.update

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Self-update for the sideloaded APK: downloads the APK set in admin
 * (Settings → General → APK URL) and installs it with PackageInstaller.
 *
 * On Android 12+ an update of an app that installed itself needs no tap, so
 * after the first self-update later ones install silently. Otherwise Android
 * shows its own install confirmation.
 */
class AppUpdateModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  init {
    instance = this
  }

  override fun getName(): String = "AppUpdate"

  @ReactMethod
  fun getInstalledVersion(promise: Promise) {
    try {
      val info = installedPackageInfo(reactContext)
      val map = Arguments.createMap()
      map.putString("versionName", info.versionName ?: "")
      map.putDouble("versionCode", versionCodeOf(info).toDouble())
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("version_error", e)
    }
  }

  /** Whether the user allowed this app to install apps ("Install unknown apps"). */
  @ReactMethod
  fun canInstallPackages(promise: Promise) {
    val allowed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactContext.packageManager.canRequestPackageInstalls()
    } else {
      true
    }
    promise.resolve(allowed)
  }

  @ReactMethod
  fun openInstallPermissionSettings(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(false)
      return
    }
    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:" + reactContext.packageName)
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("settings_error", e)
    }
  }

  /**
   * Downloads [url] and starts installing it. Resolves once the install
   * session is committed; the outcome arrives as an "AppUpdateStatus" event.
   * Rejects with "not_newer" when the APK is not a newer build of this app.
   */
  @ReactMethod
  fun downloadAndInstall(url: String, version: String, promise: Promise) {
    if (!running.compareAndSet(false, true)) {
      promise.reject("busy", "An update is already downloading")
      return
    }
    Thread {
      try {
        val apk = download(url, version)
        checkIsNewerBuild(apk)
        emitStatus("installing", null)
        install(apk)
        promise.resolve(true)
      } catch (e: NotNewerException) {
        promise.reject("not_newer", e.message)
      } catch (e: Exception) {
        Log.e(TAG, "Update failed", e)
        promise.reject("update_error", e.message ?: "Update failed")
      } finally {
        running.set(false)
      }
    }.start()
  }

  // Required by NativeEventEmitter.
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Double) {}

  private fun download(url: String, version: String): File {
    val dir = File(reactContext.cacheDir, "updates").apply { mkdirs() }
    val safeVersion = version.replace(Regex("[^0-9A-Za-z._-]"), "").ifEmpty { "latest" }
    val target = File(dir, "Connect-$safeVersion.apk")
    // Drop APKs of older updates.
    dir.listFiles()?.forEach { if (it != target) it.delete() }

    // Already downloaded on an earlier launch.
    if (target.exists() && archiveInfo(target) != null) {
      emitProgress(1.0)
      return target
    }

    val part = File(dir, target.name + ".part")
    val connection = openFollowingRedirects(url)
    try {
      val total = connection.contentLengthLong
      var written = 0L
      var lastEmit = 0L
      connection.inputStream.use { input ->
        part.outputStream().use { output ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            output.write(buffer, 0, read)
            written += read
            val now = System.currentTimeMillis()
            if (total > 0 && now - lastEmit > 250) {
              lastEmit = now
              emitProgress(written.toDouble() / total)
            }
          }
        }
      }
      if (total > 0 && written != total) {
        throw IllegalStateException("Download incomplete ($written of $total bytes)")
      }
    } catch (e: Exception) {
      part.delete()
      throw e
    } finally {
      connection.disconnect()
    }

    if (!part.renameTo(target)) {
      part.delete()
      throw IllegalStateException("Could not save the update")
    }
    emitProgress(1.0)
    return target
  }

  // HttpURLConnection does not follow redirects between http and https, and
  // APK hosts (GitHub releases, Drive, CDNs) usually redirect.
  private fun openFollowingRedirects(url: String): HttpURLConnection {
    var current = URL(url)
    repeat(MAX_REDIRECTS) {
      val connection = (current.openConnection() as HttpURLConnection).apply {
        connectTimeout = 15_000
        readTimeout = 30_000
        instanceFollowRedirects = false
      }
      val code = connection.responseCode
      if (code in 300..399) {
        val location = connection.getHeaderField("Location")
        connection.disconnect()
        if (location.isNullOrEmpty()) throw IllegalStateException("Redirect without location")
        current = URL(current, location)
        return@repeat
      }
      if (code != HttpURLConnection.HTTP_OK) {
        connection.disconnect()
        throw IllegalStateException("Download failed (HTTP $code)")
      }
      return connection
    }
    throw IllegalStateException("Too many redirects")
  }

  /** Guards against a wrong APK URL or an admin version newer than the APK. */
  private fun checkIsNewerBuild(apk: File) {
    val archive = archiveInfo(apk)
    if (archive == null) {
      apk.delete()
      throw IllegalStateException("The downloaded file is not a valid APK")
    }
    if (archive.packageName != reactContext.packageName) {
      apk.delete()
      throw IllegalStateException("The APK is for another app (${archive.packageName})")
    }
    val installed = installedPackageInfo(reactContext)
    val archiveCode = versionCodeOf(archive)
    val installedCode = versionCodeOf(installed)
    val sameBuild = archiveCode == installedCode && archive.versionName == installed.versionName
    if (archiveCode < installedCode || sameBuild) {
      apk.delete()
      throw NotNewerException(
        "APK is ${archive.versionName} ($archiveCode), installed is ${installed.versionName} ($installedCode)"
      )
    }
  }

  private fun install(apk: File) {
    val installer = reactContext.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
      setAppPackageName(reactContext.packageName)
      setSize(apk.length())
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
      }
    }
    val sessionId = installer.createSession(params)
    try {
      installer.openSession(sessionId).use { session ->
        FileInputStream(apk).use { input ->
          session.openWrite("base.apk", 0, apk.length()).use { output ->
            input.copyTo(output)
            session.fsync(output)
          }
        }
        val intent = Intent(reactContext, AppUpdateInstallReceiver::class.java)
          .setAction(AppUpdateInstallReceiver.ACTION)
        // The system adds the status extras, so the intent must be mutable.
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
          (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
        val pending = PendingIntent.getBroadcast(reactContext, sessionId, intent, flags)
        session.commit(pending.intentSender)
      }
    } catch (e: Exception) {
      try {
        installer.abandonSession(sessionId)
      } catch (_: Exception) {
      }
      throw e
    }
  }

  private fun archiveInfo(apk: File): PackageInfo? =
    @Suppress("DEPRECATION")
    reactContext.packageManager.getPackageArchiveInfo(apk.absolutePath, 0)

  private fun emitProgress(progress: Double) {
    val map = Arguments.createMap()
    map.putDouble("progress", progress.coerceIn(0.0, 1.0))
    emit("AppUpdateProgress", map)
  }

  private fun emitStatus(status: String, message: String?) {
    val map = Arguments.createMap()
    map.putString("status", status)
    if (message != null) map.putString("message", message)
    emit("AppUpdateStatus", map)
  }

  private fun emit(event: String, payload: Any) {
    try {
      if (reactContext.hasActiveReactInstance()) {
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(event, payload)
      }
    } catch (e: Exception) {
      Log.w(TAG, "Could not emit $event", e)
    }
  }

  private class NotNewerException(message: String) : Exception(message)

  companion object {
    private const val TAG = "AppUpdate"
    private const val MAX_REDIRECTS = 6
    private val running = AtomicBoolean(false)

    @Volatile
    private var instance: AppUpdateModule? = null

    fun emitInstallStatus(status: String, message: String?) {
      instance?.emitStatus(status, message)
    }

    /** Shows Android's install confirmation, from the app's screen when it is open. */
    fun startConfirmActivity(context: Context, confirm: Intent) {
      val activity = instance?.reactContext?.currentActivity
      if (activity != null) {
        activity.startActivity(confirm)
      } else {
        context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    private fun installedPackageInfo(context: Context): PackageInfo =
      @Suppress("DEPRECATION")
      context.packageManager.getPackageInfo(context.packageName, 0)

    private fun versionCodeOf(info: PackageInfo): Long =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        info.longVersionCode
      } else {
        @Suppress("DEPRECATION")
        info.versionCode.toLong()
      }
  }
}
