package com.connect.app.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.connect.app.MainActivity
import com.connect.app.R


class FloatingOverlayService : Service() {

  private var isForegroundStarted = false
  private var menuOptions: List<MenuOption> = emptyList()
  private var menuOptionCallback: ((String) -> Unit)? = null

  companion object {
    private var instance: FloatingOverlayService? = null
    fun getInstance(): FloatingOverlayService? = instance
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    
    // CRITICAL: Call startForeground() IMMEDIATELY to avoid crash
    // Android requires startForeground() to be called within 5 seconds of startForegroundService()
    // This MUST be the first thing we do, before ANY other initialization
    // Use absolute minimum notification first, then update it later if needed
    try {
      // Create notification channel synchronously (required for Android O+)
      val channelId = "connect_overlay_channel"
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        try {
          val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
          val channel = NotificationChannel(channelId, "Overlay", NotificationManager.IMPORTANCE_LOW)
          channel.setShowBadge(false)
          manager.createNotificationChannel(channel)
        } catch (e: Exception) {
          // Channel might already exist, continue anyway
          android.util.Log.d("FloatingOverlayService", "Notification channel creation skipped", e)
        }
      }
      
      // Create minimal notification immediately
      val minimalNotif = NotificationCompat.Builder(this, channelId)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("Connect")
        .setContentText("Running")
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setOngoing(true)
        .build()
      
      // Call startForeground() IMMEDIATELY - this must happen synchronously
      startForeground(1011, minimalNotif)
      isForegroundStarted = true
      android.util.Log.d("FloatingOverlayService", "startForeground() called successfully")
      
      // Now update with a better notification (this is optional and can be done asynchronously)
      try {
        updateNotification()
      } catch (e: Exception) {
        android.util.Log.w("FloatingOverlayService", "Failed to update notification, using minimal one", e)
      }
    } catch (e: Exception) {
      // Last resort: try with system default icon
      android.util.Log.e("FloatingOverlayService", "Failed to start foreground in onCreate", e)
      try {
        val channelId = "connect_overlay_channel"
        val emergencyNotif = NotificationCompat.Builder(this, channelId)
          .setSmallIcon(android.R.drawable.ic_dialog_info)
          .setContentTitle("Connect")
          .setPriority(NotificationCompat.PRIORITY_LOW)
          .build()
        startForeground(1011, emergencyNotif)
        isForegroundStarted = true
        android.util.Log.d("FloatingOverlayService", "startForeground() called with emergency notification")
      } catch (e2: Exception) {
        android.util.Log.e("FloatingOverlayService", "CRITICAL: Failed to start foreground", e2)
      }
    }
    
    // Now do other initialization AFTER startForeground() has been called
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Safety measure: Ensure startForeground() is called even if onCreate() had issues
    // This is called after onCreate(), so it serves as a backup
    if (!isForegroundStarted) {
      android.util.Log.w("FloatingOverlayService", "startForeground not called in onCreate, calling in onStartCommand")
      try {
        val channelId = "connect_overlay_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          try {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(channelId, "Overlay", NotificationManager.IMPORTANCE_LOW)
            channel.setShowBadge(false)
            manager.createNotificationChannel(channel)
          } catch (e: Exception) {
            android.util.Log.d("FloatingOverlayService", "Notification channel creation skipped", e)
          }
        }
        
        val minimalNotif = NotificationCompat.Builder(this, channelId)
          .setSmallIcon(R.mipmap.ic_launcher)
          .setContentTitle("Connect")
          .setContentText("Running")
          .setPriority(NotificationCompat.PRIORITY_LOW)
          .setOngoing(true)
          .build()
        startForeground(1011, minimalNotif)
        isForegroundStarted = true
        android.util.Log.d("FloatingOverlayService", "startForeground() called in onStartCommand")
      } catch (e: Exception) {
        android.util.Log.e("FloatingOverlayService", "CRITICAL: Failed to start foreground in onStartCommand", e)
      }
    }
    
    // Return START_STICKY to keep service running
    return START_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
    instance = null
  }

  private fun updateNotification() {
    // This method updates the notification with a better one after the initial minimal notification
    // This is optional and can fail without causing the service to crash
    val channelId = "connect_overlay_channel"
    
    try {
      // Create pending intent
      val intent = Intent(this, MainActivity::class.java)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      val pendingFlags = if (Build.VERSION.SDK_INT >= 23) {
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      val pending = PendingIntent.getActivity(
        this,
        0,
        intent,
        pendingFlags
      )

      val notification = NotificationCompat.Builder(this, channelId)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("Connect is running")
        .setContentText("Service active")
        .setContentIntent(pending)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setShowWhen(false)
        .build()

      // Update the notification (this is safe to call even if startForeground was already called)
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.notify(1011, notification)
    } catch (e: Exception) {
      // If updating fails, that's okay - we already have a minimal notification
      android.util.Log.w("FloatingOverlayService", "Error updating notification", e)
    }
  }

  fun setMenuOptions(options: List<MenuOption>, callback: (String) -> Unit) {
    menuOptions = options
    menuOptionCallback = callback
  }

}
