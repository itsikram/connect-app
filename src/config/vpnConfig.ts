export interface VpnPreset {
  id: string;
  label: string;
  host: string;
  port: string;
  excludedDomain?: string;
}

export interface VpnAuthProxy {
  id: string;
  label: string;
  host: string; // hostname or IP, no scheme
  port: string;
  username?: string;
  password?: string;
}

// Fill in your Netherlands proxy endpoint here (kept for future use)
export const vpnPresets: VpnPreset[] = [
  {
    id: 'nl',
    label: 'Netherlands',
    host: '', // e.g. "nl1.yourproxy.com" or "203.0.113.10"
    port: '', // e.g. "8080"
    excludedDomain: '',
  },
];

export const vpnProxyList: VpnAuthProxy[] = [
  { id: 'p1', label: 'NL-1', host: '142.111.48.253', port: '7030', username: 'rkastqyq', password: 'ota54tm0w4n4' },
  { id: 'p2', label: 'NL-2', host: '31.59.20.176', port: '6754', username: 'rkastqyq', password: 'ota54tm0w4n4' },
  { id: 'p3', label: 'NL-3', host: '23.95.150.145', port: '6114', username: 'rkastqyq', password: 'ota54tm0w4n4' },
  { id: 'p4', label: 'NL-4', host: '198.23.239.134', port: '6540', username: 'rkastqyq', password: 'ota54tm0w4n4' },
  { id: 'p5', label: 'NL-5', host: '45.38.107.97', port: '6014', username: 'rkastqyq', password: 'ota54tm0w4n4' },
  { id: 'p6', label: 'NL-6', host: '107.172.163.27', port: '6543', username: 'rkastqyq', password: 'ota54tm0w4n4' },
  { id: 'p7', label: 'NL-7', host: '64.137.96.74', port: '6641', username: 'rkastqyq', password: 'ota54tm0w4n4' },
  { id: 'p8', label: 'NL-8', host: '216.10.27.159', port: '6837', username: 'rkastqyq', password: 'ota54tm0w4n4' },
  { id: 'p9', label: 'NL-9', host: '142.111.67.146', port: '5611', username: 'rkastqyq', password: 'ota54tm0w4n4' },
  { id: 'p10', label: 'NL-10', host: '142.147.128.93', port: '6593', username: 'rkastqyq', password: 'ota54tm0w4n4' },
];

export function getPresetById(id: string): VpnPreset | undefined {
  return vpnPresets.find(p => p.id === id);
}

export function getProxyById(id: string): VpnAuthProxy | undefined {
  return vpnProxyList.find(p => p.id === id);
}


