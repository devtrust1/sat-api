import { User, UserRole } from '@prisma/client';
import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: User;
}

export interface UserActivitySummary {
  whiteboards: Array<{
    id: string;
    title: string | null;
    updatedAt: Date;
    isPublic: boolean;
  }>;
  memories: any[];
  bookmarks: number;
  lastSession: any | null;
}

export interface UserPreferences {
  [key: string]: any;
}

export interface UserStats {
  total: number;
  students: number;
  tutors: number;
  admins: number;
}

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  pages: number;
}

// Available Languages Type
export interface AvailableLanguage {
  code: string;
  name: string;
  enabled: boolean;
}

// User Settings Types
export interface UserSettings {
  id: string;
  userId: string;
  // Notification Settings
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyProgress: boolean;
  studyReminders: boolean;
  // Study Preferences
  studyGoalHours: number;
  preferredSubjects: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  autoSaveInterval: number;
  // Display Settings
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  showHints: boolean;
  // Session Settings
  sessionDuration: number;
  breakDuration: number;
  soundEffects: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Available languages from admin settings (only included in GET response)
  availableLanguages?: AvailableLanguage[];
}

export interface UpdateUserSettingsInput {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  weeklyProgress?: boolean;
  studyReminders?: boolean;
  studyGoalHours?: number;
  preferredSubjects?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  autoSaveInterval?: number;
  theme?: 'light' | 'dark' | 'auto';
  fontSize?: 'small' | 'medium' | 'large';
  showHints?: boolean;
  sessionDuration?: number;
  breakDuration?: number;
  soundEffects?: boolean;
}

// User Personal Stats Types
export interface UserPersonalStats {
  totalSessions: number;
  completedSessions: number;
  totalStudyTime: number; // in seconds
  averageSessionDuration: string; // formatted string
  totalQuestionsAnswered: number;
  correctAnswers: number;
  accuracy: number; // percentage
  currentStreak: number; // days
  longestStreak: number; // days
  subjectBreakdown: SubjectStats[];
  recentActivity: RecentActivity[];
}

export interface SubjectStats {
  subject: string;
  sessionsCount: number;
  accuracy: number;
  timeSpent: number;
  level: string;
}

export interface RecentActivity {
  id: string;
  type: 'session' | 'whiteboard' | 'progress';
  title: string;
  date: Date;
  duration?: number;
}

// Progress Types
export interface Progress {
  id: string;
  userId: string;
  subject: string;
  topic: string | null;
  score: number;
  accuracy: number;
  timeSpent: number;
  questionsAttempted: number;
  questionsCorrect: number;
  questionsWrong: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProgressInput {
  subject: string;
  topic?: string;
  score: number;
  accuracy: number;
  timeSpent: number;
  questionsAttempted: number;
  questionsCorrect: number;
  questionsWrong: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
  metadata?: any;
}

export interface ProgressSummary {
  overallProgress: number;
  subjectProgress: Array<{
    subject: string;
    progress: number;
    level: string;
  }>;
  recentImprovements: string[];
  areasNeedingWork: string[];
}

// Session Types
export interface Session {
  id: string;
  userId: string;
  data: any;
  lastPoint: string | null;
  subject: string | null;
  topic: string | null;
  duration: number;
  completed: boolean;
  questionsAnswered: number;
  correctAnswers: number;
  // Enhanced tracking
  audioModeEnabled: boolean;
  textModeEnabled: boolean;
  photoUploadsCount: number;
  whiteboardSubmissions: number;
  aiInteractions: number;
  spreadingJoyActions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionInput {
  subject?: string;
  topic?: string;
  data?: any;
  lastPoint?: string;
}

export interface UpdateSessionInput {
  data?: any;
  lastPoint?: string;
  subject?: string;
  topic?: string;
  duration?: number;
  completed?: boolean;
  questionsAnswered?: number;
  correctAnswers?: number;
  audioModeEnabled?: boolean;
  textModeEnabled?: boolean;
  photoUploadsCount?: number;
  whiteboardSubmissions?: number;
  aiInteractions?: number;
  spreadingJoyActions?: number;
}

// User Activity Types
export interface UserActivity {
  id: string;
  userId: string;
  date: Date;
  studyMinutes: number;
  questionsAnswered: number;
  photoQuestions: number;
  positiveActions: number;
  aiInteractions: number;
  streakDay: number;
  starProgress: number;
  createdAt: Date;
  updatedAt: Date;
}

// Progress Metrics Types
export interface ProgressMetrics {
  currentStreak: number;
  longestStreak: number;
  totalSpreadingJoy: number;
  totalSayCheese: number;
  starProgress: number;
  todayActivity: {
    studyMinutes: number;
    questionsAnswered: number;
    photoQuestions: number;
    positiveActions: number;
  };
}

export interface SessionModeUpdate {
  audioModeEnabled?: boolean;
  textModeEnabled?: boolean;
}

export { User, UserRole };
