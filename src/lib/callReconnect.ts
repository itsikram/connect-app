/**
 * Agora reports why the other person left the media channel. "Quit" means
 * they left on purpose (hung up). Anything else ("ServerTimeOut") means their
 * connection dropped — a network switch, a locked phone, a lost signal — so,
 * like WhatsApp, show "Reconnecting…" and give them time to come back before
 * closing the call. Matches the web app.
 */
export const PEER_RECONNECT_GRACE_MS = 15000;

export const peerLeftOnPurpose = (reason?: string | null): boolean =>
  !reason || reason === 'Quit';
