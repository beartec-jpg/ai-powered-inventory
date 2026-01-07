// Chat Memory Service - Manages conversation history and context
import { PrismaClient } from '@prisma/client';
import { GrokMessage, UserContext, MessageRole } from '../types/chat';
import { chatConfig } from '../config/xaiConfig';

const prisma = new PrismaClient();

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
      const exists = await prisma.chatConversation.findFirst({
        where: {
          id: conversationId,
          userId,
          active: true,
        },
      });
      if (exists) {
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
        metadata,
      },
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
      include: {
        toolCalls: true,
      },
    });

    // Reverse to get chronological order
    return messages.reverse().map((msg) => {
      const grokMessage: GrokMessage = {
        role: msg.role.toLowerCase() as any,
        content: msg.content,
      };

      // Add tool calls if present
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        grokMessage.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.toolName,
            arguments: JSON.stringify(tc.parameters),
          },
        }));
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
    const conversations = await prisma.chatConversation.findMany({
      where: {
        userId,
        active: true,
      },
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

    return conversations.map((conv) => ({
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
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        toolCalls: msg.toolCalls,
        metadata: msg.metadata,
      })),
    };
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    const result = await prisma.chatConversation.updateMany({
      where: {
        id: conversationId,
        userId,
      },
      data: {
        active: false,
      },
    });

    return result.count > 0;
  }

  /**
   * Record tool call execution
   */
  async recordToolCall(
    messageId: string,
    toolName: string,
    parameters: Record<string, any>,
    result?: Record<string, any>,
    status: 'PENDING' | 'EXECUTING' | 'SUCCESS' | 'FAILED' = 'SUCCESS',
    error?: string
  ): Promise<void> {
    await prisma.toolCall.create({
      data: {
        messageId,
        toolName,
        parameters,
        result,
        status,
        error,
        executedAt: status === 'SUCCESS' ? new Date() : undefined,
      },
    });
  }

  /**
   * Clean up old conversations
   */
  async cleanupOldConversations(): Promise<number> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - chatConfig.messageRetentionDays);

    const result = await prisma.chatConversation.updateMany({
      where: {
        updatedAt: {
          lt: retentionDate,
        },
        active: true,
      },
      data: {
        active: false,
      },
    });

    return result.count;
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
