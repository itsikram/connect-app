import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import moment from 'moment';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import ScreenHeader from '../components/ScreenHeader';
import {
  SettingsPrimaryButton,
  SettingsSecondaryButton,
  SettingsSwitchRow,
} from '../components/settings/settingsUi';
import {
  canInstallPackages,
  getAppInfo,
  isAppUpdateSupported,
  type AppInfo,
} from '../lib/appUpdate';
import {
  allowUpdateInstalls,
  checkForUpdatesNow,
  setUpdatePrefs,
  updateNow,
  useAppUpdateState,
} from '../hooks/useAutoUpdate';
import { config } from '../lib/config';
import { useToast } from '../contexts/ToastContext';

// Version on platforms without the native update module (iOS, web).
const BUNDLED_VERSION: string = require('../../app.json').expo.version;

const INSTALLER_NAMES: Record<string, string> = {
  'com.android.vending': 'Google Play',
  'com.android.packageinstaller': 'Package installer',
  'com.google.android.packageinstaller': 'Package installer',
  'com.android.chrome': 'Chrome',
  'com.sec.android.app.sbrowser': 'Samsung Internet',
  'com.google.android.apps.nbu.files': 'Files by Google',
  'com.google.android.documentsui': 'Files',
};

const ABI_NAMES: Record<string, string> = {
  arm64: '64-bit ARM (arm64-v8a)',
  arm: '32-bit ARM (armeabi-v7a)',
  x86_64: '64-bit Intel (x86_64)',
  x86: '32-bit Intel (x86)',
};

// Android release for an API level, for "minimum Android".
const ANDROID_RELEASES: Record<number, string> = {
  24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1', 28: '9', 29: '10', 30: '11',
  31: '12', 32: '12L', 33: '13', 34: '14', 35: '15', 36: '16',
};

const androidName = (api: number) =>
  ANDROID_RELEASES[api] ? `Android ${ANDROID_RELEASES[api]} (API ${api})` : `API ${api}`;

const formatDate = (ms: number) => (ms ? moment(ms).format('D MMM YYYY, h:mm A') : '—');

type Row = { label: string; value: string };

const InfoRows = ({ rows }: { rows: Row[] }) => {
  const { colors } = useTheme();
  return (
    <View>
      {rows.map((row, index) => (
        <View
          key={row.label}
          style={[
            styles.row,
            index > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border.primary,
            },
          ]}
        >
          <Text style={[styles.rowLabel, { color: colors.text.secondary }]}>
            {row.label}
          </Text>
          <Text
            style={[styles.rowValue, { color: colors.text.primary }]}
            selectable
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
};

const Section = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors.surface.primary, borderColor: colors.border.primary },
      ]}
    >
      <View style={styles.sectionTitleRow}>
        <Icon name={icon} size={20} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
};

