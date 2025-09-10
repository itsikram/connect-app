import { displayIncomingCallNotification, initializeNotifications } from './push';

// Test function to verify notifications are working
export async function testIncomingCallNotification() {
  try {
    console.log('Testing incoming call notification...');
    
    // Initialize notifications first
    const initialized = await initializeNotifications();
    if (!initialized) {
      console.error('Failed to initialize notifications');
      return false;
    }
    
    // Display a test notification
    await displayIncomingCallNotification({
      callerName: 'Test Caller',
      callerProfilePic: '',
      channelName: 'test_channel_123',
      isAudio: true,
      callerId: 'test_user_123',
    });
    
    console.log('Test notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error testing notification:', error);
    return false;
  }
}

// Test function for regular notifications
export async function testRegularNotification() {
  try {
    const { displayLocalNotification } = await import('./push');
    
    await displayLocalNotification(
      'Test Notification',
      'This is a test notification to verify the setup is working',
      { type: 'test' }
    );
    
    console.log('Test regular notification sent');
    return true;
  } catch (error) {
    console.error('Error testing regular notification:', error);
    return false;
  }
}
