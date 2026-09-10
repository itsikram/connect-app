import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureFlag } from '../contexts/FeatureFlagContext';
import { ModernButton, ModernCard } from '../components/modern';

const PaymentPendingConfirmationScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const { colors, typography, isDarkMode } = useTheme();
  const enabled = useFeatureFlag('manualPaymentEnabled');
  const params = route.params || {};
  const submittedAt = params.submittedAt ? new Date(params.submittedAt) : new Date();
  const formattedSubmittedAt = Number.isNaN(submittedAt.getTime())
    ? 'Just now'
    : submittedAt.toLocaleString();

  if (!enabled) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <Text style={[typography.h4, styles.centerText, { color: colors.text.primary }]}>
          Manual payments are currently unavailable.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.content}>
        <ModernCard margin="none" style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.status.warning}20` }]}>
            <Icon name="schedule" size={42} color={colors.status.warning} />
          </View>
          <Text style={[typography.h3, styles.title, { color: colors.text.primary }]}>
            Payment under review
          </Text>
          <Text style={[typography.body, styles.message, { color: colors.text.secondary }]}>
            Your payment has been submitted safely. We’ll notify you when an admin finishes the review.
            {'\n'}আপনার পেমেন্ট জমা হয়েছে। যাচাই শেষ হলে আমরা আপনাকে জানাব।
          </Text>
          <Text style={[typography.label, { color: colors.text.secondary }]}>
            Submitted / জমা দেওয়ার সময়
          </Text>
          <Text style={[typography.body, styles.timestamp, { color: colors.text.primary }]}>
            {formattedSubmittedAt}
          </Text>
          {params.transactionId ? (
            <Text style={[typography.caption, { color: colors.text.tertiary }]}>
              Transaction ID: {params.transactionId}
            </Text>
          ) : null}
        </ModernCard>
        <ModernButton
          title="Done"
          fullWidth
          onPress={() => navigation.popToTop?.() || navigation.goBack()}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 16, paddingBottom: 100 },
  card: { alignItems: 'center' },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  title: { marginTop: 18, textAlign: 'center' },
  message: { marginVertical: 16, textAlign: 'center' },
  timestamp: { marginTop: 6, textAlign: 'center' },
  centerText: { padding: 24, textAlign: 'center' },
});

export default PaymentPendingConfirmationScreen;
