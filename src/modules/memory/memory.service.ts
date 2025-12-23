import { PrismaClient, MemoryType } from '@prisma/client';
import {
  CreateMemoryData,
  UpdateMemoryData,
  LearningProfile,
  GetMemoriesQuery,
} from './memory.types';

const prisma = new PrismaClient();

export class MemoryService {
  /**
   * Create a new memory for a user
   */
  async createMemory(userId: string, data: CreateMemoryData) {
    return await prisma.memory.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        content: data.content,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Get all memories for a user with optional filtering
   */
  async getMemories(userId: string, query?: GetMemoriesQuery) {
    const where: any = { userId };

    if (query?.type) {
      where.type = query.type;
    }

    return await prisma.memory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query?.limit,
      skip: query?.offset,
    });
  }

  /**
   * Get a specific memory by ID
   */
  async getMemoryById(id: string, userId: string) {
    return await prisma.memory.findFirst({
      where: { id, userId },
    });
  }

  /**
   * Update a memory
   */
  async updateMemory(id: string, userId: string, data: UpdateMemoryData) {
    // First check if memory belongs to user
    const memory = await this.getMemoryById(id, userId);
    if (!memory) {
      throw new Error('Memory not found or unauthorized');
    }

    return await prisma.memory.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.content && { content: data.content }),
        ...(data.metadata && { metadata: data.metadata }),
      },
    });
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string, userId: string) {
    // First check if memory belongs to user
    const memory = await this.getMemoryById(id, userId);
    if (!memory) {
      throw new Error('Memory not found or unauthorized');
    }

    return await prisma.memory.delete({
      where: { id },
    });
  }

  /**
   * Get user's learning profile for AI personalization
   */
  async getUserLearningProfile(userId: string): Promise<LearningProfile> {
    // Get user's progress data
    const progressData = await prisma.progress.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Get user's session data
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get user's preferences from memories
    const preferences = await prisma.memory.findMany({
      where: {
        userId,
        type: MemoryType.PREFERENCE,
      },
    });

    // Analyze progress to identify strengths and weaknesses
    const subjectStats = new Map<string, { total: number; correct: number; accuracy: number }>();

    progressData.forEach(progress => {
      const subject = progress.subject;
      if (!subjectStats.has(subject)) {
        subjectStats.set(subject, { total: 0, correct: 0, accuracy: 0 });
      }
      const stats = subjectStats.get(subject)!;
      stats.total += progress.questionsAttempted;
      stats.correct += progress.questionsCorrect;
      stats.accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    });

    // Identify strengths (accuracy > 70%)
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    subjectStats.forEach((stats, subject) => {
      if (stats.accuracy >= 70) {
        strengths.push(subject);
      } else if (stats.accuracy < 50 && stats.total >= 5) {
        weaknesses.push(subject);
      }
    });

    // Get preferred subjects (most practiced)
    const preferredSubjects = Array.from(subjectStats.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 3)
      .map(([subject]) => subject);

    // Get recent topics from sessions
    const recentTopics = sessions
      .filter(s => s.topic)
      .map(s => s.topic as string)
      .slice(0, 5);

    // Calculate total study minutes
    const totalStudyMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;

    // Calculate average accuracy
    const allAccuracies = progressData.map(p => p.accuracy);
    const averageAccuracy =
      allAccuracies.length > 0
        ? allAccuracies.reduce((sum, acc) => sum + acc, 0) / allAccuracies.length
        : 0;

    // Determine difficulty level
    let difficulty = 'beginner';
    if (averageAccuracy >= 70) {
      difficulty = 'advanced';
    } else if (averageAccuracy >= 50) {
      difficulty = 'intermediate';
    }

    // Determine learning style from preferences or default
    let learningStyle = 'balanced';
    const learningStylePreference = preferences.find(p => p.title === 'learningStyle');
    if (learningStylePreference && learningStylePreference.content) {
      const content = learningStylePreference.content as any;
      learningStyle = content.style || 'balanced';
    }

    return {
      preferredSubjects,
      difficulty,
      learningStyle,
      strengths,
      weaknesses,
      recentTopics,
      totalStudyMinutes: Math.round(totalStudyMinutes),
      averageAccuracy: Math.round(averageAccuracy * 10) / 10,
    };
  }

  /**
   * Get memory count by type
   */
  async getMemoryCount(userId: string, type?: MemoryType): Promise<number> {
    return await prisma.memory.count({
      where: {
        userId,
        ...(type && { type }),
      },
    });
  }
}

export const memoryService = new MemoryService();
