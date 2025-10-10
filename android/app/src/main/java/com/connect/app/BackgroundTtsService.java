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
        
        // Start as foreground service to prevent system from killing it
        startForeground(NOTIFICATION_ID, createNotification());
        
        // Keep service running
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
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.d(TAG, "App task removed, restarting service");
        // Restart service when app is removed from recent apps
        Intent restartServiceIntent = new Intent(getApplicationContext(), BackgroundTtsService.class);
        startService(restartServiceIntent);
        super.onTaskRemoved(rootIntent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Background TTS Service",
                NotificationManager.IMPORTANCE_LOW
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
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }
}

