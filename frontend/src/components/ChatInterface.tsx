// ChatInterface Component - Main chat UI component
import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage } from '../services/chatAPI';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  error?: string | null;
  onSendMessage: (message: string) => void;
  onClearError?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isLoading = false,
  error = null,
  onSendMessage,
  onClearError,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Error Banner */}
      {error && (
        <div style={{ backgroundColor: '#fee', padding: '1rem', borderBottom: '1px solid #fcc' }}>
          <span>{error}</span>
          {onClearError && (
            <button onClick={onClearError} style={{ marginLeft: '1rem' }}>
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Messages Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            <p>Start a conversation with the AI assistant</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Ask me about your inventory
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: message.role === 'USER' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: message.role === 'USER' ? '#2563eb' : '#f3f4f6',
                  color: message.role === 'USER' ? 'white' : 'black',
                }}
              >
                <div>{message.content}</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>
                  {new Date(message.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: '#f3f4f6', padding: '0.75rem 1rem', borderRadius: '0.5rem' }}>
              <span>Processing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ borderTop: '1px solid #e5e7eb', padding: '1rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me about your inventory..."
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
            }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: isLoading || !inputValue.trim() ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
