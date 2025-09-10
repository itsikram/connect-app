package com.connect.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.*
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.core.app.NotificationCompat
import com.connect.MainActivity
import com.connect.R

class FloatingOverlayService : Service() {

  private var windowManager: WindowManager? = null
  private var overlayView: View? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    startAsForeground()
    createOverlay()
  }

  override fun onDestroy() {
    super.onDestroy()
    removeOverlay()
  }

  private fun startAsForeground() {
    val channelId = "connect_overlay_channel"
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(channelId, "Overlay", NotificationManager.IMPORTANCE_LOW)
      manager.createNotificationChannel(channel)
    }

    val intent = Intent(this, MainActivity::class.java)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val pending = PendingIntent.getActivity(
      this,
      0,
      intent,
      if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT else 0
    )

    val notification: Notification = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("Connect is running")
      .setContentText("Floating button active")
      .setContentIntent(pending)
      .setOngoing(true)
      .build()

    startForeground(1011, notification)
  }

  private fun createOverlay() {
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

    val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      layoutType,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT
    )
    params.gravity = Gravity.TOP or Gravity.START
    params.x = 24
    params.y = 120

    val root = FrameLayout(this)
    val size = (56 * resources.displayMetrics.density).toInt()
    val image = ImageView(this)
    image.setImageResource(R.mipmap.ic_launcher)
    val lp = FrameLayout.LayoutParams(size, size)
    image.layoutParams = lp
    image.isClickable = true
    image.isFocusable = true
    image.setPadding(0,0,0,0)
    image.elevation = 8f
    image.clipToOutline = true
    // Create a circular background drawable
    val drawable = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(0x8829B1A9.toInt()) // Match the teal color from the app
    }
    image.background = drawable

    root.addView(image)
    overlayView = root

    var initialX = 0
    var initialY = 0
    var initialTouchX = 0f
    var initialTouchY = 0f
    val touchListener = View.OnTouchListener { v, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          initialX = params.x
          initialY = params.y
          initialTouchX = event.rawX
          initialTouchY = event.rawY
          true
        }
        MotionEvent.ACTION_MOVE -> {
          params.x = initialX + (event.rawX - initialTouchX).toInt()
          params.y = initialY + (event.rawY - initialTouchY).toInt()
          windowManager?.updateViewLayout(overlayView, params)
          true
        }
        MotionEvent.ACTION_UP -> {
          // treat quick taps as clicks
          val dx = Math.abs(event.rawX - initialTouchX)
          val dy = Math.abs(event.rawY - initialTouchY)
          if (dx < 20 && dy < 20) {
            // bring app to front
            val i = Intent(this, MainActivity::class.java)
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            startActivity(i)
          }
          true
        }
        else -> false
      }
    }
    image.setOnTouchListener(touchListener)

    windowManager?.addView(root, params)
  }

  private fun removeOverlay() {
    overlayView?.let {
      try { windowManager?.removeView(it) } catch (_: Exception) {}
    }
    overlayView = null
    windowManager = null
  }
}



