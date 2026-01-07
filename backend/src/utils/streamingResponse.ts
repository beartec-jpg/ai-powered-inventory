// Streaming Response Utilities - SSE streaming support
import { Response } from 'express';

export class StreamingResponse {
  /**
   * Initialize SSE headers
   */
  static initializeSSE(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();
  }

  /**
   * Send SSE message
   */
  static sendMessage(res: Response, data: any, event?: string): void {
    if (event) {
      res.write(`event: ${event}\n`);
    }
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Send SSE error
   */
  static sendError(res: Response, error: string): void {
    StreamingResponse.sendMessage(res, { type: 'error', message: error }, 'error');
  }

  /**
   * Send SSE completion
   */
  static sendComplete(res: Response, data?: any): void {
    StreamingResponse.sendMessage(res, { type: 'complete', ...data }, 'complete');
  }

  /**
   * Close SSE connection
   */
  static close(res: Response): void {
    res.end();
  }

  /**
   * Handle client disconnect
   */
  static onDisconnect(res: Response, callback: () => void): void {
    res.on('close', () => {
      console.log('Client disconnected from SSE stream');
      callback();
    });
  }

  /**
   * Stream generator wrapper for async generators
   */
  static async *wrapAsyncGenerator<T>(
    generator: AsyncGenerator<T, void, unknown>
  ): AsyncGenerator<T, void, unknown> {
    try {
      for await (const chunk of generator) {
        yield chunk;
      }
    } catch (error) {
      console.error('Streaming error:', error);
      throw error;
    }
  }

  /**
   * Send keep-alive ping
   */
  static sendKeepAlive(res: Response): void {
    res.write(': keep-alive\n\n');
  }

  /**
   * Set up periodic keep-alive
   */
  static setupKeepAlive(res: Response, intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(() => {
      StreamingResponse.sendKeepAlive(res);
    }, intervalMs);
  }
}

/**
 * Helper to convert async generator to SSE stream
 */
export async function streamToSSE(
  res: Response,
  generator: AsyncGenerator<string, void, unknown>
): Promise<void> {
  StreamingResponse.initializeSSE(res);

  const keepAlive = StreamingResponse.setupKeepAlive(res);

  StreamingResponse.onDisconnect(res, () => {
    clearInterval(keepAlive);
  });

  try {
    for await (const chunk of generator) {
      res.write(chunk);
    }
    StreamingResponse.close(res);
  } catch (error: any) {
    StreamingResponse.sendError(res, error.message);
    StreamingResponse.close(res);
  } finally {
    clearInterval(keepAlive);
  }
}
