package com.connect.app.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.*
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.animation.ObjectAnimator
import android.animation.AnimatorSet
import android.animation.AnimatorListenerAdapter
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.connect.app.MainActivity
import com.connect.app.R

data class MenuOption(val id: String, val label: String, val icon: String = "")

// Material Icons Unicode mapping
private val materialIconsMap = mapOf(
  "home" to "\ue88a",
  "message" to "\ue0c9",
  "people" to "\ue7ef",
  "person" to "\ue7fd",
  "settings" to "\ue8b8",
  "casino" to "\uea30",
  "sports-esports" to "\uea28",
  "camera-alt" to "\ue3a7",
  "photo-library" to "\ue413",
  "play-circle-filled" to "\ue038",
  "facebook" to "\ue234",
  "vpn-key" to "\ue0da",
  "map" to "\ue55b",
  "contacts" to "\ue0ba",
  "sports-cricket" to "\uea29",
  "download" to "\ue2c4"
)

class FloatingOverlayService : Service() {

  private var windowManager: WindowManager? = null
  private var overlayView: View? = null
  private var menuView: View? = null
  private var menuOptions: List<MenuOption> = emptyList()
  private var buttonParams: WindowManager.LayoutParams? = null
  private var isMenuVisible = false
  private var menuItemClickListener: ((String) -> Unit)? = null

  companion object {
    private var instance: FloatingOverlayService? = null
    fun getInstance(): FloatingOverlayService? = instance
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    startAsForeground()
    createOverlay()
    // Set default menu options
    menuOptions = listOf(
      MenuOption("open", "Open App"),
      MenuOption("home", "Home"),
      MenuOption("message", "Messages"),
      MenuOption("profile", "Profile")
    )
  }

  override fun onDestroy() {
    super.onDestroy()
    instance = null
    removeMenu()
    removeOverlay()
  }

  fun setMenuOptions(options: List<MenuOption>, clickListener: (String) -> Unit) {
    menuOptions = options
    menuItemClickListener = clickListener
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

    buttonParams = params

    val root = FrameLayout(this)
    val size = (56 * resources.displayMetrics.density).toInt()
    val image = ImageView(this)
    image.setImageResource(R.mipmap.ic_launcher)
    val lp = FrameLayout.LayoutParams(size, size)
    image.layoutParams = lp
    image.isClickable = true
    image.isFocusable = true
    val padding = (4 * resources.displayMetrics.density).toInt()
    image.setPadding(padding, padding, padding, padding)
    image.elevation = 12f
    image.clipToOutline = true
    
    // Modern circular background with gradient effect
    val drawable = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        // Solid teal background with better opacity
        setColor(0xFF29B1A9.toInt()) // Full opacity teal
    }
    image.background = drawable
    
