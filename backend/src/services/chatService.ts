import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { chatConversations, chatMessages, toolCalls } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

export interface CreateConversationInput {
  userId: string;
  title?: string;
}

export interface CreateMessageInput {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: string; // JSON string
}

export interface CreateToolCallInput {
  messageId: string;
  toolName: string;
  arguments: string; // JSON string
  result?: string; // JSON string
  status: 'pending' | 'success' | 'error';
}

export class ChatService {
  /**
   * Create a new conversation
   */
  async createConversation(input: CreateConversationInput) {
    const [conversation] = await db.insert(chatConversations).values({
      id: uuidv4(),
      userId: input.userId,
      title: input.title || 'New Conversation',
      active: true,
    }).returning();

    return conversation;
  }

  /**
   * Get conversation by ID
   */
  async getConversation(id: string) {
    const [conversation] = await db.select()
      .from(chatConversations)
      .where(eq(chatConversations.id, id))
      .limit(1);

    return conversation;
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(userId: string, limit = 50) {
    const conversations = await db.select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.updatedAt))
      .limit(limit);

    return conversations;
  }

  /**
   * Add message to conversation
   */
  async addMessage(input: CreateMessageInput) {
    const [message] = await db.insert(chatMessages).values({
      id: uuidv4(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      toolCalls: input.toolCalls || null,
    }).returning();

    // Update conversation's updatedAt
    await db.update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, input.conversationId));

    return message;
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(conversationId: string, limit = 100) {
    const messages = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt)
      .limit(limit);

    return messages;
  }

  /**
   * Record tool call
   */
  async recordToolCall(input: CreateToolCallInput) {
    const [toolCall] = await db.insert(toolCalls).values({
      id: uuidv4(),
      messageId: input.messageId,
      toolName: input.toolName,
      arguments: input.arguments,
      result: input.result || null,
      status: input.status,
    }).returning();

    return toolCall;
  }

  /**
   * Update tool call result
   */
  async updateToolCall(id: string, result: string, status: 'success' | 'error') {
    const [updated] = await db.update(toolCalls)
      .set({
        result,
        status,
      })
      .where(eq(toolCalls.id, id))
      .returning();

    return updated;
  }

  /**
   * Get message tool calls
   */
  async getMessageToolCalls(messageId: string) {
    const calls = await db.select()
      .from(toolCalls)
      .where(eq(toolCalls.messageId, messageId))
      .orderBy(toolCalls.createdAt);

    return calls;
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(id: string, title: string) {
    const [updated] = await db.update(chatConversations)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete conversation
   */
  async deleteConversation(id: string) {
    // Messages and tool calls will be cascade deleted
    const [deleted] = await db.update(chatConversations)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.id, id))
      .returning();

    return deleted;
  }
}

export const chatService = new ChatService();
