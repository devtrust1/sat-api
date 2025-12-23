import { Request } from 'express';
import { User, UserRole } from '@prisma/client';
import type { AuthObject } from '@clerk/express';

// Extend Express Request type
export interface AuthRequest extends Request {
  auth?: AuthObject;
  user?: User;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any;
}

// Whiteboard types
export interface WhiteboardContent {
  drawing?: any;
  steps?: WhiteboardStep[];
  metadata?: Record<string, any>;
}

export interface WhiteboardStep {
  step: number;
  description: string;
  content: any;
  duration: number;
}

// Memory types
export interface MemoryContent {
  [key: string]: any;
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  language?: string;
  notifications?: boolean;
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic';
  [key: string]: any;
}

// Session types
export interface SessionData {
  lastActivity?: Date;
  currentLesson?: string;
  progress?: number;
  [key: string]: any;
}

// AI Service types
export interface AIResponse {
  message: string;
  context?: Record<string, any>;
  language?: string;
  usage?: {
    tokens?: number;
  };
}

export interface AIPersonalization {
  level?: string;
  interests?: string[];
  learningStyle?: string;
}

// Translation types
export interface TranslationRequest {
  text: string;
  targetLang: string;
  sourceLang?: string;
}

// Clerk webhook types
export interface ClerkUserData {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name?: string;
  last_name?: string;
  public_metadata?: {
    role?: UserRole;
    preferredLang?: string;
    [key: string]: any;
  };
}

// Validation result
export interface ValidationResult<T = any> {
  valid: boolean;
  value?: T;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// Constants
export enum BookmarkType {
  LESSON = 'lesson',
  CHAT = 'chat',
  WHITEBOARD = 'whiteboard',
}

export enum SupportedLanguage {
  EN = 'en',
  ES = 'es',
  ZH = 'zh',
  HI = 'hi',
}

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const MESSAGES = {
  SUCCESS: 'Operation completed successfully',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
} as const;