const AboutScreen = () => {
  const { colors, isDarkMode } = useTheme();
  const { showSuccess } = useToast();
  const update = useAppUpdateState();
  const updatesSupported = isAppUpdateSupported();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [canInstall, setCanInstall] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    if (!updatesSupported) return;
    getAppInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
    canInstallPackages()
      .then(setCanInstall)
      .catch(() => setCanInstall(null));
  }, [updatesSupported]);

  useFocusEffect(refresh);

  // Back from Android's "Install unknown apps" screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', appState => {
      if (appState === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Check once when the screen opens if the app has not asked the server yet.
  useEffect(() => {
    if (updatesSupported && update.check === 'idle') checkForUpdatesNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const constants = Platform.constants as any;
  const version = info?.versionName || BUNDLED_VERSION;
  const androidVersion = Number(Platform.Version) || 0;
  const installedBySelf = !!info && info.installer === info.packageName;
  const silentUpdates = androidVersion >= 31 && installedBySelf;
  const downloading =
    update.visible && (update.phase === 'downloading' || update.phase === 'installing');

  const appRows: Row[] = useMemo(() => {
    const rows: Row[] = [{ label: 'Version', value: version }];
    if (info) {
      const installer = info.installer
        ? info.installer === info.packageName
          ? 'Connect (self-update)'
          : INSTALLER_NAMES[info.installer] || info.installer
        : 'Unknown';
      rows.push(
        { label: 'Build', value: String(info.versionCode) },
        { label: 'Package', value: info.packageName },
        { label: 'Installed', value: formatDate(info.firstInstallTime) },
        { label: 'Last updated', value: formatDate(info.lastUpdateTime) },
        { label: 'Installed from', value: installer },
        { label: 'Minimum Android', value: androidName(info.minSdk) },
        { label: 'Built for', value: androidName(info.targetSdk) },
      );
    }
    return rows;
  }, [info, version]);

  const deviceRows: Row[] = useMemo(() => {
    const rows: Row[] = [];
    if (Platform.OS === 'android') {
      const maker = String(constants?.Manufacturer || constants?.Brand || '');
      const model = String(constants?.Model || '');
      rows.push(
        {
          label: 'Device',
          value: model.toLowerCase().startsWith(maker.toLowerCase())
            ? model
            : `${maker} ${model}`.trim() || 'Unknown',
        },
        {
          label: 'Android',
          value: `${constants?.Release || '?'} (API ${androidVersion})`,
        },
      );
      if (info) {
        rows.push(
          { label: 'App processor code', value: ABI_NAMES[info.abi] || info.abi || '—' },
          { label: 'Phone supports', value: info.supportedAbis.join(', ') || '—' },
          {
            label: 'Memory page size',
            value: info.pageSize ? `${Math.round(info.pageSize / 1024)} KB` : '—',
          },
        );
      }
    } else {
      rows.push({ label: 'Platform', value: `${Platform.OS} ${Platform.Version ?? ''}`.trim() });
    }
    const rn = constants?.reactNativeVersion;
    rows.push(
      {
        label: 'JavaScript engine',
        value: typeof (globalThis as any).HermesInternal === 'object' ? 'Hermes' : 'JSC',
      },
      {
        label: 'React Native',
        value: rn ? `${rn.major}.${rn.minor}.${rn.patch}` : '—',
      },
      {
        label: 'Server',
        value: String(config.API_BASE_URL || '').replace(/\/api\/?$/, '') || '—',
      },
    );
    return rows;
  }, [androidVersion, constants, info]);

  const copyDetails = useCallback(async () => {
    const lines = [
      'Connect app details',
      ...appRows.map(r => `${r.label}: ${r.value}`),
      ...deviceRows.map(r => `${r.label}: ${r.value}`),
      update.latestVersion ? `Latest version: ${update.latestVersion}` : '',
      update.error ? `Last update error: ${update.error}` : '',
    ].filter(Boolean);
    await Clipboard.setStringAsync(lines.join('\n'));
    showSuccess('Details copied');
  }, [appRows, deviceRows, showSuccess, update.error, update.latestVersion]);

  let statusText = 'Not checked yet';
  let statusColor: string = colors.text.secondary;
  let statusIcon = 'help-outline';
  if (update.check === 'checking') {
    statusText = 'Checking for updates…';
    statusIcon = 'sync';
  } else if (downloading) {
    statusText =
      update.phase === 'installing'
        ? `Installing ${update.version}…`
        : `Downloading ${update.version}… ${Math.round(update.progress * 100)}%`;
    statusColor = colors.primary;
    statusIcon = 'downloading';
  } else if (update.check === 'available') {
    statusText = `Version ${update.version} is available`;
    statusColor = colors.status.warning;
    statusIcon = 'system-update';
  } else if (update.check === 'up_to_date') {
    statusText = 'Connect is up to date';
    statusColor = colors.status.success;
    statusIcon = 'check-circle';
  } else if (update.check === 'error') {
    statusText = 'Could not check for updates';
    statusColor = colors.status.error;
    statusIcon = 'error-outline';
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScreenHeader title="About Connect" style={styles.header} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.panel,
            styles.hero,
            { backgroundColor: colors.surface.primary, borderColor: colors.border.primary },
          ]}
        >
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={[styles.appName, { color: colors.text.primary }]}>Connect</Text>
          <Text style={[styles.appVersion, { color: colors.text.secondary }]}>
            Version {version}
            {info ? ` (build ${info.versionCode})` : ''}
          </Text>
          {updatesSupported ? (
            <View style={[styles.statusChip, { backgroundColor: statusColor + '1F' }]}>
              {update.check === 'checking' ? (
                <ActivityIndicator size="small" color={statusColor} />
              ) : (
                <Icon name={statusIcon} size={16} color={statusColor} />
              )}
              <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
            </View>
          ) : null}
        </View>

        {updatesSupported ? (
          <Section title="Updates" icon="system-update">
            <Text style={[styles.note, { color: colors.text.secondary }]}>
              {update.latestVersion
                ? `Latest version: ${update.latestVersion}. `
                : ''}
              Last checked:{' '}
              {update.lastCheckedAt ? moment(update.lastCheckedAt).fromNow() : 'never'}
            </Text>
            {update.error && (update.check === 'error' || update.phase === 'failed') ? (
              <Text style={[styles.note, { color: colors.status.error }]}>{update.error}</Text>
            ) : null}

            {update.check === 'available' && !downloading ? (
              <SettingsPrimaryButton
                title={`Update to ${update.version}`}
                onPress={updateNow}
              />
            ) : null}
            <SettingsSecondaryButton
              title={update.check === 'checking' ? 'Checking…' : 'Check for updates'}
              onPress={checkForUpdatesNow}
              disabled={update.check === 'checking' || downloading}
            />

            <View style={styles.switches}>
              <SettingsSwitchRow
                label="Update automatically"
                help="Download and install new versions by itself. When off, Connect asks before updating."
                value={update.prefs.autoUpdate}
                onValueChange={value => setUpdatePrefs({ autoUpdate: value })}
              />
              <SettingsSwitchRow
                label="Download on Wi-Fi only"
                help="Wait for Wi-Fi before downloading an update automatically, to save mobile data."
                value={update.prefs.wifiOnly}
                onValueChange={value => setUpdatePrefs({ wifiOnly: value })}
                disabled={!update.prefs.autoUpdate}
              />
            </View>

            <InfoRows
              rows={[
                {
                  label: 'Install permission',
                  value:
                    canInstall === null ? '—' : canInstall ? 'Allowed' : 'Not allowed',
                },
                {
                  label: 'Updates install',
                  value: silentUpdates
                    ? 'Without a tap'
                    : androidVersion >= 31
                      ? 'After you confirm (silent from the next update)'
                      : 'After you confirm',
                },
              ]}
            />
            {canInstall === false ? (
              <SettingsSecondaryButton
                title="Allow installing updates"
                onPress={allowUpdateInstalls}
              />
            ) : null}
          </Section>
        ) : null}

        <Section title="App" icon="info-outline">
          <InfoRows rows={appRows} />
        </Section>

        <Section title="Device" icon="smartphone">
          <InfoRows rows={deviceRows} />
        </Section>

        <SettingsSecondaryButton title="Copy details" onPress={copyDetails} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 10,
    paddingBottom: 40,
    gap: 12,
  },
  panel: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    marginBottom: 10,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
  },
  appVersion: {
    fontSize: 14,
    marginTop: 2,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  switches: {
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  rowLabel: {
    fontSize: 14,
    flexShrink: 0,
    maxWidth: '45%',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
});

export default AboutScreen;
