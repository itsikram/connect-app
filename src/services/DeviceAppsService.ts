import { AppItem } from '../data/appData';

// Import with error handling for cases where the package is not properly linked
let InstalledApps: any = null;
try {
  InstalledApps = require('react-native-installed-apps').default;
} catch (error) {
  console.warn('react-native-installed-apps not available:', error);
}

export interface DeviceApp {
  packageName: string;
  appName: string;
  icon?: string;
  version?: string;
  isSystemApp?: boolean;
}

// Popular app icons mapping for better visual representation
const APP_ICON_MAP: { [key: string]: string } = {
  'com.whatsapp': 'message',
  'com.instagram.android': 'photo-camera',
  'com.facebook.katana': 'facebook',
  'com.twitter.android': 'chat',
  'com.google.android.youtube': 'play-circle-filled',
  'com.google.android.gm': 'email',
  'com.google.android.apps.maps': 'map',
  'com.google.android.calendar': 'event',
  'com.google.android.apps.photos': 'photo-library',
  'com.google.android.music': 'music-note',
  'com.android.camera2': 'camera-alt',
  'com.android.calculator2': 'calculate',
  'com.google.android.apps.weather': 'wb-sunny',
  'com.google.android.keep': 'note',
  'com.android.settings': 'settings',
  'com.android.dialer': 'phone',
  'com.android.contacts': 'contacts',
  'com.android.documentsui': 'folder',
  'com.android.deskclock': 'access-time',
  'com.android.gallery3d': 'photo',
  'com.android.gallery': 'photo',
  'com.google.android.apps.messaging': 'message',
  'com.android.chrome': 'language',
  'com.spotify.music': 'music-note',
  'com.netflix.mediaclient': 'movie',
  'com.amazon.mShop.android.shopping': 'shopping-cart',
  'com.ubercab': 'local-taxi',
  'com.google.android.apps.translate': 'translate',
  'com.google.android.apps.docs': 'description',
  'com.google.android.apps.sheets': 'table-chart',
  'com.google.android.apps.slides': 'slideshow',
  'com.microsoft.office.outlook': 'email',
  'com.microsoft.office.word': 'description',
  'com.microsoft.office.excel': 'table-chart',
  'com.microsoft.office.powerpoint': 'slideshow',
  'com.discord': 'chat',
  'com.telegram.messenger': 'message',
  'com.snapchat.android': 'photo-camera',
  'com.tiktok': 'video-library',
  'com.pinterest': 'photo',
  'com.linkedin.android': 'work',
  'com.reddit.frontpage': 'forum',
  'com.twitch.tv.viewer': 'videogame-asset',
  'com.google.android.apps.tachyon': 'video-call',
  'com.skype.raider': 'video-call',
  'com.zoom.videomeetings': 'video-call',
  'com.microsoft.teams': 'video-call',
};

