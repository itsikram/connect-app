/// <reference types="jest" />

import {
  executeAgentActions,
  parseAgentIntent,
} from '../src/services/agentActionCatalog';

describe('agent action intents', () => {
  it('accepts strict JSON and rejects unknown actions', () => {
    const valid = parseAgentIntent('{"actions":[{"action":"navigate_message"}]}');
    expect(valid.ok).toBe(true);
    expect(parseAgentIntent('```json {"actions":[]} ```').ok).toBe(false);
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
});
