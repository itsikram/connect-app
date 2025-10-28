package com.connect.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Boot receiver to restart background services after device reboot
 * This ensures notifications and TTS continue working after device restart
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "BootReceiver received action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            Intent.ACTION_PACKAGE_REPLACED.equals(action)) {
            
            Log.d(TAG, "Device boot completed or app replaced, restarting background services");
            
            try {
                // Start background TTS service
                Intent ttsServiceIntent = new Intent(context, BackgroundTtsService.class);
                context.startService(ttsServiceIntent);
                Log.d(TAG, "Background TTS service started after boot");

                // Start notification service if needed
                Intent notificationServiceIntent = new Intent(context, NotificationService.class);
                context.startService(notificationServiceIntent);
                Log.d(TAG, "Notification service started after boot");

                // Start Headless JS keep-alive service to relaunch JS background loop
                Intent keepAliveIntent = new Intent(context, KeepAliveService.class);
                context.startService(keepAliveIntent);
                Log.d(TAG, "KeepAliveService started after boot");

            } catch (Exception e) {
                Log.e(TAG, "Error starting services after boot", e);
            }
        }
    }
}

