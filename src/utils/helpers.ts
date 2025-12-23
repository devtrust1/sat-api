import { PaginationResponse } from '../types';

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const getPagination = (page: number = 1, limit: number = 20) => {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
};

export const formatPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResponse<T> => {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

export const sanitizeUser = (user: any) => {
  if (!user) return null;
  const { clerkId, ...sanitized } = user;
  return sanitized;
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

export const isValidJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

export const isSessionExpired = (
  lastActivity: Date | string,
  timeoutMinutes: number = 30
): boolean => {
  const now = new Date();
  const diff = now.getTime() - new Date(lastActivity).getTime();
  return diff > timeoutMinutes * 60 * 1000;
};
