/// <reference types="jest" />

import { findRelation, matchRelationConnects } from '../src/services/agentRelations';
import { executeAgentActions } from '../src/services/agentActionCatalog';

const connects = [
  { id: 'm1', name: 'Rahima Begum', relationshipTypes: ['Parent'], gender: 'Female' },
  { id: 'd1', name: 'Abdul Karim', relationshipTypes: ['Parent'], gender: 'Male' },
  { id: 'b1', name: 'Sabbir Hossain', relationshipTypes: ['Sibling'], gender: 'male' },
  { id: 'w1', name: 'Nusrat Jahan', relationshipTypes: ['Spouse'] },
  { id: 'x1', name: 'Momin Ali', relationshipTypes: ['Friend'], gender: 'male' },
];

describe('relationship words', () => {
  it('recognises relationship words in Bangla, Banglish and English', () => {
    for (const word of ['mom', 'my mom', "mom's", 'আম্মু', 'মা', 'আমার মা', 'ammu', 'Mother']) {
      expect(findRelation(word)?.label).toBe('mom');
    }
    expect(findRelation('বাবা')?.label).toBe('dad');
    expect(findRelation('my wife')?.label).toBe('wife');
  });

  it('does not treat real names as relationship words', () => {
    expect(findRelation('Momin')).toBeNull();
    expect(findRelation('Mamun')).toBeNull();
    expect(findRelation('Rahim')).toBeNull();
  });

  it('uses gender to tell mom from dad when both are tagged Parent', () => {
    expect(matchRelationConnects('আম্মু', connects)?.matches.map(c => c.id)).toEqual(['m1']);
    expect(matchRelationConnects('dad', connects)?.matches.map(c => c.id)).toEqual(['d1']);
    expect(matchRelationConnects('my wife', connects)?.matches.map(c => c.id)).toEqual(['w1']);
    expect(matchRelationConnects('brother', connects)?.matches.map(c => c.id)).toEqual(['b1']);
  });

  it('reports no match instead of guessing someone else', () => {
    expect(matchRelationConnects('mom', [connects[1], connects[4]])?.matches).toEqual([]);
    expect(matchRelationConnects('Momin', connects)).toBeNull();
  });
});

describe('outgoing call identity', () => {
  it('keeps the id and ignores a name lookup that finds a different person', async () => {
    const startAudioCall = jest.fn();
    const resolveUser = jest.fn().mockResolvedValue({ id: 'x1', name: 'Momin Ali' });
    const results = await executeAgentActions(
      [{ action: 'START_AUDIO_CALL', parameters: { userId: 'm1', userName: 'Mom' } }],
      { resolveUser, startAudioCall },
      { skipConfirmation: true },
    );
    expect(results[0].ok).toBe(true);
    // Called with the right person's id; the name is NOT the stranger's.
    expect(startAudioCall).toHaveBeenCalledWith('m1', 'm1', 'Mom', undefined);
  });

  it('still starts the call when the name lookup fails', async () => {
    const startVideoCall = jest.fn();
    const resolveUser = jest.fn().mockRejectedValue(new Error('not found'));
    const results = await executeAgentActions(
      [{ action: 'START_VIDEO_CALL', parameters: { userId: 'm1', userName: 'আম্মু' } }],
      { resolveUser, startVideoCall },
      { skipConfirmation: true },
    );
    expect(results[0].ok).toBe(true);
    expect(startVideoCall).toHaveBeenCalledWith('m1', 'm1', 'আম্মু', undefined);
  });
});
