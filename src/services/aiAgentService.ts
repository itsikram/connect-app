import api, { getAuthToken } from '../lib/api';
import config from '../lib/config';
import { AgentMessage, AgentStreamEvent } from '../types/aiAgent';

export type AIProvider = 'gemini' | 'openai' | 'cursor' | 'grok' | 'groq';
export interface AIProviderStatus {
  defaultProvider: AIProvider;
  enabled: Partial<Record<AIProvider, boolean>>;
  configured: Partial<Record<AIProvider, boolean>>;
  models: Partial<Record<AIProvider, string>>;
}

const SYSTEM_PROMPT =
  "You are Connect's mobile AI Agent. Reply in the user's language, be concise, never invent app data, and ask one clarification when needed. " +
  'Always return ONLY strict JSON with this shape: ' +
  '{"type":"action|question|response|mixed","message":"human-readable response","speak":true,"requires_confirmation":false,"actions":[{"id":"unique_id","type":"registered action","status":"pending","parameters":{}}]}. ' +
  'Use an empty actions array for questions and normal responses. Use SEARCH_USERS before actions that need a person; never invent IDs. ' +
  'Never use markdown or add unknown fields. Only request actions that are available in the mobile app. ' +
  'Understand Bangla, Banglish, English, and mixed language. Resolve pronouns such as him/her/ওকে from the active context. ' +
  'For social actions, include targetName or userId and messageText/parameters.message when needed.';
const DEFAULT_PROVIDER: AIProvider = 'gemini';
const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  cursor: 'composer-2.5',
  grok: 'grok-3-mini',
  groq: 'openai/gpt-oss-20b',
};

const PRIVATE_PROFILE_KEYS = new Set([
  'password',
  'passwordhash',
  'accesstoken',
  'refreshtoken',
  'token',
  'authtoken',
  'secret',
]);

const sanitizeProfile = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeProfile);
  if (!value || typeof value !== 'object') return value;
  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, unknown>
  >((result, [key, entry]) => {
    if (!PRIVATE_PROFILE_KEYS.has(key.toLowerCase())) {
      result[key] = sanitizeProfile(entry);
    }
    return result;
  }, {});
};

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
  profile?: unknown,
  providerOptions?: {
    provider: AIProvider;
    model?: string;
    memory?: {
      activeUser?: { id?: string; name?: string };
      activeProfile?: { id?: string; name?: string };
      activeConversation?: { userId?: string; name?: string };
    };
  },
): Promise<string> {
  let providerConfig = providerOptions;
  if (!providerConfig) {
    const providers = (await api.get('/ai-chat/providers')).data;
    const provider = (providers.defaultProvider || DEFAULT_PROVIDER) as AIProvider;
    const model = providers.models?.[provider] || DEFAULT_MODELS[provider];
    providerConfig = { provider, model };
  }
  const profileContext = profile
    ? `\n\nThe following is the authenticated user's own Connect profile. Treat it as the source of truth for questions about the user. Never reveal private credentials or claim fields that are not present:\n${JSON.stringify(
        sanitizeProfile(profile),
      )}`
    : '';
  const memoryContext = providerOptions?.memory
    ? `\n\nActive conversation context (use only when relevant; do not invent missing values):\n${JSON.stringify(
        providerOptions.memory,
      )}`
    : '';
  const payload = {
    provider: providerConfig.provider,
    model: providerConfig.model,
    system: SYSTEM_PROMPT + profileContext + memoryContext,
    messages: [
      ...toPayloadMessages(history),
      { role: 'user', content: message },
    ],
    temperature: 0.25,
    maxTokens: 220,
    json: true,
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
        if (event?.error) {
          reject(new Error(event.error));
          return;
        }

        if (typeof event?.text === 'string') {
          accumulated = event.text.startsWith(accumulated)
            ? event.text
            : accumulated + event.text;
          onDelta(accumulated);
        }
      }
    };
    xhr.onprogress = () => consume(xhr.responseText);
    xhr.onload = () => {
      consume(xhr.responseText);
      if (buffer.trim()) {
        const event = parseEvent(buffer);
        if (event?.error) {
          reject(new Error(event.error));
          return;
        }
        if (typeof event?.text === 'string') {
          accumulated = event.text.startsWith(accumulated)
            ? event.text
            : accumulated + event.text;
          onDelta(accumulated);
        }
      }
      signal?.removeEventListener('abort', abort);
      if (xhr.status >= 400)
        reject(new Error(`AI Agent request failed (${xhr.status})`));
      else resolve();
    };
    xhr.onerror = () => reject(new Error('Unable to connect to the AI Agent.'));
    xhr.onabort = () =>
      reject(
        Object.assign(new Error('Request cancelled'), { name: 'AbortError' }),
      );
    xhr.send(JSON.stringify(payload));
  });
  if (!accumulated.trim())
    throw new Error('The AI Agent returned an empty response.');
  return accumulated;
}

export const fetchAIProviderStatus = async (): Promise<AIProviderStatus> => {
  const response = await api.get('/ai-chat/providers');
  const data = response.data || {};
  return {
    defaultProvider: (data.defaultProvider || DEFAULT_PROVIDER) as AIProvider,
    enabled: data.enabled || {},
    configured: data.configured || {},
    models: { ...DEFAULT_MODELS, ...(data.models || {}) },
  };
};

export const fetchLatestAgentChat = async () =>
  (await api.get('/ai-chat/latest')).data;
export const saveAgentChat = async (messages: AgentMessage[]) =>
  (
    await api.post('/ai-chat/save', {
      messages,
      timestamp: new Date().toISOString(),
    })
  ).data;
export const clearAgentChat = async () =>
  (await api.delete('/ai-chat/delete')).data;
