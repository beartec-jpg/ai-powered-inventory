// Chat Page - Main chat interface
import React, { useEffect } from 'react';
import { ChatInterface } from '../components/ChatInterface';
import { useChat } from '../hooks/useChat';

export const Chat: React.FC = () => {
  const {
    messages,
    conversations,
    currentConversationId,
    isLoading,
    error,
    sendChatMessage,
    loadHistory,
    loadConversation,
    removeConversation,
    clearError,
    startNewConversation,
  } = useChat();

  // Load conversation history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      await removeConversation(conversationId);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: '320px', borderRight: '1px solid #e5e7eb', backgroundColor: 'white' }}>
        {/* Sidebar Header */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
            Chat History
          </h2>
          <button
            onClick={startNewConversation}
            style={{
              width: '100%',
              padding: '0.5rem 1rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            + New Conversation
          </button>
        </div>

        {/* Conversation List */}
        <div style={{ padding: '0.5rem', overflowY: 'auto', height: 'calc(100vh - 130px)' }}>
          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666', fontSize: '0.875rem' }}>
              <p>No conversations yet</p>
              <p style={{ marginTop: '0.5rem' }}>Start a new conversation to get started</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => loadConversation(conversation.id)}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  backgroundColor:
                    currentConversationId === conversation.id ? '#eff6ff' : 'transparent',
                  border: currentConversationId === conversation.id ? '1px solid #bfdbfe' : '1px solid transparent',
                }}
              >
                <h3 style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                  {conversation.title || 'New Conversation'}
                </h3>
                {conversation.lastMessage && (
                  <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
                    {conversation.lastMessage}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                  <span>{conversation.messageCount} messages</span>
                  <span>•</span>
                  <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600' }}>AI Inventory Assistant</h1>
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
            Ask me anything about your inventory
          </p>
        </div>

        {/* Chat Interface */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            error={error}
            onSendMessage={sendChatMessage}
            onClearError={clearError}
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;
