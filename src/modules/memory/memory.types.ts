import { Memory, MemoryType } from '@prisma/client';

export interface CreateMemoryData {
  type: MemoryType;
  title: string;
  content: any;
  metadata?: any;
}

export interface UpdateMemoryData {
  title?: string;
  content?: any;
  metadata?: any;
}

export interface MemoryResponse extends Memory {
  // You can add computed fields here if needed
}

export interface LearningProfile {
  preferredSubjects: string[];
  difficulty: string;
  learningStyle: string;
  strengths: string[];
  weaknesses: string[];
  recentTopics: string[];
  totalStudyMinutes: number;
  averageAccuracy: number;
}

export interface GetMemoriesQuery {
  type?: MemoryType;
  limit?: number;
  offset?: number;
}
