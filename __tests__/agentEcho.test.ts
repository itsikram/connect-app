/// <reference types="jest" />

import {
  agentQuietForMs,
  agentSpeechEnded,
  agentSpeechStarted,
  isAgentSpeaking,
  isLikelyAgentEcho,
  resetAgentEcho,
  waitForAgentSilence,
} from '../src/services/agentEcho';

describe('agent echo guard', () => {
  beforeEach(() => resetAgentEcho());

  it('drops a transcript that repeats what the agent just said', () => {
    agentSpeechStarted('রহিমকে ভিডিও কল দিচ্ছি, একটু অপেক্ষা করুন।');
    agentSpeechEnded();
    expect(isLikelyAgentEcho('রহিমকে ভিডিও কল দিচ্ছি')).toBe(true);
    agentSpeechStarted('I found a few people: 1. Rahim Uddin, 2. Rahim Khan.');
    agentSpeechEnded();
    expect(isLikelyAgentEcho('I found a few people Rahim Uddin')).toBe(true);
  });

  it('keeps short answers to the agent, even when the agent said them', () => {
    agentSpeechStarted('Should I do it? Tap Yes to confirm.');
    agentSpeechEnded();
    expect(isLikelyAgentEcho('yes')).toBe(false);
    expect(isLikelyAgentEcho('হ্যাঁ, করুন')).toBe(false);
  });

  it('keeps a real new request that only shares some words', () => {
    agentSpeechStarted('রহিমকে ভিডিও কল দিচ্ছি।');
    agentSpeechEnded();
    expect(isLikelyAgentEcho('করিমকে একটা ভিডিও কল দাও')).toBe(false);
    expect(isLikelyAgentEcho('open my notes please')).toBe(false);
  });

  it('forgets old speech after a while', () => {
    agentSpeechStarted('Opening your messages now');
    agentSpeechEnded();
    expect(isLikelyAgentEcho('opening your messages now', Date.now() + 60_000)).toBe(false);
  });

  it('waits for the speaker to go quiet before the mic reopens', async () => {
    agentSpeechStarted('hello there friend');
    expect(isAgentSpeaking()).toBe(true);
    expect(agentQuietForMs()).toBe(0);
    setTimeout(() => agentSpeechEnded(), 50);
    const startedAt = Date.now();
    await waitForAgentSilence(200, 5000);
    // 50ms of speech + a 200ms quiet tail.
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(230);
    expect(isAgentSpeaking()).toBe(false);
  });
});
