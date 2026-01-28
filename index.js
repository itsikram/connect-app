/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, ErrorUtils } from 'react-native';
// react-native-reanimated removed for Expo compatibility

// Global error handler for unhandled errors
// Check if ErrorUtils is available before using it
let originalErrorHandler = null;
if (ErrorUtils && typeof ErrorUtils.getGlobalHandler === 'function') {
  try {
    originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      try {
        // Always log errors (even in production) so we can diagnose crashes
        console.error('Global error handler:', {
          message: error?.message || String(error),
          stack: error?.stack,
          isFatal: isFatal,
          name: error?.name
        });
        
        // Prevent app crash by handling the error gracefully
        // The ErrorBoundary will catch React errors
        // Don't call original handler - it will crash the app
        // Instead, let React Native handle it gracefully or show error UI
        
        // Only in extreme cases where we absolutely must crash, call original handler
        // But try to avoid this to prevent automatic crashes
        if (isFatal && originalErrorHandler) {
          // Check if this is a truly unrecoverable error
          const errorMessage = error?.message || String(error) || '';
          const isUnrecoverable = errorMessage.includes('OutOfMemory') || 
                                  errorMessage.includes('Native module') ||
                                  errorMessage.includes('JNI');
          
          if (isUnrecoverable) {
            // Only crash for truly unrecoverable errors
            if (__DEV__) {
              console.error('Fatal unrecoverable error, calling original handler');
            }
            originalErrorHandler(error, isFatal);
          } else {
            // For other fatal errors, log but don't crash
            console.error('Fatal error caught, preventing crash:', error);
          }
        }
      } catch (e) {
        // If error handler itself fails, log but don't crash
        console.error('Error in global error handler:', e);
        // Don't call original handler here - it would cause a crash loop
      }
    });
  } catch (e) {
    // If setting error handler fails, continue anyway
    console.error('Failed to set global error handler:', e);
  }
}

// Handle unhandled promise rejections
if (typeof global !== 'undefined' && !global.HermesInternal) {
  const originalUnhandledRejection = global.onunhandledrejection;
  global.onunhandledrejection = (event) => {
    try {
      // Always log promise rejections to diagnose issues
      const reason = event?.reason || event;
      console.error('Unhandled promise rejection:', {
        message: reason?.message || String(reason),
        stack: reason?.stack,
        error: reason
      });
      
      // Prevent default crash behavior
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    } catch (e) {
      // Log but don't crash if error handler fails
      console.error('Error in unhandled rejection handler:', e);
      // Don't call original handler - it might crash
    }
  };
}

// Reduce console.log overhead in production
if (!__DEV__) {
  const noop = () => {};
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  // Keep error logs but reduce others
  console.log = noop;
  console.warn = noop;
  // Keep console.error for critical errors
}
// Ensure vector icon fonts are loaded early to avoid missing icons on Android/iOS
try {
  // MaterialIcons
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const MaterialIcons = require('react-native-vector-icons/MaterialIcons').default;
  if (MaterialIcons && MaterialIcons.loadFont) {
    MaterialIcons.loadFont();
  }
  // FontAwesome5
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FA5 = require('react-native-vector-icons/FontAwesome5').default;
  if (FA5 && FA5.loadFont) {
    FA5.loadFont();
  }
} catch (_) {}
import App from './App';
import { registerRootComponent } from 'expo';

// Register the app component
registerRootComponent(App);
