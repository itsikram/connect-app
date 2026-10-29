package com.connect.app.update

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log

/**
 * Result of an APK install session committed by [AppUpdateModule].
 * When Android wants the user to confirm (first self-update, or before
 * Android 12) it hands us the system confirmation screen to show.
 */
class AppUpdateInstallReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
    Log.d(TAG, "Install status $status: $message")

    if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
      val confirm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(Intent.EXTRA_INTENT)
      }
      if (confirm != null) {
        try {
          AppUpdateModule.startConfirmActivity(context, confirm)
        } catch (e: Exception) {
          Log.e(TAG, "Could not open install confirmation", e)
          AppUpdateModule.emitInstallStatus("failed", e.message)
        }
      }
      AppUpdateModule.emitInstallStatus("pending_user_action", message)
      return
    }

    AppUpdateModule.emitInstallStatus(
      if (status == PackageInstaller.STATUS_SUCCESS) "success" else "failed",
      message ?: "Install failed ($status)"
    )
  }

  companion object {
    private const val TAG = "AppUpdateInstall"
    const val ACTION = "com.connect.app.update.INSTALL_STATUS"
  }
}
