import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { backgroundServiceManager } from '../lib/backgroundServiceManager';
import { backgroundTtsService } from '../lib/backgroundTtsService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ServiceStatus {
  backgroundTtsService: boolean;
  notificationService: boolean;
  batteryOptimizationExempt: boolean;
  autoStartEnabled: boolean;
}

const BackgroundNotificationTester: React.FC = () => {
  const { colors: themeColors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    backgroundTtsService: false,
    notificationService: false,
    batteryOptimizationExempt: false,
    autoStartEnabled: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadServiceStatus();
  }, []);

  const loadServiceStatus = async () => {
    try {
      const status = await backgroundServiceManager.checkServiceStatus();
      setServiceStatus(status);
    } catch (error) {
      console.error('Error loading service status:', error);
      showError('Failed to load service status');
    }
  };

  const handleRequestPermissions = async () => {
    setIsLoading(true);
    try {
      const success = await backgroundServiceManager.requestAllPermissions();
      if (success) {
        showSuccess('All permissions granted successfully');
      } else {
        showInfo('Some permissions were not granted. Check your device settings.');
      }
      await loadServiceStatus();
    } catch (error) {
      console.error('Error requesting permissions:', error);
      showError('Failed to request permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestTts = async () => {
    try {
      await backgroundTtsService.speakMessage(
        'This is a test of the background TTS service. If you can hear this, the service is working correctly.',
        { priority: 'high', interrupt: true }
      );
      showSuccess('TTS test completed');
    } catch (error) {
      console.error('Error testing TTS:', error);
      showError('TTS test failed');
    }
  };

  const handleRestartServices = async () => {
    setIsLoading(true);
    try {
      await backgroundServiceManager.restartServices();
      showSuccess('Background services restarted');
      await loadServiceStatus();
    } catch (error) {
      console.error('Error restarting services:', error);
      showError('Failed to restart services');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopServices = async () => {
    Alert.alert(
      'Stop Services',
      'Are you sure you want to stop all background services? This will disable notifications when the app is closed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await backgroundServiceManager.stopServices();
              showInfo('Background services stopped');
              await loadServiceStatus();
            } catch (error) {
              console.error('Error stopping services:', error);
              showError('Failed to stop services');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleTestClosedAppScenario = () => {
    Alert.alert(
      'Test Closed App Scenario',
      'To test notifications when the app is closed:\n\n1. Close the app completely (remove from recent apps)\n2. Send a test notification from your server\n3. Check if you receive the notification and hear TTS\n\nMake sure battery optimization is disabled for this app.',
      [
        { text: 'OK' },
        {
          text: 'Open Battery Settings',
          onPress: () => {
            backgroundServiceManager.requestBatteryOptimizationExemption();
          },
        },
      ]
    );
  };

  const getStatusIcon = (status: boolean) => {
    return status ? 'check-circle' : 'error';
  };

  const getStatusColor = (status: boolean) => {
    return status ? '#4CAF50' : '#F44336';
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background.primary,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: themeColors.text.primary,
      marginBottom: 20,
    },
    section: {
      marginBottom: 30,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: themeColors.text.primary,
      marginBottom: 15,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15,
      backgroundColor: themeColors.background.secondary,
      borderRadius: 10,
      marginBottom: 10,
    },
    statusIcon: {
      marginRight: 15,
    },
    statusText: {
      flex: 1,
      fontSize: 16,
      color: themeColors.text.primary,
    },
    button: {
      backgroundColor: themeColors.primary,
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginBottom: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: themeColors.text.inverse,
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    warningButton: {
      backgroundColor: '#FF9800',
    },
    dangerButton: {
      backgroundColor: '#F44336',
    },
    infoButton: {
      backgroundColor: '#2196F3',
    },
    infoText: {
      fontSize: 14,
      color: themeColors.text.secondary,
      lineHeight: 20,
      marginBottom: 15,
    },
    loadingText: {
      fontSize: 14,
      color: themeColors.text.secondary,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Background Notification Tester</Text>

      {/* Service Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Status</Text>
        
        <View style={styles.statusRow}>
          <Icon 
            name={getStatusIcon(serviceStatus.backgroundTtsService)} 
            size={24} 
            color={getStatusColor(serviceStatus.backgroundTtsService)}
            style={styles.statusIcon}
          />
          <Text style={styles.statusText}>Background TTS Service</Text>
        </View>

        <View style={styles.statusRow}>
          <Icon 
            name={getStatusIcon(serviceStatus.notificationService)} 
            size={24} 
            color={getStatusColor(serviceStatus.notificationService)}
            style={styles.statusIcon}
          />
          <Text style={styles.statusText}>Notification Service</Text>
        </View>

        <View style={styles.statusRow}>
          <Icon 
            name={getStatusIcon(serviceStatus.batteryOptimizationExempt)} 
            size={24} 
            color={getStatusColor(serviceStatus.batteryOptimizationExempt)}
            style={styles.statusIcon}
          />
          <Text style={styles.statusText}>Battery Optimization Exempt</Text>
        </View>

        <View style={styles.statusRow}>
          <Icon 
            name={getStatusIcon(serviceStatus.autoStartEnabled)} 
            size={24} 
            color={getStatusColor(serviceStatus.autoStartEnabled)}
            style={styles.statusIcon}
          />
          <Text style={styles.statusText}>Auto-Start Enabled</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleRequestPermissions}
          disabled={isLoading}
        >
          <Icon name="security" size={24} color={themeColors.text.inverse} />
          <Text style={styles.buttonText}>Request Permissions</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.infoButton]} 
          onPress={handleTestTts}
          disabled={isLoading}
        >
          <Icon name="record-voice-over" size={24} color={themeColors.text.inverse} />
          <Text style={styles.buttonText}>Test TTS</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.warningButton]} 
          onPress={handleRestartServices}
          disabled={isLoading}
        >
          <Icon name="refresh" size={24} color={themeColors.text.inverse} />
          <Text style={styles.buttonText}>Restart Services</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.dangerButton]} 
          onPress={handleStopServices}
          disabled={isLoading}
        >
          <Icon name="stop" size={24} color={themeColors.text.inverse} />
          <Text style={styles.buttonText}>Stop Services</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.infoButton]} 
          onPress={handleTestClosedAppScenario}
          disabled={isLoading}
        >
          <Icon name="info" size={24} color={themeColors.text.inverse} />
          <Text style={styles.buttonText}>Test Closed App Scenario</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={loadServiceStatus}
          disabled={isLoading}
        >
          <Icon name="refresh" size={24} color={themeColors.text.inverse} />
          <Text style={styles.buttonText}>Refresh Status</Text>
        </TouchableOpacity>
      </View>

      {/* Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Testing Instructions</Text>
        
        <Text style={styles.infoText}>
          1. <Text style={{ fontWeight: 'bold' }}>Request Permissions:</Text> Grant all necessary permissions for background operation
        </Text>
        
        <Text style={styles.infoText}>
          2. <Text style={{ fontWeight: 'bold' }}>Test TTS:</Text> Verify that TTS is working correctly
        </Text>
        
        <Text style={styles.infoText}>
          3. <Text style={{ fontWeight: 'bold' }}>Close App Completely:</Text> Remove the app from recent apps
        </Text>
        
        <Text style={styles.infoText}>
          4. <Text style={{ fontWeight: 'bold' }}>Send Test Notification:</Text> Send a push notification from your server
        </Text>
        
        <Text style={styles.infoText}>
          5. <Text style={{ fontWeight: 'bold' }}>Verify:</Text> Check if you receive the notification and hear TTS
        </Text>

        <Text style={styles.infoText}>
          <Text style={{ fontWeight: 'bold' }}>Note:</Text> For best results, disable battery optimization for this app in your device settings.
        </Text>
      </View>

      {isLoading && (
        <Text style={styles.loadingText}>Processing...</Text>
      )}
    </ScrollView>
  );
};

export default BackgroundNotificationTester;

