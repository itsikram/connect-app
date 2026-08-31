package com.connect.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONObject;

public class CallNotificationModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    private static final String TAG = "CallNotificationModule";
    private static ReactApplicationContext staticContext;
    private ReactApplicationContext reactContext;

    public CallNotificationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        staticContext = reactContext;
        IncomingCallStore.INSTANCE.setReactRunning(true);
        reactContext.addLifecycleEventListener(this);
    }

    @Override
    public String getName() {
        return "CallNotificationModule";
    }

    @ReactMethod
    public void savePushConfig(String apiBaseUrl, String authToken, Promise promise) {
        try {
            IncomingCallStore.INSTANCE.savePushConfig(getReactApplicationContext(), apiBaseUrl, authToken);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void clearPushConfig(Promise promise) {
        try {
            IncomingCallStore.INSTANCE.clearPushConfig(getReactApplicationContext());
            IncomingCallStore.INSTANCE.consumePendingJson(getReactApplicationContext());
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getPendingCallAction(Promise promise) {
        try {
            String json = IncomingCallStore.INSTANCE.consumePendingJson(getReactApplicationContext());
            promise.resolve(jsonToMap(json));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}

    public static void emitIncomingCallAction(WritableMap payload) {
        try {
            if (staticContext != null && staticContext.hasActiveReactInstance()) {
                staticContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("nativeIncomingCallAction", payload);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to emit incoming call action", e);
        }
    }

    public static WritableMap jsonToMap(String json) {
        if (json == null || json.isEmpty()) return null;
        try {
            JSONObject obj = new JSONObject(json);
            WritableMap map = Arguments.createMap();
            map.putString("action", obj.optString("action"));
            map.putString("callerId", obj.optString("callerId"));
            map.putString("from", obj.optString("callerId"));
            map.putString("callerName", obj.optString("callerName"));
            map.putString("callerProfilePic", obj.optString("callerProfilePic"));
            map.putString("channelName", obj.optString("channelName"));
            map.putString("ringtoneId", obj.optString("ringtoneId", "1"));
            boolean isAudio = obj.optBoolean("isAudio", !"false".equals(obj.optString("isAudioText")));
            map.putBoolean("isAudio", isAudio);
            map.putBoolean("autoAccept", obj.optBoolean("autoAccept", "accept_call".equals(obj.optString("action"))));
            map.putBoolean("declined", "decline_call".equals(obj.optString("action")));
            return map;
        } catch (Exception e) {
            return null;
        }
    }

    @ReactMethod
    public void openIncomingCallScreen(ReadableMap params, Promise promise) {
        try {
            Intent intent = new Intent(reactContext, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.putExtra("action", "incoming_call");
            intent.putExtra("callerId", params.getString("callerId"));
            intent.putExtra("callerName", params.getString("callerName"));
            intent.putExtra("callerProfilePic", params.getString("callerProfilePic"));
            intent.putExtra("channelName", params.getString("channelName"));
            intent.putExtra("isAudio", params.getBoolean("isAudio"));
            intent.putExtra("autoAccept", params.getBoolean("autoAccept"));

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

    @Override
    public void onHostResume() {
        IncomingCallStore.INSTANCE.setReactRunning(true);
    }

    @Override
    public void onHostPause() {
        IncomingCallStore.INSTANCE.setReactRunning(true);
    }

    @Override
    public void onHostDestroy() {
        IncomingCallStore.INSTANCE.setReactRunning(false);
    }
}
