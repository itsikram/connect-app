package com.connect.app;

import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Custom Firebase Messaging Service to handle FCM messages when app is closed
 * This ensures notifications are received and processed even when the app is killed
 */
public class ConnectFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "ConnectFCMService";

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "ConnectFirebaseMessagingService created");
        // Ensure notification service is running when FCM service is created
        startNotificationService();
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "FCM message received from: " + remoteMessage.getFrom());
        Log.d(TAG, "Message data: " + remoteMessage.getData());
        
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
