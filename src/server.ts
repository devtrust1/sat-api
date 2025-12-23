import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import App from './app';
import { appConfig } from './config/app';
import prisma from './config/database';
import logger from './utils/logger';
import { dataRetentionScheduler } from './services/dataRetentionScheduler';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// Initialize and start the application
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // Start data retention scheduler
    dataRetentionScheduler.start();

    // Initialize Express app
    const app = new App();

    // Start listening
    app.listen(appConfig.port);
  } catch (error: any) {
    logger.error(`❌ Failed to start server: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // Stop data retention scheduler
    dataRetentionScheduler.stop();

    // Disconnect from database
    await prisma.$disconnect();
    logger.info('✅ Database disconnected');

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error: any) {
    logger.error(`❌ Error during shutdown: ${error.message}`);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();

export default startServer;
