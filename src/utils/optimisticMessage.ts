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

  return sortMessages([...withoutDupes, { ...confirmed, isOptimistic: false }]);
}

type EditableMessage = {
  _id?: any;
  senderId?: any;
  message?: string;
  messageType?: string;
  isOptimistic?: boolean;
  sendFailed?: boolean;
  isEdited?: boolean;
  editedAt?: string | Date | null;
  parent?: any;
};

/** `messageEdited` socket payload, or an edited message from POST /message/edit. */
export interface MessageEditPayload {
  messageId?: string;
  _id?: string;
  message?: string;
  isEdited?: boolean;
  editedAt?: string | Date | null;
}

// The edited message gets the new text and "edited" flag, and replies that
// quote it show the new text. Returns the same array when nothing changed.
export function applyMessageEdit<T extends EditableMessage>(
  messages: T[],
  edit: MessageEditPayload | null | undefined,
): T[] {
  const list = Array.isArray(messages) ? messages : [];
  const editedId = idOf(edit?.messageId || edit?._id);
  if (!edit || !editedId || typeof edit.message !== 'string') return list;
  const isEdited = edit.isEdited === undefined ? true : Boolean(edit.isEdited);
  const hasEditedAt = Object.prototype.hasOwnProperty.call(edit, 'editedAt');
  let changed = false;
  const next = list.map((msg) => {
    if (!msg) return msg;
    if (idOf(msg._id) === editedId) {
      const editedAt = hasEditedAt ? edit.editedAt ?? null : msg.editedAt ?? null;
      if (
        msg.message === edit.message &&
        Boolean(msg.isEdited) === isEdited &&
        String(msg.editedAt ?? '') === String(editedAt ?? '')
      ) {
        return msg;
      }
      changed = true;
      return { ...msg, message: edit.message, isEdited, editedAt };
    }
    const parent = msg.parent;
    if (
      parent &&
      typeof parent === 'object' &&
      idOf(parent._id) === editedId &&
      parent.message !== edit.message
    ) {
      changed = true;
      return { ...msg, parent: { ...parent, message: edit.message } };
    }
    return msg;
  });
  return changed ? next : list;
}

// Same rules as the server: my own, confirmed, plain text messages with text.
export function canEditMessage(msg: EditableMessage | null | undefined, myId: any): boolean {
  if (!msg || msg.isOptimistic || msg.sendFailed) return false;
  const id = idOf(msg._id);
  if (!id || id.startsWith('temp-')) return false;
  if (!idOf(myId) || idOf(msg.senderId) !== idOf(myId)) return false;
  if ((msg.messageType || 'text') !== 'text') return false;
  return typeof msg.message === 'string' && msg.message.trim().length > 0;
}

export function isConversationMessage(msg: any, userId: any, connectId: any): boolean {
  if (!msg) return false;
  const sender = idOf(msg.senderId);
  const receiver = idOf(msg.receiverId);
  const connect = idOf(connectId);
  const me = idOf(userId);
  if (!connect) return false;
  if (!me) return sender === connect || receiver === connect;
  return (
    (sender === me && receiver === connect) ||
    (sender === connect && receiver === me)
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

  return sortMessages([...hist, ...extras]);
}

function sortMessages<T extends { timestamp?: Date | string }>(messages: T[]): T[] {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const timeA = new Date(a.message.timestamp as any).getTime();
      const timeB = new Date(b.message.timestamp as any).getTime();
      const safeTimeA = Number.isFinite(timeA) ? timeA : 0;
      const safeTimeB = Number.isFinite(timeB) ? timeB : 0;
      return safeTimeA - safeTimeB || a.index - b.index;
    })
    .map(({ message }) => message);
}
