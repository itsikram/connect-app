import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useBackgroundPermissions } from '../hooks/useBackgroundPermissions';
import { backgroundTaskManager } from '../lib/backgroundTaskManager';
import { backgroundServiceManager } from '../lib/backgroundServiceManager';
import { displayIncomingCallNotification } from '../lib/push';

const BackgroundTestScreen: React.FC = () => {
  const { colors: themeColors } = useTheme();
  const { permissions, checkPermissions, requestAllPermissions } = useBackgroundPermissions();
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (test: string, success: boolean, details?: string) => {
    const result = `${success ? '✅' : '❌'} ${test}${details ? ` - ${details}` : ''}`;
    setTestResults(prev => [...prev, result]);
  };

  const testBackgroundTask = async () => {
    try {
      addTestResult('Testing background task registration...', true);
      const status = await backgroundTaskManager.checkStatus();
      addTestResult('Background task status:', status.isRegistered, `Registered: ${status.isRegistered}`);
      
      if (status.isRegistered) {
        const forceResult = await backgroundTaskManager.forceRunTask();
        addTestResult('Force background task execution:', forceResult);
      }
    } catch (error) {
      addTestResult('Background task test failed', false, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testBackgroundServices = async () => {
    try {
      addTestResult('Testing background service manager...', true);
      await backgroundServiceManager.initialize();
      const serviceStatus = backgroundServiceManager.getServiceStatus();
      addTestResult('Background services status:', true, JSON.stringify(serviceStatus, null, 2));
    } catch (error) {
      addTestResult('Background services test failed', false, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testNotificationPermissions = async () => {
    try {
      addTestResult('Testing notification permissions...', true);
      await checkPermissions();
      addTestResult('Notification permissions:', permissions.notifications);
    } catch (error) {
      addTestResult('Notification permissions test failed', false, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testIncomingCallNotification = async () => {
    try {
      addTestResult('Testing incoming call notification...', true);
      await displayIncomingCallNotification({
        callerName: 'Test Caller',
        callerProfilePic: '',
        channelName: 'test-channel',
        isAudio: false,
        callerId: 'test-caller-id',
      });
      addTestResult('Incoming call notification sent', true);
    } catch (error) {
      addTestResult('Incoming call notification test failed', false, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const runAllTests = async () => {
    setTestResults([]);
    addTestResult('🧪 Starting Background Functionality Tests', true);
    
    await testNotificationPermissions();
    await testBackgroundServices();
    await testBackgroundTask();
    await testIncomingCallNotification();
    
    addTestResult('🏁 All tests completed', true);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const showTestGuide = () => {
    Alert.alert(
      '📱 Background Testing Guide',
      'To test background functionality:\n\n1️⃣ Run all tests to check configuration\n2️⃣ Put app in background\n3️⃣ Send test notification from server\n4️⃣ Verify incoming call notification appears\n5️⃣ Test with device restart\n\nFor best results, test on both Android and iOS.',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  useEffect(() => {
    addTestResult('📱 Background Test Screen initialized', true);
  }, []);

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={styles.header}>
        <Icon name="bug-report" size={48} color={themeColors.primary} />
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          Background Testing
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
          Test and verify background functionality
        </Text>
      </View>

      <View style={styles.statusSection}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Current Status
        </Text>
        <View style={[styles.statusCard, { backgroundColor: themeColors.background.secondary }]}>
          <Text style={[styles.statusText, { color: themeColors.text.primary }]}>
            Overall: {permissions.overall ? '✅ Ready' : '⚠️ Setup Needed'}
          </Text>
          <Text style={[styles.statusText, { color: themeColors.text.secondary }]}>
            Notifications: {permissions.notifications ? '✅' : '❌'}
          </Text>
          <Text style={[styles.statusText, { color: themeColors.text.secondary }]}>
            Battery Optimization: {permissions.batteryOptimization ? '✅' : '❌'}
          </Text>
          <Text style={[styles.statusText, { color: themeColors.text.secondary }]}>
            Auto-Start: {permissions.autoStart ? '✅' : '❌'}
          </Text>
          <Text style={[styles.statusText, { color: themeColors.text.secondary }]}>
            Background Task: {permissions.backgroundTask ? '✅' : '❌'}
          </Text>
        </View>
      </View>

      <View style={styles.actionsSection}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Test Actions
        </Text>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
          onPress={runAllTests}
        >
          <Icon name="play-arrow" size={20} color="white" />
          <Text style={styles.actionButtonText}>Run All Tests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: themeColors.status?.info || '#007AFF' }]}
          onPress={requestAllPermissions}
        >
          <Icon name="security" size={20} color="white" />
          <Text style={styles.actionButtonText}>Request Permissions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: themeColors.status?.warning || '#FF8800' }]}
          onPress={testIncomingCallNotification}
        >
          <Icon name="phone" size={20} color="white" />
          <Text style={styles.actionButtonText}>Test Call Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryActionButton, { borderColor: themeColors.border?.primary || '#E5E5EA' }]}
          onPress={showTestGuide}
        >
          <Icon name="help-outline" size={20} color={themeColors.text.primary} />
          <Text style={[styles.secondaryActionButtonText, { color: themeColors.text.primary }]}>
            Test Guide
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryActionButton, { borderColor: themeColors.border?.primary || '#E5E5EA' }]}
          onPress={clearResults}
        >
          <Icon name="clear" size={20} color={themeColors.text.secondary} />
          <Text style={[styles.secondaryActionButtonText, { color: themeColors.text.secondary }]}>
            Clear Results
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsSection}>
        <View style={styles.resultsHeader}>
          <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
            Test Results
          </Text>
          <Text style={[styles.resultsCount, { color: themeColors.text.secondary }]}>
            {testResults.length} items
          </Text>
        </View>
        
        <View style={[styles.resultsContainer, { backgroundColor: themeColors.background.secondary }]}>
          {testResults.length === 0 ? (
            <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>
              No test results yet. Run tests to see results here.
            </Text>
          ) : (
            testResults.map((result, index) => (
              <Text key={index} style={[styles.resultText, { color: themeColors.text.primary }]}>
                {result}
              </Text>
            ))
          )}
        </View>
      </View>

      <View style={styles.tipsSection}>
        <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>
          Testing Tips
        </Text>
        <View style={styles.tipsList}>
          <Text style={[styles.tipText, { color: themeColors.text.secondary }]}>
            • Test with app in background and foreground
          </Text>
          <Text style={[styles.tipText, { color: themeColors.text.secondary }]}>
            • Test after device restart
          </Text>
          <Text style={[styles.tipText, { color: themeColors.text.secondary }]}>
            • Check notification permissions in device settings
          </Text>
          <Text style={[styles.tipText, { color: themeColors.text.secondary }]}>
            • Monitor battery optimization settings on Android
          </Text>
          <Text style={[styles.tipText, { color: themeColors.text.secondary }]}>
            • Verify Background App Refresh on iOS
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  statusSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionsSection: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  secondaryActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultsSection: {
    padding: 16,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultsContainer: {
    padding: 16,
    borderRadius: 12,
    minHeight: 200,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  resultText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  tipsSection: {
    padding: 16,
    paddingBottom: 32,
  },
  tipsList: {
    gap: 8,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default BackgroundTestScreen;