    // Add subtle shadow effect
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      image.outlineProvider = ViewOutlineProvider.BACKGROUND
      image.clipToOutline = true
    }

    root.addView(image)
    overlayView = root

    var initialX = 0
    var initialY = 0
    var initialTouchX = 0f
    var initialTouchY = 0f
    var isDragging = false
    val touchListener = View.OnTouchListener { v, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          initialX = params.x
          initialY = params.y
          initialTouchX = event.rawX
          initialTouchY = event.rawY
          isDragging = false
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = Math.abs(event.rawX - initialTouchX)
          val dy = Math.abs(event.rawY - initialTouchY)
          if (dx > 10 || dy > 10) {
            isDragging = true
            if (isMenuVisible) {
              hideMenu()
            }
            params.x = initialX + (event.rawX - initialTouchX).toInt()
            params.y = initialY + (event.rawY - initialTouchY).toInt()
            // Keep button within screen bounds
            val displayMetrics = resources.displayMetrics
            val maxX = displayMetrics.widthPixels - size
            val maxY = displayMetrics.heightPixels - size
            params.x = params.x.coerceIn(0, maxX)
            params.y = params.y.coerceIn(0, maxY)
            windowManager?.updateViewLayout(overlayView, params)
          }
          true
        }
        MotionEvent.ACTION_UP -> {
          val dx = Math.abs(event.rawX - initialTouchX)
          val dy = Math.abs(event.rawY - initialTouchY)
          if (!isDragging && dx < 20 && dy < 20) {
            // Quick tap - toggle menu
            if (isMenuVisible) {
              hideMenu()
            } else {
              showMenu()
            }
          } else if (isMenuVisible) {
            hideMenu()
          }
          true
        }
        else -> false
      }
    }
    image.setOnTouchListener(touchListener)

    // Close menu when tapping outside
    root.setOnClickListener {
      if (isMenuVisible) {
        hideMenu()
      }
    }

    windowManager?.addView(root, params)
  }

  private fun getIconUnicode(iconName: String): String {
    return materialIconsMap[iconName] ?: "\ue88a" // Default to home icon
  }

  private fun showMenu() {
    if (menuOptions.isEmpty() || isMenuVisible) return
    isMenuVisible = true

    val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }

    val menuParams = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      layoutType,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT
    )
    menuParams.gravity = Gravity.TOP or Gravity.START

    val buttonPos = buttonParams ?: return
    val buttonSize = (56 * resources.displayMetrics.density).toInt()
    val dp4 = (4 * resources.displayMetrics.density).toInt()
    val dp8 = (8 * resources.displayMetrics.density).toInt()
    val dp12 = (12 * resources.displayMetrics.density).toInt()
    val dp16 = (16 * resources.displayMetrics.density).toInt()
    val displayMetrics = resources.displayMetrics
    val screenWidth = displayMetrics.widthPixels
    val estimatedMenuWidth = (200 * displayMetrics.density).toInt()

    // Smart positioning: show menu on the side with more space
    val spaceOnRight = screenWidth - (buttonPos.x + buttonSize)
    val spaceOnLeft = buttonPos.x
    
    if (spaceOnRight >= estimatedMenuWidth || spaceOnRight > spaceOnLeft) {
      // Show menu to the right of button
      menuParams.x = buttonPos.x + buttonSize + dp8
    } else {
      // Show menu to the left of button
      menuParams.x = buttonPos.x - estimatedMenuWidth - dp8
    }
    menuParams.y = buttonPos.y

    val menuContainer = LinearLayout(this)
    menuContainer.orientation = LinearLayout.VERTICAL
    menuContainer.setPadding(dp12, dp12, dp12, dp12)
    
    // Modern gradient background with better styling
    val menuBg = GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      // Modern dark background with slight transparency
      setColor(0xE6000000.toInt()) // Almost black with transparency
      cornerRadius = (16 * resources.displayMetrics.density)
      // Subtle border
      setStroke((1 * resources.displayMetrics.density).toInt(), 0x3329B1A9.toInt())
    }
    menuContainer.background = menuBg
    menuContainer.elevation = 24f

    // Try to load Material Icons font
    var materialIconsFont: Typeface? = null
    try {
      materialIconsFont = Typeface.createFromAsset(assets, "fonts/MaterialIcons-Regular.ttf")
    } catch (e: Exception) {
      // Font not found, will use fallback
    }

    menuOptions.forEachIndexed { index, option ->
      val itemView = LinearLayout(this)
      itemView.orientation = LinearLayout.HORIZONTAL
      itemView.setPadding(dp12, dp12, dp16, dp12)
      itemView.gravity = android.view.Gravity.CENTER_VERTICAL
      
      // Ripple effect background
      val itemBg = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        setColor(0x00FFFFFF.toInt()) // Transparent by default
        cornerRadius = (8 * resources.displayMetrics.density)
      }
      itemView.background = itemBg

      // Icon view
      val iconView = TextView(this)
      val iconUnicode = getIconUnicode(option.icon)
      iconView.text = iconUnicode
      iconView.textSize = 20f
      iconView.setTextColor(0xFF29B1A9.toInt()) // Teal accent color
      
      // Try to use Material Icons font if available
      if (materialIconsFont != null) {
        iconView.typeface = materialIconsFont
      }
      
      val iconSize = (24 * resources.displayMetrics.density).toInt()
      val iconLp = LinearLayout.LayoutParams(iconSize, iconSize)
      iconLp.gravity = android.view.Gravity.CENTER_VERTICAL
      iconView.layoutParams = iconLp
      iconView.gravity = android.view.Gravity.CENTER

      // Label text
      val textView = TextView(this)
      textView.text = option.label
      textView.setTextColor(0xFFFFFFFF.toInt())
      textView.textSize = 15f
      textView.setTypeface(null, Typeface.NORMAL)
      textView.setPadding(dp12, 0, 0, 0)
      val textLp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
      textLp.gravity = android.view.Gravity.CENTER_VERTICAL
      textView.layoutParams = textLp

      itemView.addView(iconView)
      itemView.addView(textView)
      itemView.setMinimumWidth((180 * resources.displayMetrics.density).toInt())
      itemView.setMinimumHeight((48 * resources.displayMetrics.density).toInt())
      
      // Add subtle divider except for last item
      if (index < menuOptions.size - 1) {
        val divider = View(this)
        val dividerLp = LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          (1 * resources.displayMetrics.density).toInt()
        )
        dividerLp.setMargins(dp12, dp4, dp12, dp4)
        divider.layoutParams = dividerLp
        divider.setBackgroundColor(0x1AFFFFFF.toInt()) // Very subtle divider
        
        menuContainer.addView(itemView)
        menuContainer.addView(divider)
      } else {
        menuContainer.addView(itemView)
      }

      // Click handler with better feedback
      itemView.setOnClickListener {
        // Animate click
        ObjectAnimator.ofFloat(itemView, "scaleX", 1f, 0.95f, 1f).setDuration(150).start()
        ObjectAnimator.ofFloat(itemView, "scaleY", 1f, 0.95f, 1f).setDuration(150).start()
        
        menuItemClickListener?.invoke(option.id)
        hideMenu()
        // Bring app to front
        val i = Intent(this, MainActivity::class.java)
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        startActivity(i)
      }

      // Enhanced press effect with background color change
      itemView.setOnTouchListener { v, event ->
        when (event.action) {
          MotionEvent.ACTION_DOWN -> {
            val pressedBg = GradientDrawable().apply {
              shape = GradientDrawable.RECTANGLE
              setColor(0x3329B1A9.toInt()) // Teal with transparency
              cornerRadius = (8 * resources.displayMetrics.density)
            }
            itemView.background = pressedBg
            itemView.alpha = 0.9f
            true
          }
          MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
            itemView.background = itemBg
            itemView.alpha = 1.0f
            false
          }
          else -> false
        }
      }
    }

    menuView = menuContainer
    windowManager?.addView(menuContainer, menuParams)

    // Enhanced animation with staggered effect
    menuContainer.alpha = 0f
    menuContainer.scaleX = 0.85f
    menuContainer.scaleY = 0.85f
    menuContainer.translationY = (-20 * resources.displayMetrics.density)
    
    val animSet = AnimatorSet()
    val alphaAnim = ObjectAnimator.ofFloat(menuContainer, "alpha", 0f, 1f)
    val scaleXAnim = ObjectAnimator.ofFloat(menuContainer, "scaleX", 0.85f, 1f)
    val scaleYAnim = ObjectAnimator.ofFloat(menuContainer, "scaleY", 0.85f, 1f)
    val translateYAnim = ObjectAnimator.ofFloat(menuContainer, "translationY", (-20 * resources.displayMetrics.density), 0f)
    
    animSet.playTogether(alphaAnim, scaleXAnim, scaleYAnim, translateYAnim)
    animSet.duration = 250
    animSet.start()
  }

  private fun hideMenu() {
    if (!isMenuVisible || menuView == null) return
    isMenuVisible = false

    menuView?.let { view ->
      // Enhanced animation for menu disappearance
      val animSet = AnimatorSet()
      val alphaAnim = ObjectAnimator.ofFloat(view, "alpha", 1f, 0f)
      val scaleXAnim = ObjectAnimator.ofFloat(view, "scaleX", 1f, 0.9f)
      val scaleYAnim = ObjectAnimator.ofFloat(view, "scaleY", 1f, 0.9f)
      val translateYAnim = ObjectAnimator.ofFloat(view, "translationY", 0f, (-10 * resources.displayMetrics.density))
      
      animSet.playTogether(alphaAnim, scaleXAnim, scaleYAnim, translateYAnim)
      animSet.duration = 150
      animSet.addListener(object : AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: android.animation.Animator) {
          try {
            windowManager?.removeView(view)
          } catch (_: Exception) {}
        }
      })
      animSet.start()
    }
    menuView = null
  }

  private fun removeMenu() {
    menuView?.let {
      try { windowManager?.removeView(it) } catch (_: Exception) {}
    }
    menuView = null
    isMenuVisible = false
  }

  private fun removeOverlay() {
    removeMenu()
    overlayView?.let {
      try { windowManager?.removeView(it) } catch (_: Exception) {}
    }
    overlayView = null
    windowManager = null
    buttonParams = null
  }
}
