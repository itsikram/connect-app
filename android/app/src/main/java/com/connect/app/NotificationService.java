package com.connect.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.facebook.react.ReactApplication;

/**
 * Notification Service to ensure push notifications work when app is closed
 * This service handles incoming notifications and TTS processing
 */
public class NotificationService extends Service {
    private static final String TAG = "NotificationService";
    private static final String CHANNEL_ID = "notification_service_channel";
    private static final int NOTIFICATION_ID = 1002;

    @Override
    public void onCreate() {
        try {
            super.onCreate();
            Log.d(TAG, "NotificationService created");
            createNotificationChannel();
        } catch (Exception e) {
            Log.e(TAG, "Error in NotificationService.onCreate", e);
            // Continue anyway - service might still be usable
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            Log.d(TAG, "NotificationService started");
            
            // Start as foreground service
            try {
                startForeground(NOTIFICATION_ID, createNotification());
            } catch (Exception e) {
                Log.e(TAG, "Error starting foreground service", e);
                // If foreground start fails, stop the service to prevent crashes
                stopSelf(startId);
                return START_NOT_STICKY;
            }
            
            // Nudge Headless JS keep-alive to ensure background JS can spin up
            // Only do this if React Native is available (to prevent crashes)
            try {
                // Check if we're in a process that has React Native
                if (getApplication() instanceof com.facebook.react.ReactApplication) {
                    Intent keepAlive = new Intent(this, KeepAliveService.class);
                    startService(keepAlive);
                } else {
                    Log.w(TAG, "ReactApplication not available, skipping KeepAliveService start");
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not start KeepAliveService (non-critical)", e);
                // Continue - this is not critical for notification service
            }
            
            // Keep service running
            return START_STICKY;
        } catch (Exception e) {
            Log.e(TAG, "Error in onStartCommand", e);
            // Return START_NOT_STICKY on error to prevent restart loop
            return START_NOT_STICKY;
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "NotificationService destroyed");
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.d(TAG, "App task removed, restarting notification service");
        // Restart service when app is removed from recent apps
        Intent restartServiceIntent = new Intent(getApplicationContext(), NotificationService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(restartServiceIntent);
        } else {
            startService(restartServiceIntent);
        }
        // Also poke headless keep-alive
        try {
            Intent keepAlive = new Intent(getApplicationContext(), KeepAliveService.class);
            startService(keepAlive);
        } catch (Exception ignored) {}
        super.onTaskRemoved(rootIntent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Notification Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Handles push notifications when app is closed");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.setVibrationPattern(null);
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent, 
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Connect App")
            .setContentText("Notification service is running")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }
}

