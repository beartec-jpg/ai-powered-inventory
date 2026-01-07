// Chat-related TypeScript types and interfaces

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM',
  TOOL = 'TOOL',
}

export enum ToolCallStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  toolCalls?: ToolCall[];
}

export interface ChatConversation {
  id: string;
  userId: string;
  title?: string;
  active: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  messages?: ChatMessage[];
}

export interface ToolCall {
  id: string;
  messageId: string;
  toolName: string;
  parameters: Record<string, any>;
  result?: Record<string, any>;
  status: ToolCallStatus;
  error?: string;
  executedAt?: Date;
  createdAt: Date;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: UserContext;
}

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  toolCalls?: ToolCall[];
}

export interface UserContext {
  userId: string;
  role: string;
  warehouseAccess: string[];
  permissions: string[];
}

// xAI Grok API types
export interface GrokMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: GrokToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface GrokToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface GrokChatCompletionRequest {
  model: string;
  messages: GrokMessage[];
  tools?: GrokTool[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface GrokChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GrokChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GrokChoice {
  index: number;
  message: GrokMessage;
  finish_reason: string;
}

export interface GrokTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  data: any;
}

// Tool definition types
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// Chat history types
export interface ChatHistoryQuery {
  userId: string;
  conversationId?: string;
  limit?: number;
  offset?: number;
}

export interface ChatHistoryResponse {
  conversations: ChatConversation[];
  total: number;
  hasMore: boolean;
}
