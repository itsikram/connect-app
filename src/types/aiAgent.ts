export type AgentMessageType = 'user' | 'agent' | 'action-result';
export type AgentResponseType = 'action' | 'question' | 'response' | 'mixed';
export type AgentActionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentMessage {
  id: string;
  type: AgentMessageType;
  content: string;
  timestamp: string;
  streaming?: boolean;
  success?: boolean;
}

export interface AgentAction {
  action: string;
  id?: string;
  type?: string;
  status?: AgentActionStatus;
  parameters?: Record<string, unknown>;
  targetName?: string | null;
  targetRoute?: string | null;
  searchQuery?: string;
  messageText?: string;
}

export interface AgentIntent {
  type?: AgentResponseType;
  message?: string;
  speak?: boolean;
  requires_confirmation?: boolean;
  reply?: string;
  actions?: AgentAction[];
  ask?: { field?: string | null; question?: string | null };
}

export interface AgentStreamEvent {
  text?: string;
  done?: boolean;
  error?: string;
}
