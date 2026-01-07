import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Logger middleware for request/response logging
 * Logs incoming requests and outgoing responses with timestamps, status codes, and duration
 */

interface RequestLog {
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip: string;
  userAgent: string;
  requestSize: number;
  responseSize: number;
}

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Format date to ISO string
 */
function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Get log file name with date
 */
function getLogFileName(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return path.join(logsDir, `requests-${year}-${month}-${day}.log`);
}

/**
 * Write log entry to file
 */
function writeLog(logEntry: RequestLog): void {
  const logMessage = `[${logEntry.timestamp}] ${logEntry.method} ${logEntry.url} - Status: ${logEntry.statusCode} - Duration: ${logEntry.duration}ms - IP: ${logEntry.ip} - Size: ${logEntry.requestSize}/${logEntry.responseSize} bytes\n`;
  
  const fileName = getLogFileName();
  
  fs.appendFile(fileName, logMessage, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
  });
}

/**
 * Logger middleware function
 * Captures request and response details for logging
 */
export const logger = (req: Request, res: Response, next: NextFunction): void => {
  // Record start time
  const startTime = Date.now();
  const startDate = new Date();

  // Capture request size
  const requestSize = JSON.stringify(req.body || {}).length + (req.url?.length || 0);

  // Get client IP address
  const ip = (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  ).trim();

  // Get user agent
  const userAgent = (req.headers['user-agent'] || 'unknown') as string;

  // Override res.send to capture response size
  const originalSend = res.send;
  let responseSize = 0;

  res.send = function (data: any): Response {
    responseSize = typeof data === 'string' ? data.length : JSON.stringify(data).length;

    // Calculate duration
    const duration = Date.now() - startTime;

    // Create log entry
    const logEntry: RequestLog = {
      timestamp: formatDate(startDate),
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      ip,
      userAgent,
      requestSize,
      responseSize,
    };

    // Write to log
    writeLog(logEntry);

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      const colorCode = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
      const resetColor = '\x1b[0m';
      console.log(
        `${colorCode}[${logEntry.timestamp}] ${logEntry.method} ${logEntry.url} - ${logEntry.statusCode} - ${logEntry.duration}ms${resetColor}`
      );
    }

    // Call original send
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Error logging middleware
 * Logs errors with full stack traces
 */
export const errorLogger = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const timestamp = formatDate(new Date());
  const errorLog = `[${timestamp}] ERROR: ${req.method} ${req.originalUrl || req.url}\n${err.stack}\n\n`;

  const fileName = getLogFileName();
  
  fs.appendFile(fileName, errorLog, (writeErr) => {
    if (writeErr) {
      console.error('Error writing error log:', writeErr);
    }
  });

  console.error(`[${timestamp}] Error:`, err);

  next(err);
};

export default logger;
