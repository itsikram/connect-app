import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useToast } from '../contexts/ToastContext';
import { colors } from '../theme/colors';

const ToastExample: React.FC = () => {
  const { showSuccess, showError, showWarning, showInfo, showToast } = useToast();

  const handleShowSuccess = () => {
    showSuccess('Operation completed successfully!');
  };

  const handleShowError = () => {
    showError('Something went wrong. Please try again.');
  };

  const handleShowWarning = () => {
    showWarning('Please check your input before proceeding.');
  };

  const handleShowInfo = () => {
    showInfo('Here is some helpful information for you.');
  };

  const handleShowCustomToast = () => {
    showToast('This is a custom toast message', 'info', 5000);
  };

  const handleShowLongMessage = () => {
    showSuccess(
      'This is a very long message that demonstrates how the toast handles multiple lines of text. It will automatically wrap and show properly.',
      6000
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Toast Examples</Text>
      <Text style={styles.subtitle}>
        Tap the buttons below to see different types of toasts
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.success }]}
          onPress={handleShowSuccess}
        >
          <Text style={styles.buttonText}>Show Success Toast</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.error }]}
          onPress={handleShowError}
        >
          <Text style={styles.buttonText}>Show Error Toast</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.warning }]}
          onPress={handleShowWarning}
        >
          <Text style={styles.buttonText}>Show Warning Toast</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.info }]}
          onPress={handleShowInfo}
        >
          <Text style={styles.buttonText}>Show Info Toast</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleShowCustomToast}
        >
          <Text style={styles.buttonText}>Show Custom Toast (5s)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.secondary }]}
          onPress={handleShowLongMessage}
        >
          <Text style={styles.buttonText}>Show Long Message</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Features:</Text>
        <Text style={styles.infoText}>• Smooth slide-in/out animations</Text>
        <Text style={styles.infoText}>• Auto-dismiss with configurable duration</Text>
        <Text style={styles.infoText}>• Manual close button</Text>
        <Text style={styles.infoText}>• Multiple toast types (success, error, warning, info)</Text>
        <Text style={styles.infoText}>• Responsive design with proper shadows</Text>
        <Text style={styles.infoText}>• Status bar aware positioning</Text>
        <Text style={styles.infoText}>• Easy to use hook-based API</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.light,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  buttonContainer: {
    gap: 15,
    marginBottom: 30,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default ToastExample;
