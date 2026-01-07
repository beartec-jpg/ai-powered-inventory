// Chat API Service - Frontend client for chat endpoints

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  createdAt: string;
  toolCalls?: any[];
}

export interface Conversation {
  id: string;
  title?: string;
  lastMessage?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatResponse {
  success: boolean;
  data: {
    conversationId: string;
    message: ChatMessage;
    toolCalls?: any[];
  };
}

export interface ChatHistoryResponse {
  success: boolean;
  data: {
    conversations: Conversation[];
    total: number;
    hasMore: boolean;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Mock user headers for development
// In production, these would come from authentication context
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-user-id': 'user_123',
  'x-user-role': 'STAFF',
  'x-warehouse-access': 'warehouse_1,warehouse_2',
});

/**
 * Send a chat message
 */
export async function sendMessage(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ message, conversationId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send message');
  }

  return response.json();
}

/**
 * Stream a chat message using Server-Sent Events
 */
export async function* streamMessage(
  message: string,
  conversationId?: string
): AsyncGenerator<any, void, unknown> {
  const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ message, conversationId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to stream message');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('Response body is not readable');
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data.trim()) {
            try {
              yield JSON.parse(data);
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get chat history
 */
export async function getChatHistory(
  limit: number = 10,
  offset: number = 0
): Promise<ChatHistoryResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/chat/history?limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get chat history');
  }

  return response.json();
}

/**
 * Get specific conversation
 */
export async function getConversation(conversationId: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/chat/history/${conversationId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get conversation');
  }

  return response.json();
}

/**
 * Delete conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/chat/history/${conversationId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete conversation');
  }
}

/**
 * Retry logic for failed requests
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}
