import React, { useMemo } from 'react';
import {
  Alert,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureFlag } from '../contexts/FeatureFlagContext';
import { ModernButton, ModernCard } from '../components/modern';

type PaymentInstructionsRoute = {
  params?: {
    amountBDT?: number;
    type?: string;
    subscriptionTier?: string;
    coachingPlanId?: string;
    bkashNumber?: string;
    nagadNumber?: string;
  };
};

const configuredNumber = (value: string | undefined, fallback: string) =>
  value?.trim() || fallback;

const PaymentInstructionsScreen = ({
  navigation,
  route,
}: {
  navigation: any;
  route: PaymentInstructionsRoute;
}) => {
  const { colors, typography, spacing, isDarkMode } = useTheme();
  const enabled = useFeatureFlag('manualPaymentEnabled');
  const params = route.params || {};
  const amount = Number(params.amountBDT || 0);
  const numbers = useMemo(
    () => ({
      bkash: configuredNumber(
        params.bkashNumber || process.env.EXPO_PUBLIC_BKASH_NUMBER,
        'Not configured',
      ),
      nagad: configuredNumber(
        params.nagadNumber || process.env.EXPO_PUBLIC_NAGAD_NUMBER,
        'Not configured',
      ),
    }),
    [params.bkashNumber, params.nagadNumber],
  );

  const copyNumber = async (label: string, number: string) => {
    if (number === 'Not configured') {
      Alert.alert(
        `${label} number unavailable`,
        `Configure EXPO_PUBLIC_${label.toUpperCase()}_NUMBER before collecting payments.`,
      );
      return;
    }
    await Clipboard.setStringAsync(number);
    Alert.alert('Copied', `${label} number copied to your clipboard.`);
  };

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
      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.md }]}>
        <Text style={[typography.h3, { color: colors.text.primary }]}>
          Pay to Connect
        </Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.text.secondary }]}>
          Send the exact amount, then submit your payment details for review.
          {'\n'}সঠিক পরিমাণ পাঠিয়ে পেমেন্ট যাচাইয়ের জন্য তথ্য জমা দিন।
        </Text>

        <ModernCard margin="none" style={styles.amountCard}>
          <Text style={[typography.label, { color: colors.text.secondary }]}>
            Exact amount / সঠিক পরিমাণ
          </Text>
          <Text style={[typography.h2, { color: colors.primary }]}>
            ৳{amount.toFixed(2)}
          </Text>
        </ModernCard>

        <Text style={[typography.h5, styles.sectionTitle, { color: colors.text.primary }]}>
          Choose where to send / যেখান থেকে পাঠাবেন
        </Text>
        {[
          { label: 'bKash', number: numbers.bkash, icon: 'account-balance-wallet' },
          { label: 'Nagad', number: numbers.nagad, icon: 'payments' },
        ].map((item) => (
          <ModernCard key={item.label} margin="none" style={styles.numberCard}>
            <View style={styles.numberInfo}>
              <Icon name={item.icon} size={24} color={colors.primary} />
              <View style={styles.numberText}>
                <Text style={[typography.label, { color: colors.text.secondary }]}>
                  {item.label}
                </Text>
                <Text style={[typography.h5, { color: colors.text.primary }]}>
                  {item.number}
                </Text>
              </View>
            </View>
            <ModernButton
              title="Copy"
              size="medium"
              variant="outline"
              onPress={() => void copyNumber(item.label, item.number)}
              icon={<Icon name="content-copy" size={16} color={colors.primary} />}
            />
          </ModernCard>
        ))}

        <ModernCard margin="none" style={styles.instructionsCard}>
          <Text style={[typography.h5, { color: colors.text.primary }]}>
            Instructions / নির্দেশনা
          </Text>
          {[
            '1. Open bKash or Nagad, choose Send Money, and send the exact amount to the number above.',
            '১. bKash বা Nagad খুলে Send Money নির্বাচন করে উপরের নম্বরে সঠিক পরিমাণ পাঠান।',
            '2. Copy the Transaction ID from the confirmation SMS.',
            '২. কনফার্মেশন SMS থেকে Transaction ID কপি করুন।',
            '3. Enter your sender number and Transaction ID on the next screen.',
            '৩. পরের স্ক্রিনে আপনার নম্বর ও Transaction ID লিখুন।',
          ].map((step) => (
            <Text key={step} style={[typography.bodySmall, styles.step, { color: colors.text.secondary }]}>
              {step}
            </Text>
          ))}
        </ModernCard>

        <ModernButton
          title="Continue / এগিয়ে যান"
          fullWidth
          onPress={() =>
            navigation.navigate('PaymentSubmission', {
              ...params,
              amountBDT: amount,
              bkashNumber: numbers.bkash,
              nagadNumber: numbers.nagad,
            })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 12 },
  subtitle: { marginBottom: 4 },
  amountCard: { alignItems: 'center' },
  sectionTitle: { marginTop: 8 },
  numberCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  numberInfo: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  numberText: { marginLeft: 12 },
  instructionsCard: { marginTop: 8 },
  step: { marginTop: 10 },
  centerText: { padding: 24, textAlign: 'center' },
});

export default PaymentInstructionsScreen;
