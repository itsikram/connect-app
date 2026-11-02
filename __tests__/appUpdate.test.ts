// Auto-update decisions in src/hooks/useAutoUpdate.ts, with the native
// update module, the API and the network faked.

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
      setItem: jest.fn(async (k: string, v: string) => {
        store[k] = v;
      }),
      __reset: () => {
        store = {};
      },
    },
  };
});

let mockNetType = 'wifi';
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({ type: mockNetType })),
    addEventListener: jest.fn(() => () => {}),
  },
}));

const mockApiGet = jest.fn();
jest.mock('../src/lib/api', () => ({ __esModule: true, default: { get: (...a: any[]) => mockApiGet(...a) } }));

const mockNative = {
  installed: '2.1.9',
  canInstall: true,
  downloadAndInstall: jest.fn(async () => true),
};
jest.mock('../src/lib/appUpdate', () => {
  const actual = jest.requireActual('../src/lib/appUpdate');
  return {
    ...actual,
    isAppUpdateSupported: () => true,
    getInstalledVersion: async () => mockNative.installed,
    canInstallPackages: async () => mockNative.canInstall,
    openInstallPermissionSettings: async () => true,
    downloadAndInstall: (...a: any[]) => (mockNative.downloadAndInstall as any)(...a),
    addProgressListener: () => () => {},
    addStatusListener: () => () => {},
  };
});

type Mod = typeof import('../src/hooks/useAutoUpdate');

const load = (): Mod => {
  let mod: Mod;
  jest.isolateModules(() => {
    mod = require('../src/hooks/useAutoUpdate');
  });
  return mod!;
};

const config = (appVersion: string) => ({
  data: { appVersion, apkUrl: 'https://example.test/Connect.apk' },
});

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const stateOf = (mod: Mod) => mod.getAppUpdateState();

beforeEach(() => {
  require('@react-native-async-storage/async-storage').default.__reset();
  mockApiGet.mockReset();
  mockNative.installed = '2.1.9';
  mockNative.canInstall = true;
  mockNative.downloadAndInstall.mockClear();
  mockNetType = 'wifi';
});

test('reports up to date when the server version is not newer', async () => {
  const mod = load();
  mockApiGet.mockResolvedValue(config('2.1.9'));
  await mod.checkForUpdatesNow();
  const s = stateOf(mod);
  expect(s.check).toBe('up_to_date');
  expect(s.latestVersion).toBe('2.1.9');
  expect(s.lastCheckedAt).toBeGreaterThan(0);
  expect(mockNative.downloadAndInstall).not.toHaveBeenCalled();
});

test('downloads a newer version automatically by default', async () => {
  const mod = load();
  mockApiGet.mockResolvedValue(config('2.2.0'));
  await mod.checkForUpdatesNow();
  await flush();
  expect(mockNative.downloadAndInstall).toHaveBeenCalledTimes(1);
  expect(stateOf(mod).check).toBe('available');
});

test('asks instead of downloading when automatic updates are off', async () => {
  const mod = load();
  await mod.setUpdatePrefs({ autoUpdate: false });
  mockApiGet.mockResolvedValue(config('2.2.0'));
  await mod.checkForUpdatesNow();
  await flush();
  expect(mockNative.downloadAndInstall).not.toHaveBeenCalled();
  const s = stateOf(mod);
  expect(s.visible).toBe(true);
  expect(s.phase).toBe('available');

  await mod.updateNow();
  await flush();
  expect(mockNative.downloadAndInstall).toHaveBeenCalledTimes(1);
});

test('waits for Wi-Fi when Wi-Fi only is on', async () => {
  const mod = load();
  await mod.setUpdatePrefs({ wifiOnly: true });
  mockNetType = 'cellular';
  mockApiGet.mockResolvedValue(config('2.2.0'));
  await mod.checkForUpdatesNow();
  await flush();
  expect(mockNative.downloadAndInstall).not.toHaveBeenCalled();
  expect(stateOf(mod).check).toBe('available');
});

test('asks for the install permission before downloading', async () => {
  const mod = load();
  mockNative.canInstall = false;
  mockApiGet.mockResolvedValue(config('2.2.0'));
  await mod.checkForUpdatesNow();
  await flush();
  expect(mockNative.downloadAndInstall).not.toHaveBeenCalled();
  expect(stateOf(mod).phase).toBe('permission');
});

test('explains a failed download', async () => {
  const mod = load();
  mockNative.downloadAndInstall.mockRejectedValueOnce(
    Object.assign(new Error('Download failed (HTTP 404)'), { code: 'update_error' }),
  );
  mockApiGet.mockResolvedValue(config('2.2.0'));
  await mod.checkForUpdatesNow();
  await flush();
  const s = stateOf(mod);
  expect(s.phase).toBe('failed');
  expect(s.error).toMatch(/download failed/i);
});

test('shows a server error on a failed manual check', async () => {
  const mod = load();
  mockApiGet.mockRejectedValue(new Error('Network Error'));
  await mod.checkForUpdatesNow();
  const s = stateOf(mod);
  expect(s.check).toBe('error');
  expect(s.error).toMatch(/server/i);
});

test('saves the preferences', async () => {
  const mod = load();
  await mod.setUpdatePrefs({ autoUpdate: false, wifiOnly: true });
  await flush();
  const fresh = load();
  await flush();
  expect(stateOf(fresh).prefs).toEqual({ autoUpdate: false, wifiOnly: true });
});

test('describeUpdateError explains common install failures', () => {
  const { describeUpdateError } = jest.requireActual('../src/lib/appUpdate');
  expect(
    describeUpdateError('INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match', 5),
  ).toMatch(/signed differently/);
  expect(describeUpdateError(undefined, 6)).toMatch(/storage/i);
  expect(describeUpdateError('Install failed (3)', 3)).toMatch(/cancelled/);
});
