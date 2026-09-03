import api, { getAuthToken } from '../lib/api';
import config from '../lib/config';
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
  const payload = {
      provider: providerConfig.provider,
      model: providerConfig.model,
      system: SYSTEM_PROMPT,
      messages: [...toPayloadMessages(history), { role: 'user', content: message }],
      temperature: 0.25,
      maxTokens: 220,
      json: false,
    };
  const token = await getAuthToken();
  const baseUrl = String(config.API_BASE_URL).replace(/\/+$/, '');
  let accumulated = '';
  let processed = 0;
  let buffer = '';
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal?.addEventListener('abort', abort, { once: true });
    xhr.open('POST', `${baseUrl}/ai-chat/complete-stream`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', token);
    const consume = (raw: string) => {
      buffer += raw.slice(processed);
      processed = raw.length;
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      for (const chunk of events) {
        const event = parseEvent(chunk);
        if (event?.error) { reject(new Error(event.error)); return; }
        if (typeof event?.text === 'string') {
          accumulated = event.text.startsWith(accumulated) ? event.text : accumulated + event.text;
          onDelta(accumulated);
        }
      }
    };
    xhr.onprogress = () => consume(xhr.responseText);
    xhr.onload = () => {
      consume(xhr.responseText);
      if (buffer.trim()) {
        const event = parseEvent(buffer);
        if (event?.error) { reject(new Error(event.error)); return; }
        if (typeof event?.text === 'string') {
          accumulated = event.text.startsWith(accumulated) ? event.text : accumulated + event.text;
          onDelta(accumulated);
        }
      }
      signal?.removeEventListener('abort', abort);
      if (xhr.status >= 400) reject(new Error(`AI Agent request failed (${xhr.status})`));
      else resolve();
    };
    xhr.onerror = () => reject(new Error('Unable to connect to the AI Agent.'));
    xhr.onabort = () => reject(Object.assign(new Error('Request cancelled'), { name: 'AbortError' }));
    xhr.send(JSON.stringify(payload));
  });
  if (!accumulated.trim()) throw new Error('The AI Agent returned an empty response.');
  return accumulated;
}

export const fetchLatestAgentChat = async () => (await api.get('/ai-chat/latest')).data;
export const saveAgentChat = async (messages: AgentMessage[]) =>
  (await api.post('/ai-chat/save', { messages, timestamp: new Date().toISOString() })).data;
export const clearAgentChat = async () => (await api.delete('/ai-chat/delete')).data;
