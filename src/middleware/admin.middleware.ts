import { Request, Response, NextFunction } from 'express';
import { getAuth, createClerkClient } from '@clerk/express';

// Create Clerk client instance
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Type definitions for Clerk session claims
interface ClerkPublicMetadata {
  role?: string;
  [key: string]: any;
}

interface ClerkMetadata {
  role?: string;
  [key: string]: any;
}

/**
 * Middleware to check if user is an admin
 * Must be used after clerkMiddleware
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const auth = getAuth(req);

    if (!auth || !auth.userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - Authentication required',
      });
      return;
    }

    // Get user role - Since session claims don't include publicMetadata by default,
    // we need to fetch the user from Clerk API
    let role: string | undefined;

    try {
      const user = await clerkClient.users.getUser(auth.userId);
      role = (user.publicMetadata as any)?.role;
    } catch (error) {
      // Fallback to session claims
      const sessionClaims = auth.sessionClaims as any;
      const publicMetadata = sessionClaims?.publicMetadata || sessionClaims?.public_metadata;
      const metadata = sessionClaims?.metadata;
      role = metadata?.role || publicMetadata?.role;
    }

    if (role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Forbidden - Admin access required',
        debug: {
          currentRole: role || 'No role set',
          requiredRole: 'ADMIN',
          hint: 'Set role="ADMIN" in Clerk public metadata',
        },
      });
      return;
    }
    // User is admin, proceed
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Middleware to check if user has one of the specified roles
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = getAuth(req);

      if (!auth || !auth.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized - Authentication required',
        });
        return;
      }

      const publicMetadata = auth.sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
      const metadata = auth.sessionClaims?.metadata as ClerkMetadata | undefined;
      const role = metadata?.role || publicMetadata?.role;

      if (!allowedRoles.includes(role as string)) {
        res.status(403).json({
          success: false,
          message: `Forbidden - One of these roles required: ${allowedRoles.join(', ')}`,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
};
