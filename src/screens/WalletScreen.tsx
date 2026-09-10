import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { ModernCard } from '../components/modern';
import api from '../lib/api';
import { useFeatureFlag } from '../contexts/FeatureFlagContext';

type Wallet = {
  walletBalanceCoins: number;
  creatorEarningsCoins: number;
  subscriptionStatus: string;
  subscriptionTier: string;
  subscriptionExpiresAt: string | null;
  connectPlusActive: boolean;
  dailyRewardCoins: number;
  dailyRewardAvailable: boolean;
};

const WalletScreen = ({ navigation }: { navigation: any }) => {
  const { colors, typography, spacing, isDarkMode } = useTheme();
  const enabled = useFeatureFlag('walletEnabled');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [coinPacks, setCoinPacks] = useState<Array<{ coins: number; priceBDT: number; enabled: boolean }>>([]);
  const [claimingReward, setClaimingReward] = useState(false);
  const [tippingEnabled, setTippingEnabled] = useState(false);
  const [tipUsername, setTipUsername] = useState('');
  const [tipCoins, setTipCoins] = useState('');
  const [sendingTip, setSendingTip] = useState(false);
  useEffect(() => {
    api.get('/config/flags')
      .then((response) => {
        setCoinPacks(response.data?.coinPacks || []);
        setTippingEnabled(response.data?.featureFlags?.tippingEnabled === true);
      })
      .catch(() => setError('Unable to load coin packs.'));
  }, []);

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
        contentContainerStyle={[styles.content, { padding: spacing.md, paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text style={[typography.h3, { color: colors.text.primary }]}>My Wallet</Text>
        <Text style={[typography.body, { color: colors.text.secondary }]}>
          Your balance is read from the server and updates after approved payments.
        </Text>
        {error ? <Text style={[typography.body, { color: colors.status.error }]}>{error}</Text> : null}
        {notice ? <Text style={[typography.body, { color: colors.status.success }]}>{notice}</Text> : null}
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
          <Text style={[typography.label, { color: colors.text.secondary }]}>Creator earnings</Text>
          <Text style={[typography.h2, { color: colors.primary }]}>{wallet?.creatorEarningsCoins ?? 0} coins</Text>
          <Text style={[typography.caption, { color: colors.text.tertiary }]}>Received from creator tips.</Text>
        </ModernCard>
        {tippingEnabled ? (
          <ModernCard margin="none">
            <Text style={[typography.h5, { color: colors.text.primary }]}>Tip a creator</Text>
            <Text style={[typography.body, { color: colors.text.secondary }]}>
              Send coins to a creator. The platform fee is deducted automatically.
            </Text>
            <TextInput
              value={tipUsername}
              onChangeText={setTipUsername}
              placeholder="Creator username"
              placeholderTextColor={colors.text.tertiary}
              style={[styles.tipInput, { borderColor: colors.border, color: colors.text.primary }]}
            />
            <TextInput
              value={tipCoins}
              onChangeText={setTipCoins}
              keyboardType="number-pad"
              placeholder="Coins to send"
              placeholderTextColor={colors.text.tertiary}
              style={[styles.tipInput, { borderColor: colors.border, color: colors.text.primary }]}
            />
            <Text
              onPress={async () => {
                const amountCoins = Number(tipCoins);
                if (!tipUsername.trim() || !Number.isInteger(amountCoins) || amountCoins < 1 || sendingTip) return;
                setSendingTip(true);
                try {
                  const response = await api.post('/tips/send', { recipientUsername: tipUsername.trim(), amountCoins });
                  setNotice(response.data?.message || 'Tip sent successfully.');
                  setTipUsername('');
                  setTipCoins('');
                  await loadWallet();
                } catch (requestError: any) {
                  setError(requestError?.response?.data?.message || 'Unable to send tip.');
                } finally {
                  setSendingTip(false);
                }
              }}
              style={[typography.label, { color: colors.primary, marginTop: 10 }]}
            >
              {sendingTip ? 'Sending...' : 'Send tip'}
            </Text>
          </ModernCard>
        ) : null}
        <ModernCard margin="none">
          <Text style={[typography.h5, { color: colors.text.primary }]}>Daily free coins</Text>
          <Text style={[typography.body, { color: colors.text.secondary }]}>
            Claim {wallet?.dailyRewardCoins ?? 10} free coins once every day. No recharge required.
          </Text>
          <Text
            onPress={async () => {
              if (!wallet?.dailyRewardAvailable || claimingReward) return;
              setClaimingReward(true);
              try {
                await api.post('/wallet/daily-reward');
                await loadWallet();
              } catch (requestError: any) {
                setError(requestError?.response?.data?.message || 'Unable to claim daily coins.');
              } finally {
                setClaimingReward(false);
              }
            }}
            style={[typography.label, { color: wallet?.dailyRewardAvailable ? colors.primary : colors.text.tertiary, marginTop: 10 }]}
          >
            {claimingReward ? 'Claiming...' : wallet?.dailyRewardAvailable ? 'Claim free coins' : 'Already claimed today'}
          </Text>
        </ModernCard>
        <ModernCard margin="none">
          <Text style={[typography.h5, { color: colors.text.primary }]}>Add coins</Text>
          <Text style={[typography.body, { color: colors.text.secondary }]}>Choose a pack and pay by bKash or Nagad.</Text>
          {coinPacks.map((pack) => (
            <ModernCard key={`${pack.coins}-${pack.priceBDT}`} margin="none" style={styles.packCard}>
              <View style={styles.packInfo}>
                <Text style={[typography.h5, { color: colors.text.primary }]}>{pack.coins} coins</Text>
                <Text style={[typography.body, { color: colors.text.secondary }]}>৳{pack.priceBDT}</Text>
              </View>
              <Text
                onPress={() => navigation.navigate('PaymentInstructions', {
                  type: 'wallet_topup',
                  amountBDT: pack.priceBDT,
                  coinsAmount: pack.coins,
                })}
                style={[typography.label, { color: colors.primary }]}
              >
                Buy pack
              </Text>
            </ModernCard>
          ))}
        </ModernCard>
        <ModernCard margin="none">
          <Text style={[typography.h5, { color: colors.text.primary }]}>Subscription</Text>
          <Text style={[typography.body, { color: colors.text.secondary }]}>
            {wallet?.connectPlusActive
              ? `${wallet.subscriptionTier} active`
              : 'No active subscription'}
          </Text>
          {wallet?.subscriptionExpiresAt ? (
            <Text style={[typography.caption, { color: colors.text.tertiary }]}>
              Expires {new Date(wallet.subscriptionExpiresAt).toLocaleDateString()}
            </Text>
          ) : null}
          <Text
            onPress={() => navigation.navigate('Subscriptions')}
            style={[typography.label, { color: colors.primary, marginTop: 12 }]}
          >
            Browse Connect+ plans
          </Text>
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
  packCard: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  packInfo: { gap: 2 },
  tipInput: { borderRadius: 8, borderWidth: 1, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10 },
});

export default WalletScreen;
