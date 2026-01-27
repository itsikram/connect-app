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
                // Start background TTS service (use startForegroundService on O+)
                Intent ttsServiceIntent = new Intent(context, BackgroundTtsService.class);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(ttsServiceIntent);
                } else {
                    context.startService(ttsServiceIntent);
                }
                Log.d(TAG, "Background TTS service started after boot");

                // NotificationService removed - all background notifications are now handled by 
                // react-native-background-actions plugin (pushBackgroundService.ts)
                // The background-fetch plugin service will be started automatically by the app

                // Start Headless JS keep-alive service to relaunch JS background loop
                Intent keepAliveIntent = new Intent(context, KeepAliveService.class);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(keepAliveIntent);
                } else {
                    context.startService(keepAliveIntent);
                }
                Log.d(TAG, "KeepAliveService started after boot");

            } catch (Exception e) {
                Log.e(TAG, "Error starting services after boot", e);
            }
        }
    }
}

