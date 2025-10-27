package com.connect.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Promise;

public class CallNotificationModule extends ReactContextBaseJavaModule {
    private static final String TAG = "CallNotificationModule";
    private ReactApplicationContext reactContext;

    public CallNotificationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "CallNotificationModule";
    }

    @ReactMethod
    public void openIncomingCallScreen(ReadableMap params, Promise promise) {
        try {
            // Create intent to open the app with incoming call screen
            Intent intent = new Intent(reactContext, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.putExtra("action", "incoming_call");
            intent.putExtra("callerId", params.getString("callerId"));
            intent.putExtra("callerName", params.getString("callerName"));
            intent.putExtra("callerProfilePic", params.getString("callerProfilePic"));
            intent.putExtra("channelName", params.getString("channelName"));
            intent.putExtra("isAudio", params.getBoolean("isAudio"));
            intent.putExtra("autoAccept", params.getBoolean("autoAccept"));

            // Start the activity
            reactContext.startActivity(intent);
            promise.resolve(true);
            
            Log.d(TAG, "Opened incoming call screen for: " + params.getString("callerName"));
        } catch (Exception e) {
            Log.e(TAG, "Error opening incoming call screen", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void bringAppToForeground(Promise promise) {
        try {
            // Create intent to bring app to foreground
            Intent intent = new Intent(reactContext, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            
            reactContext.startActivity(intent);
            promise.resolve(true);
            
            Log.d(TAG, "Brought app to foreground");
        } catch (Exception e) {
            Log.e(TAG, "Error bringing app to foreground", e);
            promise.reject("ERROR", e.getMessage());
        }
    }
}
