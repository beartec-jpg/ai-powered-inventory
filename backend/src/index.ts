import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import chatRoutes from './routes/chat';

// Import routes
import authRoutes from './routes/auth';
import inventoryRoutes from './routes/inventory';
import stockRoutes from './routes/stock';
import warehouseRoutes from './routes/warehouse';
import aiRoutes from './routes/ai';

// Import middleware
import { logger, errorLogger } from './middleware/logger';
import { AppError } from './types';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV: string = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'AI-Powered Inventory Management System',
    version: '1.0.0',
    environment: NODE_ENV,
    endpoints: {
      auth: '/api/auth',
      inventory: '/api/inventory',
      stock: '/api/stock',
      warehouse: '/api/warehouse',
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/warehouse', warehouseRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `The requested endpoint ${req.method} ${req.path} does not exist`,
    timestamp: new Date().toISOString(),
  });
});

// Error logger middleware
app.use(errorLogger);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err.message);
  
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = NODE_ENV === 'development' ? err.message : 'An unexpected error occurred';
  
  res.status(statusCode).json({
    success: false,
    error: err.name || 'Error',
    message,
    timestamp: new Date().toISOString(),
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`
    ╔════════════════════════════════════════════════════╗
    ║  AI-Powered Inventory Management System             ║
    ║  Server running on port ${PORT}                        ║
    ║  Environment: ${NODE_ENV}                              ║
    ║  Timestamp: ${new Date().toISOString()}               ║
    ╚════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
