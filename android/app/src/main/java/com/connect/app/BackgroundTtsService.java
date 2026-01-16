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

import com.connect.app.MainActivity;

/**
 * Background TTS Service to ensure TTS functionality works even when app is closed
 * This service runs in the background to handle TTS requests from push notifications
 */
public class BackgroundTtsService extends Service {
    private static final String TAG = "BackgroundTtsService";
    private static final String CHANNEL_ID = "background_tts_channel";
    private static final int NOTIFICATION_ID = 1001;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "BackgroundTtsService created");
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "BackgroundTtsService started");
        
        // Ensure notification is set up immediately (required for foreground service)
        // Using higher priority notification for better persistence
        startForeground(NOTIFICATION_ID, createNotification());
        
        // Nudge Headless JS keep-alive to ensure background JS can spin up
        try {
            Intent keepAlive = new Intent(this, KeepAliveService.class);
            startService(keepAlive);
        } catch (Exception ignored) {}
        
        // Return START_STICKY to restart service if killed by system
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "BackgroundTtsService destroyed");
        // Do NOT restart from onDestroy - let START_STICKY handle it
        // Restarting here can cause service loops and system will kill it
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.d(TAG, "App task removed, restarting service");
        // Restart service when app is removed from recent apps
        // Using START_STICKY + stopWithTask="false" + immediate restart
        Intent restartServiceIntent = new Intent(getApplicationContext(), BackgroundTtsService.class);
        restartServiceIntent.setPackage(getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getApplicationContext().startForegroundService(restartServiceIntent);
        } else {
            getApplicationContext().startService(restartServiceIntent);
        }
        // Also poke headless keep-alive
        try {
            Intent keepAlive = new Intent(getApplicationContext(), KeepAliveService.class);
            startService(keepAlive);
        } catch (Exception ignored) {}
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Background TTS Service",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Keeps TTS functionality active in background");
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
            .setContentText("Background TTS service is running")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }
}

