import {
  applyMessageEdit,
  canEditMessage,
} from '../src/utils/optimisticMessage';
import chatReducer, { editChatMessage } from '../src/reducers/chatReducer';

// The reducer module imports the API client (native storage); not needed here.
jest.mock('../src/lib/api', () => ({ chatAPI: { getChatList: jest.fn() } }));

const ME = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const THEM = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const msg = (id: string, extra: Record<string, any> = {}): Record<string, any> => ({
  _id: id,
  senderId: ME,
  receiverId: THEM,
  message: `text ${id}`,
  messageType: 'text',
  timestamp: '2026-10-29T09:00:00.000Z',
  ...extra,
});

describe('applyMessageEdit', () => {
  it('replaces the text and marks the message edited', () => {
    const list = [msg('1'), msg('2')];
    const next = applyMessageEdit(list, {
      messageId: '2',
      message: 'fixed',
      isEdited: true,
      editedAt: '2026-10-29T10:00:00.000Z',
    });
    expect(next[1]).toMatchObject({
      message: 'fixed',
      isEdited: true,
      editedAt: '2026-10-29T10:00:00.000Z',
    });
    expect(next[0]).toBe(list[0]);
    expect(list[1].message).toBe('text 2');
  });

  it('updates reply quotes of the edited message', () => {
    const list = [msg('1'), msg('2', { parent: { _id: '1', message: 'text 1' } })];
    const next = applyMessageEdit(list, { _id: '1', message: 'new words' });
    expect(next[1].parent).toEqual({ _id: '1', message: 'new words' });
  });

  it('returns the same array for unknown ids, bad payloads and repeats', () => {
    const list = [msg('1')];
    expect(applyMessageEdit(list, { messageId: '9', message: 'x' })).toBe(list);
    expect(applyMessageEdit(list, null)).toBe(list);
    expect(applyMessageEdit(list, { messageId: '1' })).toBe(list);
    const edited = applyMessageEdit(list, { messageId: '1', message: 'x', editedAt: 'T' });
    expect(applyMessageEdit(edited, { messageId: '1', message: 'x', editedAt: 'T' })).toBe(edited);
  });

  it('rolls back to the previous values', () => {
    const optimistic = applyMessageEdit([msg('1')], { messageId: '1', message: 'draft', editedAt: 'T' });
    const restored = applyMessageEdit(optimistic, {
      messageId: '1',
      message: 'text 1',
      isEdited: false,
      editedAt: null,
    });
    expect(restored[0]).toMatchObject({ message: 'text 1', isEdited: false, editedAt: null });
  });
});

describe('canEditMessage', () => {
  it('allows only my own confirmed text messages that have text', () => {
    expect(canEditMessage(msg('1'), ME)).toBe(true);
    expect(canEditMessage(msg('1', { messageType: undefined }), ME)).toBe(true);
    expect(canEditMessage(msg('1'), THEM)).toBe(false);
    expect(canEditMessage(msg('temp-1', { isOptimistic: true }), ME)).toBe(false);
    expect(canEditMessage(msg('1', { sendFailed: true }), ME)).toBe(false);
    expect(canEditMessage(msg('1', { messageType: 'call' }), ME)).toBe(false);
    expect(canEditMessage(msg('1', { messageType: 'audio', message: '' }), ME)).toBe(false);
    expect(canEditMessage(msg('1', { messageType: 'secure' }), ME)).toBe(false);
    expect(canEditMessage(null, ME)).toBe(false);
  });
});

describe('chatReducer editChatMessage', () => {
  it('updates the chat-list preview without reordering chats', () => {
    const state = {
      chats: [
        { person: { _id: 'x' }, messages: [msg('5')] },
        { person: { _id: THEM }, messages: [msg('3')] },
      ],
      loading: false,
      error: null,
      unreadMessageCount: 0,
    } as any;
    const next = chatReducer(
      state,
      editChatMessage({ messageId: '3', message: 'edited preview', editedAt: '2026-10-29T10:00:00.000Z' }),
    );
    expect(next.chats.map((c: any) => c.person._id)).toEqual(['x', THEM]);
    expect(next.chats[1].messages[0]).toMatchObject({
      message: 'edited preview',
      isEdited: true,
      editedAt: '2026-10-29T10:00:00.000Z',
    });
    expect(next.chats[0]).toBe(state.chats[0]);
  });
});
