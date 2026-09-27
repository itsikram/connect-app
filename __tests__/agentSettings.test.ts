/// <reference types="jest" />

import {
  describeAgentSettingsForPrompt,
  findAgentSetting,
  resolveAgentSetting,
} from '../src/services/agentSettings';
import {
  applyRelationshipChange,
  normalizeRelationshipTypes,
} from '../src/services/agentRelations';
import { executeAgentActions, parseAgentIntent } from '../src/services/agentActionCatalog';

describe('agent settings', () => {
  it('finds settings by key or spoken name', () => {
    expect(findAgentSetting('readReceipts')?.key).toBe('readReceipts');
    expect(findAgentSetting('read receipts')?.key).toBe('readReceipts');
    expect(findAgentSetting('my theme')?.key).toBe('themeMode');
    expect(findAgentSetting('ভাষা')?.key).toBe('language');
    expect(findAgentSetting('showTyping')?.key).toBe('showIsTyping');
    expect(findAgentSetting('nonsense')).toBeNull();
  });

  it('coerces spoken values', () => {
    expect(resolveAgentSetting('themeMode', 'dark mode').value).toBe('dark');
    expect(resolveAgentSetting('language', 'বাংলা')).toMatchObject({ value: 'bn', display: 'Bangla' });
    expect(resolveAgentSetting('read receipts', 'off').value).toBe(false);
    expect(resolveAgentSetting('vibration', 'চালু').value).toBe(true);
    expect(resolveAgentSetting('silent mode', undefined, false).value).toBe(true);
    expect(resolveAgentSetting('volume', '150').value).toBe(100);
    expect(resolveAgentSetting('volume', 'louder', 50).value).toBe(70);
    expect(resolveAgentSetting('postVisibility', 'only me').value).toBe('private');
    expect(resolveAgentSetting('show typing', true).updates).toEqual({
      showIsTyping: true,
      showTyping: true,
    });
  });

  it('treats a named value as the setting', () => {
    expect(resolveAgentSetting('dark mode', 'on')).toMatchObject({ key: 'themeMode', value: 'dark' });
  });

  it('rejects unknown settings and values', () => {
    expect(() => resolveAgentSetting('warp drive', true)).toThrow(/can't change/);
    expect(() => resolveAgentSetting('themeMode', 'plaid')).toThrow(/Theme can be/);
    expect(() => resolveAgentSetting('readReceipts', 'maybe')).toThrow(/on or off/);
  });

  it('lists every key for the model', () => {
    expect(describeAgentSettingsForPrompt()).toContain('themeMode=default|dark|light');
    expect(describeAgentSettingsForPrompt()).toContain('volumeLevel=0-100');
  });
});

describe('connection relationships', () => {
  it('maps spoken words to relationship tags', () => {
    expect(normalizeRelationshipTypes(['mom'])).toEqual(['Parent']);
    expect(normalizeRelationshipTypes('my brother and colleague')).toEqual(['Sibling', 'Colleague']);
    expect(normalizeRelationshipTypes(['best friend', 'BFF'])).toEqual(['Best Friend']);
    expect(normalizeRelationshipTypes(['gym buddy'])).toEqual(['Gym Buddy']);
  });

  it('sets, adds and removes tags', () => {
    expect(applyRelationshipChange(['Friend'], ['Colleague'], 'set')).toEqual(['Colleague']);
    expect(applyRelationshipChange(['Friend'], ['Colleague', 'friend'], 'add')).toEqual(['Friend', 'Colleague']);
    expect(applyRelationshipChange(['Friend', 'Colleague'], ['colleague'], 'remove')).toEqual(['Friend']);
  });
});

describe('settings and relationship actions', () => {
  it('changes settings immediately without confirmation', async () => {
    const changeSetting = jest.fn(async (setting: string, value: unknown) => `${setting}=${String(value)}`);
    const confirm = jest.fn(async () => false);
    const results = await executeAgentActions(
      [{ action: 'CHANGE_SETTING', parameters: { settings: { themeMode: 'dark', readReceipts: false } } }],
      { changeSetting },
      { confirm },
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(changeSetting).toHaveBeenCalledTimes(2);
    expect(results[0]).toMatchObject({ ok: true, message: 'themeMode=dark readReceipts=false' });
  });

  it('reports a partly failed settings batch', async () => {
    const changeSetting = jest.fn(async (setting: string) => {
      if (setting === 'bad') throw new Error('Unknown bad.');
      return 'Theme set to dark.';
    });
    const results = await executeAgentActions(
      [{ action: 'CHANGE_SETTING', parameters: { settings: { themeMode: 'dark', bad: 1 } } }],
      { changeSetting },
    );
    expect(results[0]).toMatchObject({ ok: true, message: 'Theme set to dark. Unknown bad.' });
  });

  it('accepts the update-setting alias', () => {
    const parsed = parseAgentIntent(
      '{"actions":[{"action":"UPDATE_SETTING","parameters":{"setting":"language","value":"bn"}}]}',
    );
    expect(parsed).toMatchObject({ ok: true, intent: { actions: [{ action: 'CHANGE_SETTING' }] } });
  });

  it('sets a connection relationship by name', async () => {
    const setRelationship = jest.fn(async () => ['Sibling']);
    const results = await executeAgentActions(
      [{ action: 'SET_RELATIONSHIP', parameters: { userName: 'Rahim', relationTypes: ['brother'], mode: 'add' } }],
      {
        resolveUser: async () => ({ id: 'u1', name: 'Rahim Uddin' }),
        setRelationship,
      },
    );
    expect(setRelationship).toHaveBeenCalledWith('u1', ['brother'], 'add');
    expect(results[0]).toMatchObject({ ok: true, message: 'Rahim Uddin is now saved as: Sibling.' });
  });
});
