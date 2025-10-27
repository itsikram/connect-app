// Define AppItem interface locally to avoid circular dependency
export interface AppItem {
  id: string;
  name: string;
  icon?: string;
  logo?: string;
  color?: string;
  onPress?: () => void;
  packageName?: string; // For device apps
  isDeviceApp?: boolean; // Flag to identify device apps
}

// Sample app data with popular apps and their icons/logos - Modern Android style
export const sampleApps: AppItem[] = [
  {
    id: 'Ludu',
    name: 'Ludu',
    icon: 'gamepad',
    color: '#25D366',
    onPress: () => {
      // Navigation will be handled by the AppGrid component
      console.log('Ludu pressed - navigation handled by AppGrid');
    },
  },
  {
    id: 'mediaPlayer',
    name: 'Media Player',
    icon: 'play-circle-filled',
    color: '#FF9800',
    onPress: () => console.log('Media Player pressed'),
  },
  {
    id: 'Chess',
    name: 'Chess',
    icon: 'sports-esports',
    color: '#3F51B5',
    onPress: () => {
      // Navigation will be handled by the AppGrid component
      console.log('Chess pressed - navigation handled by AppGrid');
    },
  }
  ,
  {
    id: 'EmotionFaceMesh',
    name: 'FaceMesh',
    icon: 'face',
    color: '#FF6F61',
    onPress: () => {
      // Navigation handled in Menu via handleAppPress
      console.log('FaceMesh demo pressed');
    },
  },
  {
    id: 'camera',
    name: 'Camera',
    icon: 'camera-alt',
    color: '#607D8B',
    onPress: () => console.log('Camera pressed'),
  },
  {
    id: 'gallery',
    name: 'Gallery',
    icon: 'photo',
    color: '#E91E63',
    onPress: () => console.log('Gallery pressed'),
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: 'message',
    color: '#25D366',
    onPress: () => console.log('WhatsApp pressed'),
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'photo-camera',
    color: '#E4405F',
    onPress: () => console.log('Instagram pressed'),
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'facebook',
    color: '#1877F2',
    onPress: () => console.log('Facebook pressed'),
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: 'chat',
    color: '#1DA1F2',
    onPress: () => console.log('Twitter pressed'),
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'play-circle-filled',
    color: '#FF0000',
    onPress: () => console.log('YouTube pressed'),
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: 'email',
    color: '#EA4335',
    onPress: () => console.log('Gmail pressed'),
  },
  {
    id: 'maps',
    name: 'Maps',
    icon: 'map',
    color: '#4285F4',
    onPress: () => console.log('Maps pressed'),
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: 'event',
    color: '#34A853',
    onPress: () => console.log('Calendar pressed'),
  },
  {
    id: 'photos',
    name: 'Photos',
    icon: 'photo-library',
    color: '#9C27B0',
    onPress: () => console.log('Photos pressed'),
  },
  {
    id: 'music',
    name: 'Music',
    icon: 'music-note',
    color: '#FF9800',
    onPress: () => console.log('Music pressed'),
  },

  {
    id: 'calculator',
    name: 'Calculator',
    icon: 'calculate',
    color: '#795548',
    onPress: () => console.log('Calculator pressed'),
  },
  {
    id: 'weather',
    name: 'Weather',
    icon: 'wb-sunny',
    color: '#FFC107',
    onPress: () => console.log('Weather pressed'),
  },
  {
    id: 'notes',
    name: 'Notes',
    icon: 'note',
    color: '#4CAF50',
    onPress: () => console.log('Notes pressed'),
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: 'settings',
    color: '#757575',
    onPress: () => console.log('Settings pressed'),
  },
  {
    id: 'phone',
    name: 'Phone',
    icon: 'phone',
    color: '#4CAF50',
    onPress: () => console.log('Phone pressed'),
  },
  {
    id: 'contacts',
    name: 'Contacts',
    icon: 'contacts',
    color: '#2196F3',
    onPress: () => console.log('Contacts pressed'),
  },
  {
    id: 'files',
    name: 'Files',
    icon: 'folder',
    color: '#FF9800',
    onPress: () => console.log('Files pressed'),
  },
  {
    id: 'clock',
    name: 'Clock',
    icon: 'access-time',
    color: '#673AB7',
    onPress: () => console.log('Clock pressed'),
  }
];

// App data with external logos (you can replace these with actual logo URLs)
export const appsWithLogos: AppItem[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
    color: '#25D366',
    onPress: () => console.log('WhatsApp pressed'),
  },
  {
    id: 'instagram',
    name: 'Instagram',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg',
    color: '#E4405F',
    onPress: () => console.log('Instagram pressed'),
  },
  {
    id: 'facebook',
    name: 'Facebook',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg',
    color: '#1877F2',
    onPress: () => console.log('Facebook pressed'),
  },
  {
    id: 'twitter',
    name: 'Twitter',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Logo_of_Twitter.svg',
    color: '#1DA1F2',
    onPress: () => console.log('Twitter pressed'),
  },
  {
    id: 'youtube',
    name: 'YouTube',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg',
    color: '#FF0000',
    onPress: () => console.log('YouTube pressed'),
  },
  {
    id: 'gmail',
    name: 'Gmail',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg',
    color: '#EA4335',
    onPress: () => console.log('Gmail pressed'),
  },
];
