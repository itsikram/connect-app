export const adjustHexColor = (hex: string, amt: number): string => {
  try {
    let h = hex.startsWith('#') ? hex.slice(1) : hex;
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    let num = parseInt(h, 16);
    if (Number.isNaN(num)) return hex;
    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 0x00ff) + amt;
    let b = (num & 0x0000ff) + amt;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    const out = (r << 16) | (g << 8) | b;
    return '#' + out.toString(16).padStart(6, '0');
  } catch {
    return hex;
  }
};
