import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';

export const FEATURE_FLAG_NAMES = [
  'subscriptionEnabled',
  'walletEnabled',
  'fitnessCoachingUpsellEnabled',
  'tippingEnabled',
  'affiliateLinksEnabled',
  'manualPaymentEnabled',
] as const;

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];
export type FeatureFlags = Record<FeatureFlagName, boolean>;

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  subscriptionEnabled: false,
  walletEnabled: false,
  fitnessCoachingUpsellEnabled: false,
  tippingEnabled: false,
  affiliateLinksEnabled: false,
  manualPaymentEnabled: false,
};

const STORAGE_KEY = '@connect/feature-flags';
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const parseFeatureFlags = (value: unknown): FeatureFlags => {
  const source =
    value && typeof value === 'object' && 'featureFlags' in value
      ? (value as { featureFlags?: unknown }).featureFlags
      : value;
  const flags = { ...DEFAULT_FEATURE_FLAGS };

  if (!source || typeof source !== 'object') return flags;

  for (const name of FEATURE_FLAG_NAMES) {
    if (typeof (source as Record<string, unknown>)[name] === 'boolean') {
      flags[name] = (source as Record<string, boolean>)[name];
    }
  }

  return flags;
};

type FeatureFlagContextValue = {
  flags: FeatureFlags;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(
  undefined,
);

export function FeatureFlagProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/config/flags');
      const nextFlags = parseFeatureFlags(response.data);
      setFlags(nextFlags);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextFlags));
    } catch (error) {
      console.warn('Unable to refresh feature flags:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadFlags = async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && cached) setFlags(parseFeatureFlags(JSON.parse(cached)));
      } catch (error) {
        console.warn('Unable to load cached feature flags:', error);
      }
      if (mounted) await refresh();
    };

    void loadFlags();
    const interval = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ flags, isLoading, refresh }),
    [flags, isLoading, refresh],
  );

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlag(name: FeatureFlagName): boolean {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlag must be used within a FeatureFlagProvider');
  }
  return context.flags[name];
}

export function useFeatureFlags(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error(
      'useFeatureFlags must be used within a FeatureFlagProvider',
    );
  }
  return context;
}
