import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureFlag } from '../contexts/FeatureFlagContext';
import { ModernButton, ModernCard, ModernInput } from '../components/modern';
import api from '../lib/api';

const PaymentSubmissionScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const { colors, typography, spacing, isDarkMode } = useTheme();
  const enabled = useFeatureFlag('manualPaymentEnabled');
  const params = route.params || {};
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [senderMsisdn, setSenderMsisdn] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    setError('');
    if (!senderMsisdn.trim() || !transactionId.trim()) {
      setError('Sender number and Transaction ID are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post('/payments/submit', {
        paymentMethod,
        senderMsisdn: senderMsisdn.trim(),
        transactionId: transactionId.trim(),
        type: params.type,
        amountBDT: params.amountBDT,
        subscriptionTier: params.subscriptionTier,
        coachingPlanId: params.coachingPlanId,
      });
      navigation.replace('PaymentPendingConfirmation', {
        amountBDT: params.amountBDT,
        transactionId: response.data?.transaction?.transactionId || transactionId.trim(),
        submittedAt: response.data?.transaction?.submittedAt || new Date().toISOString(),
      });
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message || 'We could not submit your payment. Please try again.';
      setError(message);
      Alert.alert('Submission failed', message);
    } finally {
      setIsSubmitting(false);
    }
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={[styles.content, { padding: spacing.md }]}>
          <Text style={[typography.h3, { color: colors.text.primary }]}>
            Submit payment / পেমেন্ট জমা দিন
          </Text>
          <ModernCard margin="none">
            <Text style={[typography.label, { color: colors.text.secondary }]}>
              Amount / পরিমাণ
            </Text>
            <Text style={[typography.h4, { color: colors.primary }]}>
              ৳{Number(params.amountBDT || 0).toFixed(2)}
            </Text>
          </ModernCard>

          <Text style={[typography.label, { color: colors.text.secondary }]}>
            Payment method / পেমেন্ট মাধ্যম
          </Text>
          <View style={styles.methods}>
            {(['bkash', 'nagad'] as const).map((method) => (
              <ModernButton
                key={method}
                title={method === 'bkash' ? 'bKash' : 'Nagad'}
                variant={paymentMethod === method ? 'soft' : 'outline'}
                onPress={() => setPaymentMethod(method)}
                style={styles.methodButton}
              />
            ))}
          </View>
          <ModernInput
            label="Sender phone number / প্রেরকের নম্বর"
            value={senderMsisdn}
            onChangeText={setSenderMsisdn}
            keyboardType="phone-pad"
            placeholder="01XXXXXXXXX"
            leftIcon="phone"
          />
          <ModernInput
            label="Transaction ID / ট্রানজেকশন আইডি"
            value={transactionId}
            onChangeText={setTransactionId}
            autoCapitalize="characters"
            placeholder="Enter the TrxID from your SMS"
            leftIcon="receipt"
          />
          {error ? (
            <Text style={[typography.bodySmall, { color: colors.status.error }]}>{error}</Text>
          ) : null}
          <ModernButton
            title="Submit for review / যাচাইয়ের জন্য জমা দিন"
            fullWidth
            loading={isSubmitting}
            disabled={isSubmitting}
            onPress={() => void submit()}
            icon={<Icon name="send" size={18} color={colors.text.inverse} />}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 14 },
  methods: { flexDirection: 'row', gap: 10 },
  methodButton: { flex: 1 },
  centerText: { padding: 24, textAlign: 'center' },
});

export default PaymentSubmissionScreen;
