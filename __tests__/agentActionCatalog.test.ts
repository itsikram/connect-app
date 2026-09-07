/// <reference types="jest" />

import {
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
});
