// Chat Memory Service - Manages conversation history and context using Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { chatConversations, chatMessages, toolCalls } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { GrokMessage, UserContext, MessageRole } from '../types/chat';
import { chatConfig } from '../config/xaiConfig';

export class ChatMemory {
  /**
   * Create a new conversation
   */
  async createConversation(userId: string, title?: string): Promise<string> {
    const [conversation] = await db.insert(chatConversations).values({
      id: uuidv4(),
      userId,
      title: title || 'New Conversation',
      active: true,
    }).returning();

    return conversation.id;
  }

  /**
   * Get or create a conversation
   */
  async getOrCreateConversation(userId: string, conversationId?: string): Promise<string> {
    if (conversationId) {
      const [exists] = await db.select()
        .from(chatConversations)
        .where(eq(chatConversations.id, conversationId))
        .limit(1);
        
      if (exists && exists.userId === userId && exists.active) {
        return conversationId;
      }
    }
    return await this.createConversation(userId);
  }

  /**
   * Add a message to conversation
   */
  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const [message] = await db.insert(chatMessages).values({
      id: uuidv4(),
      conversationId,
      role: role.toLowerCase(),
      content,
      toolCalls: metadata ? JSON.stringify(metadata) : null,
    }).returning();

    // Update conversation's updatedAt
    await db.update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));

    return message.id;
  }

  /**
   * Get conversation history with context limit
   */
  async getConversationHistory(conversationId: string, limit?: number): Promise<GrokMessage[]> {
    const effectiveLimit = limit || chatConfig.maxContextLength;

    const messages = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(effectiveLimit);

    // Reverse to get chronological order
    const sortedMessages = messages.reverse();

    return sortedMessages.map((msg) => {
      const grokMessage: GrokMessage = {
        role: msg.role as any,
        content: msg.content,
      };

      // Add tool calls if present
      if (msg.toolCalls) {
        try {
          const parsed = JSON.parse(msg.toolCalls);
          if (parsed.tool_calls) {
            grokMessage.tool_calls = parsed.tool_calls;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      return grokMessage;
    });
  }

  /**
   * Build system context with user permissions
   */
  buildSystemContext(userContext: UserContext): string {
    const warehouses = userContext.warehouseAccess.join(', ');
    return `You are an AI assistant for an inventory management system. 
You help users manage their inventory through natural language commands.

User Context:
- Role: ${userContext.role}
- Accessible Warehouses: ${warehouses}
- Permissions: ${userContext.permissions.join(', ')}

Guidelines:
1. Always validate user access before executing warehouse-specific operations
2. Provide clear, concise responses
3. Ask for clarification when commands are ambiguous
4. Confirm destructive operations before executing
5. Suggest alternatives when operations cannot be completed
6. Use the available tools to query and modify inventory data
7. Format responses in a user-friendly way with relevant details

Available Operations:
- Check stock levels across warehouses
- Search for products by name or SKU
- Transfer stock between warehouses (requires access to both)
- Adjust stock quantities (managers/admins only)
- Create parts lists for jobs
- View low stock items
- Generate warehouse reports
- Check supplier information`;
  }

  /**
   * Get user conversations list
   */
  async getUserConversations(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<any[]> {
    const conversations = await db.select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.updatedAt))
      .limit(limit)
      .offset(offset);

    const result = [];
    for (const conv of conversations) {
      // Get last message and count
      const messages = await db.select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conv.id))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);

      const messageCount = await db.select({ count: chatMessages.id })
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conv.id));

      result.push({
        id: conv.id,
        title: conv.title,
        lastMessage: messages[0]?.content.substring(0, 100),
        messageCount: messageCount.length,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      });
    }

    return result;
  }

  /**
   * Get full conversation with all messages
   */
  async getConversation(conversationId: string, userId: string): Promise<any | null> {
    const [conversation] = await db.select()
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1);

    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    const messages = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt);

    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role.toUpperCase(),
        content: msg.content,
        createdAt: msg.createdAt,
        metadata: msg.toolCalls ? JSON.parse(msg.toolCalls) : null,
      })),
    };
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    const result = await db.update(chatConversations)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId))
      .returning();

    return result.length > 0 && result[0].userId === userId;
  }

  /**
   * Record tool call execution
   */
  async recordToolCall(
    messageId: string,
    toolName: string,
    parameters: Record<string, any>,
    result?: Record<string, any>,
    status: 'pending' | 'success' | 'error' = 'success',
    error?: string
  ): Promise<void> {
    await db.insert(toolCalls).values({
      id: uuidv4(),
      messageId,
      toolName,
      arguments: JSON.stringify(parameters),
      result: result ? JSON.stringify(result) : null,
      status,
    });
  }

  /**
   * Clean up old conversations
   */
  async cleanupOldConversations(): Promise<number> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - chatConfig.messageRetentionDays);

    // Note: Drizzle doesn't have a direct way to return count, so we query first
    const oldConversations = await db.select()
      .from(chatConversations)
      .where(eq(chatConversations.active, true));

    const toUpdate = oldConversations.filter(c => c.updatedAt < retentionDate);

    if (toUpdate.length > 0) {
      for (const conv of toUpdate) {
        await db.update(chatConversations)
          .set({ active: false })
          .where(eq(chatConversations.id, conv.id));
      }
    }

    return toUpdate.length;
  }
}

// Singleton instance
let chatMemoryInstance: ChatMemory | null = null;

export function getChatMemory(): ChatMemory {
  if (!chatMemoryInstance) {
    chatMemoryInstance = new ChatMemory();
  }
  return chatMemoryInstance;
}
