import api from '../lib/api';
import { AgentMessage, AgentStreamEvent } from '../types/aiAgent';

const SYSTEM_PROMPT =
  "You are Connect's mobile AI Agent. Reply in the user's language, be concise, never invent app data, and ask one clarification when needed. " +
  'When the user requests an app action, return ONLY strict JSON with this shape: ' +
  '{"reply":"optional text","actions":[{"action":"one allowlisted action","messageText":"optional"}],"ask":{"question":"optional"}}. ' +
  'Never use markdown or add unknown fields. Only request actions that are available in the mobile app.';
let providerConfig: { provider: string; model: string } | null = null;

const toPayloadMessages = (messages: AgentMessage[]) =>
  messages.slice(-8).map(message => ({
    role: message.type === 'user' ? 'user' : 'assistant',
    content: message.content,
  }));

const parseEvent = (value: string): AgentStreamEvent | null => {
  const line = value.replace(/^data:\s*/i, '').trim();
  if (!line || line === '[DONE]') return { done: true };
  try {
    return JSON.parse(line) as AgentStreamEvent;
  } catch {
    return { text: line };
  }
};

export async function streamAgentReply(
  message: string,
  history: AgentMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (!providerConfig) {
    const providers = (await api.get('/ai-chat/providers')).data;
    const provider = providers.defaultProvider || 'gemini';
    const model = providers.models?.[provider] || providers.models?.gemini || 'gemini-2.0-flash';
    providerConfig = { provider, model };
  }
  const response = await api.post(
    '/ai-chat/complete-stream',
    {
      provider: providerConfig.provider,
      model: providerConfig.model,
      system: SYSTEM_PROMPT,
      messages: [...toPayloadMessages(history), { role: 'user', content: message }],
      temperature: 0.25,
      maxTokens: 220,
      json: false,
    },
    { signal, responseType: 'text' },
  );

  const raw = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  let accumulated = '';
  for (const chunk of raw.split(/\r?\n\r?\n/)) {
    const event = parseEvent(chunk);
    if (!event) continue;
    if (event.error) throw new Error(event.error);
    if (typeof event.text === 'string') {
      accumulated = event.text.startsWith(accumulated)
        ? event.text
        : accumulated + event.text;
      onDelta(accumulated);
    }
  }
  if (!accumulated) {
    const data = response.data as { text?: string; response?: string };
    accumulated = data?.text || data?.response || '';
    if (accumulated) onDelta(accumulated);
  }
  if (!accumulated.trim()) throw new Error('The AI Agent returned an empty response.');
  return accumulated;
}

export const fetchLatestAgentChat = async () => (await api.get('/ai-chat/latest')).data;
export const saveAgentChat = async (messages: AgentMessage[]) =>
  (await api.post('/ai-chat/save', { messages, timestamp: new Date().toISOString() })).data;
export const clearAgentChat = async () => (await api.delete('/ai-chat/delete')).data;
