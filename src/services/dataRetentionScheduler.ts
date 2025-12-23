import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Data Retention Scheduler
 * Automatically deletes sessions based on admin retention duration settings
 * Runs daily to clean up expired sessions
 */
export class DataRetentionScheduler {
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the scheduler (runs once daily)
   */
  start() {
    // Run immediately on start
    this.cleanupExpiredSessions();

    // Then run every 24 hours
    this.intervalId = setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      24 * 60 * 60 * 1000 // 24 hours in milliseconds
    );

    logger.info('Data retention scheduler started - will run daily');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Data retention scheduler stopped');
    }
  }

  /**
   * Clean up expired sessions based on admin retention settings
   */
  private async cleanupExpiredSessions() {
    try {
      logger.info('Starting scheduled cleanup of expired sessions...');

      // Get admin settings
      const adminSettings = await prisma.adminSettings.findFirst();

      if (!adminSettings) {
        logger.warn('No admin settings found, skipping cleanup');
        return;
      }

      // If data retention is disabled or set to never, delete ALL sessions
      if (!adminSettings.dataRetention || adminSettings.retentionDuration === 'never') {
        logger.info('Data retention is disabled - deleting all sessions');
        const result = await prisma.session.deleteMany({});
        logger.info(`Deleted ${result.count} sessions (retention disabled)`);
        return;
      }

      // Calculate expiration date based on retention duration
      const now = new Date();
      let expirationDate: Date;

      switch (adminSettings.retentionDuration) {
        case '7':
          expirationDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30':
          expirationDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90':
          expirationDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          logger.warn(
            `Unknown retention duration: ${adminSettings.retentionDuration}, skipping cleanup`
          );
          return;
      }

      // Delete sessions older than expiration date
      const result = await prisma.session.deleteMany({
        where: {
          createdAt: {
            lt: expirationDate,
          },
        },
      });

      logger.info(
        `Cleanup complete: Deleted ${result.count} sessions older than ${adminSettings.retentionDuration} days`
      );
    } catch (error) {
      logger.error('Error during scheduled cleanup:', error);
    }
  }

  /**
   * Manually trigger cleanup (useful for testing)
   */
  async triggerCleanup() {
    await this.cleanupExpiredSessions();
  }
}

// Export singleton instance
export const dataRetentionScheduler = new DataRetentionScheduler();
