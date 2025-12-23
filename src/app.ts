import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { clerkMiddleware } from '@clerk/express';
import path from 'path';
import { appConfig } from './config/app';
// i18n removed - handled by frontend
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import routes from './modules';
import logger from './utils/logger';
import cleanupCron from './jobs/cleanup.cron';
import s3Service from './services/s3.service';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.app.set('strict routing', false); // Allow trailing slashes
    // Trust proxy - required for ngrok/reverse proxies
    this.app.set('trust proxy', 1);
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:', 'http:', 'blob:'],
            mediaSrc: ["'self'", 'data:', 'https:', 'http:', 'blob:'],
          },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: '*',
        credentials: true,
        exposedHeaders: ['Content-Type', 'Content-Length'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      })
    );

    // Compression (but skip SSE endpoints to allow real-time streaming)
    this.app.use(
      compression({
        filter: (req, res) => {
          // Don't compress SSE responses
          if (res.getHeader('Content-Type') === 'text/event-stream') {
            return false;
          }
          // Don't compress streaming endpoints
          if (req.path.includes('/stream')) {
            return false;
          }
          // Use compression for everything else
          return compression.filter(req, res);
        },
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: appConfig.rateLimit.windowMs,
      max: appConfig.rateLimit.max,
      message: 'Rate limit exceeded',
      standardHeaders: true,
      legacyHeaders: false,
      skip: req => {
        // Skip rate limiting for webhooks and authenticated session/user routes
        return (
          req.path.includes('/webhook') ||
          req.path.includes('/users/me/sessions') ||
          req.path.includes('/users/me/user-settings')
        );
      },
    });
    this.app.use('/api/', limiter);
    // Clerk authentication middleware - Apply globally for auth context
    this.app.use(
      clerkMiddleware({
        // Public routes that don't need authentication
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
        secretKey: process.env.CLERK_SECRET_KEY,
      })
    );

    // Note: i18n is handled by frontend, not needed here

    // Request logging
    this.app.use((req, _res, next) => {
      logger.http(`${req.method} ${req.path}`);
      next();
    });
  }

  private initializeRoutes(): void {
    // Root endpoint
    this.app.get('/', (_req, res) => {
      res.json({
        success: true,
        message: 'SAT Learning Platform API',
        version: '1.0.0',
        health: '/api/health',
      });
    });

    // Serve static uploaded files with CORS headers
    const uploadsPath = path.join(__dirname, '../uploads');
    this.app.use(
      '/api/v1/uploads',
      (req, res, next) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        next();
      },
      express.static(uploadsPath)
    );
    logger.info(`Serving static files from: ${uploadsPath}`);

    // API routes
    this.app.use('/api', routes);
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  private initializeJobs(): void {
    // Start cleanup cron jobs for data retention
    cleanupCron.start();
  }

  public listen(port: number): void {
    this.app.listen(port, () => {
      logger.info(`
        ╔═══════════════════════════════════════════════════╗
        ║                                                   ║
        ║   SAT Learning Platform API                       ║
        ║                                                   ║
        ║   Server running on port: ${port}                    ║
        ║   Environment: ${appConfig.nodeEnv.toUpperCase().padEnd(27)}    ║
        ║   API Base URL: http://localhost:${port}/api/v1      ║
        ║                                                   ║
        ║   Ready to accept requests! 🚀                    ║
        ║                                                   ║
        ╚═══════════════════════════════════════════════════╝
      `);

      // Log S3 configuration status
      if (s3Service.isConfigured()) {
        const bucket = process.env.AWS_S3_BUCKET;
        const region = process.env.AWS_REGION;
        logger.info(`✅ S3 configured: ${bucket} (${region})`);
      } else {
        logger.warn(
          '⚠️  S3 not configured. File uploads will fail. See S3_SETUP.md for setup instructions.'
        );
      }

      // Initialize background jobs
      this.initializeJobs();
    });
  }
}

export default App;
