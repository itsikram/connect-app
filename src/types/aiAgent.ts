export type AgentMessageType = 'user' | 'agent' | 'action-result';

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
  targetName?: string | null;
  targetRoute?: string | null;
  searchQuery?: string;
  messageText?: string;
}

export interface AgentIntent {
  reply?: string;
  actions?: AgentAction[];
  ask?: { field?: string | null; question?: string | null };
}

export interface AgentStreamEvent {
  text?: string;
  done?: boolean;
  error?: string;
}
