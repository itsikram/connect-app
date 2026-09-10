import api, { getAuthToken } from '../lib/api';
import config from '../lib/config';
import { AgentMessage, AgentStreamEvent } from '../types/aiAgent';

export type AIProvider = 'gemini' | 'openai' | 'cursor' | 'grok' | 'groq' | 'ollama';
export interface AIProviderStatus {
  defaultProvider: AIProvider;
  enabled: Partial<Record<AIProvider, boolean>>;
  configured: Partial<Record<AIProvider, boolean>>;
  models: Partial<Record<AIProvider, string>>;
}

const SYSTEM_PROMPT = `
You are Connect AI: a capable, warm, and practical mobile assistant inside the Connect app.
Your goal is to turn natural requests into safe, useful outcomes with as little friction as possible.

PRIORITIES
1. Understand intent before acting. Use the user's language and mirror their tone; support Bangla,
   Banglish, English, and mixed language.
2. Be concise but personable. Use fresh, natural wording instead of repetitive canned phrases.
   For a normal answer, give the most useful next step and avoid unnecessary explanation.
3. Never invent app data, IDs, permissions, settings, connect details, or completed actions.
   Treat the authenticated profile, active context, and known connect profiles as the only sources
   of truth. If information is missing, say so or ask one focused clarification.
4. Prefer one clear action plan. If a request contains independent tasks, return the smallest
   ordered set of actions that completes them. Do not duplicate actions.
5. Protect user control: set requires_confirmation to true for sensitive or irreversible actions
   when confirmation is appropriate, and never bypass ambiguity or authorization.

REAL-LIFE COMMUNICATION
- Sound like a thoughtful, emotionally intelligent professional, not a chatbot.
- For messages the user may send to another person, be warm, clear, tactful, and appropriately
  brief. Preserve the user's meaning while avoiding pressure, blame, slang, or overpromising.
- Match the relationship and situation: use a respectful tone for new contacts or work matters,
  and a warmer tone only when the context supports it. Never claim to be the user.
- If the user asks for a reply, provide a ready-to-send message. If the intent or recipient is
  unclear, ask one focused question instead of guessing.

ACTION RULES
- Return only actions available in the mobile app and use the exact action name in the "action"
  field (not "type"). Give every action a unique id and status "pending".
- Use SEARCH_USERS before any person-dependent action unless an authoritative id is already
  present. Never guess an id. If multiple people match, ask the user to choose before acting.
- For social actions, include targetName or userId and include messageText or parameters.message
  when a message is required.
- Use SEARCH_YOUTUBE with parameters.query. Use DOWNLOAD_YOUTUBE with parameters.query,
  parameters.url, or parameters.videoId; optional title, thumbnail, quality, and audioOnly
  parameters are supported.
- Resolve pronouns such as him, her, ওকে, তাকে, and তাকে নিয়ে from the active context only.
- For emotional or personal conversations, respond empathetically and without judgment. Do not
  diagnose or invent personal facts; suggest trusted professional or emergency help when there
  is a credible risk of harm.

OUTPUT CONTRACT
Return ONLY valid JSON. No markdown, commentary, code fences, or unknown fields.
Use exactly this shape:
{"type":"action|question|response|mixed","message":"user-facing text","speak":true,"requires_confirmation":false,"actions":[{"id":"unique_id","action":"REGISTERED_ACTION","status":"pending","parameters":{}}]}
Use an empty actions array for questions and normal responses. Put the response in message.
Set speak to true when the wording is natural for voice playback. Keep message short enough
for a mobile screen. If clarification is needed, ask exactly one specific question and return
type "question" with no actions.
`.trim();
// Gemini is the cloud default; the provider selector still allows local or
// other configured providers when needed.
const DEFAULT_PROVIDER: AIProvider = 'gemini';
const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  cursor: 'composer-2.5',
  grok: 'grok-3-mini',
  groq: 'openai/gpt-oss-20b',
  ollama: 'llama3.1:8b',
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

