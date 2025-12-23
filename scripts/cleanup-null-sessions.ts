/**
 * Cleanup Script: Remove null data sessions
 *
 * This script removes all sessions that have:
 * 1. null data column
 * 2. completed = false (incomplete sessions with no data)
 *
 * Run with: npx ts-node scripts/cleanup-null-sessions.ts
 */

import prisma from '../src/config/database';

async function cleanupNullSessions() {
  try {
    // Find all sessions - we'll filter in JavaScript since Prisma JSON null queries are tricky
    const allSessions = await prisma.session.findMany({
      select: {
        id: true,
        userId: true,
        completed: true,
        createdAt: true,
        data: true,
      },
    });

    // Filter for null data in JavaScript
    const nullSessions = allSessions.filter(session => session.data === null);

    if (nullSessions.length === 0) {
      return;
    }

    // Group by user for better logging
    const sessionsByUser = nullSessions.reduce((acc, session) => {
      if (!acc[session.userId]) {
        acc[session.userId] = [];
      }
      acc[session.userId].push(session);
      return acc;
    }, {} as Record<string, typeof nullSessions>);

    let deletedCount = 0;
    for (const session of nullSessions) {
      await prisma.session.delete({
        where: { id: session.id },
      });
      deletedCount++;
    }

    const users = await prisma.user.findMany({
      select: { id: true },
    });

    let duplicatesFound = 0;
    let duplicatesDeleted = 0;

    for (const user of users) {
      const activeSessions = await prisma.session.findMany({
        where: {
          userId: user.id,
          completed: false,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (activeSessions.length > 1) {
        duplicatesFound++;
        // Keep the first one with data, delete the rest
        let kept = false;
        for (const session of activeSessions) {
          if (!kept && session.data !== null) {
            kept = true;
          } else {
            await prisma.session.delete({ where: { id: session.id } });
            duplicatesDeleted++;
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupNullSessions()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
