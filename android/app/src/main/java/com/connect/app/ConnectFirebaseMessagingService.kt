package com.connect.app

import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

class ConnectFirebaseMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    if (data["type"] == "incoming_call") {
      if (IncomingCallStore.reactRunning) {
        super.onMessageReceived(remoteMessage)
      } else {
        IncomingCallNotifier.show(applicationContext, data)
      }
      return
    }
    super.onMessageReceived(remoteMessage)
  }
}
