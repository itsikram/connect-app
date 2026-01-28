import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BACKGROUND_TASK_NAME = 'background-connect-task';
const TASK_INTERVAL = 300; // 5 minutes minimum interval

interface BackgroundTaskStatus {
  isRegistered: boolean;
  lastRun: number | null;
  status: BackgroundFetch.Status | null;
}

class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private isInitialized = false;
  private taskStatus: BackgroundTaskStatus = {
    isRegistered: false,
    lastRun: null,
    status: null,
  };

  public static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        console.log('📱 Background task manager already initialized');
        return true;
      }

      console.log('🔧 Initializing Background Task Manager...');
      
      // Load saved status
      await this.loadTaskStatus();
      
      // Define the background task
      this.defineBackgroundTask();
      
      // Register the task
      const registered = await this.registerBackgroundTask();
      
      this.isInitialized = true;
      console.log('✅ Background Task Manager initialized:', { registered });
      
      return registered;
    } catch (error) {
      console.error('❌ Error initializing Background Task Manager:', error);
      return false;
    }
  }

  private defineBackgroundTask(): void {
    TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
      try {
        console.log('🔄 Running background task...');
        
        // Update last run time
        this.taskStatus.lastRun = Date.now();
        await this.saveTaskStatus();
        
        // Here you can add background logic like:
        // - Check for missed notifications
        // - Sync data with server
        // - Maintain socket connection if possible
        // - Check for incoming calls
        
        console.log('✅ Background task completed successfully');
        
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('❌ Background task failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }

  private async registerBackgroundTask(): Promise<boolean> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      this.taskStatus.status = status;
      
      if (status !== BackgroundFetch.Status.Available) {
        console.warn('⚠️ Background fetch not available:', status);
        return false;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
      
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
          minimumInterval: TASK_INTERVAL,
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('✅ Background task registered successfully');
      } else {
        console.log('ℹ️ Background task already registered');
      }
      
      this.taskStatus.isRegistered = true;
      await this.saveTaskStatus();
      
      return true;
    } catch (error) {
      console.error('❌ Error registering background task:', error);
      return false;
    }
  }

  async unregisterBackgroundTask(): Promise<void> {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
      
      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK_NAME);
        console.log('✅ Background task unregistered');
      }
      
      this.taskStatus.isRegistered = false;
      await this.saveTaskStatus();
    } catch (error) {
      console.error('❌ Error unregistering background task:', error);
    }
  }

  async checkStatus(): Promise<BackgroundTaskStatus> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
      
      this.taskStatus.status = status;
      this.taskStatus.isRegistered = isRegistered;
      
      await this.saveTaskStatus();
      
      return { ...this.taskStatus };
    } catch (error) {
      console.error('❌ Error checking background task status:', error);
      return this.taskStatus;
    }
  }

  private async loadTaskStatus(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem('backgroundTaskStatus');
      if (saved) {
        this.taskStatus = { ...this.taskStatus, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Error loading task status:', error);
    }
  }

  private async saveTaskStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem('backgroundTaskStatus', JSON.stringify(this.taskStatus));
    } catch (error) {
      console.error('Error saving task status:', error);
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // iOS permissions are handled through Info.plist
        return true;
      }
      
      const status = await BackgroundFetch.getStatusAsync();
      return status === BackgroundFetch.Status.Available;
    } catch (error) {
      console.error('Error requesting background permissions:', error);
      return false;
    }
  }

  getTaskStatus(): BackgroundTaskStatus {
    return { ...this.taskStatus };
  }

  async forceRunTask(): Promise<boolean> {
    try {
      const result = await BackgroundFetch.fetchResultAsync(BACKGROUND_TASK_NAME);
      return result === BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
      console.error('Error forcing background task:', error);
      return false;
    }
  }
}

export const backgroundTaskManager = BackgroundTaskManager.getInstance();
export default backgroundTaskManager;
