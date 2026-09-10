import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { ModernCard } from '../components/modern';
import api from '../lib/api';
import { useFeatureFlag } from '../contexts/FeatureFlagContext';

type Wallet = {
  walletBalanceCoins: number;
  subscriptionStatus: string;
  subscriptionTier: string;
  subscriptionExpiresAt: string | null;
};

const WalletScreen = () => {
  const { colors, typography, spacing, isDarkMode } = useTheme();
  const enabled = useFeatureFlag('walletEnabled');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<Wallet>('/wallet');
      setWallet(response.data);
    } catch {
      setError('Unable to load your wallet. Please try again.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadWallet();
    }, [loadWallet]),
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadWallet();
    } finally {
      setRefreshing(false);
    }
  };

  if (!enabled) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <Text style={[typography.h5, styles.disabledText, { color: colors.text.primary }]}>
          Wallet is currently unavailable.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.md }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text style={[typography.h3, { color: colors.text.primary }]}>My Wallet</Text>
        <Text style={[typography.body, { color: colors.text.secondary }]}>
          Your balance is read from the server and updates after approved payments.
        </Text>
        {error ? <Text style={[typography.body, { color: colors.status.error }]}>{error}</Text> : null}
        {!wallet && !error ? <ActivityIndicator color={colors.primary} /> : null}
        <ModernCard margin="none" style={styles.balanceCard}>
          <View style={[styles.coinIcon, { backgroundColor: `${colors.primary}20` }]}>
            <Icon name="monetization-on" size={36} color={colors.primary} />
          </View>
          <View>
            <Text style={[typography.label, { color: colors.text.secondary }]}>Available coins</Text>
            <Text style={[typography.h1, { color: colors.primary }]}>
              {wallet?.walletBalanceCoins ?? 0}
            </Text>
          </View>
        </ModernCard>
        <ModernCard margin="none">
          <Text style={[typography.h5, { color: colors.text.primary }]}>Subscription</Text>
          <Text style={[typography.body, { color: colors.text.secondary }]}>
            {wallet?.subscriptionStatus === 'active'
              ? `${wallet.subscriptionTier} active`
              : 'No active subscription'}
          </Text>
          {wallet?.subscriptionExpiresAt ? (
            <Text style={[typography.caption, { color: colors.text.tertiary }]}>
              Expires {new Date(wallet.subscriptionExpiresAt).toLocaleDateString()}
            </Text>
          ) : null}
        </ModernCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 14 },
  disabledText: { padding: 24 },
  balanceCard: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  coinIcon: { alignItems: 'center', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
});

export default WalletScreen;
