import { useEffect, useCallback, useRef } from 'react';
import { 
  ensureOverlayPermission, 
  startSystemOverlay, 
  stopSystemOverlay, 
  setOverlayMenuOptions,
  addOverlayMenuClickListener,
  MenuOption 
} from '../lib/overlay';
import { Platform } from 'react-native';

export interface UseFloatingOverlayOptions {
  menuOptions?: MenuOption[];
  onMenuOptionClick?: (optionId: string) => void;
  enabled?: boolean;
}

export function useFloatingOverlay({
  menuOptions = [],
  onMenuOptionClick,
  enabled = true,
}: UseFloatingOverlayOptions = {}) {
  const listenerRef = useRef<(() => void) | null>(null);

  const start = useCallback(async () => {
    if (Platform.OS !== 'android' || !enabled) return false;
    
    try {
      // Request overlay permission
      const hasPermission = await ensureOverlayPermission();
      if (!hasPermission) {
        console.warn('Overlay permission not granted');
        return false;
      }

      // Start the overlay service
      const started = await startSystemOverlay();
      if (!started) {
        console.warn('Failed to start overlay service');
        return false;
      }

      // Set menu options if provided
      if (menuOptions.length > 0) {
        await setOverlayMenuOptions(menuOptions);
      }

      // Add menu click listener if provided
      if (onMenuOptionClick) {
        listenerRef.current = addOverlayMenuClickListener(onMenuOptionClick);
      }

      return true;
    } catch (error) {
      console.error('Error starting floating overlay:', error);
      return false;
    }
  }, [menuOptions, onMenuOptionClick, enabled]);

  const stop = useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    
    // Remove listener
    if (listenerRef.current) {
      listenerRef.current();
      listenerRef.current = null;
    }

    try {
      return await stopSystemOverlay();
    } catch (error) {
      console.error('Error stopping floating overlay:', error);
      return false;
    }
  }, []);

  const updateMenuOptions = useCallback(async (options: MenuOption[]) => {
    if (Platform.OS !== 'android' || !enabled) return false;
    try {
      return await setOverlayMenuOptions(options);
    } catch (error) {
      console.error('Error updating menu options:', error);
      return false;
    }
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        listenerRef.current();
      }
    };
  }, []);

  return {
    start,
    stop,
    updateMenuOptions,
  };
}






