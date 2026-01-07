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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Get authentication headers from Clerk
// @ts-ignore
const getHeaders = async () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // In production with Clerk, get the session token
  // @ts-ignore
  if (window.Clerk) {
    try {
      // @ts-ignore
      const session = await window.Clerk.session;
      if (session) {
        const token = await session.getToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Failed to get Clerk token:', e);
    }
  }

  return headers;
};

/**
 * Send a chat message
 */
export async function sendMessage(
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, conversationId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send message');
  }

  return response.json();
}

/**
 * Get chat history
 */
export async function getChatHistory(
  limit: number = 10,
  offset: number = 0
): Promise<ChatHistoryResponse> {
  const headers = await getHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/chat/history?limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers,
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
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/chat/history/${conversationId}`, {
    method: 'GET',
    headers,
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
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/chat/history/${conversationId}`, {
    method: 'DELETE',
    headers,
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