// Color mapping for popular apps
const APP_COLOR_MAP: { [key: string]: string } = {
  'com.whatsapp': '#25D366',
  'com.instagram.android': '#E4405F',
  'com.facebook.katana': '#1877F2',
  'com.twitter.android': '#1DA1F2',
  'com.google.android.youtube': '#FF0000',
  'com.google.android.gm': '#EA4335',
  'com.google.android.apps.maps': '#4285F4',
  'com.google.android.calendar': '#34A853',
  'com.google.android.apps.photos': '#9C27B0',
  'com.google.android.music': '#FF9800',
  'com.android.camera2': '#607D8B',
  'com.android.calculator2': '#795548',
  'com.google.android.apps.weather': '#FFC107',
  'com.google.android.keep': '#4CAF50',
  'com.android.settings': '#757575',
  'com.android.dialer': '#4CAF50',
  'com.android.contacts': '#2196F3',
  'com.android.documentsui': '#FF9800',
  'com.android.deskclock': '#673AB7',
  'com.android.gallery3d': '#E91E63',
  'com.android.gallery': '#E91E63',
  'com.google.android.apps.messaging': '#25D366',
  'com.android.chrome': '#4285F4',
  'com.spotify.music': '#1DB954',
  'com.netflix.mediaclient': '#E50914',
  'com.amazon.mShop.android.shopping': '#FF9900',
  'com.ubercab': '#000000',
  'com.google.android.apps.translate': '#4285F4',
  'com.google.android.apps.docs': '#4285F4',
  'com.google.android.apps.sheets': '#0F9D58',
  'com.google.android.apps.slides': '#F4B400',
  'com.microsoft.office.outlook': '#0078D4',
  'com.microsoft.office.word': '#2B579A',
  'com.microsoft.office.excel': '#217346',
  'com.microsoft.office.powerpoint': '#D24726',
  'com.discord': '#5865F2',
  'com.telegram.messenger': '#0088CC',
  'com.snapchat.android': '#FFFC00',
  'com.tiktok': '#000000',
  'com.pinterest': '#E60023',
  'com.linkedin.android': '#0077B5',
  'com.reddit.frontpage': '#FF4500',
  'com.twitch.tv.viewer': '#9146FF',
  'com.google.android.apps.tachyon': '#4285F4',
  'com.skype.raider': '#00AFF0',
  'com.zoom.videomeetings': '#2D8CFF',
  'com.microsoft.teams': '#6264A7',
};

export class DeviceAppsService {
  /**
   * Check if the InstalledApps package is available
   */
  static isPackageAvailable(): boolean {
    return InstalledApps !== null;
  }

  /**
   * Fetch all installed apps from the device
   */
  static async getInstalledApps(): Promise<DeviceApp[]> {
    if (!this.isPackageAvailable()) {
      console.warn('react-native-installed-apps package not available');
      return [];
    }

    try {
      const installedApps = await InstalledApps.getInstalledApps();
      
      // Filter out system apps and return user apps
      const userApps = installedApps.filter((app: any) => 
        !app.isSystemApp && 
        app.appName && 
        app.appName.trim() !== '' &&
        app.packageName !== 'com.connect.app' // Exclude our own app
      );

      // Sort apps alphabetically by name
      return userApps.sort((a: any, b: any) => 
        a.appName.localeCompare(b.appName)
      );
    } catch (error) {
      console.error('Error fetching installed apps:', error);
      return [];
    }
  }

  /**
   * Convert DeviceApp to AppItem format for the grid
   */
  static convertToAppItem(deviceApp: DeviceApp): AppItem {
    const icon = APP_ICON_MAP[deviceApp.packageName] || 'apps';
    const color = APP_COLOR_MAP[deviceApp.packageName] || '#757575';

    return {
      id: deviceApp.packageName,
      name: deviceApp.appName,
      icon: icon,
      color: color,
      packageName: deviceApp.packageName,
      isDeviceApp: true,
      onPress: () => {
        this.launchApp(deviceApp.packageName);
      }
    };
  }

  /**
   * Launch an app by package name
   */
  static async launchApp(packageName: string): Promise<void> {
    if (!this.isPackageAvailable()) {
      console.warn('react-native-installed-apps package not available');
      return;
    }

    try {
      await InstalledApps.openApp(packageName);
    } catch (error) {
      console.error(`Error launching app ${packageName}:`, error);
      // You could show a toast message here if needed
    }
  }

  /**
   * Get device apps formatted for the grid
   */
  static async getDeviceAppsForGrid(): Promise<AppItem[]> {
    try {
      const deviceApps = await this.getInstalledApps();
      return deviceApps.map(app => this.convertToAppItem(app));
    } catch (error) {
      console.error('Error getting device apps for grid:', error);
      return [];
    }
  }

  /**
   * Check if we have permission to query installed packages
   */
  static async hasPermission(): Promise<boolean> {
    if (!this.isPackageAvailable()) {
      return false;
    }

    try {
      // This will throw an error if we don't have permission
      await InstalledApps.getInstalledApps();
      return true;
    } catch (error) {
      return false;
    }
  }
}
