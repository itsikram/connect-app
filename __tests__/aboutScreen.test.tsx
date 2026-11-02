// Smoke test: the About screen renders app, device and update details.
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}) },
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => ({ type: 'wifi' })), addEventListener: jest.fn(() => () => {}) },
}));
jest.mock('../src/lib/config', () => ({ config: { API_BASE_URL: 'https://server.test/api' } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon', { virtual: true });
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('../src/components/VoiceTextInput', () => 'VoiceTextInput');
jest.mock('../src/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(async () => ({ data: { appVersion: '2.2.0', apkUrl: 'https://example.test/a.apk' } })) },
}));
jest.mock('../src/lib/appUpdate', () => ({
  ...jest.requireActual('../src/lib/appUpdate'),
  isAppUpdateSupported: () => true,
  getInstalledVersion: async () => '2.1.9',
  canInstallPackages: async () => false,
  downloadAndInstall: jest.fn(async () => true),
  getAppInfo: async () => ({
    packageName: 'com.connect.app',
    versionName: '2.1.9',
    versionCode: 219,
    firstInstallTime: 1760000000000,
    lastUpdateTime: 1761000000000,
    targetSdk: 35,
    minSdk: 24,
    installer: 'com.android.chrome',
    abi: 'arm64',
    supportedAbis: ['arm64-v8a', 'armeabi-v7a'],
    pageSize: 4096,
  }),
}));

import { ThemeProvider } from '../src/contexts/ThemeContext';
import { ToastProvider } from '../src/contexts/ToastContext';
import AboutScreen from '../src/screens/AboutScreen';

const textOf = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node => node.children.filter(c => typeof c === 'string').join(''))
    .join('\n');

test('shows version, device details and the available update', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <ThemeProvider>
        <ToastProvider>
          <AboutScreen />
        </ToastProvider>
      </ThemeProvider>,
    );
  });
  await act(async () => {
    await new Promise(r => setTimeout(r, 20));
  });
  const text = textOf(tree);
  expect(text).toContain('About Connect');
  expect(text).toContain('Version 2.1.9 (build 219)');
  expect(text).toContain('Version 2.2.0 is available');
  expect(text).toContain('Update to 2.2.0');
  expect(text).toContain('Update automatically');
  expect(text).toContain('Download on Wi-Fi only');
  expect(text).toContain('Not allowed');
  expect(text).toContain('Chrome');
  expect(text).toContain('JavaScript engine');
  expect(text).toContain('Android 7.0 (API 24)');
  expect(text).toContain('https://server.test');
  act(() => tree.unmount());
});
