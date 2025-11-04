export interface VpnPreset {
  id: string;
  label: string;
  host: string;
  port: string;
  excludedDomain?: string;
}

// Fill in your Netherlands proxy endpoint here
export const vpnPresets: VpnPreset[] = [
  {
    id: 'nl',
    label: 'Netherlands',
    host: '', // e.g. "nl1.yourproxy.com" or "203.0.113.10"
    port: '', // e.g. "8080"
    excludedDomain: '',
  },
];

export function getPresetById(id: string): VpnPreset | undefined {
  return vpnPresets.find(p => p.id === id);
}


