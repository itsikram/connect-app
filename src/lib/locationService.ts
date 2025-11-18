import BackgroundGeolocation, {
  Location,
  State,
  Config,
  MotionChangeEvent,
  GeofenceEvent,
  HeartbeatEvent,
  HttpEvent,
  ConnectivityChangeEvent,
  AuthorizationEvent,
} from 'react-native-background-geolocation';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userAPI } from './api';

const PROFILE_ID_KEY = 'locationService_profileId';

interface LocationUpdateCallback {
  (location: Location): void;
}

class LocationService {
  private isInitialized = false;
  private isEnabled = false;
  private profileId: string | null = null;
  private updateCallbacks: LocationUpdateCallback[] = [];
  private lastLocationUpdateTime = 0;
  private readonly MIN_UPDATE_INTERVAL = 30000; // 30 seconds minimum between updates

  /**
   * Initialize the location service
   */
  async initialize(profileId: string): Promise<void> {
    if (this.isInitialized) {
      console.log('📍 Location service already initialized');
      return;
    }

    try {
      this.profileId = profileId;
      await AsyncStorage.setItem(PROFILE_ID_KEY, profileId);

      // Request location permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('📍 Location permissions not granted');
        return;
      }

      // Configure BackgroundGeolocation
      await BackgroundGeolocation.ready({
        // Geolocation options
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: 50, // Update every 50 meters
        stopTimeout: 5, // Stop after 5 minutes of no movement
        stopOnTerminate: false, // Continue tracking when app is terminated
        startOnBoot: true, // Start tracking when device boots
        enableHeadless: true, // Enable headless mode for background tracking

        // Activity recognition
        activityRecognitionInterval: 10000,
        stopDetectionDelay: 0,
        disableMotionActivityUpdates: false,

        // Application config
        debug: __DEV__, // Enable debug mode in development
        logLevel: __DEV__ ? BackgroundGeolocation.LOG_LEVEL_VERBOSE : BackgroundGeolocation.LOG_LEVEL_OFF,
        stopOnStationary: false,

        // HTTP & Persistence
        autoSync: true,
        maxDaysToPersist: 7,

        // iOS specific
        pausesLocationUpdatesAutomatically: false,
        locationAuthorizationRequest: 'Always',
        backgroundPermissionRationale: {
          title: "Allow {applicationName} to access this device's location even when closed or not in use?",
          message: "This app collects location data to enable location sharing with your friends even when the app is closed or not in use.",
          positiveAction: 'Change to "{backgroundPermissionOptionLabel}"',
          negativeAction: 'Cancel',
        },

        // Android specific
        notification: {
          title: 'Location Tracking',
          text: 'Your location is being tracked',
          channelName: 'Location Tracking',
          priority: BackgroundGeolocation.NOTIFICATION_PRIORITY_LOW,
          smallIcon: 'drawable/ic_notification',
          largeIcon: 'drawable/ic_notification',
        },
      });

      // Register event listeners
      this.registerEventListeners();

      this.isInitialized = true;
      console.log('✅ Location service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing location service:', error);
      throw error;
    }
  }

  /**
   * Request location permissions
   */
  private async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        ]);

        const fineLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
        const coarseLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

        return fineLocationGranted || coarseLocationGranted;
      } catch (error) {
        console.error('Error requesting Android permissions:', error);
        return false;
      }
    } else {
      // iOS permissions are handled by the library
      const status = await BackgroundGeolocation.requestPermission();
      return status === BackgroundGeolocation.AUTHORIZATION_STATUS_ALWAYS;
    }
  }

  /**
   * Register event listeners for location updates
   */
  private registerEventListeners(): void {
    // Location update event
    BackgroundGeolocation.onLocation(this.onLocation.bind(this), this.onLocationError.bind(this));

    // Motion activity event
    BackgroundGeolocation.onMotionChange(this.onMotionChange.bind(this));

    // Activity change event
    BackgroundGeolocation.onActivityChange(this.onActivityChange.bind(this));

    // Geofence event
    BackgroundGeolocation.onGeofence(this.onGeofence.bind(this));

    // Heartbeat event
    BackgroundGeolocation.onHeartbeat(this.onHeartbeat.bind(this));

    // HTTP event
    BackgroundGeolocation.onHttp(this.onHttp.bind(this));

    // Connectivity change event
    BackgroundGeolocation.onConnectivityChange(this.onConnectivityChange.bind(this));

    // Enabled change event
    BackgroundGeolocation.onEnabledChange(this.onEnabledChange.bind(this));

    // Authorization event
    BackgroundGeolocation.onAuthorization(this.onAuthorization.bind(this));
  }

  /**
   * Check if location sharing is enabled in settings
   */
  private async isLocationSharingEnabled(): Promise<boolean> {
    try {
      // Check from AsyncStorage first (faster)
      // Use the same key as SettingsContext
      const settingsStr = await AsyncStorage.getItem('@app_settings');
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        if (settings.isShareLocation !== undefined) {
          const isEnabled = settings.isShareLocation !== false;
          console.log('📍 Location sharing setting from AsyncStorage:', isEnabled);
          return isEnabled;
        }
      }
      
      // If not in AsyncStorage, check from API
      if (this.profileId) {
        const { default: api } = await import('./api');
        try {
          const response = await api.get(`/setting?profileId=${this.profileId}`);
          if (response.status === 200 && response.data) {
            const isEnabled = response.data.isShareLocation !== false;
            console.log('📍 Location sharing setting from API:', isEnabled);
            // Cache in AsyncStorage
            const currentSettings = settingsStr ? JSON.parse(settingsStr) : {};
            await AsyncStorage.setItem('@app_settings', JSON.stringify({ ...currentSettings, isShareLocation: isEnabled }));
            return isEnabled;
          }
        } catch (apiError) {
          console.error('Error fetching settings from API:', apiError);
        }
      }
      
      // Default to true if setting is not set
      console.log('📍 Location sharing setting: defaulting to true');
      return true;
    } catch (error) {
      console.error('Error checking location sharing setting:', error);
      // Default to true if we can't check
      return true;
    }
  }

  /**
   * Handle location updates
   */
  private async onLocation(location: Location): Promise<void> {
    try {
      // Check if location sharing is enabled
      const isEnabled = await this.isLocationSharingEnabled();
      if (!isEnabled) {
        console.log('📍 Location sharing is disabled in settings, skipping update');
        return;
      }

      const now = Date.now();
      
      // Throttle updates to prevent too frequent API calls
      if (now - this.lastLocationUpdateTime < this.MIN_UPDATE_INTERVAL) {
        return;
      }

      this.lastLocationUpdateTime = now;

      console.log('📍 Location update:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: new Date(location.timestamp).toISOString(),
      });

      // Update profile location via API
      await this.updateProfileLocation(location);

      // Emit location update via socket for real-time sharing
      await this.emitLocationUpdate(location);

      // Notify callbacks
      this.updateCallbacks.forEach(callback => {
        try {
          callback(location);
        } catch (error) {
          console.error('Error in location update callback:', error);
        }
      });
    } catch (error) {
      console.error('❌ Error handling location update:', error);
    }
  }

  /**
   * Handle location errors
   */
  private onLocationError(error: any): void {
    console.error('❌ Location error:', error);
  }

  /**
   * Update profile location in database via API
   */
  private async updateProfileLocation(location: Location): Promise<void> {
    try {
      if (!this.profileId) {
        console.warn('📍 No profile ID available for location update');
        return;
      }

      const locationData = {
        lastLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
          heading: location.coords.heading,
          speed: location.coords.speed,
        },
      };

      await userAPI.updateProfile(locationData);
      console.log('✅ Profile location updated successfully');
    } catch (error) {
      console.error('❌ Error updating profile location:', error);
    }
  }

  /**
   * Emit location update via socket for real-time sharing
   */
  private async emitLocationUpdate(location: Location): Promise<void> {
    try {
      // Import dynamically to avoid circular dependencies
      const { getSocket } = await import('../socket/socket');
      const socket = getSocket();
      
      if (!socket || !socket.connected) {
        console.warn('📍 Socket not connected, skipping location emit');
        return;
      }

      if (!this.profileId) {
        console.warn('📍 No profile ID available for socket emit');
        return;
      }

      const locationData = {
        profileId: this.profileId,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp,
          accuracy: location.coords.accuracy,
        },
      };

      socket.emit('location_update', locationData);
      console.log('✅ Location update emitted via socket:', {
        profileId: this.profileId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('❌ Error emitting location update via socket:', error);
    }
  }

  /**
   * Handle motion change events
   */
  private onMotionChange(event: MotionChangeEvent): void {
    console.log('📍 Motion change:', event.isMoving ? 'Moving' : 'Stationary');
  }

  /**
   * Handle activity change events
   */
  private onActivityChange(event: any): void {
    console.log('📍 Activity change:', event.activity);
  }

  /**
   * Handle geofence events
   */
  private onGeofence(event: GeofenceEvent): void {
    console.log('📍 Geofence event:', event.identifier, event.action);
  }

  /**
   * Handle heartbeat events
   */
  private onHeartbeat(event: HeartbeatEvent): void {
    console.log('📍 Heartbeat event');
  }

  /**
   * Handle HTTP events
   */
  private onHttp(event: HttpEvent): void {
    console.log('📍 HTTP event:', event.success ? 'Success' : 'Failed');
  }

  /**
   * Handle connectivity change events
   */
  private onConnectivityChange(event: ConnectivityChangeEvent): void {
    console.log('📍 Connectivity change:', event.connected ? 'Connected' : 'Disconnected');
  }

  /**
   * Handle enabled change events
   */
  private onEnabledChange(event: any): void {
    this.isEnabled = event.enabled;
    console.log('📍 Location tracking:', event.enabled ? 'Enabled' : 'Disabled');
  }

  /**
   * Handle authorization events
   */
  private onAuthorization(event: AuthorizationEvent): void {
    console.log('📍 Authorization status:', event.status);
  }

  /**
   * Start location tracking
   */
  async start(): Promise<void> {
    try {
      // Check if location sharing is enabled
      const isEnabled = await this.isLocationSharingEnabled();
      if (!isEnabled) {
        console.log('📍 Location sharing is disabled in settings, not starting tracking');
        // Stop tracking if it's already running
        try {
          await this.stop();
        } catch (e) {
          // Ignore stop errors
        }
        return;
      }

      if (!this.isInitialized) {
        const storedProfileId = await AsyncStorage.getItem(PROFILE_ID_KEY);
        if (storedProfileId) {
          await this.initialize(storedProfileId);
        } else {
          throw new Error('Location service not initialized. Call initialize() first.');
        }
      }

      const state = await BackgroundGeolocation.start();
      this.isEnabled = state.enabled;
      console.log('✅ Location tracking started');
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      throw error;
    }
  }

  /**
   * Stop location tracking
   */
  async stop(): Promise<void> {
    try {
      await BackgroundGeolocation.stop();
      this.isEnabled = false;
      console.log('📍 Location tracking stopped');
    } catch (error) {
      console.error('❌ Error stopping location tracking:', error);
      throw error;
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<Location | null> {
    try {
      const location = await BackgroundGeolocation.getCurrentPosition({
        timeout: 30,
        maximumAge: 5000,
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        samples: 1,
      });
      return location;
    } catch (error) {
      console.error('❌ Error getting current location:', error);
      return null;
    }
  }

  /**
   * Check if location tracking is enabled
   */
  async isTrackingEnabled(): Promise<boolean> {
    try {
      const state = await BackgroundGeolocation.getState();
      return state.enabled;
    } catch (error) {
      console.error('❌ Error checking tracking state:', error);
      return false;
    }
  }

  /**
   * Subscribe to location updates
   */
  subscribe(callback: LocationUpdateCallback): () => void {
    this.updateCallbacks.push(callback);
    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Change profile ID (useful when user logs in/out)
   */
  async changeProfileId(profileId: string): Promise<void> {
    this.profileId = profileId;
    await AsyncStorage.setItem(PROFILE_ID_KEY, profileId);
    console.log('📍 Profile ID changed:', profileId);
  }

  /**
   * Manually trigger a location update (useful for testing or manual refresh)
   */
  async triggerLocationUpdate(): Promise<void> {
    try {
      const location = await this.getCurrentLocation();
      if (location) {
        await this.onLocation(location);
      } else {
        console.warn('📍 Could not get current location for manual update');
      }
    } catch (error) {
      console.error('❌ Error triggering manual location update:', error);
    }
  }

  /**
   * Cleanup and remove all listeners
   */
  async destroy(): Promise<void> {
    try {
      await this.stop();
      BackgroundGeolocation.removeAllListeners();
      this.updateCallbacks = [];
      this.isInitialized = false;
      this.isEnabled = false;
      this.profileId = null;
      await AsyncStorage.removeItem(PROFILE_ID_KEY);
      console.log('📍 Location service destroyed');
    } catch (error) {
      console.error('❌ Error destroying location service:', error);
    }
  }
}

// Export singleton instance
export const locationService = new LocationService();
export default locationService;

