import prisma from '../../config/database';
import { UserRole } from '@prisma/client';
import logger from '../../utils/logger';
import { UserPreferences, UserStats, PaginatedUsers } from './user.types';
import adminService from '../admin/admin.service';

export const userService = {
  // Find or create user from Clerk data
  async syncUser(clerkData: any) {
    try {
      logger.info('Starting user sync process');

      const { id, email_addresses, first_name, last_name, public_metadata } = clerkData;

      // Validate required fields
      if (!id) {
        throw new Error('Clerk user ID is required');
      }

      if (!email_addresses || !email_addresses[0] || !email_addresses[0].email_address) {
        throw new Error('User email is required');
      }

      const email = email_addresses[0].email_address;
      const firstName = first_name || null;
      const lastName = last_name || null;
      const role = (public_metadata?.role as UserRole) || UserRole.STUDENT;
      const preferredLang = public_metadata?.preferredLang || 'en';

      logger.info('Processed user data:', {
        clerkId: id,
        email,
        firstName,
        lastName,
        role,
        preferredLang,
      });

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { clerkId: id },
      });

      if (existingUser) {
        logger.info('User exists, updating:', existingUser.id);

        const updatedUser = await prisma.user.update({
          where: { clerkId: id },
          data: {
            email,
            firstName,
            lastName,
            role,
            preferredLang,
            updatedAt: new Date(),
          },
        });

        logger.info('User updated successfully:', updatedUser.id);
        return updatedUser;
      } else {
        logger.info('Creating new user');

        const newUser = await prisma.user.create({
          data: {
            clerkId: id,
            email,
            firstName,
            lastName,
            role,
            preferredLang,
          },
        });

        logger.info('User created successfully:', newUser.id);
        return newUser;
      }
    } catch (error: any) {
      logger.error('Error in syncUser:', error.message);

      // Handle specific Prisma errors
      if (error.code === 'P2002') {
        logger.error('Unique constraint violation:', error.meta);

        // If it's an email constraint, try to find and update the user
        if (error.meta?.target?.includes('email')) {
          logger.info('Attempting to find user by email and update clerkId');
          try {
            const user = await prisma.user.update({
              where: { email: clerkData.email_addresses[0].email_address },
              data: {
                clerkId: clerkData.id,
                firstName: clerkData.first_name || null,
                lastName: clerkData.last_name || null,
                updatedAt: new Date(),
              },
            });
            logger.info('User found by email and updated with clerkId:', user.id);
            return user;
          } catch (updateError: any) {
            logger.error('Failed to update user by email:', updateError.message);
          }
        }
      }

      throw error;
    }
  },

  async getByClerkId(clerkId: string) {
    return prisma.user.findUnique({
      where: { clerkId },
      include: {
        sessions: { orderBy: { updatedAt: 'desc' }, take: 1 },
        _count: { select: { whiteboards: true, memories: true, bookmarks: true } },
      },
    });
  },

  async getById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { whiteboards: true, memories: true, bookmarks: true, sessions: true } },
      },
    });
  },

  async update(
    id: string,
    data: { firstName?: string; lastName?: string; preferredLang?: string }
  ) {
    return prisma.user.update({ where: { id }, data });
  },

  async updateRole(id: string, role: UserRole) {
    return prisma.user.update({ where: { id }, data: { role } });
  },

  async delete(clerkId: string) {
    return prisma.user.delete({ where: { clerkId } });
  },

  async updateLastLogin(clerkUserId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { clerkId: clerkUserId },
        data: {
          updatedAt: new Date(),
        },
      });
      logger.info('Last login updated for user:', clerkUserId);
    } catch (error: any) {
      logger.error(`Failed to update last login for user ${clerkUserId}:`, error.message);
    }
  },

  async getAll(page = 1, limit = 20): Promise<PaginatedUsers> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { whiteboards: true, sessions: true } } },
      }),
      prisma.user.count(),
    ]);
    return { users, total, page, pages: Math.ceil(total / limit) };
  },

  async search(query: string, page = 1, limit = 20): Promise<PaginatedUsers> {
    const skip = (page - 1) * limit;
    const where = {
      OR: [
        { email: { contains: query, mode: 'insensitive' as const } },
        { firstName: { contains: query, mode: 'insensitive' as const } },
        { lastName: { contains: query, mode: 'insensitive' as const } },
      ],
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);
    return { users, total, page, pages: Math.ceil(total / limit) };
  },

  async getStats(): Promise<UserStats> {
    const [total, students, tutors, admins] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.STUDENT } }),
      prisma.user.count({ where: { role: UserRole.TUTOR } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
    ]);
    return { total, students, tutors, admins };
  },

  async getActivity(userId: string): Promise<any> {
    const [whiteboards, memories, bookmarks, lastSession] = await Promise.all([
      prisma.whiteboard.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, updatedAt: true, isPublic: true },
      }),
      prisma.memory.findMany({
        where: { userId, type: 'PROGRESS' },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.bookmark.count({ where: { userId } }),
      prisma.session.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
    ]);
    return { whiteboards, memories, bookmarks, lastSession };
  },

  async getPreferences(userId: string): Promise<UserPreferences> {
    const memories = await prisma.memory.findMany({
      where: { userId, type: 'PREFERENCE' },
      orderBy: { updatedAt: 'desc' },
    });
    return memories.reduce((acc, m) => ({ ...acc, [m.title]: m.content }), {});
  },

  async updatePreferences(
    userId: string,
    preferences: Record<string, any>
  ): Promise<Record<string, any>> {
    const updates = Object.entries(preferences).map(([key, value]) =>
      prisma.memory.upsert({
        where: { id: `${userId}-pref-${key}` },
        update: { content: value, updatedAt: new Date() },
        create: { userId, type: 'PREFERENCE', title: key, content: value },
      })
    );
    await prisma.$transaction(updates);
    return preferences;
  },

  // ========== USER SETTINGS METHODS ==========

  async getUserSettings(userId: string) {
    // Get or create user settings
    let settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    const admin = await adminService.getSettings();
    const enabledLanguages = await this.getEnabledLanguages();

    // Get default language - prioritize English if enabled, otherwise first enabled
    const isEnglishEnabled = enabledLanguages.some(
      (l: { code: string; enabled: boolean }) => l.code === 'en' && l.enabled
    );
    const defaultLang = isEnglishEnabled
      ? 'en'
      : enabledLanguages.find((l: { enabled: boolean }) => l.enabled)?.code || 'en';

    if (!settings) {
      // Create with default language (English if available)
      settings = await prisma.userSettings.create({
        data: {
          userId,
          language: defaultLang,
          theme: 'light',
          fontSize: 'medium',
          accentColor: 'blue',
          voiceType: 'male',
          speechSpeed: '1.0x',
        },
      });
      logger.info(`Created default settings for user ${userId} with language ${defaultLang}`);
    }

    return {
      ...settings,
      availableLanguages: enabledLanguages,
      dataRetention: admin?.dataRetention,
      retentionDuration: admin?.retentionDuration,
      aiSystemPrompt: admin?.aiSystemPrompt,
      safetyMode: admin?.safetyMode,
      speechEngine: admin?.speechEngine,
      subjects: admin?.subjects,
      toneSelectors: admin?.toneSelectors,
      voiceEngine: admin?.voiceEngine,
    };
  },

  async updateUserSettings(userId: string, data: Record<string, any>) {
    return await prisma.$transaction(async tx => {
      // 1️⃣ Upsert user settings (create if not exist, update if exists)
      const settings = await tx.userSettings.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          language: 'en',
          theme: 'light',
          fontSize: 'medium',
          accentColor: 'blue',
          voiceType: 'male',
          speechSpeed: '1.0x',
          ...data, // Apply provided data
        },
      });

      // 2️⃣ If language changed, sync it to User table
      if (data.language) {
        await tx.user.update({
          where: { id: userId },
          data: { preferredLang: data.language },
        });
      }

      // 3️⃣ Return updated settings
      return settings;
    });
  },

  async getUserPersonalStats(userId: string) {
    const [allSessions, progress] = await Promise.all([
      prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.progress.findMany({
        where: { userId },
      }),
    ]);

    // Filter completed sessions for stats that require completion
    const completedSessions = allSessions.filter(s => s.completed && s.data !== null);

    // For study time, count ALL sessions (completed and incomplete) with data
    // Users spent time on incomplete sessions too!
    const sessionsWithData = allSessions.filter(s => s.data !== null);

    // 🕒 Total study time this week (week starts on Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    // getDay() returns 0 for Sunday, 1 for Monday, etc.
    // We want Monday as start of week, so adjust: Sunday (0) becomes 6, Monday (1) becomes 0, etc.
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0); // Start at midnight

    const totalStudyTimeThisWeek = sessionsWithData
      .filter(s => s.updatedAt >= startOfWeek) // Use updatedAt to count sessions active this week
      .reduce((sum, s) => sum + s.duration, 0);

    // 📘 Concepts learned (unique topics or subjects)
    const conceptsLearned = new Set<string>();
    progress.forEach(p => {
      if (p.topic) conceptsLearned.add(p.topic);
      else if (p.subject) conceptsLearned.add(p.subject);
    });

    // 📅 Latest session date (from sessions with data)
    const latestSessionDate =
      sessionsWithData.length > 0 ? sessionsWithData[0].createdAt.getTime() : 0;

    // 📊 Additional stats for progress page (use completed sessions)
    const totalSessions = completedSessions.length;
    const totalStudyTime = completedSessions.reduce((sum, s) => sum + s.duration, 0);
    const averageSessionDuration =
      totalSessions > 0 ? Math.round(totalStudyTime / totalSessions / 60) + 'm' : '0m';

    const totalQuestionsAnswered = completedSessions.reduce(
      (sum, s) => sum + (s.questionsAnswered || 0),
      0
    );
    const correctAnswers = completedSessions.reduce((sum, s) => sum + (s.correctAnswers || 0), 0);
    const accuracy =
      totalQuestionsAnswered > 0 ? Math.round((correctAnswers / totalQuestionsAnswered) * 100) : 0;

    // 🔥 Calculate current and longest streak (use completed sessions)
    const currentStreak = this.calculateStreak(completedSessions);
    let longestStreak = 0;
    let tempStreak = 0;

    if (completedSessions.length > 0) {
      const sortedSessions = [...completedSessions].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
      tempStreak = 1;

      for (let i = 1; i < sortedSessions.length; i++) {
        const prevDate = new Date(sortedSessions[i - 1].createdAt);
        const currDate = new Date(sortedSessions[i].createdAt);
        prevDate.setHours(0, 0, 0, 0);
        currDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor(
          (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    // Subject breakdown
    const subjectBreakdown = progress.reduce((acc, p) => {
      const existing = acc.find(s => s.subject === p.subject);
      if (existing) {
        existing.sessionsCount++;
        existing.timeSpent += p.timeSpent;
        existing.accuracy = Math.round((existing.accuracy + p.accuracy) / 2);
      } else {
        acc.push({
          subject: p.subject,
          sessionsCount: 1,
          accuracy: p.accuracy,
          timeSpent: p.timeSpent,
          level: p.level,
        });
      }
      return acc;
    }, [] as any[]);

    // Recent activity (last 5 completed sessions)
    const recentActivity = completedSessions.slice(0, 5).map(s => ({
      id: s.id,
      type: 'session' as const,
      title: s.subject || 'SAT Practice Session',
      date: s.createdAt.toISOString(),
      duration: s.duration,
    }));

    return {
      // For home page - all values in SECONDS for frontend formatting
      totalStudyTimeThisWeek, // in SECONDS (frontend will format)
      conceptsLearned: conceptsLearned.size,
      latestSessionDate, // timestamp in milliseconds

      // For progress page
      totalSessions,
      completedSessions: totalSessions,
      totalStudyTime, // in seconds
      averageSessionDuration,
      totalQuestionsAnswered,
      correctAnswers,
      accuracy,
      currentStreak,
      longestStreak,
      subjectBreakdown,
      recentActivity,
    };
  },

  calculateStreak(sessions: any[]): number {
    if (sessions.length === 0) return 0;

    const sortedSessions = [...sessions].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const session of sortedSessions) {
      const sessionDate = new Date(session.createdAt);
      sessionDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === streak) {
        streak++;
      } else if (diffDays > streak) {
        break;
      }
    }

    return streak;
  },

  // ========== PROGRESS METHODS ==========

  async getProgress(userId: string) {
    return prisma.progress.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getProgressBySubject(userId: string, subject: string) {
    return prisma.progress.findMany({
      where: { userId, subject },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createProgress(userId: string, data: any) {
    return prisma.progress.create({
      data: {
        userId,
        ...data,
      },
    });
  },

  async getProgressSummary(userId: string) {
    const progress = await prisma.progress.findMany({
      where: { userId },
    });

    if (progress.length === 0) {
      return {
        overallProgress: 0,
        subjectProgress: [],
        recentImprovements: [],
        areasNeedingWork: [],
      };
    }

    // Calculate overall progress
    const avgScore = progress.reduce((sum, p) => sum + p.score, 0) / progress.length;

    // Group by subject
    const subjectMap = new Map<string, any[]>();
    progress.forEach(p => {
      const existing = subjectMap.get(p.subject) || [];
      existing.push(p);
      subjectMap.set(p.subject, existing);
    });

    const subjectProgress = Array.from(subjectMap.entries()).map(([subject, items]) => {
      const avgSubjectScore = items.reduce((sum, p) => sum + p.score, 0) / items.length;
      const latestLevel = items[items.length - 1]?.level || 'beginner';

      return {
        subject,
        progress: Math.round(avgSubjectScore),
        level: latestLevel,
      };
    });

    // Find improvements and areas needing work
    const recentImprovements: string[] = [];
    const areasNeedingWork: string[] = [];

    subjectMap.forEach((items, subject) => {
      if (items.length >= 2) {
        const recent = items.slice(-2);
        if (recent[1].score > recent[0].score + 10) {
          recentImprovements.push(subject);
        } else if (recent[1].score < 60) {
          areasNeedingWork.push(subject);
        }
      }
    });

    return {
      overallProgress: Math.round(avgScore),
      subjectProgress,
      recentImprovements,
      areasNeedingWork,
    };
  },

  // ========== SESSION METHODS ==========

  async createSession(userId: string, data: any) {
    // Check for existing active session first
    const existingActive = await this.getActiveSession(userId);

    if (existingActive) {
      return existingActive;
    }

    // Always create session regardless of data retention settings
    // The session is needed for the app to function properly
    // Data retention settings will be applied during cleanup/deletion
    const session = await prisma.session.create({
      data: {
        userId,
        ...data,
      },
    });

    // Check data retention settings for future cleanup
    const adminSettings = await prisma.adminSettings.findFirst();

    if (!adminSettings?.dataRetention || adminSettings.retentionDuration === 'never') {
      logger.info(
        `Session ${session.id} created but will be auto-deleted per data retention policy`
      );
      // Note: Session cleanup should be handled by a scheduled job
      // that respects data retention settings
    }

    return session;
  },

  async getSession(sessionId: string) {
    return prisma.session.findUnique({
      where: { id: sessionId },
    });
  },

  /**
   * Recalculate metrics for a session based on its messages
   * This analyzes existing session data and updates the metrics
   */
  async recalculateSessionMetrics(sessionId: string) {
    // Get the current session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || !session.data) {
      logger.warn(`Session ${sessionId} not found or has no data`);
      return null;
    }

    const sessionData = session.data as any;
    const messages = sessionData?.messages || [];

    if (!Array.isArray(messages) || messages.length === 0) {
      logger.warn(`Session ${sessionId} has no messages to analyze`);
      return session;
    }

    // 1. Analyze messages for positive actions (Spreading Joy)
    const spreadingJoyCount = await this.analyzeSpreadingJoyInMessages(messages);

    // 2. Count photo uploads (Say Cheese) - messages with images
    const photoUploadsCount = messages.filter((msg: any) => {
      if (msg.sender !== 'user') return false;
      if (!msg.text) return false;

      // Check if message contains an image tag or whiteboard submission with image
      return msg.text.includes('<img') || msg.text.includes('[Whiteboard Submission]');
    }).length;

    logger.info(
      `Session ${sessionId} recalculated: ${spreadingJoyCount} spreading joy, ${photoUploadsCount} photos`
    );

    // Update the session with the calculated metrics
    return await prisma.session.update({
      where: { id: sessionId },
      data: {
        spreadingJoyActions: spreadingJoyCount,
        photoUploadsCount: photoUploadsCount,
      },
    });
  },

  async updateSession(sessionId: string, data: any) {
    // First update the session with the provided data
    const session = await prisma.session.update({
      where: { id: sessionId },
      data,
    });

    // After updating, recalculate metrics ASYNCHRONOUSLY (don't block the response)
    // Calculate for ANY session update that includes messages (not just completed)
    if (data.data && typeof data.data === 'object') {
      const sessionData = data.data as any;
      if (
        sessionData.messages &&
        Array.isArray(sessionData.messages) &&
        sessionData.messages.length > 0
      ) {
        logger.info(`Queuing async metrics recalculation for session ${sessionId}`);
        // Run in background - don't await (returns immediately, no timeout)
        this.recalculateSessionMetrics(sessionId).catch(error => {
          logger.error(`Failed to recalculate metrics for session ${sessionId}:`, error);
        });

        // NEW: Detect and set DOMINANT subject for incomplete sessions
        // Re-run detection each time to update as more questions are asked
        const realMessages = sessionData.messages.filter((msg: any) => msg.id !== '1');

        // Only detect if there are actual conversation messages
        if (realMessages.length > 0) {
          logger.info(`Queuing async multi-subject detection for session ${sessionId}`);

          // Run in background - use multi-subject detection
          this.detectAllSubjectsFromConversation(realMessages)
            .then(async allSubjects => {
              // Subjects are already sorted by questionCount (highest first)
              const dominantSubject = allSubjects[0];

              await prisma.session.update({
                where: { id: sessionId },
                data: {
                  subject: dominantSubject.subject,
                  topic: dominantSubject.topic,
                },
              });
              logger.info(
                `Updated session ${sessionId} with dominant subject: ${dominantSubject.subject} (${dominantSubject.questionCount} questions)`
              );
            })
            .catch(error => {
              logger.error(`Failed to detect subjects for session ${sessionId}:`, error);
            });
        }
      }
    }

    // If session is being marked as completed, create Progress record(s)
    if (data.completed === true && session.data) {
      try {
        // Extract session data
        const sessionData = session.data as any;
        const messages = sessionData?.messages || [];
        const realMessages = messages.filter((msg: any) => msg.id !== '1'); // Exclude welcome message

        // Skip progress creation if there are no real messages (only welcome message)
        if (realMessages.length === 0) {
          logger.info(
            `Session ${sessionId} completed but has no real messages - skipping progress creation`
          );
          return session;
        }

        // Calculate basic metrics
        const questionsAsked = realMessages.filter((msg: any) => msg.sender === 'user').length;
        const timeSpent = session.duration || 0;

        // 🔥 NEW: Detect ALL subjects discussed in the session
        logger.info(`Detecting all subjects for completed session ${sessionId}`);
        const allSubjects = await this.detectAllSubjectsFromConversation(realMessages);
        logger.info(`Detected ${allSubjects.length} subject(s):`, allSubjects);

        // Set primary subject (dominant = first in array) to session if not already set
        if (!session.subject && allSubjects.length > 0) {
          const primarySubject = allSubjects[0];
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              subject: primarySubject.subject,
              topic: primarySubject.topic,
            },
          });
          logger.info(
            `Updated session ${sessionId} with primary subject: ${primarySubject.subject} (${primarySubject.questionCount} questions)`
          );
        }

        // 🔥 NEW: Create separate progress record for EACH subject
        const totalQuestions = questionsAsked;
        const progressRecords = [];

        for (const subjectData of allSubjects) {
          // Calculate proportional metrics for this subject
          const proportion = subjectData.questionCount / totalQuestions;
          const subjectTimeSpent = Math.round(timeSpent * proportion);
          const subjectQuestionsAttempted = subjectData.questionCount;
          const subjectQuestionsCorrect = Math.round((session.correctAnswers || 0) * proportion);

          const progressRecord = await prisma.progress.create({
            data: {
              userId: session.userId,
              subject: subjectData.subject,
              topic: subjectData.topic || null,
              score: 0, // Will be updated when we have quiz/test features
              accuracy: 0, // Will be updated when we have quiz/test features
              timeSpent: subjectTimeSpent,
              questionsAttempted: subjectQuestionsAttempted,
              questionsCorrect: subjectQuestionsCorrect,
              questionsWrong: Math.max(0, subjectQuestionsAttempted - subjectQuestionsCorrect),
              level: 'beginner', // Will be determined by AI or user level later
              metadata: {
                sessionId: session.id,
                hasWhiteboard: sessionData?.whiteboard !== null,
                photoUploads: session.photoUploadsCount || 0,
                aiInteractions: session.aiInteractions || 0,
                isMultiSubjectSession: allSubjects.length > 1,
                totalSubjectsInSession: allSubjects.length,
              },
            },
          });

          progressRecords.push(progressRecord);
        }

        logger.info(
          `Created ${progressRecords.length} progress record(s) for session ${sessionId}`
        );
      } catch (error: any) {
        logger.error(`Failed to create progress record for session ${sessionId}:`, error.message);
        // Don't throw error - session update was successful, progress creation is optional
      }
    }

    return session;
  },

  async deleteSession(sessionId: string) {
    try {
      return await prisma.session.delete({
        where: { id: sessionId },
      });
    } catch (error: any) {
      // If session doesn't exist, that's fine - it's already deleted
      if (error.code === 'P2025') {
        logger.info(`Session ${sessionId} already deleted or doesn't exist`);
        return null;
      }
      throw error;
    }
  },

  async getUserSessions(userId: string) {
    return prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getActiveSession(userId: string) {
    // Get all active sessions for this user
    // Exclude sessions with lastPoint - those are "incomplete/paused" sessions, not "active"
    const activeSessions = await prisma.session.findMany({
      where: {
        userId,
        completed: false,
        OR: [{ lastPoint: null }, { lastPoint: '' }],
      },
      orderBy: { updatedAt: 'desc' },
    });

    // If no active sessions, return null
    if (activeSessions.length === 0) {
      return null;
    }

    // If only one active session, return it
    if (activeSessions.length === 1) {
      return activeSessions[0];
    }

    // Multiple active sessions found - clean up duplicates
    // Keep the most recently updated session with valid data, delete the rest
    let validSession = null;
    const sessionsToDelete: string[] = [];

    for (const session of activeSessions) {
      if (session.data !== null && !validSession) {
        // Keep the first session with valid data
        validSession = session;
      } else {
        // Mark for deletion
        sessionsToDelete.push(session.id);
      }
    }

    // If no valid session found, keep the most recent one
    if (!validSession && activeSessions.length > 0) {
      validSession = activeSessions[0];
      // Remove it from the delete list
      const indexToRemove = sessionsToDelete.indexOf(validSession.id);
      if (indexToRemove > -1) {
        sessionsToDelete.splice(indexToRemove, 1);
      }
    }

    // Delete duplicate sessions
    for (const sessionId of sessionsToDelete) {
      try {
        await prisma.session.delete({ where: { id: sessionId } });
        logger.info(`Deleted duplicate/empty session: ${sessionId}`);
      } catch (error: any) {
        logger.error(`Failed to delete session ${sessionId}:`, error.message);
        // Continue even if delete fails
      }
    }

    return validSession;
  },

  async getIncompleteSessions(userId: string) {
    // Get all incomplete sessions for this user that have data
    // Include sessions with lastPoint OR with data (messages/whiteboard)
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        completed: false,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Filter to only include sessions that have:
    // 1. A lastPoint saved OR
    // 2. Data (messages/whiteboard) - meaning user spent time on it
    return sessions.filter(session => {
      // Has lastPoint saved
      if (session.lastPoint && session.lastPoint.trim() !== '') {
        return true;
      }

      // Has data (messages or whiteboard)
      if (session.data && typeof session.data === 'object') {
        const data = session.data as any;
        // Check if has messages (more than just the initial greeting)
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 1) {
          return true;
        }
        // Check if has whiteboard data
        if (data.whiteboard) {
          return true;
        }
      }

      // Empty session - don't show
      return false;
    });
  },

  async getCompleteSessions(userId: string) {
    // Get admin settings for data retention
    const settings = await adminService.getSettings();

    // If data retention is disabled, return empty array
    if (!settings.dataRetention) {
      return [];
    }

    // Calculate cutoff date based on retention duration
    let cutoffDate: Date | null = null;
    const retentionDays = parseInt(settings.retentionDuration || '30', 10);

    if (retentionDays > 0) {
      cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    }

    // Build query for complete sessions
    const where: any = {
      userId,
      completed: true,
    };

    // Add date filter if retention period is set
    if (cutoffDate) {
      where.updatedAt = {
        gte: cutoffDate,
      };
    }

    // Fetch complete sessions
    const sessions = await prisma.session.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return sessions;
  },
  async renameSession(sessionId: string, title: string) {
    try {
      const updatedSession = await prisma.session.update({
        where: { id: sessionId },
        data: { subject: title },
      });

      return updatedSession;
    } catch (error) {
      throw new Error('An unexpected error occurred while renaming the session.');
    }
  },

  async getSessionCounts(userId: string) {
    // Get incomplete sessions count
    const incompleteSessions = await this.getIncompleteSessions(userId);
    const incompleteCount = incompleteSessions.length;

    // Get complete sessions count
    const completeSessions = await this.getCompleteSessions(userId);
    const completeCount = completeSessions.length;

    return {
      incompleteCount,
      completeCount,
      totalCount: incompleteCount + completeCount,
    };
  },

  async resumeSession(sessionId: string, userId: string) {
    // Verify the session belongs to the user
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Session not found or unauthorized');
    }

    // Prevent resuming completed sessions
    if (session.completed) {
      throw new Error('Cannot resume a completed session');
    }

    // Mark session as resumed (you can add a 'resumed' field to track this if needed)
    // For now, just return the session data
    return session;
  },

  /**
   * Clean up sessions based on data retention policy
   * This should be called periodically (e.g., daily cron job)
   */
  async cleanupSessionsByRetentionPolicy() {
    const settings = await adminService.getSettings();

    // If data retention is disabled or set to "never", delete all sessions immediately
    if (!settings.dataRetention || settings.retentionDuration === 'never') {
      const deletedCount = await prisma.session.deleteMany({});
      logger.info(`Data retention disabled: Deleted ${deletedCount.count} sessions`);
      return deletedCount.count;
    }

    // Calculate cutoff date based on retention duration
    const retentionDays = parseInt(settings.retentionDuration || '30', 10);

    if (retentionDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete sessions older than retention period
      const deletedCount = await prisma.session.deleteMany({
        where: {
          updatedAt: {
            lt: cutoffDate,
          },
        },
      });

      logger.info(
        `Data retention cleanup: Deleted ${deletedCount.count} sessions older than ${retentionDays} days`
      );
      return deletedCount.count;
    }

    return 0;
  },

  async clearAIData(userId: string) {
    // Clear all AI-related data for the user
    try {
      // Delete all sessions (includes chat history)
      await prisma.session.deleteMany({
        where: { userId },
      });

      // Delete all bookmarks
      await prisma.bookmark.deleteMany({
        where: { userId },
      });

      // Delete all progress records (this will clear conceptsLearned count)
      await prisma.progress.deleteMany({
        where: { userId },
      });

      // Delete all memories (AI interaction, preferences, bookmarks, etc.)
      await prisma.memory.deleteMany({
        where: { userId },
      });

      // Reset AI-related user activity metrics
      await prisma.userActivity.updateMany({
        where: { userId },
        data: {
          aiInteractions: 0,
        },
      });

      logger.info(`Cleared all AI data, bookmarks, sessions, and progress for user ${userId}`);

      return {
        success: true,
        message: 'All AI companions, bookmarks, sessions, and progress data have been removed',
      };
    } catch (error: any) {
      logger.error('Error clearing AI data:', error);
      throw new Error('Failed to clear AI data');
    }
  },

  // ========== LANGUAGE METHODS ==========

  async getAvailableLanguages(): Promise<any[]> {
    try {
      // Get admin settings to check which languages are enabled
      const adminSettings = await prisma.adminSettings.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
      // Language mapping
      const languageMap = {
        english: { code: 'en', name: 'English' },
        spanish: { code: 'es', name: 'Spanish' },
        hindi: { code: 'hi', name: 'Hindi' },
        chinese: { code: 'zh', name: 'Chinese' },
      };

      // If no admin settings exist, return all languages as enabled
      if (!adminSettings) {
        return Object.entries(languageMap).map(([key, value]) => ({
          code: value.code,
          name: value.name,
          enabled: true,
        }));
      }

      // Parse languages from admin settings
      const languages = adminSettings.languages as any;

      // Return languages with their enabled status
      return Object.entries(languageMap).map(([key, value]) => ({
        code: value.code,
        name: value.name,
        enabled: languages[key] !== undefined ? languages[key] : true,
      }));
    } catch (error: any) {
      logger.error('Error getting available languages:', error.message);
      // Return default languages in case of error
      return [
        { code: 'en', name: 'English', enabled: true },
        { code: 'es', name: 'Spanish', enabled: true },
        { code: 'hi', name: 'Hindi', enabled: true },
        { code: 'zh', name: 'Chinese', enabled: true },
      ];
    }
  },

  async getEnabledLanguages(): Promise<any[]> {
    const allLanguages = await this.getAvailableLanguages();
    // Return only enabled languages for user selection
    return allLanguages.filter(lang => lang.enabled);
  },

  // ========== SESSION TRACKING METHODS ==========

  async updateSessionModes(sessionId: string, audioEnabled: boolean, textEnabled: boolean) {
    return prisma.session.update({
      where: { id: sessionId },
      data: {
        audioModeEnabled: audioEnabled,
        textModeEnabled: textEnabled,
      },
    });
  },

  async incrementPhotoUpload(sessionId: string) {
    return prisma.session.update({
      where: { id: sessionId },
      data: { photoUploadsCount: { increment: 1 } },
    });
  },

  async incrementWhiteboardSubmission(sessionId: string) {
    return prisma.session.update({
      where: { id: sessionId },
      data: { whiteboardSubmissions: { increment: 1 } },
    });
  },

  async incrementAIInteraction(sessionId: string) {
    return prisma.session.update({
      where: { id: sessionId },
      data: { aiInteractions: { increment: 1 } },
    });
  },

  /**
   * Analyze chat messages to detect Spreading Joy actions using AI
   * Detects positive actions like: thank you, sharing progress, giving feedback
   * Works across multiple languages: en, es, hi, zh
   */
  async analyzeSpreadingJoyInMessages(messages: any[]): Promise<number> {
    try {
      // Filter to only user messages (not bot messages or whiteboard submissions)
      const userMessages = messages
        .filter((msg: any) => {
          if (msg.sender !== 'user') return false;
          if (!msg.text) return false;

          // Skip whiteboard submissions
          if (msg.text.includes('[Whiteboard Submission]')) return false;

          // Remove HTML tags to get clean text
          const cleanText = msg.text.replace(/<[^>]*>/g, '').trim();

          // Skip empty or very short messages
          if (cleanText.length < 3) return false;

          return true;
        })
        .map((msg: any) => {
          // Clean HTML from text
          return msg.text.replace(/<[^>]*>/g, '').trim();
        });

      if (userMessages.length === 0) {
        return 0;
      }

      // Use OpenAI to detect positive actions across all languages
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a sentiment analyzer that detects positive and encouraging actions in student messages across multiple languages (English, Spanish, Hindi, Chinese).

Count the following positive actions:
1. Expressing gratitude (thank you, thanks, gracias, धन्यवाद, 谢谢)
2. Sharing progress or achievements (I learned, I understand, I got it, etc.)
3. Giving positive feedback (great, awesome, helpful, this helped, etc.)
4. Showing appreciation (I appreciate, this is useful, you helped me, etc.)

Return ONLY a JSON object with the count:
{"positiveActions": <number>}`,
            },
            {
              role: 'user',
              content: `Analyze these messages and count positive actions:\n\n${userMessages.join('\n\n')}`,
            },
          ],
          max_tokens: 50,
          temperature: 0,
        }),
      });

      const data: any = await response.json();
      const aiResponse = data?.choices?.[0]?.message?.content ?? '';

      const cleanedResponse = aiResponse
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      try {
        const result = JSON.parse(cleanedResponse);
        return result.positiveActions || 0;
      } catch (parseError: any) {
        logger.error('Failed to parse Spreading Joy analysis:', parseError.message);
        return 0;
      }
    } catch (error: any) {
      logger.error('Error analyzing Spreading Joy:', error.message);
      return 0;
    }
  },

  /**
   * Increment spreading joy actions count for a session
   * Can optionally analyze messages to auto-detect positive actions
   */
  async incrementSpreadingJoy(sessionId: string, count: number = 1) {
    return prisma.session.update({
      where: { id: sessionId },
      data: { spreadingJoyActions: { increment: count } },
    });
  },

  async analyzeWhiteboardWithAI(sessionId: string, canvasData?: string, textContent?: string) {
    const { openAIService } = await import('../../services/openai.service');

    // Get session to find userId
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Get user's preferred language from UserSettings
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.userId },
      select: { language: true },
    });

    const userLanguage = userSettings?.language || 'en';

    // Debug logging
    logger.info('Whiteboard submission received:', {
      sessionId,
      hasCanvasData: !!canvasData,
      hasTextContent: !!textContent,
      textContentLength: textContent?.length || 0,
      textContentPreview: textContent?.substring(0, 300),
      hasImgTag: textContent?.includes('<img') || false,
      hasVideoTag: textContent?.includes('<video') || false,
      hasS3Url: textContent?.includes('.s3.') || textContent?.includes('s3.amazonaws') || false,
    });

    // Analyze the whiteboard content with user's preferred language
    const analysis = await openAIService.analyzeWhiteboardContent(
      canvasData,
      textContent,
      userLanguage
    );

    // Increment whiteboard submission count
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        whiteboardSubmissions: { increment: 1 },
        aiInteractions: { increment: 1 },
      },
    });

    return { analysis };
  },

  // ========== PROGRESS METRICS METHODS ==========

  async getTodayActivity(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let activity = await prisma.userActivity.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    // Create today's activity if doesn't exist
    if (!activity) {
      activity = await prisma.userActivity.create({
        data: {
          userId,
          date: today,
        },
      });
    }

    return activity;
  },

  async updateTodayActivity(userId: string, updates: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.userActivity.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: updates,
      create: {
        userId,
        date: today,
        ...updates,
      },
    });
  },

  async getProgressMetrics(userId: string) {
    // Get all sessions for streak calculation
    const allSessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        spreadingJoyActions: true,
        photoUploadsCount: true,
      },
    });

    // Calculate current streak from sessions - MUST BE CONTINUOUS (no breaks)
    let currentStreak = 0;
    let longestStreak = 0;

    if (allSessions.length > 0) {
      // Get unique dates from sessions
      const uniqueDates = new Set<string>();
      allSessions.forEach(session => {
        const date = new Date(session.createdAt);
        date.setHours(0, 0, 0, 0);
        uniqueDates.add(date.toISOString());
      });

      const sortedDates = Array.from(uniqueDates)
        .map(d => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime());

      // Calculate current streak - must be consecutive days without breaks
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < sortedDates.length; i++) {
        const sessionDate = new Date(sortedDates[i]);
        sessionDate.setHours(0, 0, 0, 0);

        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
        expectedDate.setHours(0, 0, 0, 0);

        if (sessionDate.getTime() === expectedDate.getTime()) {
          currentStreak++;
        } else {
          // Break in streak - stop counting
          break;
        }
      }

      // Calculate longest streak - must be consecutive days
      let tempStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(sortedDates[i]);
        const diffDays = Math.floor(
          (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
          // Consecutive day - continue streak
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          // Gap in days - reset streak
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak, currentStreak);
    }

    // Calculate totals from ALL sessions
    const totalSpreadingJoy = allSessions.reduce((sum, s) => sum + (s.spreadingJoyActions || 0), 0);
    const totalSayCheese = allSessions.reduce((sum, s) => sum + (s.photoUploadsCount || 0), 0);

    // Get today's activity
    const todayActivity = await this.getTodayActivity(userId);

    // Medal thresholds
    const STREAKER_THRESHOLD = 200; // 200 continuous days
    const SPREADING_JOY_THRESHOLD = 100; // 100 positive actions
    const SAY_CHEESE_THRESHOLD = 100; // 100 photo uploads

    // Determine medal status
    const streakerStatus = currentStreak >= STREAKER_THRESHOLD ? 'completed' : 'in_progress';
    const spreadingJoyStatus =
      totalSpreadingJoy >= SPREADING_JOY_THRESHOLD ? 'completed' : 'in_progress';
    const sayCheeseStatus = totalSayCheese >= SAY_CHEESE_THRESHOLD ? 'completed' : 'in_progress';

    return {
      // Streaker Medal - 200 continuous days
      currentStreak,
      longestStreak,
      streakerThreshold: STREAKER_THRESHOLD,
      streakerProgress: currentStreak,
      streakerStatus,

      // Spreading Joy Medal - 100 positive actions
      totalSpreadingJoy,
      spreadingJoyThreshold: SPREADING_JOY_THRESHOLD,
      spreadingJoyProgress: totalSpreadingJoy,
      spreadingJoyStatus,

      // Say Cheese Medal - 100 photo uploads
      totalSayCheese,
      sayCheeseThreshold: SAY_CHEESE_THRESHOLD,
      sayCheeseProgress: totalSayCheese,
      sayCheeseStatus,

      // Star Progress
      starProgress: todayActivity.starProgress,

      // Today's activity details
      todayActivity: {
        studyMinutes: todayActivity.studyMinutes,
        questionsAnswered: todayActivity.questionsAnswered,
        photoQuestions: todayActivity.photoQuestions,
        positiveActions: todayActivity.positiveActions,
      },
    };
  },

  async calculateStarProgress(userId: string) {
    const activity = await this.getTodayActivity(userId);

    // Star progress is based on multiple factors:
    // 1. Study time (minutes studied) - 40% weight
    // 2. Questions answered - 30% weight
    // 3. Daily streak maintenance - 30% weight

    // Goals (can be pulled from user settings in future)
    const STUDY_GOAL_MINUTES = 120; // 2 hours
    const QUESTIONS_GOAL = 20; // 20 questions per day
    const STREAK_GOAL = 1; // Just need to study today to maintain streak

    // Calculate individual progress percentages
    const studyProgress = Math.min((activity.studyMinutes / STUDY_GOAL_MINUTES) * 100, 100);
    const questionsProgress = Math.min((activity.questionsAnswered / QUESTIONS_GOAL) * 100, 100);
    const streakProgress = activity.studyMinutes > 0 ? 100 : 0; // Did they study today?

    // Weighted average
    const totalProgress =
      studyProgress * 0.4 + // 40% weight on study time
      questionsProgress * 0.3 + // 30% weight on questions
      streakProgress * 0.3; // 30% weight on maintaining streak

    const progress = Math.min(Math.round(totalProgress), 100);

    // Update star progress
    await this.updateTodayActivity(userId, { starProgress: progress });

    return progress;
  },

  // ========== AI SUBJECT DETECTION ==========

  async detectSubjectFromConversation(
    messages: any[]
  ): Promise<{ subject: string; topic: string | null }> {
    try {
      // Get user messages only
      const userText = messages
        .filter(msg => msg.sender === 'user' && msg.text?.length > 2)
        .map(msg => msg.text)
        .join(' ');

      // Return General if no meaningful content
      if (!userText.trim()) {
        return { subject: 'General', topic: null };
      }

      // Simple, direct API call
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: `What subject is this about: "${userText}"

Respond only in JSON: {"subject": "subject_name", "topic": "specific_topic"}`,
            },
          ],
          max_tokens: 50,
          temperature: 0,
        }),
      });

      const data: any = await response.json();
      const aiResponse = data?.choices?.[0]?.message?.content ?? '';

      const cleanedResponse = aiResponse
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      logger.info('Cleaned AI response for subject detection:', cleanedResponse);

      try {
        const result = JSON.parse(cleanedResponse);
        return {
          subject: result.subject || 'General',
          topic: result.topic || null,
        };
      } catch (parseError: any) {
        logger.error('Failed to parse AI response JSON:', parseError.message);
        return { subject: 'General', topic: null };
      }
    } catch (error: any) {
      logger.error('Subject detection error:', error.message);
      return { subject: 'General', topic: null };
    }
  },

  /**
   * Detect ALL subjects discussed in a conversation with accurate question counting
   * Returns array of subjects sorted by question count (dominant subject first)
   */
  async detectAllSubjectsFromConversation(
    messages: any[]
  ): Promise<Array<{ subject: string; topic: string | null; questionCount: number }>> {
    try {
      // Filter messages: Include user messages AND bot responses that describe images/drawings
      const relevantMessages = messages.filter(msg => {
        // Include user text messages
        if (msg.sender === 'user' && msg.text && msg.text.length > 2) {
          return true;
        }

        // Include bot messages that describe whiteboard/image content
        if (msg.sender === 'bot' && msg.text) {
          const lowerText = msg.text.toLowerCase();
          return (
            lowerText.includes('drawn') ||
            lowerText.includes('drawing') ||
            lowerText.includes('image') ||
            lowerText.includes('whiteboard') ||
            lowerText.includes('uploaded') ||
            lowerText.includes('shape') ||
            lowerText.includes('diagram')
          );
        }

        return false;
      });

      if (relevantMessages.length === 0) {
        return [{ subject: 'Unknown', topic: null, questionCount: 0 }];
      }

      // Build context for AI including both user questions AND bot image descriptions
      const conversationText = relevantMessages
        .map((msg, idx) => {
          if (msg.sender === 'user') {
            // Check if it's a whiteboard submission
            if (msg.text.includes('[Whiteboard Submission]')) {
              return `User drew on whiteboard (Question ${idx + 1})`;
            }
            return `Question ${idx + 1}: ${msg.text}`;
          } else {
            // Bot describing what was drawn/uploaded
            return `AI described: ${msg.text}`;
          }
        })
        .join('\n\n');

      logger.info(`Analyzing ${relevantMessages.length} messages for subject detection`);

      // Enhanced AI prompt for mixed media content
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: `Analyze this conversation which includes text questions, whiteboard drawings, and image uploads. Detect educational subjects.

${conversationText}

IMPORTANT RULES:
- Extract subject from BOTH text questions AND AI descriptions of drawings/images
- Examples:
  * "AI described: triangle and quadrilateral" → Subject: "Mathematics" (Geometry)
  * "Question: what is 3+4" → Subject: "Mathematics" (Arithmetic)
  * "AI described: cartoon character, no educational content" → Ignore (not educational)
  * "User drew chemistry diagram" → Subject: "Chemistry"
- If whiteboard drawing or image shows educational content (shapes, equations, diagrams), count it as a question
- If image is non-educational (screenshots, cartoons, random photos), mark as "General" or ignore
- Count each educational interaction (text question OR educational drawing) as 1 question

Respond ONLY in JSON (no markdown):
{
  "subjects": [
    {"subject": "Mathematics", "topic": "Geometry and Arithmetic", "questionCount": 2}
  ]
}`,
            },
          ],
          max_tokens: 300,
          temperature: 0,
        }),
      });

      const data: any = await response.json();
      const aiResponse = data?.choices?.[0]?.message?.content ?? '';

      const cleanedResponse = aiResponse
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      logger.info('AI multi-subject detection response:', cleanedResponse);

      try {
        const result = JSON.parse(cleanedResponse);
        const subjects = result.subjects || [];

        if (Array.isArray(subjects) && subjects.length > 0) {
          const sortedSubjects = subjects
            .map((s: any) => ({
              subject: s.subject || 'Unknown',
              topic: s.topic || null,
              questionCount: Math.max(1, parseInt(s.questionCount) || 1),
            }))
            .sort((a, b) => b.questionCount - a.questionCount);

          const uniqueSubjects = sortedSubjects.filter(
            s => s.subject !== 'Unknown' && s.subject !== 'General'
          );

          if (uniqueSubjects.length === 0) {
            return [{ subject: 'Unknown', topic: null, questionCount: relevantMessages.length }];
          } else if (uniqueSubjects.length === 1) {
            // Single subject detected
            return uniqueSubjects;
          } else {
            // Multiple subjects - combine them
            const subjectNames = uniqueSubjects.map(s => s.subject).join(', ');
            const totalQuestions = uniqueSubjects.reduce((sum, s) => sum + s.questionCount, 0);

            return [
              {
                subject: `General Practice - Mixed: ${subjectNames}`,
                topic: null,
                questionCount: totalQuestions,
              },
            ];
          }
        } else {
          return [{ subject: 'Unknown', topic: null, questionCount: relevantMessages.length }];
        }
      } catch (parseError: any) {
        logger.error('Failed to parse AI response:', parseError.message);
        return [{ subject: 'Unknown', topic: null, questionCount: relevantMessages.length }];
      }
    } catch (error: any) {
      logger.error('Subject detection error:', error.message);
      return [{ subject: 'Unknown', topic: null, questionCount: 1 }];
    }
  },
};
