import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { pushBackgroundService } from './pushBackgroundService';

interface ServiceStatus {
  backgroundTtsService: boolean;
  notificationService: boolean;
  batteryOptimizationExempt: boolean;
  autoStartEnabled: boolean;
}

class BackgroundServiceManager {
  private static instance: BackgroundServiceManager;
  private serviceStatus: ServiceStatus = {
    backgroundTtsService: false,
    notificationService: false,
    batteryOptimizationExempt: false,
    autoStartEnabled: false,
  };

  public static getInstance(): BackgroundServiceManager {
    if (!BackgroundServiceManager.instance) {
      BackgroundServiceManager.instance = new BackgroundServiceManager();
    }
    return BackgroundServiceManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing Background Service Manager...');
      
      // Load saved service status
      await this.loadServiceStatus();
      
      // Check current status
      await this.checkServiceStatus();
      
      // Start services if needed
      await this.ensureServicesRunning();
      
      console.log('✅ Background Service Manager initialized');
    } catch (error) {
      console.error('❌ Error initializing Background Service Manager:', error);
    }
  }

  private async loadServiceStatus(): Promise<void> {
    try {
      const savedStatus = await AsyncStorage.getItem('backgroundServiceStatus');
      if (savedStatus) {
        this.serviceStatus = { ...this.serviceStatus, ...JSON.parse(savedStatus) };
      }
    } catch (error) {
      console.error('Error loading service status:', error);
    }
  }

  private async saveServiceStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem('backgroundServiceStatus', JSON.stringify(this.serviceStatus));
    } catch (error) {
      console.error('Error saving service status:', error);
    }
  }

  async checkServiceStatus(): Promise<ServiceStatus> {
    try {
      if (Platform.OS === 'android') {
        // Check if services are running (this would require native module implementation)
        // For now, we'll assume they're running if the app is running
        this.serviceStatus.backgroundTtsService = true;
        this.serviceStatus.notificationService = true;
        
        // Check battery optimization status
        this.serviceStatus.batteryOptimizationExempt = await this.checkBatteryOptimization();
        
        // Check auto-start status
        this.serviceStatus.autoStartEnabled = await this.checkAutoStart();
      }
      
      await this.saveServiceStatus();
      return this.serviceStatus;
    } catch (error) {
      console.error('Error checking service status:', error);
      return this.serviceStatus;
    }
  }

  private async checkBatteryOptimization(): Promise<boolean> {
    try {
      // This would require a native module to check battery optimization status
      // For now, we'll return false and let the user check manually
      return false;
    } catch (error) {
      console.error('Error checking battery optimization:', error);
      return false;
    }
  }

  private async checkAutoStart(): Promise<boolean> {
    try {
      // This would require a native module to check auto-start permissions
      // For now, we'll return false and let the user check manually
      return false;
    } catch (error) {
      console.error('Error checking auto-start:', error);
      return false;
    }
  }

  async ensureServicesRunning(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        // Start background services if they're not running
        if (!this.serviceStatus.backgroundTtsService) {
          await this.startBackgroundTtsService();
        }
        
        if (!this.serviceStatus.notificationService) {
          await this.startNotificationService();
        }
      }
    } catch (error) {
      console.error('Error ensuring services are running:', error);
    }
  }

  private async startBackgroundTtsService(): Promise<void> {
    try {
      // This would require a native module to start the service
      console.log('🎤 Starting background TTS service...');
      this.serviceStatus.backgroundTtsService = true;
      await this.saveServiceStatus();
    } catch (error) {
      console.error('Error starting background TTS service:', error);
    }
  }

  private async startNotificationService(): Promise<void> {
    try {
      console.log('🔔 Starting notification service...');
      await pushBackgroundService.start();
      this.serviceStatus.notificationService = true;
      await this.saveServiceStatus();
    } catch (error) {
      console.error('Error starting notification service:', error);
    }
  }

  async requestBatteryOptimizationExemption(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return true;
      }

      const hasAsked = await AsyncStorage.getItem('batteryOptimizationAsked');
      if (hasAsked === 'true') {
        return this.serviceStatus.batteryOptimizationExempt;
      }

      return new Promise((resolve) => {
        Alert.alert(
          'Battery Optimization',
          'To ensure reliable notifications when the app is closed, please disable battery optimization for this app.\n\nThis will allow the app to receive notifications and play TTS even when the device is in battery saving mode.',
          [
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: async () => {
                await AsyncStorage.setItem('batteryOptimizationAsked', 'true');
                resolve(false);
              },
            },
            {
              text: 'Open Settings',
              onPress: async () => {
                try {
                  await Linking.openSettings();
                  await AsyncStorage.setItem('batteryOptimizationAsked', 'true');
                  resolve(true);
                } catch (error) {
                  console.error('Error opening settings:', error);
                  resolve(false);
                }
              },
            },
          ]
        );
      });
    } catch (error) {
      console.error('Error requesting battery optimization exemption:', error);
      return false;
    }
  }

  async requestAutoStartPermission(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return true;
      }

      const hasAsked = await AsyncStorage.getItem('autoStartAsked');
      if (hasAsked === 'true') {
        return this.serviceStatus.autoStartEnabled;
      }

      return new Promise((resolve) => {
        Alert.alert(
          'Auto-Start Permission',
          'To ensure notifications work after device restart, please enable auto-start for this app.\n\nThis will allow the app to start automatically and receive notifications even after the device is restarted.',
          [
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: async () => {
                await AsyncStorage.setItem('autoStartAsked', 'true');
                resolve(false);
              },
            },
            {
              text: 'Open Settings',
              onPress: async () => {
                try {
                  // This would open the auto-start settings for the specific device
                  await Linking.openSettings();
                  await AsyncStorage.setItem('autoStartAsked', 'true');
                  resolve(true);
                } catch (error) {
                  console.error('Error opening auto-start settings:', error);
                  resolve(false);
                }
              },
            },
          ]
        );
      });
    } catch (error) {
      console.error('Error requesting auto-start permission:', error);
      return false;
    }
  }

  async requestAllPermissions(): Promise<boolean> {
    try {
      console.log('🔐 Requesting all background permissions...');
      
      const batteryOptimization = await this.requestBatteryOptimizationExemption();
      const autoStart = await this.requestAutoStartPermission();
      
      this.serviceStatus.batteryOptimizationExempt = batteryOptimization;
      this.serviceStatus.autoStartEnabled = autoStart;
      
      await this.saveServiceStatus();
      
      console.log('✅ Background permissions requested:', {
        batteryOptimization,
        autoStart,
      });
      
      return batteryOptimization && autoStart;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  getServiceStatus(): ServiceStatus {
    return { ...this.serviceStatus };
  }

  async restartServices(): Promise<void> {
    try {
      console.log('🔄 Restarting background services...');
      
      this.serviceStatus.backgroundTtsService = false;
      this.serviceStatus.notificationService = false;
      
      await this.ensureServicesRunning();
      
      console.log('✅ Background services restarted');
    } catch (error) {
      console.error('Error restarting services:', error);
    }
  }

  async stopServices(): Promise<void> {
    try {
      console.log('🛑 Stopping background services...');
      
      // Stop background actions service
      try { await pushBackgroundService.stop(); } catch (e) {}
      
      this.serviceStatus.backgroundTtsService = false;
      this.serviceStatus.notificationService = false;
      
      await this.saveServiceStatus();
      
      console.log('✅ Background services stopped');
    } catch (error) {
      console.error('Error stopping services:', error);
    }
  }
}

export const backgroundServiceManager = BackgroundServiceManager.getInstance();
export default backgroundServiceManager;

