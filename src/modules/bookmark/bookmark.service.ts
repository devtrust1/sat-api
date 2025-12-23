import { PrismaClient } from '@prisma/client';
import { CreateBookmarkData, GetBookmarksQuery } from './bookmark.types';

const prisma = new PrismaClient();

export class BookmarkService {
  /**
   * Create a new bookmark for a user
   */
  async createBookmark(userId: string, data: CreateBookmarkData) {
    // Check if bookmark already exists for this user, resource, and session
    const existing = await prisma.bookmark.findFirst({
      where: {
        userId,
        resourceId: data.resourceId,
        sessionId: data?.metadata?.sessionId,
      },
    });

    if (existing) {
      throw new Error('Bookmark already exists for this resource in this session');
    }

    return await prisma.bookmark.create({
      data: {
        userId,
        type: data.type,
        resourceId: data.resourceId,
        title: data.title,
        sessionId: data?.metadata?.sessionId,
      },
    });
  }

  /**
   * Get all bookmarks for a user with optional filtering
   */
  async getBookmarks(userId: string, query?: GetBookmarksQuery) {
    const where: any = { userId };

    if (query?.type) {
      where.type = query.type;
    }

    const bookmarks = await prisma.bookmark.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query?.limit,
      skip: query?.offset,
      include: {
        session: {
          select: { completed: true },
        },
      },
    });

    return bookmarks.map(bookmark => ({
      ...bookmark,
      isSessionCompleted: bookmark.session?.completed ?? false,
      session: undefined,
    }));
  }

  /**
   * Get a specific bookmark by ID
   */
  async getBookmarkById(id: string, userId: string) {
    return await prisma.bookmark.findFirst({
      where: { id, userId },
    });
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(id: string, userId: string) {
    // First check if bookmark belongs to user
    const bookmark = await this.getBookmarkById(id, userId);
    if (!bookmark) {
      throw new Error('Bookmark not found or unauthorized');
    }

    return await prisma.bookmark.delete({
      where: { id },
    });
  }

  /**
   * Check if a resource is bookmarked by the user in a specific session
   */
  async checkIfBookmarked(userId: string, resourceId: string, sessionId: string): Promise<boolean> {
    const bookmark = await prisma.bookmark.findFirst({
      where: {
        userId,
        resourceId,
        sessionId,
      },
    });

    return !!bookmark;
  }

  /**
   * Get bookmark count by type
   */
  async getBookmarkCount(userId: string, type?: string): Promise<number> {
    return await prisma.bookmark.count({
      where: {
        userId,
        ...(type && { type }),
      },
    });
  }

  /**
   * Get bookmark by resource ID and session ID
   */
  async getBookmarkByResourceId(userId: string, resourceId: string, sessionId: string) {
    return await prisma.bookmark.findFirst({
      where: {
        userId,
        resourceId,
        sessionId,
      },
    });
  }
}

export const bookmarkService = new BookmarkService();
