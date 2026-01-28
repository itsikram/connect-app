import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useBackgroundPermissions } from '../hooks/useBackgroundPermissions';

interface PermissionItemProps {
  title: string;
  description: string;
  granted: boolean;
  icon: string;
}

const PermissionItem: React.FC<PermissionItemProps> = ({ title, description, granted, icon }) => {
  const { colors: themeColors } = useTheme();
  
  return (
    <View style={[
      styles.permissionItem,
      { 
        backgroundColor: granted ? themeColors.status?.success + '20' || '#00C85120' : themeColors.background.secondary,
        borderColor: granted ? themeColors.status?.success || '#00C851' : themeColors.border.primary
      }
    ]}>
      <View style={styles.permissionHeader}>
        <Icon 
          name={icon} 
          size={24} 
          color={granted ? themeColors.status?.success || '#00C851' : themeColors.text.secondary} 
        />
        <Text style={[
          styles.permissionTitle,
          { color: themeColors.text.primary }
        ]}>
          {title}
        </Text>
        <Icon 
          name={granted ? "check-circle" : "error"} 
          size={20} 
          color={granted ? themeColors.status?.success || '#00C851' : themeColors.status?.warning || '#FF8800'} 
        />
      </View>
      <Text style={[
        styles.permissionDescription,
        { color: themeColors.text.secondary }
      ]}>
        {description}
      </Text>
    </View>
  );
};

const BackgroundPermissionsGuide: React.FC = () => {
  const { colors: themeColors } = useTheme();
  const { permissions, isLoading, requestAllPermissions, showPermissionGuide } = useBackgroundPermissions();

  const handleRequestPermissions = () => {
    requestAllPermissions();
  };

  const handleShowGuide = () => {
    showPermissionGuide();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        <Text style={[styles.loadingText, { color: themeColors.text.primary }]}>
          Checking background permissions...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={styles.header}>
        <Icon name="notifications-active" size={48} color={themeColors.primary} />
        <Text style={[styles.title, { color: themeColors.text.primary }]}>
          Background Permissions
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
          Enable these to receive calls and notifications when the app is closed
        </Text>
      </View>

      <View style={styles.permissionsList}>
        <PermissionItem
          title="Notifications"
          description="Receive incoming call alerts and message notifications"
          granted={permissions.notifications}
          icon="notifications"
        />
        
        {Platform.OS === 'android' && (
          <>
            <PermissionItem
              title="Battery Optimization"
              description="Prevent Android from killing the app in background"
              granted={permissions.batteryOptimization}
              icon="battery-std"
            />
            
            <PermissionItem
              title="Auto-Start"
              description="Restart app automatically after device reboot"
              granted={permissions.autoStart}
              icon="power-settings-new"
            />
          </>
        )}
        
        <PermissionItem
          title="Background Task"
          description="Periodic background sync and maintenance"
          granted={permissions.backgroundTask}
          icon="sync"
        />
      </View>

      <View style={styles.statusSection}>
        <View style={[
          styles.statusCard,
          { 
            backgroundColor: permissions.overall ? (themeColors.status?.success + '20' || '#00C85120') : (themeColors.status?.warning + '20' || '#FF880020'),
            borderColor: permissions.overall ? (themeColors.status?.success || '#00C851') : (themeColors.status?.warning || '#FF8800')
          }
        ]}>
          <Icon 
            name={permissions.overall ? "check-circle" : "warning"} 
            size={32} 
            color={permissions.overall ? (themeColors.status?.success || '#00C851') : (themeColors.status?.warning || '#FF8800')} 
          />
          <Text style={[
            styles.statusText,
            { color: themeColors.text.primary }
          ]}>
            {permissions.overall 
              ? "✅ All background permissions are granted" 
              : "⚠️ Some permissions are missing for optimal performance"}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: themeColors.primary }
          ]}
          onPress={handleRequestPermissions}
        >
          <Icon name="security" size={20} color="white" />
          <Text style={styles.primaryButtonText}>Request All Permissions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            { 
              backgroundColor: 'transparent',
              borderColor: themeColors.border?.primary || '#E5E5EA'
            }
          ]}
          onPress={handleShowGuide}
        >
          <Icon name="help-outline" size={20} color={themeColors.text.primary} />
          <Text style={[
            styles.secondaryButtonText,
            { color: themeColors.text.primary }
          ]}>
            Learn More
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={[styles.infoTitle, { color: themeColors.text.primary }]}>
          Why These Permissions Matter
        </Text>
        <Text style={[styles.infoText, { color: themeColors.text.secondary }]}>
          Background permissions ensure you never miss important calls or messages, even when the app is not actively in use. They allow the app to:
        </Text>
        <View style={styles.infoList}>
          <Text style={[styles.infoItem, { color: themeColors.text.secondary }]}>
            • Receive incoming call notifications instantly
          </Text>
          <Text style={[styles.infoItem, { color: themeColors.text.secondary }]}>
            • Stay connected to the server for real-time updates
          </Text>
          <Text style={[styles.infoItem, { color: themeColors.text.secondary }]}>
            • Continue working after device restarts
          </Text>
          <Text style={[styles.infoItem, { color: themeColors.text.secondary }]}>
            • Sync data periodically in the background
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
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  permissionsList: {
    padding: 16,
    gap: 12,
  },
  permissionItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  statusSection: {
    padding: 16,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    padding: 16,
    paddingTop: 0,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  infoList: {
    gap: 4,
  },
  infoItem: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default BackgroundPermissionsGuide;