type ImageMessagePart = {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
};

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
      knownConnects?: Array<{ id: string; name: string; username?: string; bio?: string }>;
    };
  },
  imageDataUrl?: string,
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
  const connectsContext = providerOptions?.memory?.knownConnects?.length
    ? `\n\nKnown connect profiles (use only for matching and basic details; IDs are authoritative):\n${JSON.stringify(
        providerOptions.memory.knownConnects.slice(0, 60),
      )}`
    : '';
  const isOllama = providerConfig.provider === 'ollama';
  const ollamaMemory = providerOptions?.memory
    ? {
        activeUser: providerOptions.memory.activeUser,
        activeProfile: providerOptions.memory.activeProfile,
        activeConversation: providerOptions.memory.activeConversation,
      }
    : undefined;
  const ollamaMemoryContext = ollamaMemory
    ? `\n\nActive conversation context:\n${JSON.stringify(ollamaMemory)}`
    : '';
  const userContent: string | ImageMessagePart[] = imageDataUrl
    ? [
        { type: 'text', text: message },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ]
    : message;
  const payload = {
    provider: providerConfig.provider,
    model: providerConfig.model,
    system: isOllama
      ? `${SYSTEM_PROMPT}${ollamaMemoryContext}`.slice(0, 5000)
      : SYSTEM_PROMPT + profileContext + memoryContext + connectsContext,
    messages: [
      ...(isOllama
        ? toPayloadMessages(history.slice(-4)).map(item => ({
            ...item,
            content: item.content.slice(-1200),
          }))
        : toPayloadMessages(history)),
      { role: 'user', content: userContent },
    ],
    temperature: 0.25,
    maxTokens: isOllama ? 220 : 400,
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

const fallbackPostCaption = (userRequest = '') => {
  const request = String(userRequest || '').trim().toLowerCase();
  if (request.includes('funny') || request.includes('witty')) {
    return 'Good vibes, great stories, and a little chaos 😄';
  }
  if (request.includes('video')) {
    return 'Moments like this deserve a replay. 🎬';
  }
  if (request.includes('photo') || request.includes('image')) {
    return 'Some moments are just too good not to keep. ✨';
  }
  if (request.includes('improve') || request.includes('finish')) {
    return 'A little extra sparkle for this moment ✨';
  }
  return 'Little moments, big memories. ✨';
};

const extractCaptionText = (value: string) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const parsedText = fenced?.[1] || raw;
  const start = parsedText.indexOf('{');
  const end = parsedText.lastIndexOf('}');

  if (start !== -1 && end !== -1 && end > start) {
    try {
      const parsed = JSON.parse(parsedText.slice(start, end + 1)) as Record<string, unknown>;
      const candidate =
        typeof parsed.message === 'string' && parsed.message.trim()
          ? parsed.message
          : typeof parsed.reply === 'string' && parsed.reply.trim()
            ? parsed.reply
            : typeof parsed.caption === 'string' && parsed.caption.trim()
              ? parsed.caption
              : typeof parsed.text === 'string' && parsed.text.trim()
                ? parsed.text
                : typeof parsed.content === 'string' && parsed.content.trim()
                  ? parsed.content
                  : '';
      if (candidate) return candidate;
    } catch {
      // Ignore invalid JSON content and continue with the raw text.
    }
  }

  return raw
    .replace(/^here(?:'s| is)[^.:\n]*[:\-]\s*/i, '')
    .replace(/^['"‘’“”]+/, '')
    .replace(/['"‘’“”]+$/, '')
    .trim();
};

export const generatePostCaption = async (
  userRequest = '',
  signal?: AbortSignal,
  imageDataUrl?: string,
): Promise<string> => {
  const request = String(userRequest || '').trim();
  const providerStatus = await fetchAIProviderStatus().catch(() => null);
  const hasConfiguredProvider = Object.values(providerStatus?.configured ?? {}).some(
    value => Boolean(value),
  );

  if (!providerStatus || !hasConfiguredProvider) {
    return fallbackPostCaption(request);
  }

  try {
    const prompt = request
      ? `Write one original social-media caption for Connect. Match the user's language and keep it engaging. Use this request as your guide: ${request}. Return ONLY the caption — no quotes, no preamble, no hashtags unless they fit naturally. Max 180 characters.`
      : 'Write one original social-media caption for Connect. Match the user\'s language and keep it engaging. Return ONLY the caption — no quotes, no preamble, no hashtags unless they fit naturally. Max 180 characters.';

    const response = await streamAgentReply(
      prompt,
      [{
        id: `caption-${Date.now()}`,
        type: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      }],
      () => undefined,
      signal,
      undefined,
      undefined,
      imageDataUrl,
    );

    const caption = extractCaptionText(response);
    return caption ? caption.slice(0, 500) : fallbackPostCaption(request);
  } catch (error) {
    console.warn('Caption generation failed, using fallback caption:', error);
    return fallbackPostCaption(request);
  }
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
