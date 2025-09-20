import { AppItem } from './appData';

/**
 * Fallback apps to show when device apps are not available
 * These are common apps that most users have installed
 */
export const fallbackApps: AppItem[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: 'message',
    color: '#25D366',
    onPress: () => console.log('WhatsApp - Launch manually'),
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'photo-camera',
    color: '#E4405F',
    onPress: () => console.log('Instagram - Launch manually'),
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'facebook',
    color: '#1877F2',
    onPress: () => console.log('Facebook - Launch manually'),
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'play-circle-filled',
    color: '#FF0000',
    onPress: () => console.log('YouTube - Launch manually'),
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: 'email',
    color: '#EA4335',
    onPress: () => console.log('Gmail - Launch manually'),
  },
  {
    id: 'maps',
    name: 'Maps',
    icon: 'map',
    color: '#4285F4',
    onPress: () => console.log('Maps - Launch manually'),
  },
  {
    id: 'camera',
    name: 'Camera',
    icon: 'camera-alt',
    color: '#607D8B',
    onPress: () => console.log('Camera - Launch manually'),
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: 'calculate',
    color: '#795548',
    onPress: () => console.log('Calculator - Launch manually'),
  },
  {
    id: 'photos',
    name: 'Photos',
    icon: 'photo-library',
    color: '#9C27B0',
    onPress: () => console.log('Photos - Launch manually'),
  },
  {
    id: 'music',
    name: 'Music',
    icon: 'music-note',
    color: '#FF9800',
    onPress: () => console.log('Music - Launch manually'),
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: 'settings',
    color: '#757575',
    onPress: () => console.log('Settings - Launch manually'),
  },
  {
    id: 'phone',
    name: 'Phone',
    icon: 'phone',
    color: '#4CAF50',
    onPress: () => console.log('Phone - Launch manually'),
  },
];
