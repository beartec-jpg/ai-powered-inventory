// useChat Hook - React hook for chat state management
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  sendMessage,
  streamMessage,
  getChatHistory,
  getConversation,
  deleteConversation,
  ChatMessage,
  Conversation,
} from '../services/chatAPI';

export interface UseChatOptions {
  conversationId?: string;
  enableStreaming?: boolean;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  sendChatMessage: (message: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  removeConversation: (conversationId: string) => Promise<void>;
  clearError: () => void;
  startNewConversation: () => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { conversationId: initialConversationId, enableStreaming = false } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load initial conversation if provided
  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId);
    }
  }, [initialConversationId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
    clearError();
  }, [clearError]);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getChatHistory(20, 0);
      setConversations(response.data.conversations);
    } catch (err: any) {
      setError(err.message || 'Failed to load chat history');
      console.error('Load history error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getConversation(conversationId);
      setMessages(response.data.messages || []);
      setCurrentConversationId(conversationId);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation');
      console.error('Load conversation error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeConversation = useCallback(
    async (conversationId: string) => {
      try {
        setIsLoading(true);
        setError(null);
        await deleteConversation(conversationId);
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (currentConversationId === conversationId) {
          startNewConversation();
        }
      } catch (err: any) {
        setError(err.message || 'Failed to delete conversation');
        console.error('Delete conversation error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [currentConversationId, startNewConversation]
  );

  const sendChatMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) {
        return;
      }

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversationId: currentConversationId || 'new',
        role: 'USER',
        content: message,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setError(null);

      try {
        if (enableStreaming) {
          setIsStreaming(true);
          let streamedContent = '';
          let assistantMessageId = `temp-assistant-${Date.now()}`;

          // Add placeholder for assistant message
          const assistantMessage: ChatMessage = {
            id: assistantMessageId,
            conversationId: currentConversationId || 'new',
            role: 'ASSISTANT',
            content: '',
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);

          // Stream response
          for await (const chunk of streamMessage(message, currentConversationId || undefined)) {
            if (chunk.type === 'content') {
              streamedContent += chunk.data;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: streamedContent }
                    : msg
                )
              );
            } else if (chunk.type === 'done') {
              if (chunk.data.conversationId) {
                setCurrentConversationId(chunk.data.conversationId);
              }
            } else if (chunk.type === 'error') {
              setError(chunk.data.message || 'An error occurred');
            }
          }
        } else {
          setIsLoading(true);
          const response = await sendMessage(message, currentConversationId || undefined);

          // Update conversation ID if new
          if (response.data.conversationId) {
            setCurrentConversationId(response.data.conversationId);
          }

          // Add assistant message
          setMessages((prev) => [...prev, response.data.message]);
        }

        // Reload history to update conversation list
        await loadHistory();
      } catch (err: any) {
        setError(err.message || 'Failed to send message');
        console.error('Send message error:', err);
        // Remove the user message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [currentConversationId, enableStreaming, loadHistory]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    conversations,
    currentConversationId,
    isLoading,
    isStreaming,
    error,
    sendChatMessage,
    loadHistory,
    loadConversation,
    removeConversation,
    clearError,
    startNewConversation,
  };
}
