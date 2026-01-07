// Chat Routes
import { Router, Request, Response } from 'express';
import { getChatService } from '../services/chatService';
import { getChatLogger } from '../services/chatLogger';
import {
  authenticateChat,
  checkChatAccess,
  chatRateLimiter,
  validateConversationAccess,
  checkXAIAvailability,
} from '../middleware/chatAuth';
import { ChatRequest, UserContext } from '../types/chat';

const router = Router();
const chatService = getChatService();
const chatLogger = getChatLogger();

// Apply authentication and rate limiting to all chat routes
router.use(authenticateChat);
router.use(checkChatAccess);
router.use(chatRateLimiter);
router.use(checkXAIAvailability);

/**
 * POST /api/chat
 * Send a message and get AI response
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userContext = (req as any).userContext as UserContext;
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Message is required and must be a string',
      });
      return;
    }

    const chatRequest: ChatRequest = {
      message,
      conversationId,
      context: userContext,
    };

    // Log interaction
    await chatLogger.logInteraction({
      userId: userContext.userId,
      conversationId: conversationId || 'new',
      action: 'chat_message_sent',
      details: { message: message.substring(0, 100) },
    });

    // Process message
    const response = await chatService.processMessage(chatRequest, userContext);

    // Log response
    await chatLogger.logInteraction({
      userId: userContext.userId,
      conversationId: response.conversationId,
      action: 'chat_message_received',
      details: { messageId: response.message.id },
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to process chat message',
    });
  }
});

/**
 * POST /api/chat/stream
 * Send a message and get streaming AI response (Server-Sent Events)
 */
router.post('/stream', async (req: Request, res: Response) => {
  try {
    const userContext = (req as any).userContext as UserContext;
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Message is required and must be a string',
      });
      return;
    }

    // Initialize SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Log interaction
    await chatLogger.logInteraction({
      userId: userContext.userId,
      conversationId: conversationId || 'new',
      action: 'chat_stream_started',
      details: { message: message.substring(0, 100) },
    });

    try {
      // Create chat request
      const chatRequest: ChatRequest = {
        message,
        conversationId,
        context: userContext,
      };

      // Stream response
      await chatService.processMessageStreaming(chatRequest, userContext, res);

      // Log completion
      await chatLogger.logInteraction({
        userId: userContext.userId,
        conversationId: conversationId || 'new',
        action: 'chat_stream_completed',
      });

    } catch (streamError: any) {
      console.error('Streaming error:', streamError);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
    } finally {
      res.end();
    }
  } catch (error: any) {
    console.error('Chat stream setup error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'Failed to start chat stream',
      });
    } else {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/chat/history
 * Get chat history for user
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userContext = (req as any).userContext as UserContext;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const conversations = await chatService.getHistory(userContext.userId, limit, offset);

    res.json({
      success: true,
      data: {
        conversations,
        total: conversations.length,
        hasMore: conversations.length === limit,
      },
    });
  } catch (error: any) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve chat history',
    });
  }
});

/**
 * GET /api/chat/history/:conversationId
 * Get specific conversation
 */
router.get('/history/:conversationId', validateConversationAccess, async (req: Request, res: Response) => {
  try {
    const userContext = (req as any).userContext as UserContext;
    const { conversationId } = req.params;

    const conversation = await chatService.getConversation(conversationId, userContext.userId);

    if (!conversation) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found',
      });
      return;
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error: any) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve conversation',
    });
  }
});

/**
 * DELETE /api/chat/history/:conversationId
 * Delete a conversation
 */
router.delete('/history/:conversationId', validateConversationAccess, async (req: Request, res: Response) => {
  try {
    const userContext = (req as any).userContext as UserContext;
    const { conversationId } = req.params;

    const deleted = await chatService.deleteConversation(conversationId, userContext.userId);

    if (!deleted) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found or already deleted',
      });
      return;
    }

    // Log deletion
    await chatLogger.logInteraction({
      userId: userContext.userId,
      conversationId,
      action: 'conversation_deleted',
    });

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete conversation',
    });
  }
});

/**
 * GET /api/chat/metrics
 * Get chat performance metrics (admin only)
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const userContext = (req as any).userContext as UserContext;

    // Check if user is admin
    if (userContext.role !== 'ADMIN') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const metrics = await chatLogger.getPerformanceMetrics(startDate, endDate);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve metrics',
    });
  }
});

export default router;
