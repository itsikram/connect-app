import { Platform } from 'react-native';
import { isAndroidExpoGo } from './expoGo';

// Which conversation is currently on screen. The foreground notification
// handler (index.js) reads this so a message from the person you are
// already chatting with doesn't also pop a banner.
let activeChatId: string | null = null;

export function setActiveChat(profileId?: string | null) {
  activeChatId = profileId ? String(profileId) : null;
}

export function getActiveChat(): string | null {
  return activeChatId;
}

export function isChatNotification(data: any): boolean {
  const type = data?.type;
  return type === 'chat' || type === 'new_message' || type === 'message';
}

// Remove notifications from this sender that are still in the tray once the
// conversation has been opened.
export async function dismissChatNotifications(senderId?: string | null) {
  if (!senderId || Platform.OS === 'web' || isAndroidExpoGo()) return;
  try {
    const Notifications = require('expo-notifications');
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      (presented || [])
        .filter((notification: any) => {
          const data = notification?.request?.content?.data || {};
          const from = data.senderId || data.callerId || data.friendId;
          return from && String(from) === String(senderId) &&
            (isChatNotification(data) || data.type === 'missed_call');
        })
        .map((notification: any) =>
          Notifications.dismissNotificationAsync(notification.request.identifier),
        ),
    );
  } catch (_error) {
    // Not fatal: the tray simply keeps the old notification.
  }
}

// Route params for opening a conversation from notification data. The chat
// screen reads `route.params.connect`; notifications only carry ids/names,
// so build the minimal connect object it needs.
export function chatParamsFromNotification(data: any) {
  const id = data?.senderId || data?.callerId || data?.friendId;
  if (!id) return null;
  return {
    connect: {
      _id: String(id),
      fullName: data?.senderName || data?.connectName || data?.callerName || '',
      profilePic: data?.senderPic || data?.senderProfilePic || data?.callerProfilePic || '',
    },
  };
}
