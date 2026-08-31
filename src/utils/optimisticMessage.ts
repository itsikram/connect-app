export function idOf(value: any): string {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    if (value._id != null && value._id !== value) return idOf(value._id);
    if (typeof value.toHexString === 'function') return value.toHexString();
    const asString = typeof value.toString === 'function' ? value.toString() : '';
    if (asString && asString !== '[object Object]') return asString;
    return '';
  }
  return String(value);
}

export function upsertConfirmedMessage<T extends {
  _id?: any;
  tempId?: string;
  senderId?: any;
  message?: string;
  timestamp?: Date | string;
  isOptimistic?: boolean;
}>(prev: T[], confirmed: T, tempId?: string): T[] {
  const list = Array.isArray(prev) ? prev.filter(Boolean) : [];
  if (!confirmed || !confirmed._id) return list;

  const confirmedId = idOf(confirmed._id);
  const matchTemp = tempId || confirmed.tempId || null;

  const withoutDupes = list.filter((msg) => {
    if (matchTemp && (msg.tempId === matchTemp || String(msg._id) === String(matchTemp))) {
      return false;
    }
    if (idOf(msg._id) === confirmedId) {
      return false;
    }
    if (
      msg.isOptimistic &&
      idOf(msg.senderId) === idOf(confirmed.senderId) &&
      msg.message === confirmed.message
    ) {
      const dt = Math.abs(
        new Date(msg.timestamp as any).getTime() - new Date(confirmed.timestamp as any).getTime(),
      );
      if (Number.isFinite(dt) && dt < 15000) return false;
    }
    return true;
  });

  return [...withoutDupes, { ...confirmed, isOptimistic: false }];
}

export function isConversationMessage(msg: any, userId: any, friendId: any): boolean {
  if (!msg) return false;
  const sender = idOf(msg.senderId);
  const receiver = idOf(msg.receiverId);
  const friend = idOf(friendId);
  const me = idOf(userId);
  if (!friend) return false;
  return (
    sender === friend ||
    receiver === friend ||
    (sender === me && receiver === friend) ||
    (sender === friend && receiver === me)
  );
}

export function mergeHistoryWithLive<T extends {
  _id?: any;
  tempId?: string;
  senderId?: any;
  message?: string;
  timestamp?: Date | string;
  isOptimistic?: boolean;
}>(history: T[], live: T[]): T[] {
  const hist = Array.isArray(history) ? history.filter(Boolean) : [];
  const liveList = Array.isArray(live) ? live.filter(Boolean) : [];
  const histIds = new Set(hist.map((m) => idOf(m._id)).filter(Boolean));

  const extras = liveList.filter((msg) => {
    if (msg.isOptimistic) {
      const alreadyInHistory = hist.some(
        (h) =>
          idOf(h.senderId) === idOf(msg.senderId) &&
          h.message === msg.message &&
          Math.abs(
            new Date(h.timestamp as any).getTime() - new Date(msg.timestamp as any).getTime(),
          ) < 15000,
      );
      return !alreadyInHistory;
    }
    const id = idOf(msg._id);
    return Boolean(id && !histIds.has(id));
  });

  return [...hist, ...extras];
}
