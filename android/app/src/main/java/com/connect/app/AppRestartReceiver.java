package com.connect.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Receiver to restart background services when app is terminated
 * This ensures FCM notifications continue working after app is closed by user
 */
public class AppRestartReceiver extends BroadcastReceiver {
    private static final String TAG = "AppRestartReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "AppRestartReceiver received action: " + action);

        if (Intent.ACTION_PACKAGE_REPLACED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {
            
            Log.d(TAG, "App replaced/quick boot detected, restarting background services");
            
            try {
                // Start background TTS service
                Intent ttsServiceIntent = new Intent(context, BackgroundTtsService.class);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(ttsServiceIntent);
                } else {
                    context.startService(ttsServiceIntent);
                }
                Log.d(TAG, "Background TTS service restarted");

                // Start Headless JS keep-alive service
                Intent keepAliveIntent = new Intent(context, KeepAliveService.class);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(keepAliveIntent);
                } else {
                    context.startService(keepAliveIntent);
                }
                Log.d(TAG, "KeepAliveService restarted");

            } catch (Exception e) {
                Log.e(TAG, "Error restarting services", e);
            }
        }
    }
}
