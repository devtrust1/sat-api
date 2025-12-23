import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(`Error: ${err.message}\nStack: ${err.stack}`);

  // Prisma errors
  if (err.code?.startsWith('P')) {
    if (err.code === 'P2002')
      return res.status(409).json({ success: false, message: 'Already exists' });
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Not found' });
    if (err.code === 'P2003')
      return res.status(400).json({ success: false, message: 'Invalid reference' });
    return res.status(500).json({ success: false, message: 'Database error' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  return res.status(statusCode).json({ success: false, message });
};

export const notFoundHandler = (req: Request, res: Response) => {
  return res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
};
