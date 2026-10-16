package com.connect.app

import android.app.Activity
import android.app.KeyguardManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.view.WindowManager
import java.lang.ref.WeakReference

/**
 * Puts the call screen on top of the lock screen and wakes the display while
 * a call needs it, and keeps the rest of the app behind the lock screen.
 *
 * - Android 8.1+: MainActivity's manifest sets showWhenLocked and
 *   turnScreenOn, because SystemUI reads them to let a call notification's
 *   Accept / tap open the app without unlocking. They are switched off here
 *   whenever no call needs them, so chats never show over the lock screen.
 * - Android 7.0 - 8.0 ignore those manifest attributes, so the window flags
 *   are added for the call and removed afterwards.
 * - While an incoming call rings the screen is kept on, so it does not time
 *   out back to a dark lock screen mid-ring.
 *
 * Started by a call intent (MainActivity) or by JS (CallNotificationModule);
 * JS reports when the call screen goes away. All state lives on the main thread.
 */
object LockScreenCallMode {
  // Native call intent with no word from JS: give up after the ring window.
  private val JS_CONFIRM_TIMEOUT_MS = IncomingCallRingService.CALL_RING_DURATION_MS + 5_000L

  private val handler = Handler(Looper.getMainLooper())
  private var activityRef: WeakReference<Activity>? = null
  private var showOverLockScreen = false
  private var keepScreenOn = false
  // We added FLAG_KEEP_SCREEN_ON ourselves (and may clear it again).
  private var ownsKeepScreenOn = false
  // JS has a call screen up (ringing or in a call, not minimized).
  private var jsCallActive = false
  // A native call intent is waiting for JS to show its call screen.
  private var awaitingJs = false

  private val releaseIfUnconfirmed = Runnable { if (!jsCallActive) release() }

  /**
   * MainActivity was created. It must follow up with [onCallIntent] or
   * [onNonCallIntent], which apply the flags: applying here first would flip
   * a call launch to "hidden" and back while the activity starts.
   */
  fun attach(activity: Activity) = onMain {
    activityRef = WeakReference(activity)
    ownsKeepScreenOn = false
  }

  fun detach(activity: Activity) = onMain {
    if (activityRef?.get() === activity) activityRef = null
  }

  /** MainActivity was opened for a call: full-screen intent, direct launch, notification tap or Accept. */
  fun onCallIntent(ringing: Boolean) = onMain {
    showOverLockScreen = true
    keepScreenOn = ringing
    apply()
    handler.removeCallbacks(releaseIfUnconfirmed)
    if (!jsCallActive) {
      awaitingJs = true
      handler.postDelayed(releaseIfUnconfirmed, JS_CONFIRM_TIMEOUT_MS)
    }
  }

  /**
   * MainActivity was opened (or reopened) for anything but a call: launcher,
   * chat notification, shortcut. Outside a call the app stays behind the lock
   * screen, so a launch from the lock screen asks the user to unlock instead
   * of opening to nothing. A ringing or active call keeps its screen up.
   */
  fun onNonCallIntent(activity: Activity) = onMain {
    apply()
    if (!showOverLockScreen) requestUnlock(activity)
  }

  /** From JS: a call screen is up (true), or the call ended / was minimized (false). */
  fun setJsCallActive(active: Boolean) = onMain {
    jsCallActive = active
    awaitingJs = false
    handler.removeCallbacks(releaseIfUnconfirmed)
    showOverLockScreen = active
    if (!active) keepScreenOn = false
    apply()
  }

  /** From JS: the incoming call started or stopped ringing (answered, declined, ended). */
  fun setRinging(ringing: Boolean) = onMain {
    if (ringing) {
      keepScreenOn = true
      showOverLockScreen = true
      apply()
    } else if (!jsCallActive && !awaitingJs) {
      // Rang without a call screen (e.g. only a notification): nothing is
      // left to show over the lock screen.
      release()
    } else {
      keepScreenOn = false
      apply()
    }
  }

  /** The native ring ended (caller hung up, declined, timed out) before JS showed the call. */
  fun releaseIfNoCall() = onMain {
    if (!jsCallActive) release()
  }

  private fun release() {
    handler.removeCallbacks(releaseIfUnconfirmed)
    awaitingJs = false
    showOverLockScreen = false
    keepScreenOn = false
    apply()
  }

  private fun apply() {
    val activity = activityRef?.get() ?: return
    val window = activity.window ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      // Overrides the manifest's showWhenLocked / turnScreenOn for this activity.
      activity.setShowWhenLocked(showOverLockScreen)
      activity.setTurnScreenOn(showOverLockScreen)
    } else {
      @Suppress("DEPRECATION")
      val lockFlags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      if (showOverLockScreen) window.addFlags(lockFlags) else window.clearFlags(lockFlags)
    }

    val keepOnFlag = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
    if (keepScreenOn) {
      if (!ownsKeepScreenOn && (window.attributes.flags and keepOnFlag) == 0) {
        window.addFlags(keepOnFlag)
        ownsKeepScreenOn = true
      }
    } else if (ownsKeepScreenOn) {
      // Only clear it if we set it (expo-keep-awake may hold it in dev builds).
      window.clearFlags(keepOnFlag)
      ownsKeepScreenOn = false
    }
  }

  /**
   * Shows the unlock prompt when the app was opened on a locked phone (SystemUI
   * lets MainActivity's notifications through without unlocking because of the
   * manifest flags). Not while the screen is off: nobody is there to unlock.
   */
  private fun requestUnlock(activity: Activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val keyguard = activity.getSystemService(KeyguardManager::class.java) ?: return
    if (!keyguard.isKeyguardLocked) return
    val power = activity.getSystemService(PowerManager::class.java)
    if (power != null && !power.isInteractive) return
    keyguard.requestDismissKeyguard(activity, null)
  }

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else handler.post(block)
  }
}
