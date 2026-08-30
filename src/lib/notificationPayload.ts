/** Expo / iOS expect string values in notification data payloads. */
export function stringifyNotificationData(
  data?: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}
