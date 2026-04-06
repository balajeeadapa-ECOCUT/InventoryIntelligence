import { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { storage } from "./storage";
import { signupSchema, loginSchema } from "@shared/schema";
import { z } from "zod";
import { nanoid } from "nanoid";
import { generateOtp, setOtp, verifyOtp, isOtpVerified, clearOtp } from "./otp-store";

const resend = new Resend(process.env.RESEND_API_KEY);

declare module "express-session" {
  interface SessionData {
        userId?: string;
        email?: string;
        isAuthenticated?: boolean;
  }
}

export function setupAuthRoutes(app: Express) {
    // Signup route
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
        try {
                const validatedData = signupSchema.parse(req.body);
                const existingUser = await storage.getUserByEmail(validatedData.email);
                if (existingUser) {
                          return res.status(400).json({ message: "An account with this email already exists", field: "email" });
                }
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(validatedData.password, saltRounds);
                const userId = nanoid();
                const newUser = await storage.upsertUser({
                          id: userId,
                          email: validatedData.email,
                          password: hashedPassword,
                          firstName: validatedData.firstName,
                          lastName: validatedData.lastName,
                          phone: validatedData.phone || null,
                          status: "pending",
                          role: "sales_team",
                });
                res.status(201).json({
                          message: "Account created successfully. Please wait for admin approval.",
                          user: {
                                      id: newUser.id,
                                      email: newUser.email,
                                      firstName: newUser.firstName,
                                      lastName: newUser.lastName,
                                      status: newUser.status,
                          }
                });
        } catch (error) {
                if (error instanceof z.ZodError) {
                          return res.status(400).json({ message: "Validation failed", errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) });
                }
                console.error("Signup error:", error);
                res.status(500).json({ message: "Failed to create account" });
        }
  });

  // Login route
  app.post("/api/auth/login", async (req: Request, res: Response) => {
        try {
                const validatedData = loginSchema.parse(req.body);
                const user = await storage.getUserByEmail(validatedData.email);
                if (!user) {
                          return res.status(401).json({ message: "Invalid email or password" });
                }
                if (!user.password) {
                          return res.status(401).json({ message: "Please use Replit login for this account" });
                }
                const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
                if (!isValidPassword) {
                          return res.status(401).json({ message: "Invalid email or password" });
                }
                if (user.status === "pending") {
                          return res.status(403).json({ message: "Your account is pending approval", status: "pending" });
                }
                if (user.status === "rejected") {
                          return res.status(403).json({ message: "Your account has been rejected. Please contact support.", status: "rejected" });
                }
                req.session.userId = user.id;
                req.session.email = user.email;
                req.session.isAuthenticated = true;
                res.json({
                          message: "Login successful",
                          user: {
                                      id: user.id,
                                      email: user.email,
                                      firstName: user.firstName,
                                      lastName: user.lastName,
                                      role: user.role,
                                      status: user.status,
                          }
                });
        } catch (error) {
                if (error instanceof z.ZodError) {
                          return res.status(400).json({ message: "Validation failed", errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) });
                }
                console.error("Login error:", error);
                res.status(500).json({ message: "Failed to login" });
        }
  });

  // Logout route
  app.post("/api/auth/logout", (req: Request, res: Response) => {
        req.session.destroy((err) => {
                if (err) {
                          console.error("Logout error:", err);
                          return res.status(500).json({ message: "Failed to logout" });
                }
                res.clearCookie("connect.sid");
                res.json({ message: "Logged out successfully" });
        });
  });

  // Check if email exists (GET)
  app.get("/api/auth/check-email", async (req: Request, res: Response) => {
        const email = req.query.email as string;
        if (!email) {
                return res.status(400).json({ message: "Email is required" });
        }
        const existingUser = await storage.getUserByEmail(email);
        res.json({ exists: !!existingUser });
  });

  // Step 1: Verify email exists and send OTP
  app.post("/api/auth/check-email", async (req: Request, res: Response) => {
        try {
                const { email } = req.body;
                if (!email) return res.status(400).json({ message: "Email is required" });

          const user = await storage.getUserByEmail(email);
                if (!user) return res.status(404).json({ message: "No account found with this email address" });
                if (!user.password) {
                          return res.status(400).json({ message: "This account uses Replit login. Please sign in with Replit." });
                }

          const code = generateOtp();
                setOtp(email, code);

          if (process.env.RESEND_API_KEY) {
                    const { error } = await resend.emails.send({
                                from: "EcoCut Smart Inventory <onboarding@resend.dev>",
                                to: email,
                                subject: "EcoCut Smart Inventory — Password Reset Code",
                                html: `
                                            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
                                                          <h2 style="color:#16a34a;margin-bottom:8px">Password Reset</h2>
                                                                        <p style="color:#374151">Use the verification code below to reset your EcoCut Smart Inventory password.</p>
                                                                                      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;text-align:center;margin:24px 0">
                                                                                                      <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#15803d">${code}</span>
                                                                                                                    </div>
                                                                                                                                  <p style="color:#6b7280;font-size:14px">This code expires in <strong>10 minutes</strong>. If you did not request a password reset, ignore this email.</p>
                                                                                                                                              </div>`,
                                text: `Your EcoCut password reset code is: ${code}\n\nThis code expires in 10 minutes.`,
                    });
                    if (error) {
                                console.error("Send OTP error:", error);
                                return res.status(500).json({ message: "Failed to send verification code" });
                    }
                    console.log(`[PasswordReset] OTP sent to ${email}`);
          } else {
                    console.log(`[PasswordReset] RESEND_API_KEY not configured. OTP for ${email}: ${code}`);
          }

          res.json({ message: "Verification code sent to your email" });
        } catch (error) {
                console.error("Send OTP error:", error);
                res.status(500).json({ message: "Failed to send verification code" });
        }
  });

  // Step 2: Verify the OTP code
  app.post("/api/auth/verify-reset-code", async (req: Request, res: Response) => {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ message: "Email and code are required" });
        const result = verifyOtp(email, code);
        if (result === "expired") return res.status(400).json({ message: "Code has expired. Please request a new one." });
        if (result === "invalid") return res.status(400).json({ message: "Invalid verification code. Please check and try again." });
        res.json({ message: "Code verified successfully" });
  });

  // Step 3: Reset password (requires verified OTP)
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
        try {
                const { email, newPassword } = req.body;
                if (!email || !newPassword) return res.status(400).json({ message: "Email and new password are required" });
                if (newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
                if (!isOtpVerified(email)) {
                          return res.status(403).json({ message: "Email not verified. Please complete the verification step first." });
                }
                const user = await storage.getUserByEmail(email);
                if (!user) return res.status(404).json({ message: "No account found with this email address" });
                if (!user.password) return res.status(400).json({ message: "This account uses Replit login." });
                const hashedPassword = await bcrypt.hash(newPassword, 10);
                await storage.updateUser(user.id, { password: hashedPassword });
                clearOtp(email);
                res.json({ message: "Password reset successfully" });
        } catch (error) {
                console.error("Reset password error:", error);
                res.status(500).json({ message: "Failed to reset password" });
        }
  });

  // Get current session user info
  app.get("/api/auth/session", async (req: Request, res: Response) => {
        if (!req.session.userId) {
                return res.status(401).json({ message: "Not authenticated" });
        }
        const user = await storage.getUser(req.session.userId);
        if (!user) {
                req.session.destroy(() => {});
                return res.status(401).json({ message: "User not found" });
        }
        res.json({
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: user.status,
                isAuthenticated: req.session.isAuthenticated,
        });
  });
}
