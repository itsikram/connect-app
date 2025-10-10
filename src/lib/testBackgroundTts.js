/**
 * Test script for background TTS functionality
 * This can be used to test TTS when the app is running
 */

import { backgroundTtsService } from './backgroundTtsService';

export const testBackgroundTts = async () => {
  try {
    console.log('🧪 Starting background TTS tests...');
    
    // Initialize the service
    await backgroundTtsService.initialize();
    console.log('✅ Background TTS service initialized');
    
    // Test 1: Basic message
    console.log('🧪 Test 1: Basic message');
    await backgroundTtsService.speakMessage('Hello, this is a test of the background TTS service.', {
      priority: 'normal',
      interrupt: false
    });
    
    // Wait for speech to finish
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 2: Incoming call notification
    console.log('🧪 Test 2: Incoming call notification');
    await backgroundTtsService.speakIncomingCall('John Doe', false);
    
    // Wait for speech to finish
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 3: New message notification
    console.log('🧪 Test 3: New message notification');
    await backgroundTtsService.speakNewMessage('Alice', 'Hey, how are you doing today?');
    
    // Wait for speech to finish
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 4: General notification
    console.log('🧪 Test 4: General notification');
    await backgroundTtsService.speakNotification('System Update', 'Your app has been updated to version 2.0');
    
    // Wait for speech to finish
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 5: Interrupt test
    console.log('🧪 Test 5: Interrupt test');
    await backgroundTtsService.speakMessage('This is a long message that should be interrupted by the next message.', {
      priority: 'normal',
      interrupt: false
    });
    
    // Wait a bit then interrupt
    await new Promise(resolve => setTimeout(resolve, 1000));
    await backgroundTtsService.speakMessage('This message should interrupt the previous one.', {
      priority: 'high',
      interrupt: true
    });
    
    console.log('✅ All background TTS tests completed successfully');
    
  } catch (error) {
    console.error('❌ Background TTS test failed:', error);
  }
};

export const testTtsSettings = async () => {
  try {
    console.log('🧪 Testing TTS settings...');
    
    const currentSettings = backgroundTtsService.getSettings();
    console.log('Current TTS settings:', currentSettings);
    
    // Test different settings
    await backgroundTtsService.saveSettings({
      rate: 0.3, // Slower speech
      volume: 0.8, // Lower volume
      pitch: 1.5, // Higher pitch
    });
    
    await backgroundTtsService.speakMessage('This message should be slower, quieter, and higher pitched.');
    
    // Wait for speech to finish
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Reset to default
    await backgroundTtsService.saveSettings({
      rate: 0.5,
      volume: 1.0,
      pitch: 1.0,
    });
    
    await backgroundTtsService.speakMessage('This message should be back to normal settings.');
    
    console.log('✅ TTS settings test completed');
    
  } catch (error) {
    console.error('❌ TTS settings test failed:', error);
  }
};

export const testBackgroundNotificationSimulation = async () => {
  try {
    console.log('🧪 Simulating background notifications...');
    
    // Simulate different types of background notifications
    const notifications = [
      {
        type: 'incoming_call',
        data: {
          callerName: 'Jane Smith',
          isAudio: 'true',
          callerId: 'user123',
          channelName: 'call_channel_123'
        }
      },
      {
        type: 'new_message',
        data: {
          senderName: 'Bob Johnson',
          message: 'Are you free for a meeting tomorrow?'
        }
      },
      {
        type: 'notification',
        data: {
          title: 'Friend Request',
          body: 'Sarah Wilson sent you a friend request'
        }
      }
    ];
    
    for (let i = 0; i < notifications.length; i++) {
      const notification = notifications[i];
      console.log(`🧪 Processing notification ${i + 1}:`, notification.type);
      
      switch (notification.type) {
        case 'incoming_call':
          await backgroundTtsService.speakIncomingCall(
            notification.data.callerName,
            notification.data.isAudio === 'true'
          );
          break;
          
        case 'new_message':
          await backgroundTtsService.speakNewMessage(
            notification.data.senderName,
            notification.data.message
          );
          break;
          
        case 'notification':
          await backgroundTtsService.speakNotification(
            notification.data.title,
            notification.data.body
          );
          break;
      }
      
      // Wait between notifications
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('✅ Background notification simulation completed');
    
  } catch (error) {
    console.error('❌ Background notification simulation failed:', error);
  }
};

export default {
  testBackgroundTts,
  testTtsSettings,
  testBackgroundNotificationSimulation
};

