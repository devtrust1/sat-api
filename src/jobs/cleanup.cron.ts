import * as cron from 'node-cron';
import cleanupService from '../services/cleanup.service';
import logger from '../utils/logger';

/**
 * Cleanup Cron Jobs
 *
 * Schedules automatic data retention and cleanup tasks
 */
class CleanupCron {
  private dailyCleanupJob: cron.ScheduledTask | null = null;
  private weeklyOrphanedJob: cron.ScheduledTask | null = null;

  /**
   * Start all cleanup cron jobs
   */
  start(): void {
    // Run full cleanup daily at 2 AM
    this.dailyCleanupJob = cron.schedule('0 2 * * *', async () => {
      logger.info('🧹 Running scheduled daily cleanup...');
      try {
        await cleanupService.runFullCleanup();
      } catch (error) {
        logger.error('❌ Scheduled cleanup failed:', error);
      }
    });

    // Run orphaned file cleanup weekly on Sunday at 3 AM
    this.weeklyOrphanedJob = cron.schedule('0 3 * * 0', async () => {
      logger.info('🧹 Running scheduled orphaned file cleanup...');
      try {
        await cleanupService.cleanupOrphanedFiles();
      } catch (error) {
        logger.error('❌ Orphaned file cleanup failed:', error);
      }
    });

    logger.info('✅ Cleanup cron jobs started:');
    logger.info('   - Daily cleanup: Every day at 2:00 AM UTC');
    logger.info('   - Orphaned files: Every Sunday at 3:00 AM UTC');
  }

  /**
   * Stop all cleanup cron jobs
   */
  stop(): void {
    if (this.dailyCleanupJob) {
      this.dailyCleanupJob.stop();
      this.dailyCleanupJob = null;
    }

    if (this.weeklyOrphanedJob) {
      this.weeklyOrphanedJob.stop();
      this.weeklyOrphanedJob = null;
    }

    logger.info('🛑 Cleanup cron jobs stopped.');
  }

  /**
   * Check if cron jobs are running
   */
  isRunning(): boolean {
    return this.dailyCleanupJob !== null && this.weeklyOrphanedJob !== null;
  }

  /**
   * Run cleanup manually (for testing or on-demand execution)
   */
  async runManual(): Promise<void> {
    logger.info('🧹 Running manual cleanup...');
    try {
      await cleanupService.runFullCleanup();
      logger.info('✅ Manual cleanup completed successfully.');
    } catch (error) {
      logger.error('❌ Manual cleanup failed:', error);
      throw error;
    }
  }
}

export default new CleanupCron();
