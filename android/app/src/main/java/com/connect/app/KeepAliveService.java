package com.connect.app;

import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.Nullable;

import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

/**
 * Headless JS service to re-start JS background tasks after app termination or boot.
 */
public class KeepAliveService extends HeadlessJsTaskService {
    private static final String TAG = "KeepAliveService";
    private static final int MAX_RETRY_ATTEMPTS = 5;
    private static final long RETRY_DELAY_MS = 1000; // 1 second

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Check if React Native is ready before starting the headless task
        if (!isReactNativeReady()) {
            Log.w(TAG, "React Native not ready yet, will retry...");
            // Retry after a delay - keep service alive during retry
            retryStartTask(intent, flags, startId, 0);
            return START_STICKY; // Keep service alive to allow retry
        }
        
        // React Native is ready, proceed with normal headless task start
        return super.onStartCommand(intent, flags, startId);
    }

    /**
     * Check if React Native is initialized and ready to run headless tasks
     */
    private boolean isReactNativeReady() {
        try {
            if (getApplication() instanceof ReactApplication) {
                ReactApplication reactApplication = (ReactApplication) getApplication();
                ReactNativeHost reactNativeHost = reactApplication.getReactNativeHost();
                
                if (reactNativeHost != null) {
                    ReactContext reactContext = reactNativeHost.getReactInstanceManager().getCurrentReactContext();
                    if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
                        Log.d(TAG, "React Native is ready");
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking React Native readiness", e);
        }
        return false;
    }

    /**
     * Retry starting the headless task after a delay
     */
    private void retryStartTask(Intent intent, int flags, int startId, int attempt) {
        if (attempt >= MAX_RETRY_ATTEMPTS) {
            Log.e(TAG, "Max retry attempts reached, giving up on starting headless task");
            stopSelf(startId);
            return;
        }

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            // Check if service is still running
            if (!isReactNativeReady()) {
                Log.d(TAG, "Retry attempt " + (attempt + 1) + "/" + MAX_RETRY_ATTEMPTS + " - React Native still not ready");
                retryStartTask(intent, flags, startId, attempt + 1);
                return;
            }
            
            // React Native is ready, try to start the headless task
            Log.d(TAG, "React Native is now ready, starting headless task");
            try {
                // Call getTaskConfig to get the config, then manually invoke the task
                HeadlessJsTaskConfig taskConfig = getTaskConfig(intent);
                if (taskConfig != null) {
                    // Use reflection or direct call to start the task
                    // Since we can't easily call the protected method, we'll restart the service
                    // which will now pass the readiness check
                    Intent retryIntent = new Intent(this, KeepAliveService.class);
                    if (intent.getExtras() != null) {
                        retryIntent.putExtras(intent.getExtras());
                    }
                    startService(retryIntent);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error starting headless task after retry", e);
                // If direct start fails, try one more retry
                if (attempt < MAX_RETRY_ATTEMPTS - 1) {
                    retryStartTask(intent, flags, startId, attempt + 1);
                } else {
                    stopSelf(startId);
                }
            }
        }, RETRY_DELAY_MS);
    }

    @Override
    protected @Nullable HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        // Safety check: return null if React Native is not ready
        // This prevents the "CatalystInstance not available" error
        if (!isReactNativeReady()) {
            Log.w(TAG, "getTaskConfig: React Native not ready, returning null to prevent task start");
            return null;
        }
        
        WritableMap data = Arguments.createMap();
        data.putString("source", "KeepAliveService");
        return new HeadlessJsTaskConfig(
                "KeepAliveTask",
                data,
                0,
                true
        );
    }
}


