// Chat Memory Service - Manages conversation history and context using Prisma
import { prisma } from '../lib/prisma';
import { MessageRole } from '@prisma/client';
import { GrokMessage, UserContext } from '../types/chat';
import { chatConfig } from '../config/xaiConfig';

export class ChatMemory {
  /**
   * Create a new conversation
   */
  async createConversation(userId: string, title?: string): Promise<string> {
    const conversation = await prisma.chatConversation.create({
      data: {
        userId,
        title: title || 'New Conversation',
        active: true,
      },
    });

    return conversation.id;
  }

  /**
   * Get or create a conversation
   */
  async getOrCreateConversation(userId: string, conversationId?: string): Promise<string> {
    if (conversationId) {
      const exists = await prisma.chatConversation.findUnique({
        where: { id: conversationId },
      });
        
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
    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

    // Update conversation's updatedAt
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message.id;
  }

  /**
   * Get conversation history with context limit
   */
  async getConversationHistory(conversationId: string, limit?: number): Promise<GrokMessage[]> {
    const effectiveLimit = limit || chatConfig.maxContextLength;

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: effectiveLimit,
    });

    // Reverse to get chronological order
    const sortedMessages = messages.reverse();

    return sortedMessages.map(msg => {
      const grokMessage: GrokMessage = {
        role: msg.role.toLowerCase() as any,
        content: msg.content,
      };

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
    const conversations = await prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      lastMessage: conv.messages[0]?.content.substring(0, 100),
      messageCount: conv._count.messages,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));
  }

  /**
   * Get full conversation with all messages
   */
  async getConversation(conversationId: string, userId: string): Promise<any | null> {
    const conversation = await prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        userId,
        active: true,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            toolCalls: true,
          },
        },
      },
    });

    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      title: conversation.title,
      active: conversation.active,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages,
    };
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    });

    if (!conversation) {
      return false;
    }

    // Soft delete
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { active: false },
    });

    return true;
  }

  /**
   * Record a tool call
   */
  async recordToolCall(
    messageId: string,
    toolName: string,
    parameters: any,
    result?: any,
    status: 'PENDING' | 'SUCCESS' | 'ERROR' = 'PENDING'
  ): Promise<string> {
    const toolCall = await prisma.toolCall.create({
      data: {
        messageId,
        toolName,
        parameters,
        result,
        status,
      },
    });

    return toolCall.id;
  }

  /**
   * Update tool call with result
   */
  async updateToolCall(
    toolCallId: string,
    result: any,
    status: 'SUCCESS' | 'ERROR'
  ): Promise<void> {
    await prisma.toolCall.update({
      where: { id: toolCallId },
      data: {
        result,
        status,
      },
    });
  }

  /**
   * Clear old conversations (for cleanup)
   */
  async clearOldConversations(userId: string, daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.chatConversation.updateMany({
      where: {
        userId,
        updatedAt: {
          lt: cutoffDate,
        },
        active: true,
      },
      data: {
        active: false,
      },
    });

    return result.count;
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(conversationId: string): Promise<any> {
    const [messageCount, toolCallCount] = await Promise.all([
      prisma.chatMessage.count({
        where: { conversationId },
      }),
      prisma.toolCall.count({
        where: {
          message: {
            conversationId,
          },
        },
      }),
    ]);

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        role: true,
      },
    });

    const userMessages = messages.filter(m => m.role === MessageRole.USER).length;
    const assistantMessages = messages.filter(m => m.role === MessageRole.ASSISTANT).length;

    return {
      totalMessages: messageCount,
      userMessages,
      assistantMessages,
      toolCallsExecuted: toolCallCount,
      firstMessage: messages[0]?.createdAt,
      lastMessage: messages[messages.length - 1]?.createdAt,
    };
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
