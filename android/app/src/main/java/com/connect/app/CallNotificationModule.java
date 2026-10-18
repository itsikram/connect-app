package com.connect.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
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
        // Only an app with its activity up shows calls from JS. A headless JS
        // run (background task) has no call screen, so incoming-call pushes
        // must keep using the native ring + full-screen path.
        IncomingCallStore.INSTANCE.setReactRunning(reactContext.hasCurrentActivity());
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

    /** The JS call screen took over (or the call ended): stop the native ring and its notification. */
    @ReactMethod
    public void cancelNativeIncomingCall(Promise promise) {
        try {
            if (IncomingCallNotifier.INSTANCE.hasActiveCall()) {
                IncomingCallNotifier.INSTANCE.cancel(getReactApplicationContext(), null);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    /** A call screen is up (ringing or in a call, not minimized): keep it above the lock screen. */
    @ReactMethod
    public void setCallScreenActive(boolean active, Promise promise) {
        LockScreenCallMode.INSTANCE.setJsCallActive(active);
        promise.resolve(true);
    }

    /** The incoming call started / stopped ringing: keep the screen on while it rings. */
    @ReactMethod
    public void setIncomingCallRinging(boolean ringing, Promise promise) {
        LockScreenCallMode.INSTANCE.setRinging(ringing);
        promise.resolve(true);
    }

    /**
     * What Android lets an incoming call do while the app is closed:
     * fullScreenIntent - call screen over the lock screen (user-controlled on Android 14+),
     * overlay - call screen over other apps while the phone is in use ("Display over other apps").
     */
    @ReactMethod
    public void getIncomingCallScreenStatus(Promise promise) {
        Context context = getReactApplicationContext();
        boolean fullScreen = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            fullScreen = manager != null && manager.canUseFullScreenIntent();
        }
        boolean overlay = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || Settings.canDrawOverlays(context);
        WritableMap map = Arguments.createMap();
        map.putBoolean("fullScreenIntent", fullScreen);
        map.putBoolean("overlay", overlay);
        map.putInt("sdk", Build.VERSION.SDK_INT);
        map.putBoolean("xiaomi", isXiaomi());
        promise.resolve(map);
    }

    /** Xiaomi / Redmi / POCO (MIUI, HyperOS) block lock-screen and background pop-ups per app. */
    private static boolean isXiaomi() {
        String manufacturer = String.valueOf(Build.MANUFACTURER).toLowerCase(java.util.Locale.ROOT);
        String brand = String.valueOf(Build.BRAND).toLowerCase(java.util.Locale.ROOT);
        return manufacturer.contains("xiaomi") || brand.contains("xiaomi")
            || brand.contains("redmi") || brand.contains("poco");
    }

    /**
     * MIUI / HyperOS "Other permissions" page, where "Show on Lock screen" and
     * "Display pop-up windows while running in the background" live. Falls
     * back to the app's settings page.
     */
    @ReactMethod
    public void openOemCallPermissions(Promise promise) {
        Context context = getReactApplicationContext();
        String pkg = context.getPackageName();
        if (isXiaomi()) {
            String[] editors = {
                "com.miui.permcenter.permissions.PermissionsEditorActivity",
                "com.miui.permcenter.permissions.AppPermissionsEditorActivity",
            };
            for (String editor : editors) {
                try {
                    Intent intent = new Intent("miui.intent.action.APP_PERM_EDITOR");
                    intent.setClassName("com.miui.securitycenter", editor);
                    intent.putExtra("extra_pkgname", pkg);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    promise.resolve(true);
                    return;
                } catch (Exception ignored) {
                }
            }
        }
        promise.resolve(openSettings(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + pkg))));
    }

    @ReactMethod
    public void openFullScreenIntentSettings(Promise promise) {
        Context context = getReactApplicationContext();
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                Uri.parse("package:" + context.getPackageName()));
        } else {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
        }
        promise.resolve(openSettings(intent));
    }

    @ReactMethod
    public void openOverlaySettings(Promise promise) {
        Context context = getReactApplicationContext();
        promise.resolve(openSettings(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + context.getPackageName()))));
    }

    private boolean openSettings(Intent intent) {
        Context context = getReactApplicationContext();
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(intent);
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Settings screen unavailable, opening app details", e);
        }
        try {
            Intent details = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + context.getPackageName()));
            details.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(details);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Could not open settings", e);
            return false;
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

    /**
     * JS learned of an incoming call while the app is not on screen (socket
     * event, or the user left a ringing call screen): ring natively, which
     * works from the background and on the lock screen.
     *
     * @param fullScreen false when the user just left the call screen: ring
     *                   with a heads-up only instead of reopening the screen.
     */
    @ReactMethod
    public void showNativeIncomingCall(ReadableMap payload, boolean fullScreen, Promise promise) {
        try {
            java.util.HashMap<String, String> data = new java.util.HashMap<>();
            data.put("type", "incoming_call");
            putString(data, payload, "callerId");
            putString(data, payload, "callerName");
            putString(data, payload, "callerProfilePic");
            putString(data, payload, "channelName");
            putString(data, payload, "ringtoneId");
            boolean isAudio = !payload.hasKey("isAudio") || payload.isNull("isAudio") || payload.getBoolean("isAudio");
            data.put("isAudio", isAudio ? "true" : "false");
            IncomingCallNotifier.INSTANCE.show(getReactApplicationContext(), data, fullScreen);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Native incoming call failed", e);
            promise.resolve(false);
        }
    }

    private static void putString(java.util.Map<String, String> data, ReadableMap payload, String key) {
        if (payload.hasKey(key) && !payload.isNull(key)) {
            String value = payload.getString(key);
            if (value != null) data.put(key, value);
        }
    }

    /** An incoming-call push rang natively while JS is running in the background. */
    public static void emitIncomingCallRinging(java.util.Map<String, String> data) {
        try {
            if (staticContext == null || !staticContext.hasActiveReactInstance()) return;
            WritableMap map = Arguments.createMap();
            String callerId = data.get("callerId") != null ? data.get("callerId") : data.get("from");
            map.putString("from", callerId != null ? callerId : "");
            map.putString("callerId", callerId != null ? callerId : "");
            map.putString("callerName", data.get("callerName"));
            map.putString("callerProfilePic", data.get("callerProfilePic"));
            map.putString("channelName", data.get("channelName"));
            map.putString("ringtoneId", data.get("ringtoneId"));
            map.putBoolean("isAudio", !"false".equals(data.get("isAudio")));
            staticContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("nativeIncomingCallRinging", map);
        } catch (Exception e) {
            Log.e(TAG, "Failed to emit incoming call", e);
        }
    }

    /**
     * Keep the call's microphone and audio running while the screen is off or
     * the app is in the background. Android 11+ silences the microphone for an
     * app that is not visible unless a microphone foreground service runs, so
     * the other side heard nothing once the phone was locked. Must be started
     * while the app is on screen (placing or answering the call).
     */
    @ReactMethod
    public void startOngoingCall(ReadableMap params, Promise promise) {
        boolean isVideo = params.hasKey("isVideo") && !params.isNull("isVideo") && params.getBoolean("isVideo");
        String peerName = params.hasKey("peerName") && !params.isNull("peerName") ? params.getString("peerName") : null;
        promise.resolve(OngoingCallService.Companion.start(getReactApplicationContext(), peerName, isVideo));
    }

    @ReactMethod
    public void stopOngoingCall(Promise promise) {
        OngoingCallService.Companion.stop(getReactApplicationContext());
        promise.resolve(true);
    }

    @Override
    public void onHostResume() {
        IncomingCallStore.INSTANCE.setReactRunning(true);
        IncomingCallStore.INSTANCE.setAppInForeground(true);
    }

    @Override
    public void onHostPause() {
        IncomingCallStore.INSTANCE.setReactRunning(true);
        IncomingCallStore.INSTANCE.setAppInForeground(false);
    }

    @Override
    public void onHostDestroy() {
        IncomingCallStore.INSTANCE.setReactRunning(false);
        IncomingCallStore.INSTANCE.setAppInForeground(false);
    }
}
