import prisma from '../config/database';
import s3Service from './s3.service';
import logger from '../utils/logger';

/**
 * Data Retention and Cleanup Service
 *
 * Handles automatic cleanup of old sessions and their associated S3 files
 * based on admin-configured retention policies.
 */
class CleanupService {
  /**
   * Get admin retention settings
   */
  private async getRetentionSettings(): Promise<{
    enabled: boolean;
    durationDays: number | null;
  }> {
    try {
      const settings = await prisma.adminSettings.findFirst({
        select: {
          dataRetention: true,
          retentionDuration: true,
        },
      });

      if (!settings) {
        // Default settings if not configured
        return {
          enabled: true,
          durationDays: 30,
        };
      }

      // Parse retention duration
      let durationDays: number | null = null;
      if (settings.retentionDuration !== 'never') {
        durationDays = parseInt(settings.retentionDuration, 10);
      }

      return {
        enabled: settings.dataRetention,
        durationDays,
      };
    } catch (error) {
      logger.error('Error fetching retention settings:', error);
      // Fail-safe: return default settings
      return {
        enabled: true,
        durationDays: 30,
      };
    }
  }

  /**
   * Extract S3 file URLs from session data
   */
  private extractFileUrlsFromSession(sessionData: any): string[] {
    const fileUrls: string[] = [];

    try {
      if (!sessionData || typeof sessionData !== 'object') {
        return fileUrls;
      }

      // Extract from messages array
      if (Array.isArray(sessionData.messages)) {
        for (const message of sessionData.messages) {
          // Check for attachments array
          if (Array.isArray(message.attachments)) {
            for (const attachment of message.attachments) {
              if (attachment.url && typeof attachment.url === 'string') {
                // Only add S3 URLs (ignore local URLs)
                if (
                  attachment.url.includes('.s3.') ||
                  attachment.url.includes('s3.amazonaws.com')
                ) {
                  fileUrls.push(attachment.url);
                }
              }
            }
          }

          // Check for legacy image field
          if (message.image && typeof message.image === 'string') {
            if (message.image.includes('.s3.') || message.image.includes('s3.amazonaws.com')) {
              fileUrls.push(message.image);
            }
          }
        }
      }

      // Extract from chatHistory array (alternative structure)
      if (Array.isArray(sessionData.chatHistory)) {
        for (const chat of sessionData.chatHistory) {
          if (Array.isArray(chat.attachments)) {
            for (const attachment of chat.attachments) {
              if (attachment.url && typeof attachment.url === 'string') {
                if (
                  attachment.url.includes('.s3.') ||
                  attachment.url.includes('s3.amazonaws.com')
                ) {
                  fileUrls.push(attachment.url);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error extracting file URLs from session data:', error);
    }

    return fileUrls;
  }

  /**
   * Clean up old sessions and associated S3 files
   */
  async cleanupOldSessions(): Promise<{
    sessionsDeleted: number;
    filesDeleted: number;
    errors: number;
  }> {
    const result = {
      sessionsDeleted: 0,
      filesDeleted: 0,
      errors: 0,
    };

    try {
      // Get retention settings
      const retention = await this.getRetentionSettings();

      // If retention is disabled or set to "never", skip cleanup
      if (!retention.enabled || retention.durationDays === null) {
        logger.info('Data retention is disabled. Skipping cleanup.');
        return result;
      }

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retention.durationDays);

      logger.info(
        `Starting cleanup: Deleting sessions older than ${retention.durationDays} days (before ${cutoffDate.toISOString()})`
      );

      // Find old sessions
      const oldSessions = await prisma.session.findMany({
        where: {
          completed: true, // Only clean up completed sessions
          updatedAt: {
            lt: cutoffDate,
          },
        },
        select: {
          id: true,
          data: true,
          updatedAt: true,
        },
      });

      if (oldSessions.length === 0) {
        logger.info('No old sessions found for cleanup.');
        return result;
      }

      logger.info(`Found ${oldSessions.length} sessions to clean up.`);

      // Process each session
      for (const session of oldSessions) {
        try {
          // Extract file URLs from session data
          const fileUrls = this.extractFileUrlsFromSession(session.data);

          // Delete S3 files if any
          if (fileUrls.length > 0 && s3Service.isConfigured()) {
            logger.info(`Deleting ${fileUrls.length} S3 files for session ${session.id}`);
            const deletedCount = await s3Service.deleteMultipleFiles(fileUrls);
            result.filesDeleted += deletedCount;

            if (deletedCount < fileUrls.length) {
              logger.warn(
                `Only deleted ${deletedCount}/${fileUrls.length} files for session ${session.id}`
              );
            }
          }

          // Delete session (cascade will handle bookmarks)
          await prisma.session.delete({
            where: { id: session.id },
          });

          result.sessionsDeleted++;
        } catch (error) {
          logger.error(`Error cleaning up session ${session.id}:`, error);
          result.errors++;
        }
      }

      logger.info(
        `Cleanup completed: ${result.sessionsDeleted} sessions deleted, ${result.filesDeleted} S3 files deleted, ${result.errors} errors`
      );
    } catch (error) {
      logger.error('Error during cleanup process:', error);
      result.errors++;
    }

    return result;
  }

  /**
   * Clean up orphaned S3 files
   * (Files in S3 that are not referenced in any session)
   *
   * Note: This is a more expensive operation and should be run less frequently
   */
  async cleanupOrphanedFiles(): Promise<{
    filesChecked: number;
    filesDeleted: number;
    errors: number;
  }> {
    const result = {
      filesChecked: 0,
      filesDeleted: 0,
      errors: 0,
    };

    try {
      if (!s3Service.isConfigured()) {
        logger.warn('S3 is not configured. Skipping orphaned file cleanup.');
        return result;
      }

      logger.info('Starting orphaned file cleanup...');

      // Get all sessions
      const allSessions = await prisma.session.findMany({
        select: {
          data: true,
        },
      });

      // Build set of all referenced file URLs (filter out null data in JavaScript)
      const referencedUrls = new Set<string>();
      for (const session of allSessions) {
        if (session.data !== null) {
          const urls = this.extractFileUrlsFromSession(session.data);
          urls.forEach(url => referencedUrls.add(url));
        }
      }

      logger.info(`Found ${referencedUrls.size} referenced S3 files in database.`);

      // Note: Listing all S3 files and comparing would require additional S3 API calls
      // This is left as a placeholder for future implementation
      // For now, we rely on session-based cleanup which is more reliable

      logger.info('Orphaned file cleanup completed (full S3 scan not implemented).');
    } catch (error) {
      logger.error('Error during orphaned file cleanup:', error);
      result.errors++;
    }

    return result;
  }

  /**
   * Clean up old incomplete sessions (no data, not completed)
   * These are sessions that were started but never used
   */
  async cleanupIncompleteSessions(olderThanDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Get all incomplete sessions and filter in JavaScript for null data
      const incompleteSessions = await prisma.session.findMany({
        where: {
          completed: false,
          createdAt: {
            lt: cutoffDate,
          },
        },
        select: {
          id: true,
          data: true,
        },
      });

      // Filter for null data in JavaScript (Prisma JSON null queries can be tricky)
      const sessionsToDelete = incompleteSessions.filter(session => session.data === null);

      // Delete each session
      let deletedCount = 0;
      for (const session of sessionsToDelete) {
        await prisma.session.delete({
          where: { id: session.id },
        });
        deletedCount++;
      }

      logger.info(
        `Cleaned up ${deletedCount} incomplete sessions older than ${olderThanDays} days.`
      );

      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up incomplete sessions:', error);
      return 0;
    }
  }

  /**
   * Run all cleanup tasks
   * This is the main method to be called by cron job
   */
  async runFullCleanup(): Promise<{
    completedSessions: { sessionsDeleted: number; filesDeleted: number };
    incompleteSessions: number;
    errors: number;
  }> {
    logger.info('=== Starting Full Cleanup ===');

    const completedResult = await this.cleanupOldSessions();
    const incompleteCount = await this.cleanupIncompleteSessions();

    const totalErrors = completedResult.errors;

    logger.info('=== Full Cleanup Completed ===');
    logger.info(`Completed sessions deleted: ${completedResult.sessionsDeleted}`);
    logger.info(`S3 files deleted: ${completedResult.filesDeleted}`);
    logger.info(`Incomplete sessions deleted: ${incompleteCount}`);
    logger.info(`Total errors: ${totalErrors}`);

    return {
      completedSessions: {
        sessionsDeleted: completedResult.sessionsDeleted,
        filesDeleted: completedResult.filesDeleted,
      },
      incompleteSessions: incompleteCount,
      errors: totalErrors,
    };
  }
}

export default new CleanupService();
