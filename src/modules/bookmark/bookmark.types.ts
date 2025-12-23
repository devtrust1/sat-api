import { Bookmark } from '@prisma/client';

export interface CreateBookmarkData {
  type: string; // 'lesson', 'chat', 'exercise', 'whiteboard', 'tutor_response'
  resourceId: string;
  title: string;
  metadata?: any;
}

export interface BookmarkResponse extends Bookmark {
  // You can add computed fields here if needed
}

export interface GetBookmarksQuery {
  type?: string;
  limit?: number;
  offset?: number;
}

export enum BookmarkType {
  LESSON = 'lesson',
  CHAT = 'chat',
  EXERCISE = 'exercise',
  WHITEBOARD = 'whiteboard',
  TUTOR_RESPONSE = 'tutor_response',
}
