import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useFeatureFlag } from '../contexts/FeatureFlagContext';
import { ModernButton, ModernCard } from '../components/modern';
import api from '../lib/api';

type Tier = { priceBDT: number; durationDays: number; enabled: boolean };

const SubscriptionScreen = ({ navigation }: { navigation: any }) => {
  const { colors, typography, spacing } = useTheme();
  const enabled = useFeatureFlag('subscriptionEnabled');
  const manualPaymentsEnabled = useFeatureFlag('manualPaymentEnabled');
  const [tiers, setTiers] = useState<Record<string, Tier>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/config/flags')
      .then((response) => setTiers(response.data?.subscriptionTiers || {}))
      .catch(() => Alert.alert('Unavailable', 'Subscription plans could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  const purchase = (tier: string, plan: Tier) => {
    if (!manualPaymentsEnabled) {
      Alert.alert('Payments unavailable', 'Manual payments are currently unavailable.');
      return;
    }
    navigation.navigate('PaymentInstructions', {
      type: 'subscription',
      subscriptionTier: tier,
      amountBDT: plan.priceBDT,
    });
  };

  if (!enabled) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}><Text style={[typography.h5, styles.center, { color: colors.text.primary }]}>Connect+ is currently unavailable.</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.md, paddingBottom: 100 }]}>
        <Text style={[typography.h3, { color: colors.text.primary }]}>Connect+ subscriptions</Text>
        <Text style={[typography.body, { color: colors.text.secondary }]}>Choose a plan, send the exact amount by bKash or Nagad, and submit the TrxID for admin review.</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : Object.entries(tiers).map(([tier, plan]) => (
          <ModernCard key={tier} margin="none">
            <View style={styles.row}>
              <Icon name="workspace-premium" size={30} color={colors.primary} />
              <View style={styles.flex}>
                <Text style={[typography.h5, { color: colors.text.primary }]}>{tier.replace('_', ' ')}</Text>
                <Text style={[typography.body, { color: colors.text.secondary }]}>{plan.durationDays} days</Text>
              </View>
              <Text style={[typography.h4, { color: colors.primary }]}>৳{plan.priceBDT}</Text>
            </View>
            <ModernButton
              title="Subscribe / সাবস্ক্রাইব করুন"
              fullWidth
              disabled={!plan.enabled}
              onPress={() => purchase(tier, plan)}
              style={styles.button}
            />
          </ModernCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 14 },
  center: { padding: 24, textAlign: 'center' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  button: { marginTop: 14 },
});

export default SubscriptionScreen;
