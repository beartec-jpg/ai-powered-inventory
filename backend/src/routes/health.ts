import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Health check endpoint
 * Returns the current status of the API
 */
router.get('/', (_req: Request, res: Response) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  };

  res.status(200).json(healthStatus);
});

/**
 * Detailed health check endpoint
 * Returns more comprehensive health information
 */
router.get('/detailed', (_req: Request, res: Response) => {
  const detailedHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      api: 'operational',
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
      },
    },
  };

  res.status(200).json(detailedHealth);
});

export default router;
