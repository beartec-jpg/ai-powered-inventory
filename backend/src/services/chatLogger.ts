// Chat Logger - Audit logging for chat interactions using Prisma
import { prisma } from '../lib/prisma';

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
          details: data.details ? JSON.stringify(data.details) : null,
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

    const result = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return result.map((activity) => ({
      id: activity.id,
      userId: activity.userId,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      details: activity.details,
      createdAt: activity.createdAt,
    }));
  }

  /**
   * Get activity logs for date range
   */
  async getActivityLogsInRange(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<any[]> {
    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (userId) {
      where.userId = userId;
    }

    return prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get activity count by entity type
   */
  async getActivityCountByType(userId?: string): Promise<any> {
    const where = userId ? { userId } : {};

    const activities = await prisma.activity.groupBy({
      by: ['entityType'],
      where,
      _count: true,
    });

    return activities.map(item => ({
      entityType: item.entityType,
      count: item._count,
    }));
  }

  /**
   * Get performance metrics for a date range
   */
  async getPerformanceMetrics(startDate: Date, endDate: Date): Promise<any> {
    const activities = await prisma.activity.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        action: {
          startsWith: 'tool_execution_',
        },
      },
    });

    const totalExecutions = activities.length;
    const successfulExecutions = activities.filter(a => {
      try {
        const details = a.details ? JSON.parse(a.details as string) : {};
        return details.success === true;
      } catch {
        return false;
      }
    }).length;

    const executionsByTool: Record<string, number> = {};
    activities.forEach(a => {
      const toolName = a.action.replace('tool_execution_', '');
      executionsByTool[toolName] = (executionsByTool[toolName] || 0) + 1;
    });

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions: totalExecutions - successfulExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      executionsByTool,
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
