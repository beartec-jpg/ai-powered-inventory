// Chat Logger - Audit logging for chat interactions
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ChatLogger {
  /**
   * Log chat interaction
   */
  async logInteraction(data: {
    userId: string;
    conversationId: string;
    action: string;
    details?: any;
  }): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          userId: data.userId,
          action: data.action,
          entityType: 'ChatConversation',
          entityId: data.conversationId,
          details: JSON.stringify(data.details),
        },
      });
    } catch (error) {
      console.error('Failed to log chat interaction:', error);
    }
  }

  /**
   * Log tool execution
   */
  async logToolExecution(data: {
    userId: string;
    toolName: string;
    parameters: any;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          userId: data.userId,
          action: `tool_execution_${data.toolName}`,
          entityType: 'ToolCall',
          entityId: data.toolName,
          details: JSON.stringify({
            parameters: data.parameters,
            success: data.success,
            error: data.error,
          }),
        },
      });
    } catch (error) {
      console.error('Failed to log tool execution:', error);
    }
  }

  /**
   * Log AI decision
   */
  async logAIDecision(data: {
    userId: string;
    conversationId: string;
    decision: string;
    reasoning?: string;
  }): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          userId: data.userId,
          action: 'ai_decision',
          entityType: 'ChatConversation',
          entityId: data.conversationId,
          details: JSON.stringify({
            decision: data.decision,
            reasoning: data.reasoning,
          }),
        },
      });
    } catch (error) {
      console.error('Failed to log AI decision:', error);
    }
  }

  /**
   * Get chat activity logs
   */
  async getActivityLogs(
    userId?: string,
    entityType?: string,
    limit: number = 100
  ): Promise<any[]> {
    const where: any = {};
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return activities.map((activity) => ({
      id: activity.id,
      user: activity.user,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      details: activity.details,
      createdAt: activity.createdAt,
    }));
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalInteractions: number;
    toolExecutions: number;
    successRate: number;
    avgResponseTime?: number;
  }> {
    const activities = await prisma.activity.findMany({
      where: {
        entityType: {
          in: ['ChatConversation', 'ToolCall'],
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalInteractions = activities.filter(
      (a) => a.entityType === 'ChatConversation'
    ).length;
    const toolExecutions = activities.filter((a) => a.entityType === 'ToolCall').length;

    let successfulTools = 0;
    for (const activity of activities) {
      if (activity.entityType === 'ToolCall' && activity.details) {
        try {
          const details = JSON.parse(activity.details);
          if (details.success) successfulTools++;
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    const successRate = toolExecutions > 0 ? (successfulTools / toolExecutions) * 100 : 0;

    return {
      totalInteractions,
      toolExecutions,
      successRate: Math.round(successRate * 100) / 100,
    };
  }
}

// Singleton instance
let chatLoggerInstance: ChatLogger | null = null;

export function getChatLogger(): ChatLogger {
  if (!chatLoggerInstance) {
    chatLoggerInstance = new ChatLogger();
  }
  return chatLoggerInstance;
}
