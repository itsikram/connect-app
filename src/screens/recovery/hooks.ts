import { useCallback, useEffect, useRef, useState } from 'react';
import { RecoveryContent, RecoveryDashboard, RecoveryLang, recoveryApi } from '../../services/recoveryApi';
import { errorMessage } from '../fitness/ui';

/** Static Recovery content (catalog, screeners, helplines), cached for offline use. */
export const useRecoveryContent = (lang: RecoveryLang) => {
  const [content, setContent] = useState<RecoveryContent | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const cached = await recoveryApi.getCachedContent(lang);
    if (cached) setContent(cached);
    try {
      const response = await recoveryApi.getContent(lang);
      setContent(response.data);
      setError('');
      recoveryApi.cacheContent(lang, response.data).catch(() => {});
    } catch (requestError: any) {
      if (!cached) setError(errorMessage(requestError, 'Could not load'));
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  return { content, error, reload: load };
};

/**
 * Dashboard data: shows the cached copy immediately, then refreshes from the
 * server (and again whenever the screen regains focus).
 */
export const useRecoveryDashboard = (lang: RecoveryLang, navigation?: any) => {
  const [data, setData] = useState<RecoveryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [offsetMs, setOffsetMs] = useState(0);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const response = await recoveryApi.getDashboard(lang);
      if (!mounted.current) return;
      setData(response.data);
      setError('');
      if (response.data.serverTime) setOffsetMs(Date.parse(response.data.serverTime) - Date.now());
      recoveryApi.cacheDashboard(response.data).catch(() => {});
    } catch (requestError: any) {
      if (mounted.current) setError(errorMessage(requestError, 'Could not load your recovery summary.'));
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [lang]);

  useEffect(() => {
    mounted.current = true;
    recoveryApi
      .getCachedDashboard()
      .then((cached) => {
        if (mounted.current && cached) {
          setData(cached);
          setLoading(false);
        }
      })
      .catch(() => {})
      .finally(refresh);
    const unsubscribe = navigation?.addListener?.('focus', refresh);
    return () => {
      mounted.current = false;
      unsubscribe?.();
    };
  }, [navigation, refresh]);

  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    offsetMs,
    refresh,
    pullToRefresh: () => {
      setRefreshing(true);
      refresh();
    },
  };
};

/** The last saved dashboard only (no network), for screens that must work offline such as SOS and Help. */
export const useCachedDashboard = () => {
  const [data, setData] = useState<RecoveryDashboard | null>(null);
  useEffect(() => {
    let active = true;
    recoveryApi
      .getCachedDashboard()
      .then((cached) => {
        if (active) setData(cached);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return data;
};
