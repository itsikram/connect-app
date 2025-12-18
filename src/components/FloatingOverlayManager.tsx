import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useFloatingOverlay } from '../hooks/useFloatingOverlay';
import { MenuOption } from '../lib/overlay';
import { useLudoGame } from '../contexts/LudoGameContext';
import { useChessGame } from '../contexts/ChessGameContext';

interface FloatingOverlayManagerProps {
  enabled?: boolean;
  menuOptions?: MenuOption[];
}

/**
 * Component to manage the floating overlay button with menu
 * Add this to your App.tsx to enable the floating button globally
 */
export default function FloatingOverlayManager({ 
  enabled = true,
  menuOptions: customMenuOptions 
}: FloatingOverlayManagerProps) {
  const navigation = useNavigation();
  const { setLudoGameActive } = useLudoGame();
  const { setChessGameActive } = useChessGame();

  const defaultMenuOptions: MenuOption[] = [
    // Main navigation
    {
      id: 'home',
      label: 'Home',
      icon: 'home',
    },
    {
      id: 'message',
      label: 'Messages',
      icon: 'message',
    },
    {
      id: 'friends',
      label: 'Friends',
      icon: 'people',
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: 'person',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
    },
    // Menu page apps
    {
      id: 'ludo',
      label: 'Ludo',
      icon: 'casino',
    },
    {
      id: 'chess',
      label: 'Chess',
      icon: 'sports-esports',
    },
    {
      id: 'camera',
      label: 'Camera',
      icon: 'camera-alt',
    },
    {
      id: 'gallery',
      label: 'Gallery',
      icon: 'photo-library',
    },
    {
      id: 'mediaPlayer',
      label: 'Media Player',
      icon: 'play-circle-filled',
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: 'facebook',
    },
    {
      id: 'youtube',
      label: 'YouTube',
      icon: 'play-circle-filled',
    },
    {
      id: 'vpnBrowser',
      label: 'VPN Browser',
      icon: 'vpn-key',
    },
    {
      id: 'maps',
      label: 'Maps',
      icon: 'map',
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: 'contacts',
    },
    {
      id: 'cricbuzz',
      label: 'Cricbuzz',
      icon: 'sports-cricket',
    },
    {
      id: 'downloads',
      label: 'Downloads',
      icon: 'download',
    },
  ];

  const menuOptions = customMenuOptions || defaultMenuOptions;

  const handleMenuOptionClick = (optionId: string) => {
    console.log('Floating overlay menu item clicked:', optionId);
    
    try {
      switch (optionId) {
        // Main navigation
        case 'home':
          (navigation as any).navigate('Home');
          break;
        case 'message':
          (navigation as any).navigate('Message');
          break;
        case 'friends':
          (navigation as any).navigate('Friends');
          break;
        case 'profile':
          (navigation as any).navigate('Menu', { screen: 'MyProfile' });
          break;
        case 'settings':
          (navigation as any).navigate('Menu', { screen: 'Settings' });
          break;
        // Menu page apps
        case 'ludo':
          setLudoGameActive(true);
          break;
        case 'chess':
          setChessGameActive(true);
          break;
        case 'camera':
          (navigation as any).navigate('Home', { screen: 'Camera' });
          break;
        case 'gallery':
          (navigation as any).navigate('Home', { screen: 'Gallery' });
          break;
        case 'mediaPlayer':
          (navigation as any).navigate('Menu', {
            screen: 'MediaPlayer',
            params: {
              source: {
                type: 'video',
                uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                title: 'Sample Video',
              }
            }
          });
          break;
        case 'facebook':
          (navigation as any).navigate('Menu', { screen: 'Facebook' });
          break;
        case 'youtube':
          (navigation as any).navigate('Menu', { screen: 'YouTube' });
          break;
        case 'vpnBrowser':
          (navigation as any).navigate('Menu', { screen: 'VpnBrowser' });
          break;
        case 'maps':
          (navigation as any).navigate('Menu', { screen: 'GoogleMaps' });
          break;
        case 'contacts':
          (navigation as any).navigate('Menu', { screen: 'GoogleContacts' });
          break;
        case 'cricbuzz':
          (navigation as any).navigate('Menu', { screen: 'Cricbuzz' });
          break;
        case 'downloads':
          (navigation as any).navigate('Menu', { screen: 'Downloads' });
          break;
        default:
          console.warn('Unknown menu option:', optionId);
      }
    } catch (error) {
      console.error('Error navigating from floating overlay:', error);
    }
  };

  const { start, stop } = useFloatingOverlay({
    menuOptions,
    onMenuOptionClick: handleMenuOptionClick,
    enabled,
  });

  useEffect(() => {
    if (enabled) {
      // Start the overlay when component mounts
      start().then((success) => {
        if (success) {
          console.log('✅ Floating overlay started successfully');
        } else {
          console.warn('⚠️ Failed to start floating overlay');
        }
      });

      // Cleanup: stop overlay when component unmounts
      return () => {
        stop().then((success) => {
          if (success) {
            console.log('✅ Floating overlay stopped');
          }
        });
      };
    }
  }, [enabled, start, stop]);

  // This component doesn't render anything
  return null;
}

