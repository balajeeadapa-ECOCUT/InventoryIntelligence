import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const isReplitEnvironment = !!process.env.REPLIT_DOMAINS;

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const conString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  const sessionStore = new pgStore({
    conString,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || "fallback-secret-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  if (!isReplitEnvironment) {
    // Not on Replit — skip OIDC setup
    // Password-based auth in authRoutes.ts handles all login flows

    // Stub out Replit auth routes so they redirect gracefully
    app.get("/api/login", (_req, res) => {
      res.redirect("/login");
    });
    app.get("/api/callback", (_req, res) => {
      res.redirect("/login");
    });
    app.get("/api/logout", (req, res) => {
      req.session.destroy(() => {});
      res.redirect("/login");
    });

    return;
  }

  // --- Replit OIDC setup (only when REPLIT_DOMAINS is set) ---
  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  const sessionData = req.session as any;

  // Check for email/password session authentication first
  if (sessionData?.userId && sessionData?.isAuthenticated) {
    try {
      const dbUser = await storage.getUser(sessionData.userId);
      if (dbUser) {
        if (dbUser.status !== "approved") {
          return res.status(403).json({ message: "Account pending approval" });
        }
        (req as any).user = {
          claims: { sub: dbUser.id },
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role || "sales_team",
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
        };
        return next();
      }
    } catch (error) {
      console.error("Error fetching user for email/password auth:", error);
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  // If not on Replit, only session-based auth is supported
  if (!isReplitEnvironment) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Fall back to Replit OIDC authentication
  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > user.expires_at) {
    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  // Fetch user role from database and check approval status
  try {
    const userId = user.claims?.sub;
    if (userId) {
      const dbUser = await storage.getUser(userId);
      if (dbUser) {
        if (dbUser.status !== "approved") {
          return res.status(403).json({ message: "Account pending approval" });
        }
        user.id = dbUser.id;
        user.email = dbUser.email;
        user.role = dbUser.role || "sales_team";
        user.firstName = dbUser.firstName;
        user.lastName = dbUser.lastName;
      }
    }
  } catch (error) {
    console.error("Error fetching user role:", error);
  }

  return next();
};
