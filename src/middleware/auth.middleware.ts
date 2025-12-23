import { Response, NextFunction } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import logger from '../utils/logger';
export interface AuthRequests extends Request {
  user?: any;
}
// Simple authentication check - returns JSON for API

export const authenticate = async (req: any, res: Response, next: NextFunction) => {
  try {
    const auth = await req.auth?.(); // ← updated to be a function

    if (!auth || !auth.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};
// Simple authorization check
export const authorize = (...roles: UserRole[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const auth = getAuth(req);

    if (!auth.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get user from database
    let user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
    });

    // If user not found in database, auto-create from Clerk data
    if (!user) {
      logger.info(`User ${auth.userId} not found in database, auto-creating from Clerk`);

      try {
        // Fetch user data from Clerk
        const clerkUser = await clerkClient.users.getUser(auth.userId);

        // Extract user info
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        const firstName = clerkUser.firstName || null;
        const lastName = clerkUser.lastName || null;
        const role = (clerkUser.publicMetadata?.role as UserRole) || UserRole.STUDENT;
        const preferredLang = (clerkUser.publicMetadata?.preferredLang as string) || 'en';

        if (!email) {
          logger.error('Cannot create user: email not found in Clerk');
          return res.status(400).json({
            success: false,
            message: 'User email not found',
          });
        }

        // Create user in database
        user = await prisma.user.create({
          data: {
            clerkId: auth.userId,
            email,
            firstName,
            lastName,
            role,
            preferredLang,
          },
        });

        logger.info(`Successfully auto-created user ${user.id} from Clerk data`);
      } catch (error: any) {
        logger.error('Failed to auto-create user from Clerk:', error.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to create user account. Please try logging out and back in.',
        });
      }
    }

    // Check role
    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Attach user to request
    req.user = user;
    req.auth = auth as any;
    next();
  };
};
