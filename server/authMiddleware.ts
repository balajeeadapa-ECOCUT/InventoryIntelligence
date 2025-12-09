import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, ROLE_PERMISSIONS, UserRole } from "@shared/schema";
import { eq } from "drizzle-orm";

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        firstName?: string;
        lastName?: string;
      };
    }
  }
}

// Middleware to check if user is authenticated (handles both OIDC and email/password)
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const session = req.session as any;
    const oidcUser = req.user as any;
    
    let userId: string | null = null;
    
    // Check for email/password authentication first
    if (session?.userId && session?.isAuthenticated) {
      userId = session.userId;
    }
    // Check for OIDC (Replit Auth) - user is already attached by passport
    else if (oidcUser?.claims?.sub) {
      userId = oidcUser.claims.sub;
    }
    // Legacy passport session check
    else if (session?.passport?.user) {
      userId = session.passport.user;
    }
    
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Fetch user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check if user is approved (for email/password auth)
    if (user.status && user.status !== 'approved') {
      return res.status(403).json({ error: "Account pending approval" });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: (user.role || "sales_team") as UserRole,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

// Middleware to check if user has specific role
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Access denied. Insufficient permissions.",
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
}

// Middleware to check specific permission
export function requirePermission(permission: keyof typeof ROLE_PERMISSIONS.admin) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = req.user.role;
    const permissions = ROLE_PERMISSIONS[userRole];

    if (!permissions || !permissions[permission]) {
      return res.status(403).json({
        error: `Access denied. Permission '${permission}' required.`,
        userRole: userRole,
      });
    }

    next();
  };
}

// Helper function to check if user has permission
export function hasPermission(
  userRole: UserRole,
  permission: keyof typeof ROLE_PERMISSIONS.admin
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions ? permissions[permission] : false;
}

// Helper function to get user permissions
export function getUserPermissions(userRole: UserRole) {
  return ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.sales_team;
}

// Middleware to attach permissions to request
export function attachPermissions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.user) {
    (req as any).permissions = getUserPermissions(req.user.role);
  }
  next();
}