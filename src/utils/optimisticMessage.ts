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
