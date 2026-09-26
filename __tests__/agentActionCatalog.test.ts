/// <reference types="jest" />

import {
  describeAgentActionsForPrompt,
  executeAgentActions,
  parseAgentIntent,
} from '../src/services/agentActionCatalog';

describe('agent action intents', () => {
  it('accepts recoverable JSON and rejects unknown actions', () => {
    const valid = parseAgentIntent('{"actions":[{"action":"navigate_message"}]}');
    expect(valid.ok).toBe(true);
    expect(parseAgentIntent('```json {"reply":"Done","actions":[]} ```').ok).toBe(true);
    expect(parseAgentIntent('Here is the action: {"reply":"Done","actions":[]}').ok).toBe(true);
    const unsupported = parseAgentIntent('{"actions":[{"action":"delete_everything"}]}');
    expect(unsupported.ok).toBe(false);
    expect(unsupported).toMatchObject({ unsupportedActions: ['delete_everything'] });
  });

  it('requires confirmation for sensitive actions', async () => {
    const logout = jest.fn();
    const adapter = { logout };
    const cancelled = await executeAgentActions(
      [{ action: 'logout' }],
      adapter,
      { confirm: async () => false },
    );
    expect(cancelled[0]).toMatchObject({ ok: false, cancelled: true });
    expect(logout).not.toHaveBeenCalled();

    const confirmed = await executeAgentActions(
      [{ action: 'logout' }],
      adapter,
      { confirm: async () => true },
    );
    expect(confirmed[0].ok).toBe(true);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('accepts YouTube search and download actions', async () => {
    const searchYoutube = jest.fn();
    const downloadYoutube = jest.fn();
    const parsed = parseAgentIntent(
      '{"actions":[{"action":"SEARCH_YOUTUBE","parameters":{"query":"lofi music"}},{"action":"DOWNLOAD_YOUTUBE","parameters":{"query":"lofi music"}}]}',
    );
    expect(parsed.ok).toBe(true);

    const results = await executeAgentActions(
      parsed.ok ? parsed.intent.actions : undefined,
      { searchYoutube, downloadYoutube },
      { skipConfirmation: true },
    );

    expect(results.every(result => result.ok)).toBe(true);
    expect(searchYoutube).toHaveBeenCalledWith('lofi music');
    expect(downloadYoutube).toHaveBeenCalledWith(expect.objectContaining({ query: 'lofi music' }));
  });

  it('hydrates the callee profile picture when the action already has a user ID', async () => {
    const startAudioCall = jest.fn();
    const resolveUser = jest.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Alex',
      profilePic: 'https://example.com/alex.jpg',
    });

    const results = await executeAgentActions(
      [
        {
          action: 'START_AUDIO_CALL',
          parameters: { userId: 'user-1', userName: 'Alex' },
        },
      ],
      { resolveUser, startAudioCall },
      { skipConfirmation: true },
    );

    expect(results[0].ok).toBe(true);
    expect(resolveUser).toHaveBeenCalledWith('Alex');
    expect(startAudioCall).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      'Alex',
      'https://example.com/alex.jpg',
    );
  });

  it('folds loose action fields into parameters and ignores extra keys', () => {
    const parsed = parseAgentIntent(
      '{"message":"On it","confidence":0.9,"actions":[{"action":"SEARCH_YOUTUBE","query":"lofi","label":"x"}]}',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.actions?.[0].parameters).toMatchObject({ query: 'lofi' });
  });

  it('keeps supported actions when the plan also contains unknown ones', () => {
    const parsed = parseAgentIntent(
      '{"actions":[{"action":"navigate_notes"},{"action":"teleport"}]}',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.actions?.map(action => action.action)).toEqual([
      'navigate_notes',
    ]);
  });

  it('always confirms destructive actions, even in auto mode', async () => {
    const removeConnect = jest.fn();
    const confirm = jest.fn(async () => false);
    const results = await executeAgentActions(
      [{ action: 'REMOVE_CONNECT', parameters: { userId: 'u1' } }],
      { removeConnect },
      { skipConfirmation: true, confirm },
    );
    expect(confirm).toHaveBeenCalled();
    expect(removeConnect).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({ cancelled: true });
  });

  it('runs the new productivity and lookup actions', async () => {
    const createEvent = jest.fn();
    const createNote = jest.fn();
    const queryAppData = jest.fn(async () => 'You have 2 open tasks.');
    const results = await executeAgentActions(
      [
        {
          action: 'CREATE_EVENT',
          parameters: { title: 'Standup', date: '2026-09-26', time: '10:00' },
        },
        { action: 'CREATE_NOTE', parameters: { content: 'Buy milk' } },
        { action: 'QUERY_APP_DATA', parameters: { dataType: 'tasks' } },
      ],
      { createEvent, createNote, queryAppData },
      { skipConfirmation: true },
    );
    expect(results.every(result => result.ok)).toBe(true);
    expect(createEvent).toHaveBeenCalledWith({
      title: 'Standup',
      date: '2026-09-26',
      time: '10:00',
    });
    expect(createNote).toHaveBeenCalledWith('Buy milk', undefined);
    expect(results[2].message).toBe('You have 2 open tasks.');
  });

  it('rejects an event without an absolute date', async () => {
    const createEvent = jest.fn();
    const [result] = await executeAgentActions(
      [{ action: 'CREATE_EVENT', parameters: { title: 'Gym', date: 'tomorrow' } }],
      { createEvent },
      { skipConfirmation: true },
    );
    expect(result.ok).toBe(false);
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('describes every promptable action for the model', () => {
    const prompt = describeAgentActionsForPrompt();
    expect(prompt).toContain('CREATE_POST(');
    expect(prompt).toContain('QUERY_APP_DATA(');
    expect(prompt).not.toContain('start_voice_input');
  });
});
