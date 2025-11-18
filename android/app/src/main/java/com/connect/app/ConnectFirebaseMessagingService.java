package com.connect.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.RingtoneManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Custom Firebase Messaging Service to handle FCM messages when app is closed
 * This ensures notifications are received and processed even when the app is killed
 */
public class ConnectFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "ConnectFCMService";
    private static final String INCOMING_CALL_CHANNEL_ID = "incoming_calls";
    private static final int INCOMING_CALL_NOTIFICATION_ID = 2001;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "ConnectFirebaseMessagingService created");
        // Ensure notification service is running when FCM service is created
        startNotificationService();
        // Create notification channels
        createIncomingCallChannel();
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "FCM message received from: " + remoteMessage.getFrom());
        Log.d(TAG, "Message data: " + remoteMessage.getData());
        
        Map<String, String> data = remoteMessage.getData();
        
        // Log all data keys for debugging
        if (data != null) {
            Log.d(TAG, "FCM data keys: " + data.keySet().toString());
            for (Map.Entry<String, String> entry : data.entrySet()) {
                Log.d(TAG, "  " + entry.getKey() + " = " + entry.getValue());
            }
        }
        
        // Check if this is an incoming call notification
        if (data != null && "incoming_call".equals(data.get("type"))) {
            Log.d(TAG, "✅ Incoming call notification detected - displaying native notification");
            handleIncomingCallNotification(data);
        } else {
            Log.d(TAG, "Not an incoming call notification. Type: " + (data != null ? data.get("type") : "null"));
        }
        
        // Ensure notification service is running when message is received (even when app is closed)
        startNotificationService();
        
        // Start KeepAliveService to ensure background JS runtime can process the message
        // This is critical when the app is closed - it starts the JS runtime so setBackgroundMessageHandler can run
        try {
            Intent keepAlive = new Intent(this, KeepAliveService.class);
            startService(keepAlive);
            Log.d(TAG, "KeepAliveService started for FCM message to enable JS runtime");
        } catch (Exception e) {
            Log.e(TAG, "Error starting KeepAliveService", e);
        }
        
        // IMPORTANT: Call super to ensure React Native Firebase processes the message
        // React Native Firebase's setBackgroundMessageHandler in index.js will handle the actual message
        // Our custom service ensures the background services are running so JS can execute
        super.onMessageReceived(remoteMessage);
    }

    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "New FCM token received: " + token);
        // Token refresh will be handled by React Native's messaging().onTokenRefresh()
        super.onNewToken(token);
    }

    /**
     * Handle incoming call notification by displaying a native Android notification
     * This ensures the notification is shown even when the app is completely closed
     */
    private void handleIncomingCallNotification(Map<String, String> data) {
        try {
            // Extract data from FCM payload (server sends 'from' field, not 'callerId')
            String callerName = data.get("callerName") != null ? data.get("callerName") : "Unknown Caller";
            String callerId = data.get("callerId") != null ? data.get("callerId") : (data.get("from") != null ? data.get("from") : "");
            String channelName = data.get("channelName") != null ? data.get("channelName") : "";
            boolean isAudio = "true".equals(data.get("isAudio")) || "true".equalsIgnoreCase(data.get("isAudio"));
            String callerProfilePic = data.get("callerProfilePic") != null ? data.get("callerProfilePic") : "";

            Log.d(TAG, "📞 Displaying incoming call notification:");
            Log.d(TAG, "   Caller Name: " + callerName);
            Log.d(TAG, "   Caller ID: " + callerId);
            Log.d(TAG, "   Channel Name: " + channelName);
            Log.d(TAG, "   Is Audio: " + isAudio);
            Log.d(TAG, "   Profile Pic: " + (callerProfilePic.isEmpty() ? "none" : "present"));
            
            // Validate required fields
            if (callerId == null || callerId.isEmpty()) {
                Log.e(TAG, "❌ Error: callerId/from is missing from FCM data");
                return;
            }
            if (channelName == null || channelName.isEmpty()) {
                Log.e(TAG, "❌ Error: channelName is missing from FCM data");
                return;
            }

            // Create intent to open the app with incoming call data
            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra("type", "incoming_call");
            intent.putExtra("callerId", callerId);
            intent.putExtra("callerName", callerName);
            intent.putExtra("callerProfilePic", callerProfilePic);
            intent.putExtra("channelName", channelName);
            intent.putExtra("isAudio", isAudio);
            
            PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT
            );

            // Create full-screen intent for incoming calls (Android 10+)
            PendingIntent fullScreenIntent = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                fullScreenIntent = PendingIntent.getActivity(
                    this,
                    1,
                    intent,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT
                );
            }

            // Create accept action
            Intent acceptIntent = new Intent(this, MainActivity.class);
            acceptIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            acceptIntent.putExtra("type", "incoming_call");
            acceptIntent.putExtra("action", "accept");
            acceptIntent.putExtra("callerId", callerId);
            acceptIntent.putExtra("callerName", callerName);
            acceptIntent.putExtra("callerProfilePic", callerProfilePic);
            acceptIntent.putExtra("channelName", channelName);
            acceptIntent.putExtra("isAudio", isAudio);
            acceptIntent.putExtra("autoAccept", true);
            
            PendingIntent acceptPendingIntent = PendingIntent.getActivity(
                this,
                2,
                acceptIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT
            );

            // Create reject action
            Intent rejectIntent = new Intent(this, MainActivity.class);
            rejectIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            rejectIntent.putExtra("type", "incoming_call");
            rejectIntent.putExtra("action", "reject");
            rejectIntent.putExtra("callerId", callerId);
            rejectIntent.putExtra("channelName", channelName);
            rejectIntent.putExtra("isAudio", isAudio);
            
            PendingIntent rejectPendingIntent = PendingIntent.getActivity(
                this,
                3,
                rejectIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT
            );

            // Build notification
            String title = isAudio ? "Incoming Audio Call" : "Incoming Video Call";
            String body = "Call from " + callerName;

            NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, INCOMING_CALL_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setAutoCancel(false)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
                .setVibrate(new long[]{0, 300, 500, 300, 500})
                .setFullScreenIntent(fullScreenIntent, true)
                .addAction(R.mipmap.ic_launcher, "Accept", acceptPendingIntent)
                .addAction(R.mipmap.ic_launcher, "Reject", rejectPendingIntent);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.notify(INCOMING_CALL_NOTIFICATION_ID, notificationBuilder.build());
                Log.d(TAG, "✅ Incoming call notification displayed successfully with ID: " + INCOMING_CALL_NOTIFICATION_ID);
            } else {
                Log.e(TAG, "❌ NotificationManager is null - cannot display notification");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error displaying incoming call notification", e);
            e.printStackTrace();
        }
    }

    /**
     * Create notification channel for incoming calls with high priority
     */
    private void createIncomingCallChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                INCOMING_CALL_CHANNEL_ID,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Full-screen incoming call notifications");
            channel.setShowBadge(true);
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 500, 300, 500});
            channel.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                android.media.AudioAttributes.Builder()
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build()
            );
            channel.setBypassDnd(true); // Bypass Do Not Disturb
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
                Log.d(TAG, "Incoming call notification channel created");
            }
        }
    }

    /**
     * Start the NotificationService to ensure background processing is active
     */
    private void startNotificationService() {
        try {
            Intent serviceIntent = new Intent(this, NotificationService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            Log.d(TAG, "NotificationService started from FCM service");
        } catch (Exception e) {
            Log.e(TAG, "Error starting NotificationService from FCM", e);
        }
    }
}
