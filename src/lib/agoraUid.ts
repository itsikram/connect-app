/** Stable numeric Agora UID hashed from a profile id (matches web AudioCall/VideoCall). */
export function hashProfileUid(profileId?: string | null): number {
  if (!profileId) return 0;
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    hash = (hash << 5) - hash + profileId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
