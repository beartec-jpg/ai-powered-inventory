// Chat Page - Main chat interface with sidebar
import React, { useEffect, useState } from 'react';
import { ChatInterface } from '../components/ChatInterface';
import { useChat } from '../hooks/useChat';
import { Conversation } from '../services/chatAPI';

export const Chat: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const {
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
  } = useChat({ conversationId: selectedConversationId || undefined });

  // Load conversation history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    loadConversation(conversationId);
  };

  const handleNewConversation = () => {
    setSelectedConversationId(null);
    startNewConversation();
  };

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      await removeConversation(conversationId);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? 'w-80' : 'w-0'
        } bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <button
            onClick={handleNewConversation}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Conversation
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new conversation to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                    currentConversationId === conversation.id
                      ? 'bg-blue-50 border-blue-200 border'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {conversation.title || 'New Conversation'}
                      </h3>
                      {conversation.lastMessage && (
                        <p className="text-xs text-gray-600 truncate mt-1">
                          {conversation.lastMessage}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span>{conversation.messageCount} messages</span>
                        <span>•</span>
                        <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity ml-2"
                      aria-label="Delete conversation"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-4">
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Open sidebar"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">AI Inventory Assistant</h1>
            <p className="text-sm text-gray-600">Ask me anything about your inventory</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'}`}></span>
              {error ? 'Error' : 'Connected'}
            </span>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            isStreaming={isStreaming}
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
