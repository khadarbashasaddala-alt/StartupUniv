import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import type { User } from "@shared/schema";
import { slugifyTrack, findExistingTrack, TRACK_LABEL_MAX_LENGTH } from "@shared/tracks";
// One rule for task titles, shared with the Zod schema, the client dialogs and the
// programme-plan importer, so they cannot drift apart (issue #258 — a task saved as "-").
import {
  isNoOp,
  parseCsv,
  parsePlanSheet,
  taskTitleError,
  type ProgrammePlan,
  type TeamPlanDiff,
} from "@shared/programmePlan";
import { summariseSprintClose, sprintPhase } from "@shared/sprintPhase";
import {
  completionBlockedReason,
  latestPerSubmitter,
  reviewInputError,
  summariseEvidence,
} from "@shared/evidenceReview";
import {
  RECORDING_MAX_BYTES,
  RECORDING_UPLOAD_URL_TTL_SECONDS,
  RECORDING_VIEW_URL_TTL_SECONDS,
  canDeleteRecording,
  canUploadRecording,
  canViewRecording,
  formatBytes,
  recordingFileError,
  recordingObjectKey,
} from "@shared/meetingRecording";
import { meetingLinkError, normaliseMeetingPlatform } from "@shared/meetingPlatform";
import { resolveLmsStartUrl } from "./lms";
import { randomUUID } from "crypto";
import { updateAllTeamsHealth, updateTeamHealth } from "./team-health-calculator";
import { registerTicketRoutes } from "./ticketRoutes";
import { registerChatRoutes } from "./chatRoutes";
import { registerSprintExportRoutes } from "./sprintExportRoutes";
import { registerConvexMediaRoutes } from "./convexMediaRoutes";
import { convexStorage } from "./convexStorage";
import { sql, eq, asc, and } from "drizzle-orm";
import { db } from "./db";
import {
  initKeycloakClient,
  isSSOAvailable,
  getAuthorizationUrl,
  handleCallback as handleSSOCallback,
  getLogoutUrl,
  migrateUserToKeycloak,
} from "./services/auth-service";

async function ensureTeamRoleHasFounder() {
  try {
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'team_role' AND e.enumlabel = 'Founder'
        ) THEN
          EXECUTE 'ALTER TYPE team_role ADD VALUE ''Founder''';
        END IF;
      END $$;
    `);
  } catch (error) {
    console.error("Failed to ensure team_role enum includes 'Founder' value:", error);
  }
}

function normalizeTaskAssigneeIds(assigneeIds: unknown): string[] {
  if (Array.isArray(assigneeIds)) {
    return assigneeIds.filter((id): id is string => typeof id === "string");
  }

  if (typeof assigneeIds === "string") {
    try {
      const parsed = JSON.parse(assigneeIds);
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

// Validation endpoint: check whether email/phone already exists for a role
// (validation endpoint moved inside registerRoutes where `app` is available)

// Startup DB checks can mutate the DB schema (ALTER TYPE). To avoid noisy timeouts
// and accidental schema changes in local/dev environments, run them only when
// explicitly enabled.
const shouldRunStartupDbChecks = process.env.RUN_STARTUP_DB_CHECKS === "true";

if (shouldRunStartupDbChecks) {
  void ensureTeamRoleHasFounder();
}

// Extend Express Request to include user property
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
import bcrypt from "bcryptjs";
import {
  insertUserSchema,
  insertApplicationSchema,
  insertTeamSchema,
  insertSprintSchema,
  insertTaskSchema,
  insertReviewSchema,
  insertEvidenceSchema,
  insertCohortSchema,
  insertMilestoneSchema,
  insertProblemStatementSchema,
  insertTrackSchema,
  insertOrganizationSchema,
  insertRoleAssignmentSchema,
  insertRoleSchema,
  insertSeedFundSchema,
  insertCapTableEntrySchema,
  insertStipendDisbursementSchema,
  insertInvoiceSchema,
  insertBlogPostSchema,
  insertFaqSchema,
  learnerApplicationFormSchema,
  universityApplicationFormSchema,
  corporateApplicationFormSchema,
  teamApplicationSubmissionSchema,
  applications,
  paymentInstallments,
  manualPayments,
  users,
} from "@shared/schema";

// Session middleware (simple cookie-based session)
declare module "express-session" {
  interface SessionData {
    userId?: string;
    oauth_state?: string;
    oauth_nonce?: string;
    oauth_code_verifier?: string;
    idToken?: string;
  }
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Load user and attach to request for downstream handlers
  (async () => {
    try {
      const user = await storage.getUser(req.session!.userId!);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      // Extend session expiration on every authenticated request
      // With rolling: true, accessing req.session automatically extends it
      // Explicitly save to ensure session is persisted and cookie is refreshed
      req.session.save((err) => {
        if (err) {
          console.error("Session save error in requireAuth:", err);
        }
      });
      // Attach user to request object so routes can use req.user
      (req as any).user = user;
      next();
    } catch (error: any) {
      console.error("requireAuth load user error:", error);
      return res.status(500).json({ message: "Authentication error" });
    }
  })();
}

function parseExperienceFlag(value: unknown): {
  hasSeenRolesResponsibilities: boolean;
  hasSeenSidebarTooltip: boolean;
} {
  const fallback = {
    hasSeenRolesResponsibilities: false,
    hasSeenSidebarTooltip: false,
  };

  if (!value || typeof value !== "object") return fallback;
  const data = value as Record<string, unknown>;

  return {
    hasSeenRolesResponsibilities: Boolean(data.hasSeenRolesResponsibilities),
    hasSeenSidebarTooltip: Boolean(data.hasSeenSidebarTooltip),
  };
}

function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(403).json({ message: "Forbidden" });
      }
      // Allow if user has required role
      if (roles.includes(user.role)) {
        (req as any).user = user;
        return next();
      }
      return res.status(403).json({ message: "Forbidden" });
    } catch (error: any) {
      console.error("requireRole middleware error:", error);
      return res.status(500).json({
        message: "Authentication error"
      });
    }
  };
}

/**
 * Attaches each cohort's planned headcount per role as `composition`, keyed by role code,
 * so clients can render a field per role instead of four fixed ones.
 */
async function withCompositions<T extends { id: string }>(cohortRows: T[]) {
  const byCohort = await storage.getCohortCompositions(cohortRows.map((c) => c.id));
  return cohortRows.map((cohort) => ({
    ...cohort,
    composition: byCohort[cohort.id] ?? {},
  }));
}

/**
 * Reads a composition map off a request body, dropping entries that are not a non-negative
 * number and rejecting role codes that are not registered — the latter would otherwise
 * surface as a foreign key violation rather than a useful message.
 *
 * `counts` is undefined when the client sent no map at all, which callers treat as "leave
 * the existing counts alone".
 */
async function readComposition(
  raw: unknown
): Promise<{ counts?: Record<string, number>; error?: string }> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "composition must be an object keyed by role code" };
  }

  const counts: Record<string, number> = {};
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    const count = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(count) || count < 0) continue;
    counts[code] = Math.trunc(count);
  }

  const known = new Set((await storage.getRoles()).map((role) => role.code));
  const unknown = Object.keys(counts).filter((code) => !known.has(code));
  if (unknown.length > 0) {
    return { error: `Unknown role${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}` };
  }

  return { counts };
}

// Helper: check whether a contact (email or phone) already exists for a given application role
async function checkContactDupes(role?: string | null, email?: string | null, phone?: string | null) {
  try {
    const normalizedEmail = (email || "").toLowerCase().trim();
    const normalizedPhone = phone || "";

    // Build SQL conditions to compare JSON fields inside applications.form_json
    // Email comparison: case-insensitive trimmed equality
    // Phone comparison: compare only digits (strip non-digits)
    // Check email in common JSON fields; fallback to searching JSON text if needed
    const emailCond = normalizedEmail
      ? sql`(
          LOWER(TRIM((applications.form_json->>'email'))) = LOWER(${normalizedEmail})
          OR LOWER(TRIM((applications.form_json->>'applicantEmail'))) = LOWER(${normalizedEmail})
          OR LOWER(TRIM((applications.form_json->>'senderEmail'))) = LOWER(${normalizedEmail})
          OR LOWER(TRIM((applications.form_json->>'team_leader_email'))) = LOWER(${normalizedEmail})
          OR LOWER(TRIM((applications.form_json->>'leaderEmail'))) = LOWER(${normalizedEmail})
          OR LOWER(applications.form_json::text) LIKE CONCAT('%', LOWER(${normalizedEmail}), '%')
        )`
      : sql`false`;

    const phoneCond = normalizedPhone
      ? sql`regexp_replace((applications.form_json->>'phone')::text, '\\D', '', 'g') = regexp_replace(${normalizedPhone}::text, '\\D', '', 'g')`
      : sql`false`;

    // Both email and phone should be checked globally (regardless of application type).
    // Build WHERE as: (emailCond) OR (phoneCond)
    const whereClause = sql`(${emailCond}) OR (${phoneCond})`;

    const found = await db.select().from(applications).where(whereClause).limit(1);

    let emailExists = false;
    let phoneExists = false;

    if (found && found.length > 0) {
      const f = found[0];
      const form = (f.formJson || {}) as any;

      // Email: check multiple possible keys and also fallback to JSON text
      if (email && normalizedEmail !== "") {
        const keysToCheck = [
          "email",
          "applicantEmail",
          "senderEmail",
          "team_leader_email",
          "leaderEmail",
          "applicant_email",
        ];
        for (const k of keysToCheck) {
          if (form && typeof form[k] === "string") {
            if (form[k].toLowerCase().trim() === normalizedEmail) {
              emailExists = true;
              break;
            }
          }
        }
        if (!emailExists) {
          try {
            const text = JSON.stringify(form).toLowerCase();
            if (text.includes(normalizedEmail)) {
              emailExists = true;
            }
          } catch (e) {
            // ignore
          }
        }
      }

      // Phone: check common keys and compare digits-only
      if (phone && normalizedPhone !== "") {
        const phoneKeys = ["phone", "contactNumber", "contact_number", "contact", "phoneNumber"];
        const b = (normalizedPhone || "").replace(/\D/g, "");
        for (const k of phoneKeys) {
          if (form && typeof form[k] === "string") {
            const a = (form[k] || "").replace(/\D/g, "");
            if (a === b && b !== "") {
              phoneExists = true;
              break;
            }
          }
        }
      }
    }

    return { emailExists, phoneExists };
  } catch (error) {
    console.error("checkContactDupes error:", error);
    return { emailExists: false, phoneExists: false };
  }
}

// Middleware that strictly requires ADMIN role
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return (async () => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin privileges required" });
    }
    next();
  })();
}

// Helper to validate request body
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      next(error);
    }
  };
}

// Cap table generation logic
function generateCapTable(teamId: string, members: { userId: string; role: string; name: string }[]) {
  const entries: { teamId: string; userId?: string; label: string; percent: string; cashAmount: string }[] = [];

  // Default equity split for 10L seed fund
  // StartupUniv: 10%, ESOP Pool: 10%, Founders: 80%
  entries.push({
    teamId,
    label: "StartupUniv",
    percent: "10.00",
    cashAmount: "100000", // 10% of 10L
  });

  entries.push({
    teamId,
    label: "ESOP Pool",
    percent: "10.00",
    cashAmount: "0",
  });

  // Distribute 80% among team members
  const promoters = members.filter(m => m.role === "Promoter" || m.role === "Founder");
  const coPromoters = members.filter(m => m.role === "CoPromoter");
  const regularMembers = members.filter(m => m.role === "Member");

  let remainingPercent = 80;

  // Promoter gets 35%
  promoters.forEach((p, i) => {
    const pct = Math.floor(35 / promoters.length);
    entries.push({
      teamId,
      userId: p.userId,
      label: `Promoter - ${p.name}`,
      percent: pct.toFixed(2),
      cashAmount: "0",
    });
    remainingPercent -= pct;
  });

  // Co-Promoters split 25%
  coPromoters.forEach((p, i) => {
    const pct = Math.floor(25 / Math.max(coPromoters.length, 1));
    entries.push({
      teamId,
      userId: p.userId,
      label: `Co-Promoter - ${p.name}`,
      percent: pct.toFixed(2),
      cashAmount: "0",
    });
    remainingPercent -= pct;
  });

  // Remaining goes to members
  regularMembers.forEach((m, i) => {
    const pct = Math.floor(remainingPercent / Math.max(regularMembers.length, 1));
    entries.push({
      teamId,
      userId: m.userId,
      label: `Member - ${m.name}`,
      percent: pct.toFixed(2),
      cashAmount: "0",
    });
  });

  return entries;
}

// Helper function to auto-close all applications when a user joins a team
// Called after createRoleAssignment succeeds
async function autoCloseApplicationsOnTeamAssignment(userId: string): Promise<void> {
  try {
    const user = await storage.getUser(userId);
    if (!user) return;

    // Skip for founders - they manage teams, don't join them this way
    if (user.role === 'FOUNDER') return;

    // For mentors: only close when they reach max (2) teams
    if (user.role === 'MENTOR') {
      const assignments = await storage.getRoleAssignmentsByUser(userId);
      const mentorAssignments = assignments.filter(a => a.role === "Mentor" || a.role === "Promoter");
      if (mentorAssignments.length < 2) return; // Still has slots, don't close
    }

    // Close all applications for COFOUNDER, LEARNER, or MENTOR at max capacity
    const result = await storage.closeAllApplicationsForUser(userId);
    console.log(`🔒 Auto-closed applications for ${user.email}: ${result.teamMemberAppsClosed} team-member, ${result.problemStatementAppsClosed} problem-statement`);
  } catch (error) {
    console.error(`❌ Error auto-closing applications for user ${userId}:`, error);
    // Don't throw - this is a cleanup operation, shouldn't fail the main request
  }
}

// Stipend calculation per Business Plan v2
const STIPEND_BANDS = {
  A: 25000, // Promoter: ₹25k/month
  B: 20000, // Co-Promoter: ₹20k/month
  C: 10000, // Member: ₹10k/month
};

// Shared function to calculate fee by application type and plan
// FOUNDER: Premium only (₹5,00,000)
// COFOUNDER: Premium only (₹3,00,000)
// LEARNER: Basic (₹1,00,000) or Premium (₹1,50,000) based on plan
// PROFESSIONAL: ₹1,50,000
function getFeeByType(type: string, plan?: string): number {
  switch (type) {
    case "LEARNER":
      return plan === "premium" ? 150000 : 100000;
    case "PROFESSIONAL":
      return 150000;
    case "FOUNDER":
      return 500000; // Premium only
    case "COFOUNDER":
      return 300000; // Premium only
    default:
      return 100000;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Store reference to app for raw body parsing in specific routes
  const expressApp = app;

  // Ticketing module lives in its own file to keep this one navigable
  registerTicketRoutes(app, { requireAuth, requireRole });

  // Team chat REST surface; real-time delivery lives in chatSocket.ts
  registerChatRoutes(app, { requireAuth });

  // Completed-sprint export (record + attachments) lives in its own file.
  // isTeamMemberOrAdmin is a hoisted declaration below, passed in so the export
  // routes scope to a team the same way the other sprint endpoints do.
  registerSprintExportRoutes(app, { requireRole, isTeamMemberOrAdmin });

  // File/image/video storage backed by Convex. Registered alongside the S3
  // paths rather than replacing them, so features can move across one at a
  // time. Skipped entirely when the deployment is not configured, which keeps
  // environments without CONVEX_URL booting exactly as before.
  if (convexStorage.isConfigured()) {
    registerConvexMediaRoutes(app, { requireAuth });
  } else {
    console.warn(
      "Convex media routes disabled: set CONVEX_URL and CONVEX_SERVICE_SECRET to enable them",
    );
  }

  // Validation endpoint: check whether email/phone already exists for a role
  app.post("/api/applications/validate-contact", async (req, res) => {
    try {
      const { email, phone } = req.body || {};
      const dup = await checkContactDupes(undefined, email || null, phone || null);
      return res.json({ emailExists: dup.emailExists, phoneExists: dup.phoneExists });
    } catch (error: any) {
      console.error("validate-contact error:", error);
      return res.status(500).json({ message: "Validation failed" });
    }
  });

  // Public config: payment portal URL for Razorpay (must be rooman.net subdomain when deployed)
  app.get("/api/config", (_req, res) => {
    const paymentPortalUrl = (process.env.PAYMENT_PORTAL_URL || process.env.PORTAL_URL || "http://localhost:5000").replace(/\/$/, "");
    res.json({ paymentPortalUrl });
  });

  // Note: Health check route is now registered in server/index.ts BEFORE this function
  // to ensure it's available even if database connection fails

  // =====================
  // Auth Routes
  // =====================

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Normalize email to lowercase for case-insensitive lookup
      const normalizedEmail = email?.toLowerCase().trim();
      
      console.log("🔐 Login attempt:", { email, normalizedEmail, hasPassword: !!password });
      
      if (!normalizedEmail || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      let user;
      try {
        user = await storage.getUserByEmail(normalizedEmail);
        console.log("👤 User lookup result:", { found: !!user, hasPassword: !!user?.password, role: user?.role });
      } catch (dbError: any) {
        console.error("❌ Database error during user lookup:", {
          message: dbError?.message,
          code: dbError?.code,
          detail: dbError?.detail,
          stack: dbError?.stack
        });
        throw dbError; // Re-throw to be caught by outer catch
      }

      if (!user || !user.password) {
        console.log(`❌ Login failed for ${normalizedEmail}: User not found or no password set`);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      let valid = false;
      try {
        valid = await bcrypt.compare(password, user.password);
      } catch (bcryptErr: any) {
        console.error("❌ bcrypt.compare error:", bcryptErr?.message);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (!valid) {
        console.log(`❌ Login failed for ${normalizedEmail}: Password mismatch`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const [authState] = await db
        .select({
          firstTimeLogin: users.firstTimeLogin,
          experienceFlag: users.experienceFlag,
        })
        .from(users)
        .where(eq(users.id, user.id));

      if (authState?.firstTimeLogin) {
        await db
          .update(users)
          .set({ firstTimeLogin: false })
          .where(eq(users.id, user.id));
      }

      const experienceFlags = parseExperienceFlag(authState?.experienceFlag);

      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.json({
          user: {
            ...user,
            firstTimeLogin: false,
            experienceFlag: experienceFlags,
            password: undefined,
          },
        });
      });
    } catch (error) {
      if (res.headersSent) return;
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("❌ Login error:", err.message);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out" });
    });
  });

  // =====================
  // LMS Routes (Moodle)
  // =====================
  // Browser endpoint: redirects user into Moodle's OAuth2/OIDC login entry.
  // Intentionally a redirect (not JSON) because it's triggered by a UI click.
  app.get("/api/lms/start", (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.redirect("/login");
      }

      // Always resolves to something now. None of the MOODLE_* variables are passed to the
      // production container, so this used to answer 500 "Moodle is not configured" on every
      // click and the button looked broken. See server/lms.ts for the precedence.
      return res.redirect(resolveLmsStartUrl());
    } catch (error) {
      console.error("LMS start redirect error:", error);
      return res.status(500).send("Failed to redirect to LMS");
    }
  });

  // =====================
  // SSO Routes (Keycloak)
  // =====================

  // Check if SSO is available
  app.get("/api/auth/sso/status", async (_req, res) => {
    if (process.env.ENABLE_SSO === "true") {
      try {
        // Keycloak may start after our server; attempt lazy init.
        await initKeycloakClient();
      } catch {
        // Ignore init errors; we only report availability.
      }
    }

    res.json({
      available: isSSOAvailable(),
      enabled: process.env.ENABLE_SSO === "true",
    });
  });

  // SSO Login - Redirect to Keycloak
  app.get("/api/auth/sso/login", async (req, res) => {
    if (!isSSOAvailable() && process.env.ENABLE_SSO === "true") {
      try {
        await initKeycloakClient();
      } catch {
        // no-op
      }
    }

    if (!isSSOAvailable()) {
      return res.status(503).json({
        message: "SSO is not available. Please use regular login.",
      });
    }

    try {
      // Generate state and nonce for security
      const state = randomUUID();
      const nonce = randomUUID();

      // Store in session for validation
      req.session.oauth_state = state;
      req.session.oauth_nonce = nonce;

      // Get authorization URL and code verifier
      const { url: authUrl, codeVerifier } = getAuthorizationUrl(state, nonce);
      
      // Store code verifier in session for callback
      req.session.oauth_code_verifier = codeVerifier;

      // Redirect to Keycloak
      res.redirect(authUrl);
    } catch (error) {
      console.error("SSO login error:", error);
      res.status(500).json({
        message: "Failed to initiate SSO login",
      });
    }
  });

  // SSO Callback - Handle Keycloak response
  app.get("/api/auth/callback", async (req, res) => {
    if (!isSSOAvailable()) {
      return res.redirect("/?error=sso_unavailable");
    }

    try {
      const { code, state, error, error_description } = req.query;

      // Check for OAuth errors
      if (error) {
        console.error("SSO OAuth error:", error, error_description);
        return res.redirect(`/?error=${error}&error_description=${encodeURIComponent(error_description as string || '')}`);
      }

      if (!code || !state) {
        return res.redirect("/?error=missing_parameters");
      }

      // Validate state parameter
      if (state !== req.session.oauth_state) {
        console.error("SSO state mismatch");
        return res.redirect("/?error=invalid_state");
      }

      const nonce = req.session.oauth_nonce;
      if (!nonce) {
        return res.redirect("/?error=missing_nonce");
      }

      const codeVerifier = req.session.oauth_code_verifier;
      if (!codeVerifier) {
        return res.redirect("/?error=missing_code_verifier");
      }

      // Exchange code for tokens and get user
      const result = await handleSSOCallback(code as string, state as string, nonce, codeVerifier);

      if (!result || !result.user) {
        return res.redirect("/?error=authentication_failed");
      }

      const { user, tokens } = result;

      // Set session
      req.session.userId = user.id;
      req.session.idToken = tokens.id_token; // Store for logout

      // Clear OAuth state
      delete req.session.oauth_state;
      delete req.session.oauth_nonce;
      delete req.session.oauth_code_verifier;

      console.log(`✅ SSO login successful for ${user.email}`);

      // Redirect to app dashboard after successful SSO login
      res.redirect("/app");
    } catch (error) {
      console.error("SSO callback error:", error);
      res.redirect("/?error=callback_failed");
    }
  });

  // SSO Logout - Single Sign-Out
  app.post("/api/auth/sso/logout", async (req, res) => {
    try {
      const idToken = req.session.idToken;

      // Destroy local session
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err);
        }
      });

      // If user has ID token, redirect to Keycloak logout
      if (idToken && isSSOAvailable()) {
        const logoutUrl = getLogoutUrl(
          idToken,
          process.env.APP_URL || "http://localhost:5000"
        );
        res.json({ logoutUrl });
      } else {
        res.json({ success: true });
      }
    } catch (error) {
      console.error("SSO logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Migrate existing user to Keycloak (optional endpoint for admins)
  app.post("/api/auth/sso/migrate-user", requireAuth, async (req, res) => {
    try {
      const { userId, password } = req.body;

      if (!userId || !password) {
        return res.status(400).json({
          message: "User ID and password are required",
        });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.keycloakId) {
        return res.status(400).json({
          message: "User already migrated to SSO",
        });
      }

      const keycloakId = await migrateUserToKeycloak(user, password);

      if (keycloakId) {
        res.json({
          success: true,
          message: "User migrated to SSO successfully",
          keycloakId,
        });
      } else {
        res.status(500).json({
          message: "Failed to migrate user to SSO",
        });
      }
    } catch (error) {
      console.error("User migration error:", error);
      res.status(500).json({ message: "Migration failed" });
    }
  });

  // Forgot Password - Send OTP
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({ message: "If the email exists, an OTP has been sent" });
      }

      // Clean up expired OTPs
      await storage.deleteExpiredOtps();

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = await bcrypt.hash(otp, 10);

      // Set expiry to 10 minutes from now
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      // Create OTP record
      await storage.createPasswordResetOtp({
        email,
        otp: otp, // Store plain OTP for email (will be hashed in DB)
        hashedOtp,
        attempts: 0,
        expiresAt,
        verified: false,
      });

      // Send OTP email
      try {
        const { sendPasswordResetOtpEmail } = await import("./services/email-service");
        await sendPasswordResetOtpEmail(email, otp);
        console.log(`✅ OTP email sent successfully to ${email}`);
        
        // In development/debug mode, also log OTP to console
        if (process.env.DEBUG_OTP === "true" || process.env.NODE_ENV !== "production") {
          console.log(`\n🔧 ========================================`);
          console.log(`🔧 DEBUG MODE: OTP Generated`);
          console.log(`🔧 Email: ${email}`);
          console.log(`🔧 OTP: ${otp}`);
          console.log(`🔧 Valid for 10 minutes`);
          console.log(`🔧 ========================================\n`);
        }
      } catch (emailError: any) {
        console.error("\n❌ ========================================");
        console.error("❌ ERROR SENDING OTP EMAIL");
        console.error("❌ ========================================");
        console.error("Email:", email);
        console.error("OTP:", otp);
        console.error("Error message:", emailError?.message);
        console.error("Error code:", emailError?.code);
        console.error("Status code:", emailError?.response?.statusCode);
        console.error("Response body:", JSON.stringify(emailError?.response?.body, null, 2));
        console.error("Full error:", emailError);
        console.error("❌ ========================================\n");
        
        // Always log OTP in console when email fails (for debugging)
        console.log(`\n🔧 ========================================`);
        console.log(`🔧 OTP GENERATED (Email sending failed)`);
        console.log(`🔧 Email: ${email}`);
        console.log(`🔧 OTP: ${otp}`);
        console.log(`🔧 Valid for 10 minutes`);
        console.log(`🔧 Use this OTP to verify: ${otp}`);
        console.log(`🔧 ========================================\n`);
        
        // Check if SendGrid API key is missing
        const sendGridApiKey = process.env.SENDGRID_API_KEY || process.env.EMAIL_HOST_PASSWORD;
        if (!sendGridApiKey) {
          console.error("\n⚠️  ========================================");
          console.error("⚠️  SENDGRID API KEY NOT CONFIGURED!");
          console.error("⚠️  ========================================");
          console.error("Set SENDGRID_API_KEY or EMAIL_HOST_PASSWORD environment variable");
          console.error("⚠️  ========================================\n");
        }
        
        // Still return success to user for security, but log the error
      }

      // Don't reveal if user exists or not for security
      res.json({ message: "If the email exists, an OTP has been sent" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Verify OTP
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }

      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        return res.status(400).json({ message: "OTP must be a 6-digit number" });
      }

      // Get the most recent unverified OTP for this email
      const otpRecord = await storage.getPasswordResetOtpByEmail(email);

      if (!otpRecord) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      // Check if OTP has expired
      if (new Date(otpRecord.expiresAt) < new Date()) {
        return res.status(400).json({ message: "OTP has expired. Please request a new one." });
      }

      // Check if already verified
      if (otpRecord.verified) {
        return res.status(400).json({ message: "OTP has already been used" });
      }

      // Check attempt limit (max 5 attempts)
      if (otpRecord.attempts >= 5) {
        return res.status(400).json({ message: "Too many attempts. Please request a new OTP." });
      }

      // Verify OTP
      const isValid = await bcrypt.compare(otp, otpRecord.hashedOtp);

      if (!isValid) {
        // Increment attempts
        await storage.updatePasswordResetOtp(otpRecord.id, {
          attempts: otpRecord.attempts + 1,
        });
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // Mark OTP as verified
      const updatedOtp = await storage.updatePasswordResetOtp(otpRecord.id, {
        verified: true,
      });

      if (!updatedOtp) {
        console.error(`❌ Failed to update OTP verification status for ${email}`);
        return res.status(500).json({ message: "Failed to verify OTP. Please try again." });
      }

      console.log(`✅ OTP verified successfully for ${email}, OTP ID: ${otpRecord.id}, verified: ${updatedOtp.verified}`);
      res.json({ message: "OTP verified successfully" });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  // Reset Password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;

      if (!email || !otp || !newPassword) {
        return res.status(400).json({ message: "Email, OTP, and new password are required" });
      }

      // Password policy: min 8, at least one number and one special char
      if (newPassword.length < 8 || !/\d/.test(newPassword) || !/[^\w\s]/.test(newPassword)) {
        return res.status(400).json({
          message: "Password must be at least 8 characters, include a number and a special character"
        });
      }

      // Get the verified OTP record for this email
      // We need to query for verified OTPs, not unverified ones
      const { db } = await import("./db");
      const { passwordResetOtps } = await import("@shared/schema");
      const { eq, and, desc, gte, sql } = await import("drizzle-orm");

      console.log(`🔍 Looking for verified OTP for ${email}`);

      // Debug: Check all OTPs for this email
      const allOtps = await db
        .select()
        .from(passwordResetOtps)
        .where(eq(passwordResetOtps.email, email))
        .orderBy(desc(passwordResetOtps.createdAt));

      console.log(`📋 Found ${allOtps.length} OTP record(s) for ${email}:`,
        allOtps.map(o => ({ id: o.id, verified: o.verified, expiresAt: o.expiresAt, createdAt: o.createdAt })));

      // Query for verified OTPs (check expiration separately for better error messages)
      const [otpRecord] = await db
        .select()
        .from(passwordResetOtps)
        .where(and(
          eq(passwordResetOtps.email, email),
          eq(passwordResetOtps.verified, true)
        ))
        .orderBy(desc(passwordResetOtps.createdAt))
        .limit(1);

      if (!otpRecord) {
        console.error(`❌ Reset password failed for ${email}: No verified OTP found`);
        // Check if there's an unverified OTP to give a better error message
        const unverifiedOtp = await storage.getPasswordResetOtpByEmail(email);
        if (unverifiedOtp) {
          console.log(`⚠️  Found unverified OTP for ${email}, user needs to verify first`);
          return res.status(400).json({ message: "OTP not verified. Please verify OTP first." });
        }
        console.log(`⚠️  No OTP found at all for ${email}`);
        return res.status(400).json({ message: "OTP not verified or expired. Please request a new OTP." });
      }

      console.log(`✅ Found verified OTP for ${email}, OTP ID: ${otpRecord.id}, verified: ${otpRecord.verified}, expiresAt: ${otpRecord.expiresAt}`);

      // Check if OTP has expired (do this check after finding the record)
      if (new Date(otpRecord.expiresAt) < new Date()) {
        console.error(`❌ OTP expired for ${email}, expiresAt: ${otpRecord.expiresAt}, now: ${new Date()}`);
        return res.status(400).json({ message: "OTP has expired. Please request a new one." });
      }

      console.log(`✅ Verified OTP is valid and not expired for ${email}, proceeding with password reset`);

      // Verify OTP again (double check)
      const isValid = await bcrypt.compare(otp, otpRecord.hashedOtp);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // Check if OTP has expired
      if (new Date(otpRecord.expiresAt) < new Date()) {
        return res.status(400).json({ message: "OTP has expired. Please request a new one." });
      }

      // Get user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password
      await storage.updateUser(user.id, { password: hashedPassword });

      // Mark OTP as used (already verified, but we can delete it or mark it)
      // For security, we could delete the OTP record, but keeping it for audit

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Extend session expiration on auth check - this keeps the session alive
      // With rolling: true, accessing req.session automatically extends it
      // Explicitly save to ensure session is persisted and cookie is refreshed
      req.session.save((err) => {
        if (err) {
          console.error("Session save error in /api/auth/me:", err);
        }
      });

      // Get preferredTrack from appropriate table based on role
      let preferredTrack: string | null = null;
      try {
        if (user.role === "MENTOR") {
          // For mentors, fetch from mentor_profiles table
          const mentorProfile = await storage.getMentorProfileByUserId(user.id);
          if (mentorProfile?.tracksJson) {
            const tracks = mentorProfile.tracksJson as string[];
            // Use the first track for auto-fill (mentors can still change it in the UI)
            preferredTrack = tracks.length > 0 ? tracks[0] : null;
          }
        } else {
          // For founders, cofounders, learners - fetch from this user's applications
          const userApplications = await storage.getApplicationsByUser(user.id);
          const latestApplication = userApplications.length > 0 ? userApplications[0] : null;

          if (latestApplication?.formJson) {
            let formData: any = null;

            // formJson may be stored as a JSON string or as an object depending on DB/driver
            if (typeof latestApplication.formJson === "string") {
              try {
                formData = JSON.parse(latestApplication.formJson);
              } catch (e) {
                // Fall back to raw value if parsing fails
                formData = latestApplication.formJson;
              }
            } else {
              formData = latestApplication.formJson;
            }

            if (formData && typeof formData === "object") {
              // Try multiple field names for backwards compatibility
              const directPreferredTrack =
                formData.preferredTrack ||
                (Array.isArray(formData.preferredTracks) && formData.preferredTracks.length > 0
                  ? formData.preferredTracks[0]
                  : null) ||
                formData.track ||
                formData.sector ||
                null;

              preferredTrack = directPreferredTrack || null;
            }
          }
        }
      } catch (error) {
        console.warn("Error fetching preferredTrack:", error);
      }

      res.json({ user: { ...user, password: undefined, preferredTrack } });
    } catch (error: any) {
      // If an unexpected error occurs (database connection, session store failure),
      // return 500 instead of 401 so the frontend doesn't treat it as "not logged in"
      console.error("❌ Error in /api/auth/me:", error?.message || error);
      res.status(500).json({ message: "Internal server error checking session" });
    }
  });

  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { name, phone, avatarUrl } = req.body;

      const updateData: { name?: string; phone?: string | undefined; avatarUrl?: string } = {};
      if (name && typeof name === "string") {
        updateData.name = name.trim();
      }
      if (phone !== undefined) {
        updateData.phone = phone ? String(phone).trim() : undefined;
      }
      if (avatarUrl && typeof avatarUrl === "string") {
        updateData.avatarUrl = avatarUrl.trim();
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const updated = await storage.updateUser(userId, updateData);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ user: { ...updated, password: undefined } });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/auth/experience-flags", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const [row] = await db
        .select({
          firstTimeLogin: users.firstTimeLogin,
          experienceFlag: users.experienceFlag,
        })
        .from(users)
        .where(eq(users.id, userId));

      const flags = parseExperienceFlag(row?.experienceFlag);

      return res.json({
        firstTimeLogin: row?.firstTimeLogin ?? false,
        hasSeenRolesResponsibilities: flags.hasSeenRolesResponsibilities,
        hasSeenSidebarTooltip: flags.hasSeenSidebarTooltip,
      });
    } catch (error: any) {
      console.error("Get experience flags error:", error);
      return res.status(500).json({ message: "Failed to fetch experience flags" });
    }
  });

  app.patch("/api/auth/experience-flags", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const schema = z.object({
        hasSeenRolesResponsibilities: z.boolean().optional(),
        hasSeenSidebarTooltip: z.boolean().optional(),
      });

      const parsed = schema.parse(req.body ?? {});
      if (
        parsed.hasSeenRolesResponsibilities === undefined &&
        parsed.hasSeenSidebarTooltip === undefined
      ) {
        return res.status(400).json({ message: "No valid experience flag fields to update" });
      }

      const [current] = await db
        .select({
          firstTimeLogin: users.firstTimeLogin,
          experienceFlag: users.experienceFlag,
        })
        .from(users)
        .where(eq(users.id, userId));

      const currentFlags = parseExperienceFlag(current?.experienceFlag);
      const mergedFlags = {
        hasSeenRolesResponsibilities:
          parsed.hasSeenRolesResponsibilities ?? currentFlags.hasSeenRolesResponsibilities,
        hasSeenSidebarTooltip:
          parsed.hasSeenSidebarTooltip ?? currentFlags.hasSeenSidebarTooltip,
      };

      const [saved] = await db
        .update(users)
        .set({ experienceFlag: mergedFlags })
        .where(eq(users.id, userId))
        .returning({
          firstTimeLogin: users.firstTimeLogin,
          experienceFlag: users.experienceFlag,
        });

      const savedFlags = parseExperienceFlag(saved?.experienceFlag);

      return res.json({
        firstTimeLogin: saved?.firstTimeLogin ?? false,
        hasSeenRolesResponsibilities: savedFlags.hasSeenRolesResponsibilities,
        hasSeenSidebarTooltip: savedFlags.hasSeenSidebarTooltip,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Update experience flags error:", error);
      return res.status(500).json({ message: "Failed to update experience flags" });
    }
  });

  // =====================
  // User Routes
  // =====================

  app.get("/api/users", requireRole("ADMIN"), async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users.map(u => ({ ...u, password: undefined })));
    } catch (error: any) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Debug endpoint to check users (for development only)
  app.get("/api/debug/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const usersWithPasswordInfo = allUsers.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        hasPassword: !!u.password,
        createdAt: u.createdAt,
        // Removed passwordPreview and passwordLength for security
      }));
      res.json({
        count: allUsers.length,
        users: usersWithPasswordInfo
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get users by role for team member selection (Founders only)
  // Get founder's preferred track for team filtering
  app.get("/api/founder/track", requireRole("FOUNDER", "COFOUNDER"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const applications = await storage.getApplicationsByUser(userId);
      const latestApplication = applications.length > 0 ? applications[0] : null;
      const formJson = latestApplication?.formJson as any || {};

      const preferredTrack = formJson.preferredTrack || formJson.track || formJson.sector || null;

      res.json({ preferredTrack });
    } catch (error: any) {
      console.error("Error fetching founder track:", error);
      res.status(500).json({ message: "Failed to fetch founder track" });
    }
  });

  // Get current team composition and limits
  app.get("/api/founder/team-composition", requireRole("FOUNDER", "COFOUNDER"), async (req, res) => {
    try {
      const founderId = req.session!.userId!;

      // Get the founder's team
      const founderAssignments = await storage.getRoleAssignmentsByUser(founderId);
      console.log(`[Team Composition] Founder ${founderId} has ${founderAssignments.length} assignments`);
      
      if (founderAssignments.length === 0) {
        // No team yet, return empty composition
        console.log(`[Team Composition] No team found for founder, returning zeros`);
        return res.json({
          composition: {
            cofounder: { current: 0, max: 2 },
            mentor: { current: 0, max: 1 },
            learner: { current: 0, max: 6 }
          },
          total: { current: 1, max: 10 } // Just the founder
        });
      }

      // Get actual team members from role assignments
      const teamId = founderAssignments[0].teamId;
      const teamMembers = await storage.getRoleAssignmentsByTeam(teamId);
      console.log(`[Team Composition] Team ${teamId} has ${teamMembers.length} members:`);
      teamMembers.forEach(m => console.log(`  - userId: ${m.userId}, role: ${m.role}`));

      // Count by role (based on actual team assignments, not applications)
      // Exclude the founder from counts - they are counted separately
      const composition = {
        cofounder: {
          current: teamMembers.filter(m => m.role === "CoPromoter").length,
          max: 2
        },
        mentor: {
          current: teamMembers.filter(m => m.role === "Mentor").length,
          max: 1
        },
        learner: {
          current: teamMembers.filter(m => m.role === "Member").length,
          max: 6
        }
      };

      console.log(`[Team Composition] Counts - CoPromoter: ${composition.cofounder.current}, Mentor: ${composition.mentor.current}, Member: ${composition.learner.current}`);

      const totalCurrent = composition.cofounder.current + composition.mentor.current + composition.learner.current + 1; // +1 for founder
      const totalMax = composition.cofounder.max + composition.mentor.max + composition.learner.max + 1; // +1 for founder

      res.json({
        composition,
        total: {
          current: totalCurrent,
          max: totalMax
        }
      });
    } catch (error: any) {
      console.error("Error fetching team composition:", error);
      res.status(500).json({ message: "Failed to fetch team composition" });
    }
  });

  // Founder's own published problem statements (for linking to team when creating team)
  app.get("/api/founder/my-published-problem-statements", requireRole("FOUNDER"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const statements = await storage.getProblemStatements({ status: "PUBLISHED", createdBy: userId });
      res.json(statements);
    } catch (error: any) {
      console.error("Error fetching founder problem statements:", error);
      res.status(500).json({ message: "Failed to fetch problem statements" });
    }
  });

  app.get("/api/team-members/:role", requireRole("FOUNDER", "COFOUNDER", "LEARNER"), async (req, res) => {
    try {
      const role = req.params.role.toUpperCase();
      const sector = (req.query.sector || req.query.interestedTech || req.query.track) as string | undefined;
      const currentUserId = req.session!.userId!;
      const currentUser = await storage.getUser(currentUserId);
      
      if (!["COFOUNDER", "MENTOR", "LEARNER", "FOUNDER"].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be COFOUNDER, MENTOR, LEARNER, or FOUNDER" });
      }

      // Block co-founders/learners from accessing founder and mentor lists
      // They can only apply through problem statements
      if ((currentUser?.role === "COFOUNDER" || currentUser?.role === "LEARNER")) {
        if (role === "FOUNDER") {
          return res.status(403).json({ 
            message: "Co-founders and learners cannot view founders directly. Please apply through problem statements instead." 
          });
        }
        if (role === "MENTOR") {
          return res.status(403).json({ 
            message: "Co-founders and learners cannot view mentors directly. Please apply through problem statements instead." 
          });
        }
      }
      
      // Get requester's preferred track for filtering (only when FOUNDER is requesting)
      let founderTrack = sector;
      if (!founderTrack && currentUser?.role === "FOUNDER") {
        const founderApplications = await storage.getApplicationsByUser(currentUserId);
        const founderApp = founderApplications.length > 0 ? founderApplications[0] : null;
        const founderFormJson = founderApp?.formJson as any || {};
        founderTrack = founderFormJson.preferredTrack || founderFormJson.track || founderFormJson.sector;
      }

      let users = await storage.getUsersByRole(role);

      // Only include users with accepted applications
      const eligibleUsers = [];
      for (const user of users) {
        if (user.role === "FOUNDER") {
          // For founders: check if they have accepted/paid application
          try {
            const applications = await storage.getApplicationsByUser(user.id);
            const hasAcceptedApplication = applications.some(app => 
              app.status === "ACCEPTED" || app.status === "PAID"
            );
            if (hasAcceptedApplication) {
              eligibleUsers.push(user);
            }
          } catch (error) {
            console.warn(`Error checking applications for founder ${user.id}:`, error);
          }
        } else if (user.role === "MENTOR") {
          // For mentors, check if they have approved credentials
          try {
            const mentorProfile = await storage.getMentorProfileByUserId(user.id);
            if (mentorProfile && mentorProfile.credentialsApprovedBy) {
              eligibleUsers.push(user);
            }
          } catch (error) {
            console.warn(`Error checking mentor profile for user ${user.id}:`, error);
          }
        } else {
          // For COFOUNDER and LEARNER: check application status
          try {
            const applications = await storage.getApplicationsByUser(user.id);
            const hasAcceptedApplication = applications.some(app =>
              app.status === "ACCEPTED" || app.status === "PAID"
            );
            if (hasAcceptedApplication) {
              eligibleUsers.push(user);
            }
          } catch (error) {
            console.warn(`Error checking applications for user ${user.id}:`, error);
          }
        }
      }
      users = eligibleUsers;
      
      // Skip automatic track filtering - let frontend handle it via client-side filtering
      // Track filtering only applies if explicitly passed as a query parameter
      const shouldFilterByTrack = false; // Disabled automatic track filtering
      
      if (shouldFilterByTrack) {
        const trackFilteredUsers = [];
        for (const user of users) {
          
          if (user.role === "FOUNDER") {
            // For founders: check if their preferredTrack matches requested track
            let hasMatchingTrack = false;
            try {
              const applications = await storage.getApplicationsByUser(user.id);
              const latestApplication = applications.length > 0 ? applications[0] : null;
              const formJson = latestApplication?.formJson as any || {};
              
              const userTrack = formJson.preferredTrack || formJson.track || formJson.sector || '';
              if (userTrack && founderTrack && userTrack.toLowerCase() === founderTrack.toLowerCase()) {
                hasMatchingTrack = true;
              }
            } catch (error) {
              console.warn(`Error checking application data for founder ${user.id}:`, error);
            }
            
            if (hasMatchingTrack) {
              trackFilteredUsers.push(user);
            }
          } else if (user.role === "MENTOR") {
            // For mentors: check if their tracksJson contains founder's track
            let hasMatchingTrack = false;
            try {
              const mentorProfile = await storage.getMentorProfileByUserId(user.id);
              if (mentorProfile && mentorProfile.tracksJson) {
                const tracks = Array.isArray(mentorProfile.tracksJson) ? mentorProfile.tracksJson : [];
                hasMatchingTrack = tracks.some(track => 
                  founderTrack && track.toLowerCase() === founderTrack.toLowerCase()
                );
              }
            } catch (error) {
              console.warn(`Error checking mentor tracks for user ${user.id}:`, error);
            }

            if (hasMatchingTrack) {
              trackFilteredUsers.push(user);
            }
          } else {
            // For COFOUNDER and LEARNER: check if their preferredTrack matches founder's track
            let hasMatchingTrack = false;
            try {
              const applications = await storage.getApplicationsByUser(user.id);
              const latestApplication = applications.length > 0 ? applications[0] : null;
              const formJson = latestApplication?.formJson as any || {};

              const userTrack = formJson.preferredTrack || formJson.track || formJson.sector || '';
              if (userTrack && founderTrack && userTrack.toLowerCase() === founderTrack.toLowerCase()) {
                hasMatchingTrack = true;
              }
            } catch (error) {
              console.warn(`Error checking application data for user ${user.id}:`, error);
            }

            if (hasMatchingTrack) {
              trackFilteredUsers.push(user);
            }
          }
        }
        users = trackFilteredUsers;
      }

      // Exclude users already in teams
      try {
        const assignmentFiltered: typeof users = [] as any;
        for (const u of users) {
          try {
            const assignments = await storage.getRoleAssignmentsByUser(u.id);
            if (role === "MENTOR") {
              // For mentors: allow if mentoring less than 2 teams (2 teams max per mentor)
              // Check both "Mentor" (legacy) and "Promoter" (new) roles for backward compatibility
              const mentorAssignments = assignments.filter(a => a.role === "Mentor" || a.role === "Promoter");
              if (mentorAssignments.length < 2) {
                assignmentFiltered.push(u);
              }
            } else if (role === "FOUNDER") {
              // For founders: check if they have room in their team based on requester's role
              const founderAssignments = assignments.filter(a => a.role === "Founder" || a.role === "CoPromoter");
              
              if (founderAssignments.length === 0) {
                // Founder has no team yet, so they can accept anyone
                assignmentFiltered.push(u);
              } else {
                // Founder has a team - check if there's room based on current user's role
                const teamId = founderAssignments[0].teamId;
                
                // Get all team members to count by role
                const teamMembers = await storage.getRoleAssignmentsByTeam(teamId);
                const coPromoterCount = teamMembers.filter(tm => tm.role === "CoPromoter").length;
                const memberCount = teamMembers.filter(tm => tm.role === "Member").length;
                // Check both "Mentor" (legacy) and "Promoter" (new) roles for backward compatibility
                const mentorCount = teamMembers.filter(tm => tm.role === "Mentor" || tm.role === "Promoter").length;
                
                // Check if there's room based on the current user's role (who is requesting the list)
                let hasRoom = false;
                if (currentUser?.role === "COFOUNDER") {
                  hasRoom = coPromoterCount < 2; // Max 2 co-founders
                } else if (currentUser?.role === "LEARNER") {
                  hasRoom = memberCount < 7; // Max 7 learners
                } else if (currentUser?.role === "MENTOR") {
                  hasRoom = mentorCount < 2; // Max 2 mentors
                }
                
                if (hasRoom) {
                  assignmentFiltered.push(u);
                }
              }
            } else {
              // For COFOUNDER and LEARNER, exclude if assigned to any team
              if (assignments.length === 0) {
                assignmentFiltered.push(u);
              }
            }
          } catch (err) {
            console.warn(`Error checking assignments for user ${u.id}:`, err);
            // On error, exclude user to be safe
          }
        }
        users = assignmentFiltered;
      } catch (err) {
        console.warn("Error filtering users by assignments:", err);
      }

      // Return public user info including phone and bio for details view
      const publicUsers = await Promise.all(users.map(async u => {
        // Get application data to extract sector information
        const applications = await storage.getApplicationsByUser(u.id);
        const latestApplication = applications.length > 0 ? applications[0] : null;
        const formJson = latestApplication?.formJson as any || {};
        const sector = (u as any).specialization || formJson.preferredTrack || formJson.sector || formJson.track || null;

        // For mentors, add team count information
        let currentTeamsCount = 0;
        let maxTeams = 0;
        if (u.role === "MENTOR") {
          try {
            const assignments = await storage.getRoleAssignmentsByUser(u.id);
            const mentorAssignments = assignments.filter(a => a.role === "Mentor" || a.role === "Promoter");
            currentTeamsCount = mentorAssignments.length;
            maxTeams = 2;
          } catch (error) {
            currentTeamsCount = 0;
            maxTeams = 2;
          }
        }

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          specialization: (u as any).specialization || null,
          avatarUrl: u.avatarUrl || null,
          phone: (u as any).phone || null,
          bio: (u as any).bio || null,
          sector: sector, // Include proper sector field from application data
          ...(u.role === "MENTOR" && {
            currentTeamsCount,
            maxTeams,
          }),
        };
      }));
      res.json(publicUsers);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  // Get detailed user profile including application data or mentor profile
  app.get("/api/users/:id/profile", requireRole("FOUNDER", "COFOUNDER", "MENTOR"), async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user is a mentor and has a mentor profile
      const mentorProfile = user.role === "MENTOR" ? await storage.getMentorProfileByUserId(id) : null;

      // Get user's applications to extract form data (for learners/co-founders)
      const applications = await storage.getApplicationsByUser(id);
      const latestApplication = applications.length > 0 ? applications[0] : null;

      const formJson = latestApplication?.formJson as any || {};

      // Extract CV information from application (for learners/co-founders)
      let cvDownloadUrl: string | null = null;
      if (latestApplication && formJson.cvS3Key) {
        try {
          if (process.env.AWS_S3_BUCKET_NAME) {
            const { S3StorageService } = await import("./s3Storage");
            const storageService = new S3StorageService();
            cvDownloadUrl = await storageService.getSignedDownloadURL(formJson.cvS3Key, 3600); // 1 hour expiry
          }
        } catch (error) {
          console.error("Error generating CV download URL:", error);
        }
      }

      // Extract CV information from mentor profile (for mentors)
      let mentorCvUrl: string | null = null;
      if (mentorProfile && mentorProfile.cvUrl) {
        // Check if cvUrl is already a full URL (http/https)
        const isFullUrl = mentorProfile.cvUrl.startsWith('http://') || mentorProfile.cvUrl.startsWith('https://');

        if (isFullUrl) {
          // If it's already a full URL, check if it's a signed URL that might be expired
          // Try to extract the S3 key and generate a fresh signed URL
          try {
            if (process.env.AWS_S3_BUCKET_NAME) {
              const { S3StorageService } = await import("./s3Storage");
              const storageService = new S3StorageService();

              // Extract S3 key from the URL
              const s3Key = storageService.normalizeObjectEntityPath(mentorProfile.cvUrl);

              // Check if the file exists before generating signed URL
              const exists = await storageService.objectExists(s3Key);
              if (exists) {
                // Generate a fresh signed URL
                mentorCvUrl = await storageService.getSignedDownloadURL(s3Key, 3600);
              } else {
                console.warn(`CV file not found in S3: ${s3Key}`);
                mentorCvUrl = null;
              }
            } else {
              // If no S3 config, use the original URL
              mentorCvUrl = mentorProfile.cvUrl;
            }
          } catch (error) {
            console.error("Error generating mentor CV download URL from full URL:", error);
            // Fallback to original URL if extraction/generation fails
            mentorCvUrl = mentorProfile.cvUrl;
          }
        } else if (mentorProfile.cvUrl.startsWith('applications/') || mentorProfile.cvUrl.includes('/cv/')) {
          // If cvUrl is an S3 key, check if file exists and generate signed URL
          try {
            if (process.env.AWS_S3_BUCKET_NAME) {
              const { S3StorageService } = await import("./s3Storage");
              const storageService = new S3StorageService();

              // Check if the file exists before generating signed URL
              const exists = await storageService.objectExists(mentorProfile.cvUrl);
              if (exists) {
                mentorCvUrl = await storageService.getSignedDownloadURL(mentorProfile.cvUrl, 3600);
              } else {
                console.warn(`CV file not found in S3: ${mentorProfile.cvUrl}`);
                mentorCvUrl = null;
              }
            }
          } catch (error) {
            console.error("Error generating mentor CV download URL from S3 key:", error);
            // Don't set mentorCvUrl if generation fails - let it be null so UI can handle gracefully
            mentorCvUrl = null;
          }
        } else {
          // If it's neither a full URL nor an S3 key pattern, use as-is
          mentorCvUrl = mentorProfile.cvUrl;
        }
      }

      // Build comprehensive profile
      const profile: any = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: (user as any).phone || null,
        specialization: (user as any).specialization || null,
        avatarUrl: user.avatarUrl || null,
      };

      // If mentor, use mentor profile data
      if (mentorProfile) {
        profile.education = mentorProfile.education || null;
        profile.skills = mentorProfile.skills || null;
        profile.experience = mentorProfile.experience || null;
        profile.tracks = mentorProfile.tracksJson || null;
        profile.linkedinUrl = mentorProfile.linkedinUrl || null;
        profile.githubUrl = mentorProfile.githubUrl || null;
        profile.portfolioUrl = mentorProfile.portfolioUrl || null;
        profile.description = mentorProfile.description || null;
        profile.aboutMentor = mentorProfile.aboutMentor || null;
        profile.certificationsUrl = mentorProfile.certificationsUrl || null;
        profile.videoUrl = mentorProfile.videoUrl || null;

        // CV information from mentor profile
        profile.cv = mentorCvUrl && mentorProfile.cvUrl ? {
          fileName: mentorProfile.cvUrl.split('/').pop() || "CV.pdf",
          downloadUrl: mentorCvUrl,
          url: mentorCvUrl,
        } : null;

        // All mentor profile data for display
        profile.formData = {
          education: mentorProfile.education,
          skills: mentorProfile.skills,
          experience: mentorProfile.experience,
          tracks: mentorProfile.tracksJson,
          linkedinUrl: mentorProfile.linkedinUrl,
          githubUrl: mentorProfile.githubUrl,
          portfolioUrl: mentorProfile.portfolioUrl,
          description: mentorProfile.description,
          aboutMentor: mentorProfile.aboutMentor,
          certificationsUrl: mentorProfile.certificationsUrl,
          videoUrl: mentorProfile.videoUrl,
          cvUrl: mentorProfile.cvUrl,
        };
      } else {
        // For non-mentors, use application form data
        profile.education = formJson.education || null;
        profile.skills = formJson.skills || formJson.techStack || null;
        profile.tracks = formJson.tracksJson || formJson.tracks || null;

        // CV information from application
        profile.cv = formJson.cvFileName ? {
          fileName: formJson.cvFileName,
          fileSize: formJson.cvFileSize || null,
          fileType: formJson.cvFileType || null,
          downloadUrl: cvDownloadUrl,
        } : null;

        // All form answers
        profile.formData = formJson;
        profile.applicationStatus = latestApplication?.status || null;
        profile.applicationType = latestApplication?.type || null;
      }

      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Get detailed user profile for the dedicated profile page
  app.get("/api/users/:id/detailed-profile", requireRole("FOUNDER", "COFOUNDER", "MENTOR", "ADMIN", "LEARNER"), async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user is a mentor and has a mentor profile
      const mentorProfile = user.role === "MENTOR" ? await storage.getMentorProfileByUserId(id) : null;

      // Get user's applications to extract form data (for learners/co-founders)
      const applications = await storage.getApplicationsByUser(id);
      const latestApplication = applications.length > 0 ? applications[0] : null;

      const formJson = latestApplication?.formJson as any || {};

      // Extract CV and media URLs
      let resumeUrl: string | null = null;
      let videoUrl: string | null = null;
      let profileImageUrl: string | null = null;
      const media: Array<{ type: string; url: string; name: string }> = [];

      // For mentors, get URLs from mentor profile
      if (mentorProfile) {
        if (mentorProfile.cvUrl) {
          try {
            if (process.env.AWS_S3_BUCKET_NAME) {
              const { S3StorageService } = await import("./s3Storage");
              const storageService = new S3StorageService();
              const s3Key = storageService.normalizeObjectEntityPath(mentorProfile.cvUrl);
              const exists = await storageService.objectExists(s3Key);
              if (exists) {
                resumeUrl = await storageService.getSignedDownloadURL(s3Key, 3600);
                media.push({ type: "cv", url: resumeUrl, name: "CV/Resume" });
              }
            } else {
              resumeUrl = mentorProfile.cvUrl;
              media.push({ type: "cv", url: resumeUrl, name: "CV/Resume" });
            }
          } catch (error) {
            console.error("Error generating mentor CV URL:", error);
          }
        }

        videoUrl = mentorProfile.videoUrl || null;
        if (videoUrl) {
          media.push({ type: "video", url: videoUrl, name: "Video Profile" });
        }

        // Parse certificationsUrl (may be stringified JSON array or plain string)
        if (mentorProfile.certificationsUrl) {
          try {
            let certUrls: string[] = [];
            if (Array.isArray(mentorProfile.certificationsUrl)) {
              certUrls = mentorProfile.certificationsUrl as string[];
            } else if (typeof mentorProfile.certificationsUrl === "string") {
              const raw = mentorProfile.certificationsUrl.trim();
              if (raw.startsWith("[") || raw.startsWith("{")) {
                try {
                  const parsed = JSON.parse(raw);
                  certUrls = Array.isArray(parsed) ? parsed : [];
                } catch {
                  // Not valid JSON, treat as single URL
                  certUrls = raw ? [raw] : [];
                }
              } else {
                // Plain string, treat as single URL
                certUrls = raw ? [raw] : [];
              }
            }

            // Add each certification to media array
            certUrls.forEach((url, index) => {
              if (url && url.trim()) {
                media.push({ type: "certificate", url: url.trim(), name: `Certificate ${index + 1}` });
              }
            });
          } catch (error) {
            console.error("Error parsing certificationsUrl:", error);
          }
        }
      } else {
        // For non-mentors, get URLs from application form data
        if (formJson.cvS3Key) {
          try {
            if (process.env.AWS_S3_BUCKET_NAME) {
              const { S3StorageService } = await import("./s3Storage");
              const storageService = new S3StorageService();
              resumeUrl = await storageService.getSignedDownloadURL(formJson.cvS3Key, 3600);
              media.push({ type: "cv", url: resumeUrl, name: "CV/Resume" });
            }
          } catch (error) {
            console.error("Error generating application CV URL:", error);
          }
        }
        videoUrl = formJson.videoUrl || null;
        if (videoUrl) {
          media.push({ type: "video", url: videoUrl, name: "Video Profile" });
        }
        profileImageUrl = formJson.profileImageUrl || null;
      }

      // Safely parse mentor profile skills (avoid throwing on invalid JSON or HTML)
      let parsedMentorSkills: string[] | null = null;
      if (mentorProfile && mentorProfile.skills) {
        try {
          if (Array.isArray(mentorProfile.skills)) {
            parsedMentorSkills = mentorProfile.skills as string[];
          } else if (mentorProfile.skills && typeof mentorProfile.skills === "string") {
            const raw = String(mentorProfile.skills).trim();

            // Check if it looks like HTML (starts with < or contains HTML tags)
            if (raw.startsWith("<") || raw.includes("<html>") || raw.includes("<!")) {
              console.warn(`Mentor profile skills contains HTML for user ${user.id}, ignoring...`);
              parsedMentorSkills = null;
            } else if (raw.startsWith("[") || raw.startsWith("{")) {
              // Attempt to parse as JSON
              try {
                parsedMentorSkills = JSON.parse(raw);
              } catch (parseError) {
                console.warn(`Invalid JSON in mentor profile skills for user ${user.id}:`, parseError);
                // Fallback: split by comma for simple stored lists
                parsedMentorSkills = raw.split(",").map((s: string) => s.trim()).filter(Boolean) as string[];
              }
            } else {
              // Fallback: split by comma for simple stored lists
              parsedMentorSkills = raw.split(",").map((s: string) => s.trim()).filter(Boolean) as string[];
            }
          }
        } catch (err) {
          console.warn(`Error parsing mentorProfile.skills for user ${user.id}:`, err);
          parsedMentorSkills = null;
        }
      }

      // If user has an avatar stored (could be an S3 key), generate a signed GET URL
      let avatarSignedUrl: string | null = null;
      if (user.avatarUrl) {
        try {
          if (process.env.AWS_S3_BUCKET_NAME) {
            const { S3StorageService } = await import("./s3Storage");
            const storageService = new S3StorageService();
            const s3Key = storageService.normalizeObjectEntityPath(user.avatarUrl);
            const exists = await storageService.objectExists(s3Key);
            if (exists) {
              avatarSignedUrl = await storageService.getSignedDownloadURL(s3Key, 3600);
            }
          } else {
            avatarSignedUrl = user.avatarUrl;
          }
        } catch (err) {
          console.error("Error generating signed URL for user avatar:", err);
          avatarSignedUrl = null;
        }
      }

      // Keys to omit from formData so we never expose S3 keys, file metadata, or internal fields
      const FORM_DATA_HIDDEN_KEYS = new Set([
        "cvS3Key", "cvFileName", "cvFileSize", "cvFileType", "avatarUrl", "profileImageUrl",
        "objectKey", "s3Key", "uploadURL", "formJson", "certificationsUrl", "videoUrl", "cvUrl",
      ]);
      const sanitizeFormData = (obj: Record<string, any> | null | undefined): Record<string, any> => {
        if (!obj || typeof obj !== "object") return {};
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (FORM_DATA_HIDDEN_KEYS.has(k)) continue;
          if (/s3|objectKey|fileKey/i.test(k)) continue;
          if (typeof v === "string" && (v.includes("s3.amazonaws") || v.includes("s3://") || (v.length > 100 && /^[\w/-]+$/.test(v)))) continue;
          out[k] = v;
        }
        return out;
      };

      const rawFormData = mentorProfile ? {
        education: mentorProfile.education,
        skills: mentorProfile.skills,
        experience: mentorProfile.experience,
        tracks: mentorProfile.tracksJson,
        linkedinUrl: mentorProfile.linkedinUrl,
        githubUrl: mentorProfile.githubUrl,
        portfolioUrl: mentorProfile.portfolioUrl,
        description: mentorProfile.description,
        aboutMentor: mentorProfile.aboutMentor,
      } : formJson;

      // Build comprehensive detailed profile
      const detailedProfile = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customTag: user.customTag || null,
        phone: (user as any).phone || formJson.phone || null,
        bio: (user as any).bio || formJson.bio || formJson.aboutYourself || (mentorProfile?.aboutMentor) || null,
        specialization: (user as any).specialization || formJson.specialization || null,
        avatarUrl: avatarSignedUrl || (user.avatarUrl && user.avatarUrl.startsWith("http") ? user.avatarUrl : null) || null,
        sector: (user as any).specialization || formJson.sector || formJson.preferredTrack || formJson.track || null,
        location: formJson.location || formJson.address || formJson.city || null,
        dateOfBirth: formJson.dateOfBirth || formJson.dob || null,
        website: formJson.website || (mentorProfile?.portfolioUrl) || null,
        linkedin: formJson.linkedin || formJson.linkedinUrl || (mentorProfile?.linkedinUrl) || null,
        github: formJson.github || formJson.githubUrl || (mentorProfile?.githubUrl) || null,
        portfolio: formJson.portfolio || formJson.portfolioUrl || (mentorProfile?.portfolioUrl) || null,
        experience: formJson.experience || formJson.workExperience || (mentorProfile?.experience) || null,
        education: formJson.education || formJson.educationalBackground || (mentorProfile?.education) || null,
        skills: formJson.skills || formJson.techStack || formJson.technicalSkills || parsedMentorSkills || null,
        languages: formJson.languages || formJson.spokenLanguages || null,
        achievements: formJson.achievements || formJson.awards || formJson.certifications || null,
        resumeUrl,
        videoUrl,
        profileImageUrl,
        media,
        formData: sanitizeFormData(rawFormData),
      };

      res.json(detailedProfile);
    } catch (error: any) {
      console.error("Error fetching detailed user profile:", error);

      // Provide more specific error information for debugging
      const errorDetails = {
        message: "Failed to fetch detailed user profile",
        // Only include error details in development mode
        ...(process.env.NODE_ENV === 'development' && {
          userId: req.params.id,
          errorType: error.constructor.name,
          error: error.message,
          stack: error.stack
        })
      };

      res.status(500).json(errorDetails);
    }
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session!.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Only allow users to update their own profile, or admins to update anyone
      if (currentUser.id !== req.params.id && currentUser.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden" });
      }

      // customTag is admin-managed only (via PATCH /api/admin/users/:id/tag)
      const { password, customTag, ...updateData } = req.body;
      const updated = await storage.updateUser(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...updated, password: undefined });
    } catch (error: any) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // =====================
  // Debug Routes (temporary)
  // =====================

  app.get("/api/debug/applications", requireAdmin, async (req, res) => {
    try {
      const applications = await storage.getApplications();
      const debugData = applications.slice(0, 5).map((app: any) => ({
        id: app.id,
        userId: app.userId,
        type: app.type,
        status: app.status,
        formJsonKeys: app.formJson ? Object.keys(app.formJson as any) : [],
        preferredTrack: app.formJson ? (app.formJson as any).preferredTrack : null,
        track: app.formJson ? (app.formJson as any).track : null,
        sector: app.formJson ? (app.formJson as any).sector : null,
        createdAt: app.createdAt,
      }));
      res.json(debugData);
    } catch (error: any) {
      console.error("Debug applications error:", error);
      res.status(500).json({ message: "Debug failed" });
    }
  });

  // =====================
  // Admin Privilege Management Routes
  // =====================

  // Get all users with admin status (for admin privilege management)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      console.log("🔍 GET /api/admin/users - Session:", {
        sessionId: req.sessionID,
        userId: req.session?.userId,
      });

      const role = req.query.role as string | undefined;
      const excludeInTeamsParam = req.query.excludeInTeams;
      let excludeInTeams = false;
      if (typeof excludeInTeamsParam === 'string') {
        excludeInTeams = excludeInTeamsParam === 'true' || excludeInTeamsParam === '1';
      } else if (typeof excludeInTeamsParam === 'boolean' && excludeInTeamsParam === true) {
        excludeInTeams = true;
      }
      console.log(`🔍 [GET /api/admin/users] role=${role}, excludeInTeams=${excludeInTeams}, excludeInTeams raw: ${excludeInTeamsParam}, type: ${typeof excludeInTeamsParam}, full query:`, JSON.stringify(req.query));
      const users = role ? await storage.getUsersByRole(role) : await storage.getUsers();
      
      let userData = users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        phone: u.phone,
        customTag: u.customTag || null,
        createdAt: u.createdAt
      }));

      // If excludeInTeams is true, filter out users who are already in teams
      if (excludeInTeams) {
        console.log(`🔍 [excludeInTeams] Checking ${userData.length} users for team assignments...`);
        const allRoleAssignments = await Promise.all(
          userData.map(async (user) => {
            try {
              const assignments = await storage.getRoleAssignmentsByUser(user.id);
              const hasTeam = assignments.length > 0;
              if (hasTeam) {
                console.log(`  ⚠️ User ${user.name} (${user.email}) is already in ${assignments.length} team(s):`, assignments.map(a => ({ teamId: a.teamId, role: a.role })));
              } else {
                console.log(`  ✅ User ${user.name} (${user.email}) is NOT in any team`);
              }
              return { userId: user.id, hasTeam, assignments };
            } catch (error: any) {
              console.error(`  ❌ Error checking assignments for ${user.name} (${user.email}):`, error.message);
              return { userId: user.id, hasTeam: false, assignments: [] };
            }
          })
        );
        
        const usersInTeams = new Set(
          allRoleAssignments.filter(ra => ra.hasTeam).map(ra => ra.userId)
        );
        
        const beforeCount = userData.length;
        userData = userData.filter(user => !usersInTeams.has(user.id));
        console.log(`✅ [excludeInTeams] Filtered out ${usersInTeams.size} users who are already in teams (${beforeCount} → ${userData.length})`);
        console.log(`📋 [excludeInTeams] Remaining users:`, userData.map(u => `${u.name} (${u.email})`));
      }

      console.log(`✅ Returning ${userData.length} users${role ? ` (filtered by role: ${role})` : ''}${excludeInTeams ? ' (excluding users in teams)' : ''}`);
      res.json(userData);
    } catch (error: any) {
      console.error("❌ Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get single user details by ID (for admin user detail page)
  app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return user details without password
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        customTag: user.customTag || null,
        createdAt: user.createdAt,
        organization: (user as any).organization || null,
        department: (user as any).department || null,
        bio: (user as any).bio || null,
      };

      res.json(userData);
    } catch (error: any) {
      console.error("❌ Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Set, replace, or remove a user's custom tag (admin only; learners and mentors only)
  app.patch("/api/admin/users/:id/tag", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role !== "LEARNER" && user.role !== "MENTOR") {
        return res.status(400).json({ message: "Tags can only be assigned to learners and mentors" });
      }

      const rawTag = req.body?.customTag;
      if (rawTag !== null && rawTag !== undefined && typeof rawTag !== "string") {
        return res.status(400).json({ message: "customTag must be a string or null" });
      }

      const trimmed = typeof rawTag === "string" ? rawTag.trim() : null;
      if (trimmed && trimmed.length > 40) {
        return res.status(400).json({ message: "Tag must be 40 characters or fewer" });
      }

      // One tag per user: a new tag replaces the old one; empty/null removes it
      const updated = await storage.updateUser(req.params.id, { customTag: trimmed || null });
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ id: updated.id, customTag: updated.customTag || null });
    } catch (error: any) {
      console.error("❌ Error updating user tag:", error);
      res.status(500).json({ message: "Failed to update tag" });
    }
  });

  // Get user's application details
  app.get("/api/admin/users/:userId/application", requireAdmin, async (req, res) => {
    try {
      const applications = await storage.getApplicationsByUser(req.params.userId);
      
      if (!applications || applications.length === 0) {
        return res.json({ application: null });
      }

      // Get the most recent accepted application or the first one
      const acceptedApp = applications.find(app => app.status === "ACCEPTED");
      const application = acceptedApp || applications[0];

      res.json({ 
        application: {
          id: application.id,
          type: application.type,
          status: application.status,
          formJson: application.formJson,
          createdAt: application.createdAt,
        }
      });
    } catch (error: any) {
      console.error("❌ Error fetching user application:", error);
      res.status(500).json({ message: "Failed to fetch application" });
    }
  });

  

  // Delete user (admin only) - permanently deletes user and all associated data
  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      console.log(`🗑️ DELETE /api/admin/users/${req.params.id} - Request received`);
      const currentUser = await storage.getUser(req.session!.userId!);
      const targetUser = await storage.getUser(req.params.id);
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deleting your own account
      if (currentUser?.id === targetUser.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Prevent deleting the main admin account
      if (targetUser.email === "admin@startupvarsity.com" || targetUser.role === "ADMIN") {
        return res.status(400).json({ message: "Cannot delete the main admin account" });
      }

      console.log(`🗑️ Admin ${currentUser?.email} deleting user ${targetUser.email} at ${new Date()}`);

      // Import database and schema
      const { db } = await import("./db");
      const { 
        users, 
        applications,
        teams,
        problemStatements,
        problemStatementApplications,
        sessions, 
        notifications, 
        assessmentAttempts, 
        assessmentAnswers, 
        assessmentAssignments,
        tasks,
        sprintPermissions,
        roleAssignments,
        teamMemberApplications,
        teamApplicationMembers,
        teamApplicationInvites,
        capTableEntries,
        stipendDisbursements,
        invoices,
        certificates,
        passwordResetOtps,
        blogPosts,
        mentorProfiles,
        mentorSessions,
        mentorHonorariums,
        mentorJobPostings,
        assessments,
        reviews,
        dailyStandups,
        milestones
      } = await import("@shared/schema");
      const { eq, or, inArray } = await import("drizzle-orm");

      // Delete in order to avoid foreign key violations
      // 1. Delete sessions
      await db.delete(sessions).where(eq(sessions.userId, targetUser.id));
      console.log(`   ✓ Deleted sessions`);

      // 2. Delete notifications
      await db.delete(notifications).where(eq(notifications.userId, targetUser.id));
      console.log(`   ✓ Deleted notifications`);

      // 3. Delete assessment answers (via attempts)
      const attempts = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.userId, targetUser.id));
      for (const attempt of attempts) {
        await db.delete(assessmentAnswers).where(eq(assessmentAnswers.attemptId, attempt.id));
      }
      await db.delete(assessmentAttempts).where(eq(assessmentAttempts.userId, targetUser.id));
      await db.delete(assessmentAssignments).where(eq(assessmentAssignments.userId, targetUser.id));
      // Also clear any "assignedBy" references to this user
      await db.update(assessmentAssignments).set({ assignedBy: null }).where(eq(assessmentAssignments.assignedBy, targetUser.id));
      console.log(`   ✓ Deleted assessment data`);

      // 4. Update tasks to remove assignee (or delete if preferred)
      await db.update(tasks).set({ assigneeId: null }).where(eq(tasks.assigneeId, targetUser.id));
      console.log(`   ✓ Updated tasks`);

      // 5. Delete sprint permissions (as grantee or as grantor)
      await db.delete(sprintPermissions).where(
        or(eq(sprintPermissions.userId, targetUser.id), eq(sprintPermissions.grantedBy, targetUser.id))
      );
      console.log(`   ✓ Deleted sprint permissions`);

      // 6. Delete role assignments
      await db.delete(roleAssignments).where(eq(roleAssignments.userId, targetUser.id));
      console.log(`   ✓ Deleted role assignments`);

      // 7. Delete team member applications (both as founder and target)
      await db.delete(teamMemberApplications).where(eq(teamMemberApplications.founderId, targetUser.id));
      await db.delete(teamMemberApplications).where(eq(teamMemberApplications.targetUserId, targetUser.id));
      console.log(`   ✓ Deleted team member applications`);

      // 8. Delete cap table entries
      await db.delete(capTableEntries).where(eq(capTableEntries.userId, targetUser.id));
      console.log(`   ✓ Deleted cap table entries`);

      // 9. Delete stipend disbursements
      await db.delete(stipendDisbursements).where(eq(stipendDisbursements.userId, targetUser.id));
      console.log(`   ✓ Deleted stipend disbursements`);

      // 10. Delete certificates
      await db.delete(certificates).where(eq(certificates.userId, targetUser.id));
      console.log(`   ✓ Deleted certificates`);

      // 11. Delete invoices (direct user link)
      await db.delete(invoices).where(eq(invoices.userId, targetUser.id));
      console.log(`   ✓ Deleted invoices`);

      // 12. Delete password reset OTPs
      await db.delete(passwordResetOtps).where(eq(passwordResetOtps.email, targetUser.email));
      console.log(`   ✓ Deleted password reset OTPs`);

      // 13. Delete reviews created by this user (if they're a mentor)
      await db.delete(reviews).where(eq(reviews.mentorId, targetUser.id));
      console.log(`   ✓ Deleted reviews`);

      // 14. Delete daily standups (uses authorId, not userId)
      await db.delete(dailyStandups).where(eq(dailyStandups.authorId, targetUser.id));
      console.log(`   ✓ Deleted daily standups`);

      // 15. Clear blog post author (keep content, detach author)
      await db.update(blogPosts).set({ authorId: null }).where(eq(blogPosts.authorId, targetUser.id));
      console.log(`   ✓ Detached blog posts`);

      // 16. Delete mentor sessions / honorariums
      await db.delete(mentorSessions).where(eq(mentorSessions.mentorId, targetUser.id));
      await db.delete(mentorHonorariums).where(eq(mentorHonorariums.mentorId, targetUser.id));
      console.log(`   ✓ Deleted mentor sessions & honorariums`);

      // 17. Clear admin-created content references
      await db.update(mentorJobPostings).set({ createdBy: null }).where(eq(mentorJobPostings.createdBy, targetUser.id));
      await db.update(assessments).set({ createdBy: null }).where(eq(assessments.createdBy, targetUser.id));
      console.log(`   ✓ Cleared createdBy references`);

      // 18. Clear mentor credential approvals attributed to this user (if they were an admin approver)
      await db.update(mentorProfiles).set({ credentialsApprovedBy: null }).where(eq(mentorProfiles.credentialsApprovedBy, targetUser.id));
      console.log(`   ✓ Cleared mentor credential approvals`);

      // 19. Delete problem-statement applications for this user
      await db.delete(problemStatementApplications).where(eq(problemStatementApplications.applicantId, targetUser.id));
      console.log(`   ✓ Deleted problem statement applications`);

      // 20. Delete applications owned by this user, and clear reviewer/payment references
      await db.update(applications).set({ reviewerId: null }).where(eq(applications.reviewerId, targetUser.id));
      await db.update(applications).set({ paymentConfirmedBy: null }).where(eq(applications.paymentConfirmedBy, targetUser.id));

      const userApplications = await db
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.userId, targetUser.id));
      const userApplicationIds = userApplications.map((a) => a.id);
      if (userApplicationIds.length > 0) {
        // If this user owns TEAM applications, delete dependent team_application_members/invites first.
        // Otherwise deleting the applications row can fail due to FK constraints.
        const teamAppMembers = await db
          .select({ id: teamApplicationMembers.id })
          .from(teamApplicationMembers)
          .where(inArray(teamApplicationMembers.teamApplicationId, userApplicationIds));
        const teamAppMemberIds = teamAppMembers.map((m) => m.id);

        if (teamAppMemberIds.length > 0) {
          await db
            .delete(teamApplicationInvites)
            .where(inArray(teamApplicationInvites.memberId, teamAppMemberIds));
        }
        await db
          .delete(teamApplicationMembers)
          .where(inArray(teamApplicationMembers.teamApplicationId, userApplicationIds));

        // If this user is tied to a TEAM application via team_application_members.individual_application_id,
        // clear that link first to avoid FK violations when deleting the individual applications.
        await db
          .update(teamApplicationMembers)
          .set({ individualApplicationId: null })
          .where(inArray(teamApplicationMembers.individualApplicationId, userApplicationIds));
        await db.delete(invoices).where(inArray(invoices.applicationId, userApplicationIds));
      }
      await db.delete(applications).where(eq(applications.userId, targetUser.id));
      console.log(`   ✓ Deleted applications`);

      // 21. Delete problem statements created by this user (detach from teams first)
      const createdProblemStatements = await db
        .select({ id: problemStatements.id })
        .from(problemStatements)
        .where(eq(problemStatements.createdBy, targetUser.id));
      const createdProblemStatementIds = createdProblemStatements.map((p) => p.id);

      if (createdProblemStatementIds.length > 0) {
        await db.update(teams).set({ problemStatementId: null }).where(inArray(teams.problemStatementId, createdProblemStatementIds));
        await db.delete(problemStatements).where(inArray(problemStatements.id, createdProblemStatementIds));
      }

      await db.update(problemStatements).set({ publishedBy: null }).where(eq(problemStatements.publishedBy, targetUser.id));
      console.log(`   ✓ Cleaned problem statements`);

      // 22. Delete mentor profile if exists

      await db.delete(mentorProfiles).where(eq(mentorProfiles.userId, targetUser.id));
      console.log(`   ✓ Deleted mentor profile`);

      // 23. Finally, delete the user
      await db.delete(users).where(eq(users.id, targetUser.id));
      console.log(`   ✓ Deleted user`);

      console.log(`✅ User ${targetUser.email} and all associated data deleted successfully`);
      
      res.json({ 
        message: "User deleted successfully",
        deletedUser: { id: targetUser.id, email: targetUser.email, name: targetUser.name }
      });
    } catch (error: any) {
      console.error("❌ Error deleting user:", error);
      res.status(500).json({ 
        message: "Failed to delete user", 
        // Log detailed error server-side for admin debugging
        ...(process.env.NODE_ENV === "development" && {
          error: error?.message,
          code: error?.code,
          constraint: error?.constraint
        })
      });
    }
  });
  
  // Update user password (admin only)
  app.put("/api/admin/users/:userId/update-password", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { newPassword, email } = req.body;

      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }

      // Password validation
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }
      if (!/\d/.test(newPassword)) {
        return res.status(400).json({ message: "Password must include at least one number" });
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
        return res.status(400).json({ message: "Password must include at least one special character" });
      }

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password
      const { hashPassword } = await import("./services/credential-service");
      const hashedPassword = await hashPassword(newPassword);

      // Update password in database
      await storage.updateUser(userId, { password: hashedPassword });

      // Send email with updated credentials
      const { sendUpdatedCredentialsEmail } = await import("./services/email-service");
      await sendUpdatedCredentialsEmail(user.email, newPassword);

      res.json({ 
        message: "Password updated successfully",
        email: user.email
      });
    } catch (error: any) {
      console.error("Error updating password:", error);
      res.status(500).json({ message: "Failed to update password" });
    }
  });
  
  // Create new user (admin only)
  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      console.log("🔍 POST /api/admin/users - Session:", {
        sessionId: req.sessionID,
        userId: req.session?.userId,
      });

      const { name, email, password, role, phone, orgId, cohortId } = req.body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({ message: "Name, email, password, and role are required" });
      }

      // Check if email already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        role,
        phone,
        orgId,
      });

      // Create an auto-accepted application so the user appears in relevant lists
      // This ensures admin-created users are visible to others (e.g., founders to learners)
      try {
        // Map role to application type
        const applicationTypeMap: Record<string, string> = {
          "FOUNDER": "FOUNDER",
          "COFOUNDER": "COFOUNDER",
          "LEARNER": "LEARNER",
          "MENTOR": "MENTOR",
        };

        const applicationType = applicationTypeMap[role.toUpperCase()];
        if (applicationType) {
          await storage.createApplication({
            type: applicationType as any,
            userId: user.id,
            status: "ACCEPTED",
            formJson: {
              adminCreated: true,
              name: user.name,
              email: user.email,
              phone: user.phone || null,
            },
            paid: role === "MENTOR" ? false : true, // Mentors don't need payment, others are auto-paid
          });

          console.log(`✅ Created auto-accepted application for admin-created ${role} user: ${user.email}`);
        }

        // For mentors, also create a mentor profile with approved credentials
        if (role.toUpperCase() === "MENTOR") {
          try {
            const adminId = req.session!.userId!;
            await storage.createMentorProfile({
              userId: user.id,
              credentialsApprovedBy: adminId,
              credentialsApprovedAt: new Date(),
              credentialsShared: true,
            });
            console.log(`✅ Created mentor profile with approved credentials for: ${user.email}`);
          } catch (mentorProfileError: any) {
            // If mentor profile already exists or creation fails, log but don't fail the request
            console.warn(`⚠️ Could not create mentor profile for ${user.email}:`, mentorProfileError.message);
          }
        }
      } catch (appError: any) {
        // Log error but don't fail the user creation
        console.error(`⚠️ Error creating application for admin-created user ${user.email}:`, appError.message);
      }

      // Enroll user in cohort if cohortId provided
      if (cohortId) {
        try {
          await storage.createCohortUser({ userId: user.id, cohortId });
          console.log(`✅ Enrolled user ${user.email} into cohort ${cohortId}`);
        } catch (cohortError: any) {
          console.warn(`⚠️ Could not enroll user in cohort:`, cohortError.message);
        }
      }

      res.status(201).json({
        message: "User created successfully",
        user: { ...user, password: undefined }
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // =====================
  // Role Routes
  // =====================

  // Readable by any signed-in user: the Users page and the cohort form both render from
  // this list. Writes are admin-only, below.
  app.get("/api/roles", requireAuth, async (_req, res) => {
    try {
      res.json(await storage.getRoles());
    } catch (error) {
      console.error("Get roles error:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.post("/api/admin/roles", requireRole("ADMIN"), async (req, res) => {
    try {
      const parsed = insertRoleSchema.safeParse({
        ...req.body,
        // Only the seed migration may mint system roles — they are undeletable and imply
        // behaviour in code that a role created here cannot have.
        isSystem: false,
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.issues[0]?.message ?? "Invalid role",
        });
      }

      const existing = await storage.getRoleByCode(parsed.data.code);
      if (existing) {
        return res.status(409).json({ message: `Role ${parsed.data.code} already exists` });
      }

      const created = await storage.createRole(parsed.data);
      res.status(201).json(created);
    } catch (error) {
      console.error("Create role error:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.delete("/api/admin/roles/:code", requireRole("ADMIN"), async (req, res) => {
    try {
      const role = await storage.getRoleByCode(req.params.code);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      if (role.isSystem) {
        return res.status(400).json({
          message: `${role.label} is a built-in role and cannot be deleted`,
        });
      }

      // The users.role foreign key would reject this anyway; checking first turns a
      // database error into a message that says how many users are in the way.
      const inUse = await storage.countUsersWithRole(role.code);
      if (inUse > 0) {
        return res.status(409).json({
          message: `${inUse} user${inUse === 1 ? "" : "s"} still ${
            inUse === 1 ? "has" : "have"
          } the ${role.label} role — reassign them first`,
        });
      }

      await storage.deleteRole(role.code);
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Delete role error:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // =====================
  // Cohort Routes
  // =====================

  // These three handlers must catch. Express does not catch a rejected promise from
  // an async handler, so a failing query became an unhandled rejection and the request
  // never got a response at all -- it hung until the client gave up, holding a
  // connection open. A 500 is the right failure here; silence is not.
  app.get("/api/cohorts", async (req, res) => {
    try {
      const cohorts = await storage.getCohorts();
      res.json(await withCompositions(cohorts));
    } catch (error) {
      console.error("Get cohorts error:", error);
      res.status(500).json({ message: "Failed to fetch cohorts" });
    }
  });

  app.get("/api/cohorts/active", async (req, res) => {
    try {
      const cohorts = await storage.getActiveCohorts();
      res.json(await withCompositions(cohorts));
    } catch (error) {
      console.error("Get active cohorts error:", error);
      res.status(500).json({ message: "Failed to fetch active cohorts" });
    }
  });

  // Get cohorts open for registration (public) - MUST be before /api/cohorts/:id
  app.get("/api/cohorts/open-for-registration", async (req, res) => {
    try {
      const openCohorts = await storage.getCohortsOpenForRegistration();
      res.json(await withCompositions(openCohorts));
    } catch (error) {
      console.error("Get open cohorts error:", error);
      res.status(500).json({ message: "Failed to fetch open cohorts" });
    }
  });

  app.get("/api/cohorts/:id", async (req, res) => {
    try {
      const cohort = await storage.getCohort(req.params.id);
      if (!cohort) {
        return res.status(404).json({ message: "Cohort not found" });
      }
      res.json({ ...cohort, composition: await storage.getCohortComposition(cohort.id) });
    } catch (error) {
      console.error("Get cohort error:", error);
      res.status(500).json({ message: "Failed to fetch cohort" });
    }
  });

  app.post("/api/cohorts", requireRole("ADMIN"), async (req, res) => {
    try {
      const { name, startDate, endDate, location, seats, isActive, isOpenForRegistration } = req.body;

      if (!name || !startDate || !endDate) {
        return res.status(400).json({ message: "Name, start date, and end date are required" });
      }

      // Validated before the insert, so a bad role code cannot leave a cohort behind
      const { counts, error } = await readComposition(req.body.composition);
      if (error) {
        return res.status(400).json({ message: error });
      }

      const cohort = await storage.createCohort({
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        seats: seats || 100,
        isActive: isActive !== undefined ? isActive : true,
        isOpenForRegistration: isOpenForRegistration !== undefined ? isOpenForRegistration : false,
      });

      if (counts) {
        await storage.setCohortComposition(cohort.id, counts);
      }

      res.status(201).json({
        ...cohort,
        composition: await storage.getCohortComposition(cohort.id),
      });
    } catch (error) {
      console.error("Create cohort error:", error);
      res.status(400).json({ message: "Failed to create cohort" });
    }
  });

  app.patch("/api/cohorts/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const { composition, ...body } = req.body;
      // Drizzle timestamp columns expect Date; client sends date strings (YYYY-MM-DD)
      if (typeof body.startDate === "string") body.startDate = new Date(body.startDate);
      if (typeof body.endDate === "string") body.endDate = new Date(body.endDate);

      // Validated before the update, so a bad role code changes nothing
      const { counts, error } = await readComposition(composition);
      if (error) {
        return res.status(400).json({ message: error });
      }

      // A composition-only edit leaves nothing for SET, which Drizzle rejects
      const updated = Object.keys(body).length > 0
        ? await storage.updateCohort(req.params.id, body)
        : await storage.getCohort(req.params.id);
      if (!updated) {
        return res.status(404).json({ message: "Cohort not found" });
      }

      if (counts) {
        await storage.setCohortComposition(updated.id, counts);
      }

      res.json({ ...updated, composition: await storage.getCohortComposition(updated.id) });
    } catch (error) {
      console.error("Update cohort error:", error);
      res.status(400).json({ message: "Failed to update cohort" });
    }
  });

  // Delete a cohort (admin only) - cascades to cohort_users, tasks, and sessions
  app.delete("/api/cohorts/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const success = await storage.deleteCohort(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Cohort not found" });
      }
      res.json({ message: "Cohort deleted successfully" });
    } catch (error) {
      console.error("Delete cohort error:", error);
      res.status(500).json({ message: "Failed to delete cohort" });
    }
  });

  // =====================
  // Cohort Users Routes
  // =====================
  
  // Get user's cohort assignment
  app.get("/api/cohort-users/me", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const cohortUser = await storage.getCohortUser(userId);
      if (!cohortUser) {
        return res.status(404).json({ message: "No cohort assignment found" });
      }
      res.json(cohortUser);
    } catch (error) {
      console.error("Get cohort user error:", error);
      res.status(500).json({ message: "Failed to fetch cohort assignment" });
    }
  });

  // Assign user to cohort (used during application)
  app.post("/api/cohort-users", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { cohortId } = req.body;

      if (!cohortId) {
        return res.status(400).json({ message: "Cohort ID is required" });
      }

      // Check if user is already assigned to a cohort
      const existing = await storage.getCohortUser(userId);
      if (existing) {
        return res.status(400).json({ message: "User is already assigned to a cohort" });
      }

      // Check if cohort exists and is open for registration
      const cohort = await storage.getCohort(cohortId);
      if (!cohort) {
        return res.status(404).json({ message: "Cohort not found" });
      }
      if (!cohort.isOpenForRegistration) {
        return res.status(400).json({ message: "This cohort is not open for registration" });
      }

      const cohortUser = await storage.createCohortUser({ userId, cohortId });
      res.status(201).json(cohortUser);
    } catch (error) {
      console.error("Create cohort user error:", error);
      res.status(500).json({ message: "Failed to assign user to cohort" });
    }
  });

  // Get users in a cohort (admin only)
  app.get("/api/cohorts/:id/users", requireRole("ADMIN"), async (req, res) => {
    try {
      const cohortUsers = await storage.getCohortUsersByCohort(req.params.id);
      res.json(cohortUsers);
    } catch (error) {
      console.error("Get cohort users error:", error);
      res.status(500).json({ message: "Failed to fetch cohort users" });
    }
  });

  // Remove user from cohort (admin only)
  app.delete("/api/cohort-users/:userId", requireRole("ADMIN"), async (req, res) => {
    try {
      const success = await storage.deleteCohortUser(req.params.userId);
      if (!success) {
        return res.status(404).json({ message: "Cohort user not found" });
      }
      res.json({ message: "User removed from cohort" });
    } catch (error) {
      console.error("Delete cohort user error:", error);
      res.status(500).json({ message: "Failed to remove user from cohort" });
    }
  });

  // Get teams for a specific cohort
  app.get("/api/cohorts/:id/teams", async (req, res) => {
    try {
      const cohortId = req.params.id;
      const teams = await storage.getTeamsByCohort(cohortId);
      
      // Enrich teams with member count
      const enrichedTeams = await Promise.all(teams.map(async (team) => {
        const members = await storage.getRoleAssignmentsByTeam(team.id);
        return {
          ...team,
          memberCount: members.length,
        };
      }));
      
      res.json(enrichedTeams);
    } catch (error) {
      console.error("Get cohort teams error:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // =====================
  // Cohort Tasks Routes
  // =====================
  console.log("📋 Cohort Tasks routes:");
  console.log("  - GET /api/cohort-tasks (list all)");
  console.log("  - GET /api/cohort-tasks/:id (get single)");
  console.log("  - GET /api/cohorts/:cohortId/tasks (list by cohort)");
  console.log("  - GET /api/my-cohort-tasks (user's cohort tasks)");
  console.log("  - POST /api/cohort-tasks (create)");
  console.log("  - PUT /api/cohort-tasks/:id (update)");
  console.log("  - DELETE /api/cohort-tasks/:id (delete)");

  // Get all cohort tasks (admin, founder, mentor)
  app.get("/api/cohort-tasks", requireRole("ADMIN", "FOUNDER", "MENTOR"), async (req, res) => {
    try {
      const tasks = await storage.getCohortTasks();
      // Fetch sessions for each task
      const tasksWithSessions = await Promise.all(
        tasks.map(async (task) => {
          const sessions = await storage.getCohortTaskSessions(task.id);
          return { ...task, sessions };
        })
      );
      res.json(tasksWithSessions);
    } catch (error) {
      console.error("Get cohort tasks error:", error);
      res.status(500).json({ message: "Failed to fetch cohort tasks" });
    }
  });

  // Get single cohort task
  app.get("/api/cohort-tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.getCohortTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Cohort task not found" });
      }
      const sessions = await storage.getCohortTaskSessions(task.id);
      res.json({ ...task, sessions });
    } catch (error) {
      console.error("Get cohort task error:", error);
      res.status(500).json({ message: "Failed to fetch cohort task" });
    }
  });

  // Get cohort tasks by cohort ID
  app.get("/api/cohorts/:cohortId/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getCohortTasksByCohort(req.params.cohortId);
      // Fetch sessions for each task
      const tasksWithSessions = await Promise.all(
        tasks.map(async (task) => {
          const sessions = await storage.getCohortTaskSessions(task.id);
          return { ...task, sessions };
        })
      );
      res.json(tasksWithSessions);
    } catch (error) {
      console.error("Get cohort tasks by cohort error:", error);
      res.status(500).json({ message: "Failed to fetch cohort tasks" });
    }
  });

  // Get cohort tasks for current user (based on their team's cohort)
  app.get("/api/my-cohort-tasks", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const tasks = await storage.getCohortTasksForUser(userId);
      // Fetch sessions for each task
      const tasksWithSessions = await Promise.all(
        tasks.map(async (task) => {
          const sessions = await storage.getCohortTaskSessions(task.id);
          return { ...task, sessions };
        })
      );
      res.json(tasksWithSessions);
    } catch (error) {
      console.error("Get user cohort tasks error:", error);
      res.status(500).json({ message: "Failed to fetch cohort tasks" });
    }
  });

  // Create cohort task (admin, founder, mentor)
  app.post("/api/cohort-tasks", requireRole("ADMIN", "FOUNDER", "MENTOR"), async (req, res) => {
    try {
      const { cohortId, title, description, meetingLink, startTime, endTime, sessions } = req.body;
      const adminId = req.session!.userId!;

      if (!cohortId || !title || !startTime || !endTime) {
        return res.status(400).json({ message: "Cohort ID, title, start time, and end time are required" });
      }

      // Verify cohort exists
      const cohort = await storage.getCohort(cohortId);
      if (!cohort) {
        return res.status(404).json({ message: "Cohort not found" });
      }

      const task = await storage.createCohortTask({
        cohortId,
        title,
        description: description || null,
        meetingLink: meetingLink || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdBy: adminId,
        isActive: true,
      });

      // Create sessions if provided
      if (sessions && Array.isArray(sessions) && sessions.length > 0) {
        for (const session of sessions) {
          await storage.createCohortTaskSession({
            cohortTaskId: task.id,
            startDate: new Date(session.startDate),
            endDate: new Date(session.endDate),
            startTime: session.startTime, // HH:MM format
            endTime: session.endTime, // HH:MM format
            meetingLink: session.meetingLink || null,
            isActive: true,
          });
        }
      }

      // Fetch the task with sessions
      const taskSessions = await storage.getCohortTaskSessions(task.id);
      const taskWithSessions = { ...task, sessions: taskSessions };

      console.log(`✅ Cohort task created: ${task.id} for cohort ${cohortId} with ${sessions?.length || 0} sessions`);
      res.status(201).json(taskWithSessions);
    } catch (error) {
      console.error("Create cohort task error:", error);
      res.status(500).json({ message: "Failed to create cohort task" });
    }
  });

  // Update cohort task (admin, founder, mentor)
  app.put("/api/cohort-tasks/:id", requireRole("ADMIN", "FOUNDER", "MENTOR"), async (req, res) => {
    try {
      const { title, description, meetingLink, startTime, endTime, isActive, sessions } = req.body;

      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (meetingLink !== undefined) updateData.meetingLink = meetingLink;
      if (startTime !== undefined) updateData.startTime = new Date(startTime);
      if (endTime !== undefined) updateData.endTime = new Date(endTime);
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await storage.updateCohortTask(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Cohort task not found" });
      }

      // Handle sessions update - delete old and create new
      if (sessions !== undefined && Array.isArray(sessions)) {
        await storage.deleteCohortTaskSessionsByTaskId(req.params.id);
        for (const session of sessions) {
          await storage.createCohortTaskSession({
            cohortTaskId: req.params.id,
            startDate: new Date(session.startDate),
            endDate: new Date(session.endDate),
            startTime: session.startTime, // HH:MM format
            endTime: session.endTime, // HH:MM format
            meetingLink: session.meetingLink || null,
            isActive: true,
          });
        }
      }

      // Fetch the task with sessions
      const taskSessions = await storage.getCohortTaskSessions(req.params.id);
      const taskWithSessions = { ...updated, sessions: taskSessions };

      res.json(taskWithSessions);
    } catch (error) {
      console.error("Update cohort task error:", error);
      res.status(500).json({ message: "Failed to update cohort task" });
    }
  });

  // Delete cohort task (admin, founder, mentor)
  app.delete("/api/cohort-tasks/:id", requireRole("ADMIN", "FOUNDER", "MENTOR"), async (req, res) => {
    try {
      await storage.deleteCohortTask(req.params.id);
      res.json({ message: "Cohort task deleted successfully" });
    } catch (error) {
      console.error("Delete cohort task error:", error);
      res.status(500).json({ message: "Failed to delete cohort task" });
    }
  });

  // =====================
  // Milestone Routes
  // =====================
  app.get("/api/milestones", async (req, res) => {
    const { cohortId } = req.query;
    if (cohortId && typeof cohortId === "string") {
      const milestones = await storage.getMilestonesByCohort(cohortId);
      return res.json(milestones);
    }
    const milestones = await storage.getMilestones();
    res.json(milestones);
  });

  app.get("/api/milestones/:id", async (req, res) => {
    const milestone = await storage.getMilestone(req.params.id);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }
    res.json(milestone);
  });

  app.post("/api/milestones", requireRole("ADMIN"), async (req, res) => {
    try {
      const { name, description, cohortId, startDate, endDate, status, order, goals, deliverables } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Milestone name is required" });
      }
      const milestone = await storage.createMilestone({
        name,
        description,
        cohortId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status: status || "UPCOMING",
        order: order || 1,
        goals,
        deliverables,
      });
      res.status(201).json(milestone);
    } catch (error) {
      console.error("Create milestone error:", error);
      res.status(400).json({ message: "Failed to create milestone" });
    }
  });

  app.patch("/api/milestones/:id", requireRole("ADMIN"), async (req, res) => {
    const updated = await storage.updateMilestone(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Milestone not found" });
    }
    res.json(updated);
  });

  app.delete("/api/milestones/:id", requireRole("ADMIN"), async (req, res) => {
    const deleted = await storage.deleteMilestone(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Milestone not found" });
    }
    res.json({ message: "Milestone deleted successfully" });
  });

  // =====================
  // Problem Statement Routes
  // =====================

  app.get("/api/problems", async (req, res) => {
    try {
      const { track } = req.query;
      let problems;

      if (track && typeof track === "string") {
        problems = await storage.getProblemStatementsByTrack(track);
      } else {
        problems = await storage.getProblemStatements();
      }

      // Check if user is authenticated and their role
      let currentUser = null;
      if (req.session?.userId) {
        currentUser = await storage.getUser(req.session.userId);
      }

      // Hide detailed information from learners/interns
      if (currentUser && (currentUser.role === "LEARNER" || currentUser.role === "UNIVERSITY")) {
        // For learners, only show basic overview (title, track, difficulty)
        const overviewProblems = problems.map(problem => ({
          id: problem.id,
          title: problem.title,
          track: problem.track,
          difficulty: problem.difficulty,
          tags: problem.tags
          // Note: summary is intentionally excluded for learners
        }));
        return res.json(overviewProblems);
      }

      // For founders, co-founders, mentors, admins, and unauthenticated users, show full details
      res.json(problems);
    } catch (error) {
      console.error("Error fetching problem statements:", error);
      res.status(500).json({ message: "Failed to fetch problem statements" });
    }
  });

  app.get("/api/problems/:id", async (req, res) => {
    const problem = await storage.getProblemStatement(req.params.id);
    if (!problem) {
      return res.status(404).json({ message: "Problem statement not found" });
    }
    res.json(problem);
  });

  // NOTE: these two write problem_statements straight from req.body. The
  // `track` pgEnum used to be the only thing rejecting a bad track here; now
  // that the column is plain text, the catalog check has to be explicit.
  app.post("/api/problems", requireRole("ADMIN"), async (req, res) => {
    try {
      if (req.body?.track !== undefined) {
        const resolved = await resolveTrackOrFail(req.body.track, res);
        if (!resolved) return;
        req.body.track = resolved;
      }
      const problem = await storage.createProblemStatement(req.body);
      res.status(201).json(problem);
    } catch (error) {
      res.status(400).json({ message: "Failed to create problem statement" });
    }
  });

  app.patch("/api/problems/:id", requireRole("ADMIN"), async (req, res) => {
    if (req.body?.track !== undefined) {
      const current = await storage.getProblemStatement(req.params.id);
      const resolved = await resolveTrackOrFail(req.body.track, res, current?.track);
      if (!resolved) return;
      req.body.track = resolved;
    }
    const updated = await storage.updateProblemStatement(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Problem statement not found" });
    }
    res.json(updated);
  });

  // =====================
  // Unified Applications API (Sent/Received for all users)
  // =====================

  // Get all applications sent by the current user
  app.get("/api/applications/sent", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const applications: any[] = [];

      // 1. Team Member Applications sent by this user (as founder inviting others)
      if (["FOUNDER", "COFOUNDER"].includes(user.role)) {
        const teamMemberApps = await storage.getTeamMemberApplicationsByFounder(userId);
        for (const app of teamMemberApps) {
          const targetUser = await storage.getUser(app.targetUserId);
          
          // Check if target user is in a team
          let teamName: string | undefined;
          let computedStatus = "sent";
          let displayStatus = "Sent";
          
          if (app.status === "ACCEPTED") {
            computedStatus = "accepted";
            displayStatus = "Accepted";
            // Check if they're now in a team together
            const targetUserRoles = await storage.getRoleAssignmentsByUser(app.targetUserId);
            if (targetUserRoles.length > 0) {
              const team = await storage.getTeam(targetUserRoles[0].teamId);
              if (team) {
                computedStatus = "in_team";
                displayStatus = `In Team: ${team.name}`;
                teamName = team.name;
              }
            }
          } else if (app.status === "REJECTED") {
            computedStatus = "rejected";
            displayStatus = "Rejected";
          }

          applications.push({
            id: app.id,
            type: "team_invitation",
            status: app.status,
            computedStatus,
            displayStatus,
            teamName,
            message: app.message,
            createdAt: app.createdAt,
            recipientId: app.targetUserId,
            recipientName: targetUser?.name || null,
            recipientEmail: targetUser?.email || null,
            recipientRole: app.targetUserRole,
          });
        }
      }

      // 2. Problem Statement Applications sent by this user
      const psApps = await storage.getProblemStatementApplicationsByApplicant(userId);
      for (const app of psApps) {
        const problemStatement = await storage.getProblemStatement(app.problemStatementId);
        
        let teamName: string | undefined;
        let computedStatus = "sent";
        let displayStatus = "Sent";
        
        if (app.status === "ACCEPTED") {
          computedStatus = "accepted";
          displayStatus = "Accepted";
          
          // Check if user is assigned to problem statement (has role assignment)
          const userRoles = await storage.getRoleAssignmentsByUser(userId);
          if (userRoles.length > 0) {
            const team = await storage.getTeam(userRoles[0].teamId);
            if (team) {
              computedStatus = "in_team";
              displayStatus = `In Team: ${team.name}`;
              teamName = team.name;
              
              // Check if team is assigned to this problem statement
              if (team.problemStatementId === app.problemStatementId) {
                computedStatus = "assigned_to_ps";
                displayStatus = `Assigned: ${problemStatement?.title || "Problem Statement"}`;
              }
            }
          }
        } else if (app.status === "REJECTED") {
          computedStatus = "rejected";
          displayStatus = "Rejected";
        }

        // Get the problem statement owner (for display as recipient)
        let recipientName: string | null = null;
        let recipientEmail: string | null = null;
        if (problemStatement) {
          const owner = await storage.getUser(problemStatement.createdBy);
          recipientName = owner?.name || "Admin";
          recipientEmail = owner?.email || null;
        }

        applications.push({
          id: app.id,
          type: "problem_statement_application",
          status: app.status,
          computedStatus,
          displayStatus,
          teamName,
          problemStatementId: app.problemStatementId,
          problemStatementTitle: problemStatement?.title || null,
          message: app.message,
          createdAt: app.createdAt,
          recipientId: problemStatement?.createdBy || null,
          recipientName,
          recipientEmail,
          recipientRole: problemStatement?.createdByRole || null,
          applicantRole: app.applicantRole,
        });
      }

      // Sort by date descending
      applications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(applications);
    } catch (error: any) {
      console.error("Error fetching sent applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Get all applications received by the current user
  app.get("/api/applications/received", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const applications: any[] = [];

      // 1. Team Member Applications received by this user (invitations from founders)
      const receivedInvites = await storage.getTeamMemberApplicationsByTargetUser(userId);
      for (const app of receivedInvites) {
        const sender = await storage.getUser(app.founderId);

        let teamName: string | undefined;
        let computedStatus = "received";
        let displayStatus = "Received";

        if (app.status === "ACCEPTED") {
          computedStatus = "accepted";
          displayStatus = "Accepted";
          // Check if user is now in a team
          const userRoles = await storage.getRoleAssignmentsByUser(userId);
          if (userRoles.length > 0) {
            const team = await storage.getTeam(userRoles[0].teamId);
            if (team) {
              computedStatus = "in_team";
              displayStatus = `In Team: ${team.name}`;
              teamName = team.name;
            }
          }
        } else if (app.status === "REJECTED") {
          computedStatus = "rejected";
          displayStatus = "Rejected";
        } else if (app.status === "PENDING") {
          computedStatus = "received";
          displayStatus = "Received";
        }

        // Founder's published problem statement (for recipients to view profile & PS overview)
        let founderProblemStatement: { id: string; title: string; overview: string | null } | null = null;
        const founderPsList = await storage.getProblemStatements({ status: "PUBLISHED", createdBy: app.founderId });
        if (founderPsList.length > 0) {
          const ps = founderPsList[0];
          founderProblemStatement = { id: ps.id, title: ps.title, overview: ps.overview ?? null };
        }

        applications.push({
          id: app.id,
          type: "team_invitation",
          status: app.status,
          computedStatus,
          displayStatus,
          teamName,
          message: app.message,
          createdAt: app.createdAt,
          senderId: app.founderId,
          senderName: sender?.name || null,
          senderEmail: sender?.email || null,
          senderRole: sender?.role || "FOUNDER",
          founderProblemStatement,
        });
      }

      // 2. Problem Statement Applications received by this user (if they own problem statements)
      // Founders/Admins receive applications to their problem statements
      if (["FOUNDER", "COFOUNDER", "ADMIN", "MENTOR"].includes(user.role)) {
        // Get all problem statements created by this user
        const allProblemStatements = await storage.getProblemStatements();
        const userProblemStatements = allProblemStatements.filter(ps => ps.createdBy === userId);
        
        for (const ps of userProblemStatements) {
          const psApplications = await storage.getProblemStatementApplications(ps.id);
          
          for (const app of psApplications) {
            const applicant = await storage.getUser(app.applicantId);
            
            let teamName: string | undefined;
            let computedStatus = "received";
            let displayStatus = "Received";
            
            if (app.status === "ACCEPTED") {
              computedStatus = "accepted";
              displayStatus = "Accepted";
              // Check if applicant is now in a team
              const applicantRoles = await storage.getRoleAssignmentsByUser(app.applicantId);
              if (applicantRoles.length > 0) {
                const team = await storage.getTeam(applicantRoles[0].teamId);
                if (team) {
                  computedStatus = "in_team";
                  displayStatus = `In Team: ${team.name}`;
                  teamName = team.name;
                }
              }
            } else if (app.status === "REJECTED") {
              computedStatus = "rejected";
              displayStatus = "Rejected";
            } else if (app.status === "PENDING") {
              computedStatus = "received";
              displayStatus = "Received";
            }

            applications.push({
              id: app.id,
              type: "problem_statement_application",
              status: app.status,
              computedStatus,
              displayStatus,
              teamName,
              problemStatementId: ps.id,
              problemStatementTitle: ps.title,
              message: app.message,
              createdAt: app.createdAt,
              senderId: app.applicantId,
              senderName: applicant?.name || null,
              senderEmail: applicant?.email || null,
              senderRole: app.applicantRole,
            });
          }
        }
      }

      // Sort by date descending
      applications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(applications);
    } catch (error: any) {
      console.error("Error fetching received applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // =====================
  // Team Member Application Routes (Founder to Co-Founder/Mentor/Learner)
  // =====================

  // Get team member applications sent by founder
  app.get("/api/team-member-applications/sent", requireRole("FOUNDER", "COFOUNDER", "LEARNER"), async (req, res) => {
    try {
      const founderId = req.session!.userId!;
      const applications = await storage.getTeamMemberApplicationsByFounder(founderId);

      // Enrich with target user info
      const enriched = await Promise.all(applications.map(async (app) => {
        const targetUser = await storage.getUser(app.targetUserId);
        return {
          ...app,
          targetUserName: targetUser?.name || null,
          targetUserEmail: targetUser?.email || null,
          targetUser: targetUser ? {
            id: targetUser.id,
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role,
            specialization: (targetUser as any).specialization || null,
          } : null,
        };
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching sent applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Get team member applications received by user (founder, co-founder, mentor, or learner)
  app.get("/api/team-member-applications/received", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const user = await storage.getUser(userId);
      
      if (!user || !["FOUNDER", "COFOUNDER", "MENTOR", "LEARNER"].includes(user.role)) {
        return res.status(403).json({ message: "Only founders, co-founders, mentors, and learners can receive applications" });
      }

      const applications = await storage.getTeamMemberApplicationsByTargetUser(userId);
      
      // Enrich with applicant info (founderId is the applicant - the person who applied)
      const enriched = await Promise.all(applications.map(async (app) => {
        console.log(`🔍 Processing application ${app.id}, founderId: ${app.founderId}`);
        const applicant = await storage.getUser(app.founderId);
        
        if (!applicant) {
          console.warn(`⚠️ Applicant not found for founderId: ${app.founderId}`);
        } else {
          console.log(`✅ Found applicant: ${applicant.name} (${applicant.email})`);
        }
        
        // Get applicant's full application details
        let applicationDetails = null;
        if (applicant) {
          const userApplications = await storage.getApplicationsByUser(applicant.id);
          // Get the most recent accepted application
          const acceptedApp = userApplications.find(a => a.status === "ACCEPTED") || userApplications[0];
          if (acceptedApp && acceptedApp.formJson) {
            applicationDetails = acceptedApp.formJson;
          }
        }
        
        // Get applicant's sector from their application form
        const applicantApplications = applicant ? await storage.getApplicationsByUser(applicant.id) : [];
        const applicantLatestApp = applicantApplications.length > 0 ? applicantApplications[0] : null;
        const applicantFormJson = applicantLatestApp?.formJson as any || {};
        const applicantSector = applicantFormJson.preferredTrack || applicantFormJson.track || applicantFormJson.sector || null;

        // Founder's published problem statement (for recipients to view overview)
        let founderProblemStatement: { id: string; title: string; overview: string | null } | null = null;
        const founderPsList = await storage.getProblemStatements({ status: "PUBLISHED", createdBy: app.founderId });
        if (founderPsList.length > 0) {
          const ps = founderPsList[0];
          founderProblemStatement = { id: ps.id, title: ps.title, overview: ps.overview ?? null };
        }
        
        const result = {
          ...app,
          founderProblemStatement,
          // Include both formats for backward compatibility
          applicantName: applicant?.name || null,
          applicantEmail: applicant?.email || null,
          applicantRole: applicant?.role || null,
          applicantPhone: applicant?.phone || null,
          applicantSector: applicantSector,
          applicationDetails: applicationDetails, // Full application data
          // Also include founder object for frontend compatibility
          founder: applicant ? {
            id: applicant.id,
            name: applicant.name || "Unknown",
            email: applicant.email || "N/A",
            role: applicant.role || "FOUNDER",
            phone: applicant.phone || null,
            specialization: applicantSector || null,
          } : {
            id: app.founderId,
            name: "Unknown",
            email: "N/A",
            role: "UNKNOWN",
            phone: null,
            specialization: null,
          },
        };
        
        console.log(`📦 Returning enriched application:`, {
          id: result.id,
          founderName: result.founder?.name,
          founderEmail: result.founder?.email,
          applicantName: result.applicantName,
        });
        
        return result;
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching received applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Create team member application (founder applies to co-founder/mentor/learner)
  app.post("/api/team-member-applications", requireRole("FOUNDER", "COFOUNDER", "LEARNER"), async (req, res) => {
    try {
      const founderId = req.session!.userId!;
      const currentUser = await storage.getUser(founderId);
      const { targetUserId, targetUserRole, message } = req.body;

      if (!targetUserId || !targetUserRole) {
        return res.status(400).json({ message: "targetUserId and targetUserRole are required" });
      }

      if (!["COFOUNDER", "MENTOR", "LEARNER", "FOUNDER"].includes(targetUserRole)) {
        return res.status(400).json({ message: "Invalid targetUserRole. Must be COFOUNDER, MENTOR, LEARNER, or FOUNDER" });
      }

      // Block co-founders/learners from applying directly to founders or mentors
      // They can only apply through problem statements
      if ((currentUser?.role === "COFOUNDER" || currentUser?.role === "LEARNER")) {
        if (targetUserRole === "FOUNDER") {
          return res.status(403).json({ 
            message: "Co-founders and learners cannot apply directly to founders. Please apply through problem statements instead." 
          });
        }
        if (targetUserRole === "MENTOR") {
          return res.status(403).json({ 
            message: "Co-founders and learners cannot apply directly to mentors. Please apply through problem statements instead." 
          });
        }
      }

      // Verify target user exists and has correct role
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || targetUser.role !== targetUserRole) {
        return res.status(400).json({ message: "Target user not found or role mismatch" });
      }

      // Check if application already exists
      const existing = await storage.getTeamMemberApplication(founderId, targetUserId);
      if (existing) {
        return res.status(400).json({ message: "You have already applied to this user" });
      }

      // No limits on number of applications - founder can apply to unlimited people

      const application = await storage.createTeamMemberApplication({
        founderId,
        targetUserId,
        targetUserRole,
        message: message || null,
        status: "PENDING",
      });

      // Create notification for the target user
      try {
        const applicant = await storage.getUser(founderId);
        const targetUser = await storage.getUser(targetUserId);
        
        if (targetUser && applicant) {
          // Determine role label for notification
          const applicantRoleLabel = currentUser?.role === "FOUNDER" ? "Founder" :
                                     currentUser?.role === "COFOUNDER" ? "Co-Founder" :
                                     currentUser?.role === "LEARNER" ? "Learner" : "User";
          
          const targetRoleLabel = targetUserRole === "MENTOR" ? "Mentor" :
                                 targetUserRole === "COFOUNDER" ? "Co-Founder" :
                                 targetUserRole === "LEARNER" ? "Learner" :
                                 targetUserRole === "FOUNDER" ? "Founder" : "Team Member";
          
          await storage.createNotification({
            userId: targetUserId,
            type: "TEAM_MEMBER_APPLICATION_RECEIVED" as any,
            title: `New Team Application from ${applicant.name}`,
            message: `${applicant.name} (${applicantRoleLabel}) has applied to join as ${targetRoleLabel === "Founder" ? "a team member" : `your ${targetRoleLabel}`}. Review the application in your dashboard.`,
            status: "UNREAD" as any,
            metadataJson: {
              applicationId: application.id,
              applicantId: founderId,
              applicantName: applicant.name,
              applicantRole: currentUser?.role,
              targetUserRole: targetUserRole,
            },
          });
        }
      } catch (notifError: any) {
        console.error("Error creating notification for team member application:", notifError);
        // Don't fail the request if notification creation fails
      }

      res.status(201).json(application);
    } catch (error: any) {
      console.error("Error creating team member application:", error);
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  // Update team member application status (accept/reject)
  app.patch("/api/team-member-applications/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { status } = req.body;

      if (!["ACCEPTED", "REJECTED"].includes(status)) {
        return res.status(400).json({ message: "Status must be ACCEPTED or REJECTED" });
      }

      const application = await storage.getTeamMemberApplicationById(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (application.targetUserId !== userId) {
        return res.status(403).json({ message: "You can only update applications sent to you" });
      }

      const updated = await storage.updateTeamMemberApplication(req.params.id, { status });
      
      console.log("📝 Application status updated:", {
        applicationId: req.params.id,
        newStatus: status,
        applicantId: application.founderId,
        targetUserId: application.targetUserId,
      });
      
      // If approved, ensure founder has a team ready but wait for manual addition of members
      if (status === "ACCEPTED") {
        try {
          const founder = await storage.getUser(application.founderId);
          const acceptingUser = await storage.getUser(userId);

          console.log("👥 Users loaded:", {
            founder: founder ? { id: founder.id, name: founder.name, role: founder.role } : null,
            acceptingUser: acceptingUser ? { id: acceptingUser.id, name: acceptingUser.name, role: acceptingUser.role } : null,
          });

          if (founder?.role === "FOUNDER" && acceptingUser && application.targetUserRole !== "FOUNDER") {
            const founderAssignments = await storage.getRoleAssignmentsByUser(application.founderId);
            const founderTeamAssignment = founderAssignments.find(a => a.role === "Founder");

            if (!founderTeamAssignment) {
              console.log("📝 Creating new team for founder:", application.founderId);

              const cohorts = await storage.getCohorts();
              const activeCohort = cohorts.find(c => new Date(c.startDate) <= new Date() && new Date(c.endDate) >= new Date()) || cohorts[0];

              if (!activeCohort) {
                throw new Error("No cohort available to create team");
              }

              const newTeam = await storage.createTeam({
                cohortId: activeCohort.id,
                name: `${founder.name}'s Team`,
                health: "G",
              });

              await storage.createRoleAssignment({
                userId: application.founderId,
                teamId: newTeam.id,
                role: "Founder",
                stipendBand: "A",
              });

              console.log("✅ Created new team and assigned founder:", { teamId: newTeam.id, founderId: application.founderId });
            } else {
              console.log("ℹ️ Founder already assigned to team:", { teamId: founderTeamAssignment.teamId });
            }

            console.log("⏳ Awaiting founder to manually add accepted member", {
              founderId: application.founderId,
              acceptedUserId: acceptingUser.id,
            });
          } else {
            console.log("⚠️ Skipping team preparation:", {
              founderRole: founder?.role,
              targetUserRole: application.targetUserRole,
              hasAcceptingUser: !!acceptingUser,
              reason: !founder?.role ? "No founder role" :
                      founder?.role !== "FOUNDER" ? `Founder role is ${founder.role}, not FOUNDER` :
                      application.targetUserRole === "FOUNDER" ? "Founder-to-founder applications not supported" :
                      !acceptingUser ? "No accepting user found" : "Unknown",
            });
          }
        } catch (assignmentError) {
          console.error("❌ Error preparing founder team for manual assignment:", assignmentError);
          console.error("Error stack:", (assignmentError as Error).stack);
        }
      }
      
      // If approved, create notification for the founder
      if (status === "ACCEPTED") {
        try {
          console.log("🔔 Creating notification for founder after application acceptance...");
          const targetUser = await storage.getUser(userId);
          const founder = await storage.getUser(application.founderId);

          console.log("📋 Notification data:", {
            founderId: application.founderId,
            founderFound: !!founder,
            targetUserId: userId,
            targetUserFound: !!targetUser,
            targetUserName: targetUser?.name,
            targetUserRole: application.targetUserRole,
          });

          if (founder) {
            // Determine role label for notification
            const roleLabel = application.targetUserRole === "MENTOR" ? "Mentor" :
              application.targetUserRole === "COFOUNDER" ? "Co-Founder" :
                application.targetUserRole === "LEARNER" ? "Learner" : "Team Member";

            const notificationData = {
              userId: founder.id,
              type: "TEAM_MEMBER_APPLICATION_ACCEPTED" as any,
              title: `Application Accepted - ${targetUser?.name || roleLabel}`,
              message: `${targetUser?.name || `A ${roleLabel.toLowerCase()}`} has accepted your team member application. You can now add them to your team.`,
              status: "UNREAD" as any,
              metadataJson: {
                applicationId: application.id,
                targetUserId: application.targetUserId,
                targetUserRole: application.targetUserRole,
                targetUserName: targetUser?.name,
                targetUserEmail: targetUser?.email,
              },
            };
            console.log("📝 Creating notification with data:", notificationData);
            const notification = await storage.createNotification(notificationData);
            console.log("✅ Notification created successfully:", {
              notificationId: notification.id,
              userId: notification.userId,
              founderEmail: founder.email,
              type: notification.type,
              status: notification.status,
              targetUserRole: application.targetUserRole,
              targetUserName: targetUser?.name,
            });
          } else {
            console.error("❌ Founder not found for userId:", application.founderId);
          }
        } catch (notifError: any) {
          console.error("❌ Error creating notification for founder:", notifError);
          console.error("Error details:", {
            message: notifError.message,
            stack: notifError.stack,
            code: notifError.code,
            applicationId: application.id,
            founderId: application.founderId,
            targetUserId: userId,
            targetUserRole: application.targetUserRole,
          });
          // Don't fail the request if notification creation fails
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating application:", error);
      res.status(500).json({ message: "Failed to update application" });
    }
  });

  // Delete/cancel team member application (founder/cofounder/learner withdraws application)
  app.delete("/api/team-member-applications/:id", requireRole("FOUNDER", "COFOUNDER", "LEARNER"), async (req, res) => {
    try {
      const { id } = req.params;
      const founderId = req.session!.userId!;

      const application = await storage.getTeamMemberApplicationById(id);
      if (!application || application.founderId !== founderId) {
        return res.status(403).json({ message: "Forbidden or application not found" });
      }

      // Only allow cancellation of pending applications
      if (application.status !== "PENDING") {
        return res.status(400).json({ message: "Only pending applications can be cancelled" });
      }

      const deleted = await storage.deleteTeamMemberApplication(id);
      if (deleted) {
        res.json({ message: "Application cancelled successfully" });
      } else {
        res.status(404).json({ message: "Application not found" });
      }
    } catch (error: any) {
      console.error("Error cancelling team member application:", error);
      res.status(500).json({ message: "Failed to cancel application" });
    }
  });

  // =====================
  // Application Routes
  // =====================

  app.get("/api/applications", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session!.userId!);
    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Admins can see all applications
    if (currentUser.role === "ADMIN") {
      const applications = await storage.getApplications();
      return res.json(applications);
    }

    // Others can only see their own applications
    const applications = await storage.getApplicationsByUser(currentUser.id);
    res.json(applications);
  });

  app.get("/api/applications/:id", requireAuth, async (req, res) => {
    const application = await storage.getApplication(req.params.id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const currentUser = await storage.getUser(req.session!.userId!);
    if (currentUser?.role !== "ADMIN" && application.userId !== currentUser?.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(application);
  });

  // Application CV upload URL endpoint
  // NOTE: This route must be defined BEFORE any catch-all routes
  app.post("/api/applications/cv/upload-url", async (req, res) => {
    console.log("📤 Application CV upload URL requested:", req.body);
    try {
      const { fileName, fileType } = req.body;

      if (!fileName) {
        return res.status(400).json({ message: "File name is required" });
      }

      // Generate a unique ID for the CV upload
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      // Fix: Use correct object key format that S3StorageService expects/can handle or just consistent pathing
      const objectKey = `applications/cv/${fileId}/${fileName}`;
      const contentType = fileType || 'application/pdf';

      console.log("📤 Generated Content-Type for signed URL:", contentType);
      console.log("📤 File name:", fileName);

      // Lazy load s3 storage to ensure environment variables are loaded
      const { s3Storage } = await import("./s3");

      // Get signed URL using the service
      const signedURL = await s3Storage.getSignedUploadURL(objectKey, contentType, 900); // 15 mins

      console.log("✅ Signed URL generated successfully for:", objectKey);

      res.json({
        uploadUrl: signedURL, // FIXED: Changed from uploadURL to uploadUrl to match client expectation
        objectKey: objectKey,
        fileId: fileId,
      });
    } catch (error: any) {
      console.error("❌ Error generating upload URL:", error);
      console.error("Error generating upload URL:", error);
      res.status(500).json({
        message: "Failed to generate upload URL"
      });
    }
  });

  // Payment proof upload URL endpoint
  // NOTE: This route must be defined BEFORE any catch-all routes
  app.post("/api/payments/proof/upload-url", async (req, res) => {
    console.log("📤 Payment proof upload URL requested:", req.body);
    try {
      const { fileName, fileType, applicationId } = req.body;

      if (!fileName) {
        return res.status(400).json({ message: "File name is required" });
      }

      // Generate a unique ID for the payment proof upload
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const objectKey = `payments/proof/${applicationId || 'general'}/${fileId}/${fileName}`;
      const contentType = fileType || 'application/pdf';

      console.log("📤 Generated Content-Type for signed URL:", contentType);
      console.log("📤 File name:", fileName);
      console.log("📤 Object key:", objectKey);

      // Lazy load s3 storage to ensure environment variables are loaded
      const { s3Storage } = await import("./s3");

      // Get signed URL using the service
      const signedURL = await s3Storage.getSignedUploadURL(objectKey, contentType, 900); // 15 mins

      console.log("✅ Signed URL generated successfully for:", objectKey);

      res.json({
        uploadUrl: signedURL,
        objectKey: objectKey,
        fileId: fileId,
      });
    } catch (error: any) {
      console.error("❌ Error generating payment proof upload URL:", error);
      res.status(500).json({
        message: "Failed to generate upload URL"
      });
    }
  });

  // MOM document upload URL endpoint
  app.post("/api/meetings/mom/upload-url", requireAuth, async (req, res) => {
    try {
      const { fileName, fileType } = req.body;
      if (!fileName) {
        return res.status(400).json({ message: "File name is required" });
      }
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const objectKey = `meetings/mom/${fileId}/${fileName}`;
      const contentType = fileType || "application/pdf";
      const { s3Storage } = await import("./s3");
      const signedURL = await s3Storage.getSignedUploadURL(objectKey, contentType, 900);
      res.json({ uploadUrl: signedURL, objectKey, fileId });
    } catch (error: any) {
      console.error("❌ Error generating MOM upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Payment proof view URL endpoint
  app.post("/api/payments/proof/view-url", async (req, res) => {
    console.log("👁️ Payment proof view URL requested:", req.body);
    try {
      const { objectKey } = req.body;

      if (!objectKey) {
        return res.status(400).json({ message: "Object key is required" });
      }

      if (process.env.AWS_S3_BUCKET_NAME) {
        const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
        const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

        const s3Client = new S3Client({
          region: process.env.AWS_REGION || "us-east-1",
          credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
            : undefined,
        });

        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: objectKey,
        });

        const signedGetURL = await getSignedUrl(s3Client, command, {
          expiresIn: 900, // 15 minutes
        });

        res.json({
          viewUrl: signedGetURL,
        });
      } else {
        // For non-S3 storage, use S3StorageService fallback or return error
        // Payment proofs should use S3, so this branch may not be needed
        res.status(501).json({
          message: "Payment proof view URL requires S3 storage configuration"
        });
      }
    } catch (error: any) {
      console.error("❌ Error generating payment proof view URL:", error);
      res.status(500).json({
        message: "Failed to generate view URL"
      });
    }
  });

  // Mentor file upload URL endpoint (for CV, certifications, and videos)
  // NOTE: This route must be defined BEFORE any catch-all routes
  app.post("/api/mentors/files/upload-url", async (req, res) => {
    console.log("📤 Mentor file upload URL requested:", req.body);
    try {
      const { fileName, fileType, fileCategory } = req.body; // fileCategory: 'cv', 'certification', 'video'

      if (!fileName) {
        return res.status(400).json({ message: "File name is required" });
      }

      if (!fileCategory || !['cv', 'certification', 'video'].includes(fileCategory)) {
        return res.status(400).json({ message: "File category must be 'cv', 'certification', or 'video'" });
      }

      // Generate a unique ID for the mentor file upload
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const objectKey = `mentors/${fileCategory}/${fileId}/${fileName}`;

      if (process.env.AWS_S3_BUCKET_NAME) {
        const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
        const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

        const s3Client = new S3Client({
          region: process.env.AWS_REGION || "us-east-1",
          credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
            : undefined,
        });

        const contentType = fileType || (fileCategory === 'video' ? 'video/mp4' : 'application/pdf');
        console.log("📤 Generated Content-Type for signed URL:", contentType);
        console.log("📤 File category:", fileCategory);
        console.log("📤 File name:", fileName);

        const command = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: objectKey,
          ContentType: contentType,
        });

        const signedURL = await getSignedUrl(s3Client, command, {
          expiresIn: 900, // 15 minutes
        });

        console.log("✅ Signed URL generated successfully for:", objectKey);

        res.json({
          uploadURL: signedURL,
          objectKey: objectKey,
          fileId: fileId,
          contentType: contentType, // Return Content-Type so frontend can verify
        });
      } else {
        const { ObjectStorageService } = await import("./objectStorage");
        const objectStorageService = new ObjectStorageService();
        const objectPath = `/objects/${objectKey}`;
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();

        res.json({
          uploadURL,
          objectKey: objectKey,
          fileId: fileId,
        });
      }
    } catch (error) {
      console.error("Error getting CV upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Generate GET pre-signed URL for viewing mentor files (after upload)
  app.post("/api/mentors/files/view-url", async (req, res) => {
    console.log("👁️ Mentor file view URL requested:", req.body);
    try {
      const { objectKey } = req.body;

      if (!objectKey) {
        return res.status(400).json({ message: "Object key is required" });
      }

      if (process.env.AWS_S3_BUCKET_NAME) {
        const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
        const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

        const s3Client = new S3Client({
          region: process.env.AWS_REGION || "us-east-1",
          credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
            : undefined,
        });

        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: objectKey,
        });

        const signedGetURL = await getSignedUrl(s3Client, command, {
          expiresIn: 900, // 15 minutes
        });

        console.log("✅ GET signed URL generated successfully for:", objectKey);

        res.json({
          fileUrl: signedGetURL,
          objectKey: objectKey,
        });
      } else {
        // For non-S3 storage, return the object path directly
        const objectPath = `/objects/${objectKey}`;

        res.json({
          fileUrl: objectPath,
          objectKey: objectKey,
        });
      }
    } catch (error) {
      console.error("❌ Error getting mentor file view URL:", error);
      res.status(500).json({ message: "Failed to get view URL" });
    }
  });

  // Generate PUT pre-signed URL for uploading user avatar
  app.post("/api/users/avatar/upload-url", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { fileName, fileType } = req.body;
      if (!fileName) return res.status(400).json({ message: "File name is required" });

      // Get user to determine role for folder structure
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Create role-based folder name
      const roleFolderMap: Record<string, string> = {
        FOUNDER: "founder profile photo",
        COFOUNDER: "cofounder profile photo",
        LEARNER: "learner profile photo",
        MENTOR: "mentor profile photo",
        ADMIN: "admin profile photo",
      };
      const roleFolder = roleFolderMap[user.role] || "user profile photo";

      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const fileExtension = fileName.split('.').pop() || 'jpg';
      const sanitizedFileName = `${fileId}.${fileExtension}`;
      const objectKey = `${roleFolder}/${userId}/${sanitizedFileName}`;

      if (process.env.AWS_S3_BUCKET_NAME) {
        const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
        const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

        const s3Client = new S3Client({
          region: process.env.AWS_REGION || "us-east-1",
          credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
            : undefined,
        });

        const contentType = fileType || "image/jpeg";

        const command = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: objectKey,
          ContentType: contentType,
        });

        const signedURL = await getSignedUrl(s3Client, command, { expiresIn: 900 });

        return res.json({ uploadURL: signedURL, objectKey, contentType });
      }

      // Fallback for non-S3 environments
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      return res.json({ uploadURL, objectKey });
    } catch (error: any) {
      console.error("Error generating avatar upload URL:", error);
      res.status(500).json({ message: "Failed to generate avatar upload URL" });
    }
  });

  // Change password for current user
  app.post("/api/users/change-password", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) return res.status(400).json({ message: "Old and new passwords are required" });

      // Password policy: min 8, at least one number and one special char
      if (typeof newPassword !== 'string' || newPassword.length < 8 || !/\d/.test(newPassword) || !/[^\w\s]/.test(newPassword)) {
        return res.status(400).json({ message: "Password must be at least 8 characters, include a number and a special character" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await bcrypt.compare(oldPassword, user.password || "");
      if (!valid) return res.status(403).json({ message: "Old password is incorrect" });

      const hashed = await bcrypt.hash(newPassword, 10);
      const updated = await storage.updateUser(userId, {
        password: hashed,
        passwordChangedAt: new Date(),
      });
      if (!updated) return res.status(500).json({ message: "Failed to update password" });

      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Update avatar URL after upload completes
  app.post("/api/users/avatar/update", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { objectKey } = req.body;

      if (!objectKey || typeof objectKey !== "string") {
        return res.status(400).json({ message: "Object key is required" });
      }

      // Update user's avatarUrl in database
      const updated = await storage.updateUser(userId, { avatarUrl: objectKey.trim() });
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        success: true,
        message: "Avatar updated successfully",
        user: { ...updated, password: undefined }
      });
    } catch (error: any) {
      console.error("Error updating avatar:", error);
      res.status(500).json({ message: "Failed to update avatar" });
    }
  });

  // Get avatar view URL for current user
  app.post("/api/auth/profile/avatar-url", requireAuth, async (req, res) => {
    try {
      const { objectKey } = req.body;

      if (!objectKey) {
        return res.status(400).json({ message: "Object key is required" });
      }

      // Use S3 storage service to get signed URL
      if (process.env.AWS_S3_BUCKET_NAME) {
        const { S3StorageService } = await import("./s3Storage");
        const storageService = new S3StorageService();

        // Check if file exists
        const exists = await storageService.objectExists(objectKey);
        if (!exists) {
          return res.status(404).json({ message: "Avatar file not found" });
        }

        // Generate signed GET URL valid for 1 hour
        const fileUrl = await storageService.getSignedDownloadURL(objectKey, 3600);

        res.json({ fileUrl });
      } else {
        // Fallback to local storage
        const { ObjectStorageService } = await import("./objectStorage");
        const storageService = new ObjectStorageService();

        const fileUrl = await storageService.getSignedUrl(objectKey);
        res.json({ fileUrl });
      }
    } catch (error: any) {
      console.error("Error generating avatar view URL:", error);
      res.status(500).json({ message: "Failed to generate avatar view URL" });
    }
  });

  // Get detailed profile for current user (includes avatar signed URL)
  app.get("/api/auth/profile/detailed", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate avatar URL if user has an avatar
      let avatarUrl = null;
      if (user.avatarUrl) {
        try {
          if (process.env.AWS_S3_BUCKET_NAME) {
            const { S3StorageService } = await import("./s3Storage");
            const storageService = new S3StorageService();

            // Check if file exists
            const exists = await storageService.objectExists(user.avatarUrl);
            if (exists) {
              // Generate signed GET URL valid for 1 hour
              avatarUrl = await storageService.getSignedDownloadURL(user.avatarUrl, 3600);
            }
          } else {
            // Fallback to local storage
            const { ObjectStorageService } = await import("./objectStorage");
            const storageService = new ObjectStorageService();

            avatarUrl = await storageService.getSignedUrl(user.avatarUrl);
          }
        } catch (error) {
          console.warn("Error generating avatar URL:", error);
          // Continue without avatar URL
        }
      }

      // Get preferredTrack and domain from appropriate table based on role
      let preferredTrack = null;
      let domain = null;
      try {
        if (user.role === 'MENTOR') {
          // For mentors, fetch from mentor_profiles table
          const mentorProfile = await storage.getMentorProfileByUserId(userId);
          if (mentorProfile?.tracksJson) {
            const tracks = mentorProfile.tracksJson as string[];
            // Return first track or join multiple tracks
            preferredTrack = tracks.length > 0 ? tracks.join(', ') : null;
          }
        } else {
          // For founders, cofounders, learners - fetch from user's application(s)
          const userApplications = await storage.getApplicationsByUser(userId);
          console.log(`[Profile Detailed] ==========================================`);
          console.log(`[Profile Detailed] User ${userId} has ${userApplications.length} application(s)`);
          
          // Log all applications for debugging
          userApplications.forEach((app, index) => {
            console.log(`[Profile Detailed] Application ${index + 1}:`);
            console.log(`[Profile Detailed]   - ID: ${app.id}`);
            console.log(`[Profile Detailed]   - Type: ${app.type}`);
            console.log(`[Profile Detailed]   - Status: ${app.status}`);
            console.log(`[Profile Detailed]   - CohortId (from table): ${app.cohortId || 'null'}`);
            console.log(`[Profile Detailed]   - Has formJson: ${!!app.formJson}`);
            if (app.formJson) {
              console.log(`[Profile Detailed]   - formJson type: ${typeof app.formJson}`);
              if (typeof app.formJson === 'string') {
                console.log(`[Profile Detailed]   - formJson (first 500 chars): ${app.formJson.substring(0, 500)}`);
              } else {
                console.log(`[Profile Detailed]   - formJson keys: ${Object.keys(app.formJson as any).join(', ')}`);
                console.log(`[Profile Detailed]   - formJson preferredTrack: ${(app.formJson as any).preferredTrack || 'not found'}`);
                console.log(`[Profile Detailed]   - formJson preferredTracks: ${JSON.stringify((app.formJson as any).preferredTracks) || 'not found'}`);
                console.log(`[Profile Detailed]   - formJson cohortId: ${(app.formJson as any).cohortId || 'not found'}`);
              }
            }
          });
          
          // Prefer ACCEPTED applications, otherwise use the latest
          // Also check all applications if the first one doesn't have the data we need
          let applicationToUse = userApplications.find(app => app.status === 'ACCEPTED');
          if (!applicationToUse && userApplications.length > 0) {
            applicationToUse = userApplications[0];
          }
          
          // If we still don't have preferredTrack or domain, check other applications
          if (applicationToUse) {
            console.log(`[Profile Detailed] ==========================================`);
            console.log(`[Profile Detailed] Using application ${applicationToUse.id}, status: ${applicationToUse.status}, cohortId: ${applicationToUse.cohortId}`);
            // Parse formJson if it's a string, otherwise use as-is
            let formData: any = null;
            if (applicationToUse.formJson) {
              if (typeof applicationToUse.formJson === 'string') {
                console.log(`[Profile Detailed] formJson is a string, parsing...`);
                try {
                  formData = JSON.parse(applicationToUse.formJson);
                  console.log(`[Profile Detailed] Successfully parsed formJson`);
                } catch (e) {
                  console.warn("[Profile Detailed] Error parsing formJson:", e);
                  formData = applicationToUse.formJson;
                }
              } else {
                console.log(`[Profile Detailed] formJson is already an object`);
                formData = applicationToUse.formJson;
              }
            } else {
              console.log(`[Profile Detailed] No formJson in application`);
            }
            
            if (formData) {
              console.log(`[Profile Detailed] ==========================================`);
              console.log(`[Profile Detailed] FormData analysis:`);
              console.log(`[Profile Detailed] FormData keys:`, Object.keys(formData));
              console.log(`[Profile Detailed] Full formData:`, JSON.stringify(formData, null, 2).substring(0, 1000));
              console.log(`[Profile Detailed] preferredTrack:`, formData.preferredTrack, `(type: ${typeof formData.preferredTrack})`);
              console.log(`[Profile Detailed] preferredTracks:`, formData.preferredTracks, `(type: ${typeof formData.preferredTracks}, isArray: ${Array.isArray(formData.preferredTracks)})`);
              console.log(`[Profile Detailed] track:`, formData.track);
              console.log(`[Profile Detailed] sector:`, formData.sector);
              console.log(`[Profile Detailed] cohortId in formData:`, formData.cohortId);
              
              // Try multiple field names for preferred track
              if (formData.preferredTrack) {
                preferredTrack = formData.preferredTrack;
                console.log(`[Profile Detailed] Found preferredTrack:`, preferredTrack);
              } else if (formData.preferredTracks && Array.isArray(formData.preferredTracks) && formData.preferredTracks.length > 0) {
                // If preferredTracks is an array, join them
                preferredTrack = formData.preferredTracks.join(', ');
                console.log(`[Profile Detailed] Found preferredTracks array:`, preferredTrack);
              } else if (formData.track) {
                preferredTrack = formData.track;
                console.log(`[Profile Detailed] Found track:`, preferredTrack);
              } else if (formData.sector) {
                preferredTrack = formData.sector;
                console.log(`[Profile Detailed] Found sector:`, preferredTrack);
              } else {
                console.log(`[Profile Detailed] No preferred track found in formData`);
              }
              
              // Get domain (cohort name) from cohortId
              // Check both the application's cohortId field and formData's cohortId
              const cohortId = applicationToUse.cohortId || formData.cohortId;
              console.log(`[Profile Detailed] Looking for cohort with ID:`, cohortId);
              if (cohortId) {
                try {
                  const cohort = await storage.getCohort(cohortId);
                  if (cohort) {
                    domain = cohort.name;
                    console.log(`[Profile Detailed] Found domain:`, domain);
                  } else {
                    console.log(`[Profile Detailed] Cohort not found for ID:`, cohortId);
                  }
                } catch (cohortError) {
                  console.warn("Error fetching cohort for domain:", cohortError);
                }
              } else {
                console.log(`[Profile Detailed] No cohortId found in application or formData`);
              }
            } else {
              console.log(`[Profile Detailed] No formData found in application`);
            }
            
            // If we still don't have preferredTrack or domain, check other applications
            if ((!preferredTrack || !domain) && userApplications.length > 1) {
              console.log(`[Profile Detailed] Missing data, checking other applications...`);
              for (const app of userApplications) {
                if (app.id === applicationToUse.id) continue; // Skip the one we already checked
                
                let appFormData: any = null;
                if (app.formJson) {
                  if (typeof app.formJson === 'string') {
                    try {
                      appFormData = JSON.parse(app.formJson);
                    } catch (e) {
                      appFormData = app.formJson;
                    }
                  } else {
                    appFormData = app.formJson;
                  }
                }
                
                if (appFormData) {
                  // Try to get preferredTrack if we don't have it
                  if (!preferredTrack) {
                    if (appFormData.preferredTrack) {
                      preferredTrack = appFormData.preferredTrack;
                      console.log(`[Profile Detailed] Found preferredTrack in application ${app.id}:`, preferredTrack);
                    } else if (appFormData.preferredTracks && Array.isArray(appFormData.preferredTracks) && appFormData.preferredTracks.length > 0) {
                      preferredTrack = appFormData.preferredTracks.join(', ');
                      console.log(`[Profile Detailed] Found preferredTracks in application ${app.id}:`, preferredTrack);
                    }
                  }
                  
                  // Try to get domain if we don't have it
                  if (!domain) {
                    const appCohortId = app.cohortId || appFormData.cohortId;
                    if (appCohortId) {
                      try {
                        const cohort = await storage.getCohort(appCohortId);
                        if (cohort) {
                          domain = cohort.name;
                          console.log(`[Profile Detailed] Found domain in application ${app.id}:`, domain);
                        }
                      } catch (e) {
                        // Ignore
                      }
                    }
                  }
                  
                  // If we found both, we can stop
                  if (preferredTrack && domain) break;
                }
              }
            }
          } else {
            console.log(`[Profile Detailed] No applications found for user`);
          }
          
          // Fallback: If domain not found in application, check direct cohort assignment
          if (!domain) {
            try {
              const cohortUser = await storage.getCohortUser(userId);
              if (cohortUser?.cohortId) {
                const cohort = await storage.getCohort(cohortUser.cohortId);
                if (cohort) {
                  domain = cohort.name;
                }
              }
            } catch (cohortUserError) {
              console.warn("Error fetching direct cohort assignment:", cohortUserError);
            }
          }
          
          // Fallback: If domain still not found, check user's team's cohort
          if (!domain) {
            try {
              const userAssignments = await storage.getRoleAssignmentsByUser(userId);
              if (userAssignments.length > 0) {
                const teamIds = userAssignments.map(a => a.teamId).filter((id): id is string => id !== null);
                for (const teamId of teamIds) {
                  const team = await storage.getTeam(teamId);
                  if (team?.cohortId) {
                    const cohort = await storage.getCohort(team.cohortId);
                    if (cohort) {
                      domain = cohort.name;
                      break; // Use the first team's cohort found
                    }
                  }
                }
              }
            } catch (teamCohortError) {
              console.warn("Error fetching team cohort:", teamCohortError);
            }
          }
        }
      } catch (error) {
        console.warn("Error fetching preferredTrack and domain:", error);
      }

      // Return user data with avatar URL, preferredTrack, and domain
      const responseData = {
        ...user,
        password: undefined,
        avatarUrl,
        preferredTrack: preferredTrack || null,
        domain: domain || null
      };
      console.log(`[Profile Detailed] ==========================================`);
      console.log(`[Profile Detailed] FINAL RESPONSE SUMMARY:`);
      console.log(`[Profile Detailed] preferredTrack: ${responseData.preferredTrack} (${typeof responseData.preferredTrack})`);
      console.log(`[Profile Detailed] domain: ${responseData.domain} (${typeof responseData.domain})`);
      console.log(`[Profile Detailed] Response data keys:`, Object.keys(responseData));
      console.log(`[Profile Detailed] Full response (preferredTrack/domain only):`, JSON.stringify({ preferredTrack: responseData.preferredTrack, domain: responseData.domain }, null, 2));
      console.log(`[Profile Detailed] ==========================================`);
      res.json(responseData);
    } catch (error: any) {
      console.error("Error getting detailed profile:", error);
      res.status(500).json({ message: "Failed to get profile details" });
    }
  });


  app.post("/api/applications", async (req, res) => {
    try {
      const { type, formJson, cohortId, cvS3Key, teamInviteToken } = req.body;
      
      console.log("📝 Creating application with type:", type, teamInviteToken ? "(via team invite)" : "");

      let resolvedType: string = type;
      let teamInviteContext: null | {
        inviteId: string;
        memberId: string;
        teamApplicationId: string;
        memberRole: "FOUNDER" | "COFOUNDER" | "LEARNER";
        cofounderRole?: "CTO" | "CBO";
        internTrack?: "TECHNICAL" | "BUSINESS" | "BOTH";
        memberEmail: string;
        memberName: string;
      } = null;

      // Normalize preferredTracks when the frontend sends a checkbox map
      // Older client versions submit preferredTracks as an object map { trackValue: true }
      // Convert that to an array of selected track keys so Zod validation succeeds.
      const normalizedFormJson: any = { ...(formJson || {}) };
      if (
        normalizedFormJson.preferredTracks &&
        !Array.isArray(normalizedFormJson.preferredTracks) &&
        typeof normalizedFormJson.preferredTracks === "object"
      ) {
        try {
          normalizedFormJson.preferredTracks = Object.entries(normalizedFormJson.preferredTracks)
            .filter(([, v]) => !!v)
            .map(([k]) => k);
        } catch (e) {
          // If normalization fails, leave as-is and let Zod report a clear error
        }
      }

      console.log("📝 Form data keys:", Object.keys(normalizedFormJson || {}));

      // The preferredTrack(s) zod rules are plain strings now (the selectable
      // list lives in the `tracks` catalog, so a hardcoded enum would reject
      // anything an admin adds). Validate against the catalog here instead, and
      // normalise casing so "fintech" is stored as "FinTech".
      {
        const catalog = await storage.getTracks(true);
        const byLower = new Map(catalog.map((t) => [t.value.toLowerCase(), t.value]));

        const resolveOne = (raw: unknown): string | undefined => {
          if (typeof raw !== "string" || !raw.trim()) return undefined;
          return byLower.get(raw.trim().toLowerCase());
        };

        if (normalizedFormJson.preferredTrack !== undefined) {
          const resolved = resolveOne(normalizedFormJson.preferredTrack);
          if (!resolved) {
            return res.status(400).json({
              message: `Unknown track "${normalizedFormJson.preferredTrack}"`,
            });
          }
          normalizedFormJson.preferredTrack = resolved;
        }

        if (Array.isArray(normalizedFormJson.preferredTracks)) {
          const resolvedAll: string[] = [];
          for (const raw of normalizedFormJson.preferredTracks) {
            const resolved = resolveOne(raw);
            if (!resolved) {
              return res.status(400).json({ message: `Unknown track "${raw}"` });
            }
            if (!resolvedAll.includes(resolved)) resolvedAll.push(resolved);
          }
          normalizedFormJson.preferredTracks = resolvedAll;
        }
      }

      // If submitted via team invite, force the application type and lock the identity/role details.
      if (teamInviteToken && typeof teamInviteToken === "string" && teamInviteToken.trim()) {
        const token = teamInviteToken.trim();
        const crypto = await import("crypto");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const invite = await storage.getTeamApplicationInviteByTokenHash(tokenHash);
        if (!invite) {
          return res.status(400).json({ message: "Invalid invite token" });
        }
        if (invite.usedAt) {
          return res.status(400).json({ message: "This invite link has already been used" });
        }
        if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
          return res.status(400).json({ message: "This invite link has expired" });
        }

        const member = await storage.getTeamApplicationMember(invite.memberId);
        if (!member) {
          return res.status(400).json({ message: "Invalid invite link (member not found)" });
        }

        // Only allow invited roles
        if (!(["FOUNDER", "COFOUNDER", "LEARNER"] as const).includes(member.role as any)) {
          return res.status(400).json({ message: "Invalid invited role" });
        }

        // Force application type to match invited role
        resolvedType = member.role;

        // Lock identity
        normalizedFormJson.email = member.email;
        normalizedFormJson.fullName = member.fullName;

        // Force role-specific fields
        if (member.role === "COFOUNDER" && member.cofounderRole) {
          normalizedFormJson.interestedRole = member.cofounderRole;
        }
        if (member.role === "LEARNER" && member.internTrack) {
          const mapped = member.internTrack === "BOTH" ? "MIXED" : member.internTrack;
          normalizedFormJson.interestedRole = mapped;
        }

        teamInviteContext = {
          inviteId: invite.id,
          memberId: member.id,
          teamApplicationId: member.teamApplicationId,
          memberRole: member.role as any,
          cofounderRole: (member.cofounderRole as any) || undefined,
          internTrack: (member.internTrack as any) || undefined,
          memberEmail: member.email,
          memberName: member.fullName,
        };
      }

      // Validate form data based on application type
      let validatedForm;
      switch (resolvedType) {
        case "LEARNER":
        case "PROFESSIONAL":
        case "FOUNDER":
        case "COFOUNDER":
          validatedForm = learnerApplicationFormSchema.parse(normalizedFormJson);
          break;
        case "UNIVERSITY":
          validatedForm = universityApplicationFormSchema.parse(formJson);
          break;
        case "CORPORATE":
          validatedForm = corporateApplicationFormSchema.parse(formJson);
          break;
        default:
          console.error("❌ Invalid application type:", resolvedType);
          return res.status(400).json({ message: "Invalid application type", receivedType: resolvedType });
      }

      console.log("✅ Form validation passed, checking for duplicate contacts...");

      // Server-side per-role duplicate check to prevent duplicates
      try {
        const contactEmail = (validatedForm as any).email || null;
        const contactPhone = (validatedForm as any).phone || null;
        const dup = await checkContactDupes(resolvedType, contactEmail, contactPhone);
        if (dup.emailExists || dup.phoneExists) {
          return res.status(400).json({
            message: "Duplicate contact for this role",
            emailExists: dup.emailExists,
            phoneExists: dup.phoneExists,
          });
        }
      } catch (e) {
        console.warn("Duplicate check failed (continuing):", e);
      }

      console.log("✅ Form validation passed, creating application...");

      // Additional validation for learner applications
      if (resolvedType === "LEARNER" || resolvedType === "PROFESSIONAL") {
        const technicalSkills = (validatedForm as any).technicalSkills;
        const readyForProjects = (validatedForm as any).readyForProjects;
        const needsTraining = (validatedForm as any).needsTraining;

        // Validate technical skills if provided
        if (technicalSkills && (!Array.isArray(technicalSkills) || technicalSkills.length === 0)) {
          return res.status(400).json({ message: "Technical skills must be a non-empty array" });
        }

        // Validate project readiness mutual exclusivity if provided
        if (typeof readyForProjects === 'boolean' && typeof needsTraining === 'boolean') {
          if (readyForProjects && needsTraining) {
            return res.status(400).json({ 
              message: "Cannot select both 'ready for projects' and 'needs training'. Please select only one." 
            });
          }
        }

        console.log("✅ Learner/Professional specific validation passed");
      }

      // Calculate fee based on type and plan using shared function
      const plan = (validatedForm as any).plan || (validatedForm as any).tier || "";
      const feeAmount = getFeeByType(resolvedType, plan).toString();

      const acceptedTerms = (validatedForm as any).acceptTerms === true;

      const application = await storage.createApplication({
        type: resolvedType as any,
        userId: req.session?.userId || null,
        status: "NEW",
        formJson: validatedForm,
        cohortId,
        feeAmount: feeAmount,
        acceptedTermsAt: acceptedTerms ? new Date() : null,
      });

      // If created via invite, link the submission to the team roster + consume invite.
      if (teamInviteContext) {
        try {
          await storage.updateTeamApplicationMember(teamInviteContext.memberId, {
            individualApplicationId: application.id,
            status: "SUBMITTED" as any,
          });
          await storage.updateTeamApplicationInvite(teamInviteContext.inviteId, {
            usedAt: new Date(),
          });

          // Attempt to create a team once all invited members have submitted and the TEAM application is accepted with a cohort.
          const teamApp = await storage.getApplication(teamInviteContext.teamApplicationId);
          if (teamApp && teamApp.type === "TEAM" && teamApp.status === "ACCEPTED" && teamApp.cohortId) {
            const members = await storage.getTeamApplicationMembers(teamInviteContext.teamApplicationId);
            const allSubmitted = members.length > 0 && members.every(m => !!m.individualApplicationId);
            const formData = (teamApp.formJson as any) || {};
            const alreadyHasTeam = !!formData.teamId;

            if (allSubmitted && !alreadyHasTeam) {
              const createdTeam = await storage.createTeam({
                cohortId: teamApp.cohortId,
                name: formData.team_name || formData.teamName || "Team",
              } as any);

              const updatedFormJson = {
                ...formData,
                teamId: createdTeam.id,
                teamFormedAt: new Date().toISOString(),
              };

              await storage.updateApplication(teamApp.id, {
                formJson: updatedFormJson as any,
              });
            }
          }
        } catch (linkErr) {
          console.error("⚠️ Failed to link invite submission to team application:", linkErr);
          // Don't fail the application submission
        }
      }
      
      // Create notification for admins about new application
      try {
        const { db } = await import("./db");
        const { notifications, users } = await import("@shared/schema");
        const { eq, or } = await import("drizzle-orm");
        
        // Get all admin users
        const adminUsers = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.role, "ADMIN"));
        
        // Create notification for each admin
        const applicantName = (validatedForm as any)?.fullName || (validatedForm as any)?.contactPersonName || "Unknown";
        const notificationPromises = adminUsers.map(admin => 
          db.insert(notifications).values({
            userId: admin.id,
            type: "CANDIDATE_SELECTED", // Use existing notification type
            title: `New ${type} Application Received`,
            message: `A new ${type} application has been submitted by ${applicantName}.`,
            status: "UNREAD",
            metadataJson: {
              applicationId: application.id,
              applicationType: type,
              applicantName: applicantName,
            },
          })
        );
        
        await Promise.all(notificationPromises);
        console.log(`✅ Created notifications for ${adminUsers.length} admin(s) about new ${type} application`);
      } catch (notificationError) {
        console.error("⚠️ Failed to create notifications for new application:", notificationError);
        // Don't fail the application creation if notification fails
      }

      // If CV was uploaded, save the S3 key.
      // We are skipping the "move" operation to avoid S3 CopyObject encoding issues with certain filenames.
      // The file remains in the temporary upload location, which is perfectly fine.
      if (cvS3Key) {
        console.log("ℹ️ Skipping file move to avoid encoding issues. Using temp key:", cvS3Key);
        try {
          const updatedFormJson = { ...validatedForm, cvS3Key: cvS3Key };
          await storage.updateApplication(application.id, {
            formJson: updatedFormJson as any,
          });
          console.log("✅ Application updated with CV S3 Key:", cvS3Key);
        } catch (dbError) {
          console.error("❌ Error updating application with CV key:", dbError);
        }
      }

      console.log("✅ Application created successfully:", application.id);
      res.status(201).json(application);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ Zod validation error:", error.errors);
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Application creation error:", errorMessage);
      console.error("❌ Full error:", error);

      // Check if it's an enum value error
      if (errorMessage.includes("invalid input value for enum") ||
        errorMessage.includes("FOUNDER") ||
        errorMessage.includes("COFOUNDER") ||
        errorMessage.includes("enum_application_type")) {
        return res.status(400).json({
          message: "Database migration required. Please run: npm run db:add-app-types and restart the server",
          error: "Application type not found in database enum",
          details: errorMessage
        });
      }

      res.status(400).json({ message: "Failed to create application", error: errorMessage });
    }
  });

  // =====================
  // Team Applications (public)
  // =====================

  // Create a TEAM application (team leader submits roster). Invites are sent only after acceptance.
  app.post("/api/team-applications", async (req, res) => {
    try {
      const parsed = teamApplicationSubmissionSchema.parse(req.body);

      // Normalize leader fields so existing admin list/search works (it expects fullName/email)
      const formJson = {
        ...parsed,
        fullName: parsed.team_leader_full_name,
        email: parsed.team_leader_email,
      };

      const teamAcceptedTerms = (parsed as any).acceptTerms === true;

      const teamApp = await storage.createApplication({
        type: "TEAM" as any,
        userId: req.session?.userId || null,
        status: "NEW" as any,
        formJson: formJson as any,
        cohortId: null,
        feeAmount: "0",
        acceptedTermsAt: teamAcceptedTerms ? new Date() : null,
      });

      // Create roster members
      const createdMembers = [] as any[];
      for (let i = 0; i < parsed.members.length; i++) {
        const m = parsed.members[i];
        const member = await storage.createTeamApplicationMember({
          teamApplicationId: teamApp.id,
          memberIndex: i,
          fullName: m.member_full_name,
          email: m.member_email.toLowerCase().trim(),
          role: m.member_role as any,
          cofounderRole: m.cofounder_role ?? null,
          internTrack: m.intern_track ?? null,
          status: "PENDING" as any,
        } as any);
        createdMembers.push(member);
      }

      // Notify all admins (in-app notifications). Don't fail if notifications fail.
      try {
        const admins = await storage.getUsersByRole("ADMIN");
        const teamName = parsed.team_name;
        const leaderName = parsed.team_leader_full_name;
        const leaderEmail = parsed.team_leader_email;

        await Promise.all(
          (admins || []).map((admin) =>
            storage.createNotification({
              userId: admin.id,
              // Reuse an existing enum value to avoid requiring a new notification-type migration.
              type: "TEAM_MEMBER_APPLICATION_RECEIVED" as any,
              title: "New TEAM application received",
              message: `${leaderName} (${leaderEmail}) submitted a TEAM application for ${teamName}.`,
              status: "UNREAD" as any,
              metadataJson: {
                applicationId: teamApp.id,
                applicationType: "TEAM",
                teamName,
                leaderEmail,
              },
            } as any)
          )
        );
      } catch (notifError) {
        console.error("Error creating admin notification for TEAM application:", notifError);
      }

      res.json({
        applicationId: teamApp.id,
        members: createdMembers,
      });
    } catch (error: any) {
      console.error("Error creating team application:", error);
      // Zod validation
      if (error?.name === "ZodError" && Array.isArray(error?.issues)) {
        return res.status(400).json({
          message: "Validation failed",
          issues: (error as any).issues,
        });
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Likely missing migration (enum/table)
      if (
        errorMessage.includes("invalid input value for enum") ||
        errorMessage.includes("enum_application_type") ||
        errorMessage.includes("application_type") ||
        errorMessage.includes("team_application_members") ||
        errorMessage.includes("team_application_invites") ||
        errorMessage.includes("relation")
      ) {
        return res.status(400).json({
          message: "Database migration required. Please run: npm run db:add-team-applications and restart the server",
          details: errorMessage,
        });
      }

      res.status(400).json({ message: errorMessage || "Failed to create team application" });
    }
  });

  // Validate a team invite token and return info needed for the invite landing page
  app.get("/api/team-invites/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      if (!token) return res.status(400).json({ message: "Invalid invite token" });

      const crypto = await import("crypto");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const invite = await storage.getTeamApplicationInviteByTokenHash(tokenHash);
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
        return res.status(400).json({ message: "Invite expired" });
      }

      const member = await storage.getTeamApplicationMember(invite.memberId);
      if (!member) return res.status(404).json({ message: "Invite member not found" });

      const teamApplication = await storage.getApplication(member.teamApplicationId);
      if (!teamApplication) return res.status(404).json({ message: "Team application not found" });

      const form = (teamApplication.formJson as any) || {};

      res.json({
        teamApplicationId: teamApplication.id,
        teamName: form.team_name,
        memberEmail: member.email,
        memberName: member.fullName,
        memberRole: member.role,
        cofounderRole: member.cofounderRole,
        internTrack: member.internTrack,
      });
    } catch (error) {
      console.error("Error validating team invite:", error);
      res.status(500).json({ message: "Failed to validate invite" });
    }
  });

  app.patch("/api/applications/:id", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session!.userId!);
    if (currentUser?.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await storage.updateApplication(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Application not found" });
    }
    res.json(updated);
  });

  // Admin applications with filters
  app.get("/api/admin/applications", requireRole("ADMIN"), async (req, res) => {
    try {
      const { status, type, cohortId, search } = req.query;
      let applications = await storage.getApplications();

      // Apply filters
      if (status && typeof status === "string") {
        applications = applications.filter(a => a.status === status);
      }
      if (type && typeof type === "string") {
        applications = applications.filter(a => a.type === type);
      }
      if (cohortId && typeof cohortId === "string") {
        applications = applications.filter(a => a.cohortId === cohortId);
      }

      // Search filter (by name, email, or application ID)
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        applications = applications.filter(app => {
          const formData = app.formJson as any;
          const name = (formData?.fullName || "").toLowerCase();
          const email = (formData?.email || "").toLowerCase();
          const appId = app.id.toLowerCase();
          return name.includes(searchLower) || email.includes(searchLower) || appId.includes(searchLower);
        });
      }

      // Add user details and reviewer details
      const enrichedApplications = await Promise.all(
        applications.map(async (app) => {
          const user = app.userId ? await storage.getUser(app.userId) : null;
          const reviewer = app.reviewerId ? await storage.getUser(app.reviewerId) : null;
          const formData = app.formJson as any;
          
          // Get selected cohort info if cohortId exists in formData
          let selectedCohort = null;
          if (formData?.cohortId) {
            const cohort = await storage.getCohort(formData.cohortId);
            if (cohort) {
              selectedCohort = { id: cohort.id, name: cohort.name };
            }
          }
          
          return {
            ...app,
            name: formData?.fullName || formData?.contactPerson || formData?.institutionName || "Unknown",
            email: formData?.email || formData?.contactEmail || "N/A",
            user: user ? { id: user.id, name: user.name, email: user.email } : null,
            reviewer: reviewer ? { id: reviewer.id, name: reviewer.name } : null,
            selectedCohort,
          };
        })
      );

      res.json(enrichedApplications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Get team applications for admin
  app.get("/api/admin/team-applications", requireRole("ADMIN"), async (req, res) => {
    try {
      const { status, cohortId, search } = req.query;
      let applications = await storage.getApplications();

      // Filter for TEAM applications only
      applications = applications.filter(a => a.type === "TEAM");

      // Apply additional filters
      if (status && typeof status === "string") {
        applications = applications.filter(a => a.status === status);
      }
      if (cohortId && typeof cohortId === "string") {
        applications = applications.filter(a => a.cohortId === cohortId);
      }

      // Search filter (by team name, leader name, or email)
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        applications = applications.filter(app => {
          const formData = app.formJson as any;
          const teamName = (formData?.team_name || "").toLowerCase();
          const leaderName = (formData?.team_leader_full_name || "").toLowerCase();
          const leaderEmail = (formData?.team_leader_email || "").toLowerCase();
          return teamName.includes(searchLower) || leaderName.includes(searchLower) || leaderEmail.includes(searchLower);
        });
      }

      // Add team members and cohort details
      const enrichedApplications = await Promise.all(
        applications.map(async (app) => {
          const teamMembers = await storage.getTeamApplicationMembers(app.id);
          const cohort = app.cohortId ? await storage.getCohort(app.cohortId) : null;
          return {
            ...app,
            formData: app.formJson,
            teamMembers,
            cohort,
          };
        })
      );

      res.json(enrichedApplications);
    } catch (error) {
      console.error("Error fetching team applications:", error);
      res.status(500).json({ message: "Failed to fetch team applications" });
    }
  });

  // Get single team application details for admin
  app.get("/api/admin/team-applications/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (application.type !== "TEAM") {
        return res.status(400).json({ message: "Application is not a team application" });
      }

      const teamMembers = await storage.getTeamApplicationMembers(application.id);
      
      // Enrich team members with individual application and user details
      const enrichedMembers = await Promise.all(
        teamMembers.map(async (member) => {
          let individualApplication = null;
          let user = null;
          
          if (member.individualApplicationId) {
            individualApplication = await storage.getApplication(member.individualApplicationId);
            if (individualApplication?.userId) {
              user = await storage.getUser(individualApplication.userId);
            }
          }
          
          return {
            ...member,
            individualApplication,
            user,
          };
        })
      );

      const cohort = application.cohortId ? await storage.getCohort(application.cohortId) : null;

      res.json({
        ...application,
        formData: application.formJson,
        teamMembers: enrichedMembers,
        cohort,
      });
    } catch (error) {
      console.error("Error fetching team application details:", error);
      res.status(500).json({ message: "Failed to fetch team application details" });
    }
  });

  // Batch status update
  app.post("/api/admin/applications/batch-status", requireRole("ADMIN"), async (req, res) => {
    const currentUser = await storage.getUser(req.session!.userId!);
    const { ids, status, selectionNotes } = req.body;

    if (!ids || !Array.isArray(ids) || !status) {
      return res.status(400).json({ message: "IDs and status are required" });
    }

    const updated = await Promise.all(
      ids.map(id => storage.updateApplication(id, {
        status,
        selectionNotes,
        reviewerId: currentUser!.id,
        reviewedAt: new Date(),
      }))
    );

    res.json({ updated: updated.filter(Boolean).length });
  });

  // Get single application details (for admin detail view)
  app.get("/api/admin/applications/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      const user = application.userId ? await storage.getUser(application.userId) : null;
      const reviewer = application.reviewerId ? await storage.getUser(application.reviewerId) : null;
      const formData = application.formJson as any;

      const teamMembers = application.type === "TEAM"
        ? await storage.getTeamApplicationMembers(application.id)
        : undefined;

      // Get selected cohort info if cohortId exists in formData
      let selectedCohort = null;
      if (formData?.cohortId) {
        const cohort = await storage.getCohort(formData.cohortId);
        if (cohort) {
          selectedCohort = { id: cohort.id, name: cohort.name };
        }
      }

      res.json({
        ...application,
        formData,
        teamMembers,
        user: user ? { id: user.id, name: user.name, email: user.email } : null,
        reviewer: reviewer ? { id: reviewer.id, name: reviewer.name } : null,
        selectedCohort,
      });
    } catch (error) {
      console.error("Error fetching application details:", error);
      res.status(500).json({ message: "Failed to fetch application details" });
    }
  });

  // Stream CV as attachment (forces download instead of open in browser)
  app.get("/api/admin/applications/:id/documents/cv/download", requireRole("ADMIN"), async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getApplication(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      const formData = application.formJson as any;
      const cvFileName = formData?.cvFileName || "Resume.pdf";
      const cvS3Key = formData?.cvS3Key;
      const resumeS3Key = formData?.resumeObjectKey || formData?.resumeS3Key;
      const cvUrl = formData?.cvUrl;
      const resumeUrl = formData?.resumeUrl;
      let objectKey: string | null = cvS3Key || resumeS3Key || null;
      if (!objectKey && (cvUrl || resumeUrl)) {
        try {
          const urlObj = new URL(cvUrl || resumeUrl!);
          const pathParts = urlObj.pathname.split("/").filter((p: string) => p);
          const appIndex = pathParts.findIndex((p: string) => p === "applications");
          objectKey = appIndex >= 0 ? pathParts.slice(appIndex).join("/") : pathParts.join("/");
        } catch {
          objectKey = null;
        }
      }
      if (!objectKey && cvFileName) {
        objectKey = `applications/${id}/cv/${cvFileName}`;
      }
      if (!objectKey || !process.env.AWS_S3_BUCKET_NAME) {
        return res.status(404).json({ message: "CV not available for download" });
      }
      const { S3StorageService } = await import("./s3Storage");
      const storageService = new S3StorageService();
      const safeName = /[^\w\s.-]/g.test(cvFileName) ? "Resume.pdf" : cvFileName;
      res.setHeader("Content-Disposition", `attachment; filename="${safeName.replace(/"/g, "%22")}"`);
      await storageService.downloadObject(objectKey, res, 3600);
    } catch (err: any) {
      if (err.name === "ObjectNotFoundError") {
        return res.status(404).json({ message: "CV not found" });
      }
      console.error("Error streaming CV download:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download file" });
      }
    }
  });

  // Get application documents (CV, etc.)
  app.get("/api/admin/applications/:id/documents/:documentType", requireRole("ADMIN"), async (req, res) => {
    try {
      const { id, documentType } = req.params;
      const application = await storage.getApplication(id);

      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      const formData = application.formJson as any;

      if (documentType === "cv") {
        const cvFileName = formData?.cvFileName;
        const cvFileSize = formData?.cvFileSize;
        const cvFileType = formData?.cvFileType;
        const cvS3Key = formData?.cvS3Key; // Check if S3 key is stored
        const cvUrl = formData?.cvUrl; // Check if CV URL is stored (from ObjectUploader)
        const resumeUrl = formData?.resumeUrl; // Check for resumeUrl (mentor applications)
        const resumeS3Key = formData?.resumeObjectKey || formData?.resumeS3Key; // Check for resume S3 key

        // Check if CV exists in any form
        if (!cvFileName && !cvS3Key && !cvUrl && !resumeUrl && !resumeS3Key) {
          return res.status(404).json({ message: "CV not found for this application" });
        }

        // Determine the S3 object key - prioritize stored keys
        let objectKey: string | null = null;
        if (cvS3Key) {
          objectKey = cvS3Key;
        } else if (resumeS3Key) {
          objectKey = resumeS3Key;
        } else if (cvUrl || resumeUrl) {
          // Try to extract object key from URL
          const urlToParse = cvUrl || resumeUrl;
          try {
            const urlObj = new URL(urlToParse);
            // For S3 signed URLs, the key is usually in the pathname
            // Format: /bucket-name/key or /key
            const pathname = urlObj.pathname;
            // Remove leading slash and extract key
            const pathParts = pathname.split('/').filter(p => p);
            if (pathParts.length > 0) {
              // Find 'applications' in path and get everything after it
              const appIndex = pathParts.findIndex(p => p === 'applications');
              if (appIndex >= 0) {
                objectKey = pathParts.slice(appIndex).join('/');
              } else {
                // If no 'applications' found, use all parts as key
                objectKey = pathParts.join('/');
              }
            }
          } catch (e) {
            console.warn("Could not parse CV URL to extract object key:", urlToParse);
          }
        }

        // If we have an object key, always generate a fresh signed URL (more reliable)
        if (objectKey) {
          // Generate fresh signed URL
          if (process.env.AWS_S3_BUCKET_NAME) {
            const { S3StorageService } = await import("./s3Storage");
            const storageService = new S3StorageService();
            try {
              const signedUrl = await storageService.getSignedDownloadURL(objectKey, 3600); // 1 hour expiry
              return res.json({
                fileName: cvFileName || "Resume.pdf",
                fileSize: cvFileSize || 0,
                fileType: cvFileType || "application/pdf",
                downloadUrl: signedUrl,
                viewUrl: signedUrl,
              });
            } catch (s3Error: any) {
              console.error("Error generating signed URL from object key:", s3Error);
              // Fall through to try URL or construct key from filename
            }
          } else {
            // For GCS or other storage
            const { ObjectStorageService } = await import("./objectStorage");
            const objectStorageService = new ObjectStorageService();
            const objectPath = objectKey.startsWith("/") ? objectKey : `/${objectKey}`;
            try {
              const signedUrl = await objectStorageService.getSignedDownloadURL(objectPath, 3600);
              return res.json({
                fileName: cvFileName || "Resume.pdf",
                fileSize: cvFileSize || 0,
                fileType: cvFileType || "application/pdf",
                downloadUrl: signedUrl,
                viewUrl: signedUrl,
              });
            } catch (storageError: any) {
              console.error("Error generating signed URL from object key:", storageError);
              // Fall through to try URL or construct key from filename
            }
          }
        }

        // If we have a URL but couldn't extract/generate signed URL, try using it directly
        // (might work if it's still valid or public)
        const finalCvUrl = cvUrl || resumeUrl;
        if (finalCvUrl && !objectKey) {
          return res.json({
            fileName: cvFileName || "Resume.pdf",
            fileSize: cvFileSize || 0,
            fileType: cvFileType || "application/pdf",
            downloadUrl: finalCvUrl,
            viewUrl: finalCvUrl,
          });
        }

        // Fallback: construct the key from application ID and filename
        if (!objectKey && cvFileName) {
          objectKey = `applications/${id}/cv/${cvFileName}`;
        }

        // Generate signed URL for S3 using constructed key
        if (objectKey) {
          if (process.env.AWS_S3_BUCKET_NAME) {
            const { S3StorageService } = await import("./s3Storage");
            const storageService = new S3StorageService();
            const signedUrl = await storageService.getSignedDownloadURL(objectKey, 3600); // 1 hour expiry

            return res.json({
              fileName: cvFileName || "Resume.pdf",
              fileSize: cvFileSize || 0,
              fileType: cvFileType || "application/pdf",
              downloadUrl: signedUrl,
              viewUrl: signedUrl, // Same URL for viewing
            });
          } else {
            // For GCS or other storage
            const { ObjectStorageService } = await import("./objectStorage");
            const objectStorageService = new ObjectStorageService();
            const objectPath = objectKey.startsWith("/") ? objectKey : `/${objectKey}`;
            const signedUrl = await objectStorageService.getSignedDownloadURL(objectPath, 3600);

            return res.json({
              fileName: cvFileName || "Resume.pdf",
              fileSize: cvFileSize || 0,
              fileType: cvFileType || "application/pdf",
              downloadUrl: signedUrl,
              viewUrl: signedUrl,
            });
          }
        }
      }

      if (documentType === "certificate") {
        const certificates = formData?.certificates;
        if (!certificates || !Array.isArray(certificates) || certificates.length === 0) {
          return res.status(404).json({ message: "No certificates found for this application" });
        }

        // Get the certificate by index (default to 0)
        const certIndex = req.query.index ? parseInt(req.query.index as string) : 0;
        const cert = certificates[certIndex];
        if (!cert) {
          return res.status(404).json({ message: "Certificate not found" });
        }

        // If certificate has objectKey, generate signed URL
        if (cert.objectKey) {
          if (process.env.AWS_S3_BUCKET_NAME) {
            const { S3StorageService } = await import("./s3Storage");
            const storageService = new S3StorageService();
            try {
              const signedUrl = await storageService.getSignedDownloadURL(cert.objectKey, 3600);
              return res.json({
                fileName: cert.fileName || "certificate.pdf",
                fileSize: 0,
                fileType: "application/pdf",
                downloadUrl: signedUrl,
                viewUrl: signedUrl,
              });
            } catch (s3Error: any) {
              console.error("Error generating signed URL for certificate:", s3Error);
            }
          } else {
            const { ObjectStorageService } = await import("./objectStorage");
            const objectStorageService = new ObjectStorageService();
            const objectPath = cert.objectKey.startsWith("/") ? cert.objectKey : `/${cert.objectKey}`;
            try {
              const signedUrl = await objectStorageService.getSignedDownloadURL(objectPath, 3600);
              return res.json({
                fileName: cert.fileName || "certificate.pdf",
                fileSize: 0,
                fileType: "application/pdf",
                downloadUrl: signedUrl,
                viewUrl: signedUrl,
              });
            } catch (storageError: any) {
              console.error("Error generating signed URL for certificate:", storageError);
            }
          }
        }

        // Fallback to stored URL
        if (cert.url) {
          return res.json({
            fileName: cert.fileName || "certificate.pdf",
            fileSize: 0,
            fileType: "application/pdf",
            downloadUrl: cert.url,
            viewUrl: cert.url,
          });
        }

        return res.status(404).json({ message: "Certificate URL not found" });
      }

      if (documentType === "id-proof") {
        const idProof = formData?.idProof;
        if (!idProof) {
          return res.status(404).json({ message: "ID proof not found for this application" });
        }

        // If ID proof has objectKey, generate signed URL
        if (idProof.objectKey) {
          if (process.env.AWS_S3_BUCKET_NAME) {
            const { S3StorageService } = await import("./s3Storage");
            const storageService = new S3StorageService();
            try {
              const signedUrl = await storageService.getSignedDownloadURL(idProof.objectKey, 3600);
              return res.json({
                fileName: idProof.fileName || "id-proof.pdf",
                fileSize: 0,
                fileType: "application/pdf",
                downloadUrl: signedUrl,
                viewUrl: signedUrl,
              });
            } catch (s3Error: any) {
              console.error("Error generating signed URL for ID proof:", s3Error);
            }
          } else {
            const { ObjectStorageService } = await import("./objectStorage");
            const objectStorageService = new ObjectStorageService();
            const objectPath = idProof.objectKey.startsWith("/") ? idProof.objectKey : `/${idProof.objectKey}`;
            try {
              const signedUrl = await objectStorageService.getSignedDownloadURL(objectPath, 3600);
              return res.json({
                fileName: idProof.fileName || "id-proof.pdf",
                fileSize: 0,
                fileType: "application/pdf",
                downloadUrl: signedUrl,
                viewUrl: signedUrl,
              });
            } catch (storageError: any) {
              console.error("Error generating signed URL for ID proof:", storageError);
            }
          }
        }

        // Fallback to stored URL
        if (idProof.url) {
          return res.json({
            fileName: idProof.fileName || "id-proof.pdf",
            fileSize: 0,
            fileType: "application/pdf",
            downloadUrl: idProof.url,
            viewUrl: idProof.url,
          });
        }

        return res.status(404).json({ message: "ID proof URL not found" });
      }

      res.status(400).json({ message: "Invalid document type" });
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // Confirm payment for application (manual/offline payment)
  app.post("/api/admin/applications/:id/confirm-payment", requireRole("ADMIN"), async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session!.userId!);
      const {
        amountPaid,
        paymentDate,
        paymentMethod,
        transactionReferenceId,
        installmentId,
        notes,
        proofAttachmentUrl,
      } = req.body;

      // Validation
      if (!amountPaid || !paymentDate || !paymentMethod) {
        return res.status(400).json({
          message: "Missing required fields: amountPaid, paymentDate, and paymentMethod are required",
        });
      }

      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Create manual payment record
      const [manualPayment] = await db
        .insert(manualPayments)
        .values({
          applicationId: req.params.id,
          installmentId: installmentId || null,
          amountPaid: amountPaid.toString(),
          paymentDate: new Date(paymentDate),
          paymentMethod: paymentMethod,
          transactionReferenceId: transactionReferenceId || null,
          notes: notes || null,
          receivedBy: currentUser!.id,
          proofAttachmentUrl: proofAttachmentUrl || null,
        })
        .returning();

      // Calculate total paid amount (including this manual payment)
      const existingManualPayments = await db
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.applicationId, req.params.id));

      const totalManualPaid = existingManualPayments.reduce(
        (sum, mp) => sum + parseFloat(mp.amountPaid as string),
        0
      );

      // Get all installments to check if fully paid
      const allInstallments = await db
        .select()
        .from(paymentInstallments)
        .where(eq(paymentInstallments.applicationId, req.params.id));

      const totalInstallmentPaid = allInstallments
        .filter((i: any) => i.status === "PAID")
        .reduce((sum: number, i: any) => sum + parseFloat(i.amount as string), 0);

      const totalPaid = totalManualPaid + totalInstallmentPaid;
      const feeAmount = parseFloat(application.feeAmount as string) || 0;
      const allPaid = totalPaid >= feeAmount;

      // Update application status
      const updated = await storage.updateApplication(req.params.id, {
        paymentConfirmed: true,
        paymentConfirmedAt: new Date(),
        paymentConfirmedBy: currentUser!.id,
        totalPaidAmount: totalPaid.toString(),
        paid: allPaid,
        status: allPaid ? ("PAID" as any) : ("PARTIALLY_PAID" as any),
        selectionNotes: notes || application.selectionNotes,
      });

      res.json({
        message: "Manual payment recorded successfully",
        application: updated,
        manualPayment: manualPayment,
      });
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // ============================================
  // RAZORPAY PAYMENT INTEGRATION ENDPOINTS
  // ============================================

  // Admin initiates payment for an application
  app.post("/api/admin/applications/:id/initiate-payment", requireRole("ADMIN"), async (req, res) => {
    try {
      const { sendOfferEmail } = await import("./services/email-service");
      
      const { registrationFee } = req.body;
      const applicationId = req.params.id;

      if (!applicationId) {
        return res.status(400).json({ message: "Application ID is required" });
      }

      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (!application.type) {
        return res.status(400).json({ message: "Application type is missing" });
      }

      const formData = (application.formJson as any) || {};

      // Block if fully paid
      const totalPaid = parseFloat(application.totalPaidAmount || "0");
      const customFee = application.customFeeAmount ? parseFloat(application.customFeeAmount) : 0;
      
      if (totalPaid > 0 && customFee > 0 && totalPaid >= customFee) {
        return res.json({
          alreadyPaid: true,
          amount: totalPaid,
          message: `User has already paid ₹${totalPaid}. Payment complete.`,
          application,
        });
      }

      const plan = formData?.plan || "";
      const totalFee = getFeeByType(application.type, plan);

      if (!totalFee || totalFee <= 0) {
        return res.status(400).json({ 
          message: `Invalid total fee calculated: ₹${totalFee}. Please check application type.` 
        });
      }

      // Validate registration fee amount
      const minFee = parseInt(process.env.MIN_PAYMENT_AMOUNT || "1");
      const maxFee = parseInt(process.env.MAX_PAYMENT_AMOUNT || "400000");
      const defaultRegFee = parseInt(process.env.DEFAULT_REGISTRATION_FEE || "10000");
      
      let registrationFeeNum: number | null = null;
      if (registrationFee !== undefined && registrationFee !== null) {
        const parsed = typeof registrationFee === 'number' ? registrationFee : parseFloat(String(registrationFee));
        if (!isNaN(parsed) && parsed > 0) {
          registrationFeeNum = parsed;
        }
      }
      
      // Calculate default registration fee as 10% of total fee if not provided
      const calculatedDefaultRegFee = Math.floor(totalFee * 0.1);
      const finalRegistrationFee = registrationFeeNum || (customFee > 0 ? customFee : calculatedDefaultRegFee);

      // Log for debugging
      console.log(`[Initiate Payment] Application: ${applicationId}, Total Fee: ${totalFee}, Registration Fee Input: ${registrationFee}, Final Registration Fee: ${finalRegistrationFee}`);

      if (typeof finalRegistrationFee !== 'number' || isNaN(finalRegistrationFee) || finalRegistrationFee <= 0) {
        return res.status(400).json({ 
          message: `Invalid registration fee. Please provide a valid amount.` 
        });
      }
      
      if (finalRegistrationFee < minFee || finalRegistrationFee > maxFee) {
        return res.status(400).json({ 
          message: `Registration fee must be between ₹${minFee} and ₹${maxFee}` 
        });
      }

      // Validate registration fee is less than total fee
      if (finalRegistrationFee >= totalFee) {
        return res.status(400).json({ 
          message: `Registration fee (₹${finalRegistrationFee}) must be less than total fee (₹${totalFee})` 
        });
      }

      // Delete any existing PENDING installments to ensure new amounts are used
      // Keep PAID installments as they represent completed payments
      await db.delete(paymentInstallments)
        .where(
          and(
            eq(paymentInstallments.applicationId, applicationId),
            eq(paymentInstallments.status, "PENDING")
          )
        );

      // Calculate installment plan structure (without creating DB records)
      // Installments will be created on-demand when user clicks to pay
      const { calculateInstallmentPlan } = await import("./services/payment-service");
      const installmentPlan = calculateInstallmentPlan(totalFee, finalRegistrationFee);

      // Resolve recipient email and name
      let emailSent = false;
      let recipientEmail: string | null = null;
      let recipientName = "Student";
      
      // Try user account first, then fall back to formJson
      if (application.userId) {
        const user = await storage.getUser(application.userId);
        if (user?.email) {
          recipientEmail = user.email;
          recipientName = user.name || "Student";
        }
      }
      
      if (!recipientEmail) {
        recipientEmail = formData.email || formData.personalEmail || formData.contactEmail || null;
        recipientName = formData.fullName || formData.name || formData.contactPerson || "Student";
      }

      // Update application status to OFFER
      const offerExpiryHours = parseInt(process.env.OFFER_EXPIRY_HOURS || "24");
      const offerSentAt = new Date();
      const offerExpiresAt = new Date(offerSentAt.getTime() + offerExpiryHours * 60 * 60 * 1000);

      const updated = await storage.updateApplication(applicationId, {
        status: "OFFER" as any,
        offerSentAt,
        offerExpiresAt,
        customFeeAmount: String(finalRegistrationFee),
      });
      
      // Send offer email with payment plan structure (installments not yet in DB)
      if (recipientEmail) {
        try {
          await sendOfferEmail(recipientEmail, recipientName, totalFee, installmentPlan, offerExpiresAt, applicationId);
          emailSent = true;
          console.log(`✅ Offer email sent to ${recipientEmail}`);
        } catch (emailError: any) {
          console.error(`Failed to send offer email:`, emailError.message);
        }
      } else {
        console.warn(`No email found for application ${applicationId}`);
      }

      res.json({
        success: true,
        installments: installmentPlan, // Return plan structure (not DB records)
        offerExpiresAt,
        emailSent,
        application: updated,
      });
    } catch (error: any) {
      console.error("Error initiating payment:", error.message);
      console.error("Error initiating payment:", error);
      res.status(500).json({ 
        message: "Failed to initiate payment"
      });
    }
  });

  // User creates payment order for specific installment (PUBLIC - for payment portal)
  // Supports both installmentId (existing) and installmentNumber (on-demand creation)
  app.get("/api/applications/:applicationId/installments/:installmentId/payment-order", async (req, res) => {
    try {
      const { createPaymentOrder, canRetryPayment, checkOfferExpiry, createSingleInstallment } = await import("./services/payment-service");
      const { applicationId, installmentId } = req.params;

      // Verify application exists (no user auth required for public payment page)
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Check offer expiry
      const expired = await checkOfferExpiry(applicationId);
      if (expired) {
        return res.status(400).json({ 
          message: "Payment offer has expired. Please contact admin to extend." 
        });
      }

      // Check retry limit
      const retryCheck = await canRetryPayment(applicationId);
      if (!retryCheck.canRetry) {
        return res.status(429).json({
          message: retryCheck.reason,
          cooldownRemaining: retryCheck.cooldownRemaining,
          cooldownEndsAt: retryCheck.cooldownEndsAt,
        });
      }

      // Check if installmentId is a virtual ID (format: virtual_1, virtual_2, etc.)
      // or a real UUID. If virtual, extract installmentNumber and create on-demand
      let finalInstallmentId = installmentId;
      
      if (installmentId.startsWith("virtual_")) {
        // Extract installment number from virtual ID
        const installmentNumber = parseInt(installmentId.replace("virtual_", ""));
        
        if (isNaN(installmentNumber) || installmentNumber < 1 || installmentNumber > 3) {
          return res.status(400).json({ message: "Invalid installment number" });
        }

        // Calculate total fee and registration fee
        const formData = (application.formJson as any) || {};
        const plan = formData.plan || "";
        let totalFee = 0;
        let registrationFee = 0;

        // Calculate total fee first
        const calculatedFee = getFeeByType(application.type as string, plan);
        if (calculatedFee > 0) {
          totalFee = calculatedFee;
        } else {
          totalFee = parseFloat(application.feeAmount as string || "0");
        }
        
        // Registration fee: Use customFeeAmount if exists (can be any amount ₹1-₹5,00,000)
        // If not set, default to 10% of total fee
        if (application.customFeeAmount) {
          registrationFee = parseFloat(application.customFeeAmount as string);
          // Validate registration fee is within valid range
          if (isNaN(registrationFee) || registrationFee < 1 || registrationFee > 500000) {
            // If invalid, fall back to 10% of total
            registrationFee = Math.floor(totalFee * 0.1);
          }
          // Ensure registration fee is less than total fee
          if (registrationFee >= totalFee) {
            registrationFee = Math.floor(totalFee * 0.1);
          }
        } else {
          // Default registration fee is 10% of total
          registrationFee = Math.floor(totalFee * 0.1);
        }

        // Create installment on-demand
        try {
          finalInstallmentId = await createSingleInstallment(applicationId, installmentNumber, totalFee, registrationFee);
          console.log(`✅ Created installment ${installmentNumber} on-demand for application ${applicationId}`);
        } catch (error: any) {
          console.error("Error creating installment on-demand:", error);
          return res.status(500).json({ 
            message: `Failed to create installment: ${error.message}` 
          });
        }
      }

      // Create payment order with the final installment ID
      const orderDetails = await createPaymentOrder(finalInstallmentId);

      res.json(orderDetails);
    } catch (error: any) {
      console.error("Error creating payment order:", error);
      res.status(500).json({ message: error.message || "Failed to create payment order" });
    }
  });

  // Verify payment after Razorpay checkout (PUBLIC - for payment portal)
  app.post("/api/applications/:applicationId/installments/:installmentId/verify-payment", async (req, res) => {
    try {
      const { processPaymentSuccess } = await import("./services/payment-service");
      const { applicationId, installmentId } = req.params;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      // Verify application exists (no user auth required for public payment page)
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Process payment
      const result = await processPaymentSuccess(
        installmentId,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature
      );

      res.json({
        success: true,
        installment: result.installment,
        application: result.application,
        invoiceUrl: result.invoiceUrl,
        allPaid: result.allPaid,
        totalPaid: result.totalPaid,
        newStatus: result.newStatus,
      });
    } catch (error: any) {
      console.error("Error verifying payment:", error);
      res.status(400).json({ message: "Payment verification failed" });
    }
  });

  // Get payment status for an application (PUBLIC - for payment portal)
  app.get("/api/applications/:applicationId/payment-status", async (req, res) => {
    try {
      const { canRetryPayment, checkOfferExpiry, calculateInstallmentPlan } = await import("./services/payment-service");
      const { applicationId } = req.params;

      // Verify application exists (no user auth required for public payment page)
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Get all installments from DB (may be empty if not created yet)
      const dbInstallments = await db.select().from(paymentInstallments)
        .where(eq(paymentInstallments.applicationId, applicationId))
        .orderBy(asc(paymentInstallments.installmentNumber));

      // Get all manual payments
      const manualPaymentsList = await db.select().from(manualPayments)
        .where(eq(manualPayments.applicationId, applicationId));

      // Calculate total amount and registration fee
      const formData = (application.formJson as any) || {};
      const plan = formData.plan || "";

      let totalAmount = 0;
      let registrationFee = 0;
      
      // Calculate total fee first
      const calculatedFee = getFeeByType(application.type as string, plan);
      if (calculatedFee > 0) {
        totalAmount = calculatedFee;
      } else {
        totalAmount = parseFloat(application.feeAmount as string || "0");
      }
      
      // Registration fee: Use customFeeAmount if exists (can be any amount ₹1-₹5,00,000)
      // If not set, default to 10% of total fee
      if (application.customFeeAmount) {
        registrationFee = parseFloat(application.customFeeAmount as string);
        // Validate registration fee is within valid range
        if (isNaN(registrationFee) || registrationFee < 1 || registrationFee > 500000) {
          // If invalid, fall back to 10% of total
          registrationFee = Math.floor(totalAmount * 0.1);
        }
        // Ensure registration fee is less than total fee
        if (registrationFee >= totalAmount) {
          registrationFee = Math.floor(totalAmount * 0.1);
        }
      } else {
        // Default registration fee is 10% of total
        registrationFee = Math.floor(totalAmount * 0.1);
      }

      // Calculate installment plan structure (1 registration + 2 installments)
      const installmentPlan = calculateInstallmentPlan(totalAmount, registrationFee);

      // Merge DB installments with calculated plan
      // If installment exists in DB, use DB data; otherwise use calculated plan
      const installments = installmentPlan.map((planItem) => {
        const dbItem = dbInstallments.find((db: any) => db.installmentNumber === planItem.installmentNumber);
        if (dbItem) {
          // Use DB data if exists
          return {
            id: dbItem.id,
            number: dbItem.installmentNumber,
            type: dbItem.installmentType,
            amount: parseFloat(dbItem.amount),
            status: dbItem.status,
            paidAt: dbItem.paidAt,
            dueDate: dbItem.dueDate,
            exists: true, // Flag to indicate it exists in DB
          };
        } else {
          // Use calculated plan if not in DB yet
          return {
            id: `virtual_${planItem.installmentNumber}`, // Virtual ID for frontend
            number: planItem.installmentNumber,
            type: planItem.installmentType,
            amount: planItem.amount,
            status: "PENDING",
            paidAt: null,
            dueDate: planItem.dueDate,
            exists: false, // Flag to indicate it needs to be created
          };
        }
      });

      // Calculate paid amount from:
      // 1. Installments marked as PAID (only from DB)
      const paidFromInstallments = dbInstallments
        .filter((i: any) => i.status === "PAID")
        .reduce((sum: number, i: any) => sum + parseFloat(i.amount), 0);
      
      // 2. Manual payments
      const paidFromManual = manualPaymentsList.reduce(
        (sum: number, mp: any) => sum + parseFloat(mp.amountPaid as string),
        0
      );

      // Total paid amount
      const paidAmount = paidFromInstallments + paidFromManual;

      // Pending amount: total - paid (never negative)
      const pendingAmount = Math.max(0, totalAmount - paidAmount);

      // Adjust the first PENDING installment's displayed amount to reflect manual payments already made
      // e.g. if ₹1,000 was paid manually against a ₹15,000 registration fee, show ₹14,000 as due
      if (paidFromManual > 0) {
        const firstPendingIdx = installments.findIndex((i: any) => i.status === "PENDING");
        if (firstPendingIdx !== -1) {
          const adjusted = installments[firstPendingIdx].amount - paidFromManual;
          installments[firstPendingIdx] = {
            ...installments[firstPendingIdx],
            amount: Math.max(0, adjusted),
          };
        }
      }

      const offerExpired = await checkOfferExpiry(applicationId);
      const retryInfo = await canRetryPayment(applicationId);

      // If the user is logged in (inside the portal), offer expiry does NOT apply —
      // only external/public payment page users should be blocked by expiry.
      const isLoggedIn = !!req.session?.userId;
      const effectiveOfferExpired = isLoggedIn ? false : offerExpired;

      // Find next unpaid installment (prioritize DB installments, then virtual ones)
      const nextInstallment = installments.find((i: any) => i.status === "PENDING");

      res.json({
        totalAmount,
        paidAmount,
        pendingAmount,
        status: application.status,
        installments: installments.map(i => ({
          id: i.id,
          number: i.number,
          type: i.type,
          amount: i.amount,
          status: i.status,
          paidAt: i.paidAt,
          dueDate: i.dueDate,
          exists: i.exists, // Frontend can use this to know if installment needs creation
        })),
        canPayNow: !effectiveOfferExpired && retryInfo.canRetry,
        offerExpired: effectiveOfferExpired,
        offerExpiresAt: application.offerExpiresAt,
        retryInfo: {
          attemptsLeft: retryInfo.attemptsLeft || 0,
          cooldownEndsAt: retryInfo.cooldownEndsAt || null,
        },
        nextInstallment: nextInstallment ? {
          id: nextInstallment.id,
          number: nextInstallment.number,
          amount: nextInstallment.amount,
          dueDate: nextInstallment.dueDate,
        } : null,
      });
    } catch (error) {
      console.error("Error getting payment status:", error);
      res.status(500).json({ message: "Failed to get payment status" });
    }
  });

  // Razorpay webhook handler
  app.post("/api/webhooks/razorpay", async (req, res) => {
    try {
      const { handleWebhook } = await import("./services/payment-service");
      const signature = req.headers["x-razorpay-signature"] as string;
      
      await handleWebhook(req.body, signature);
      
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Webhook error:", error);
      // Always return 200 to Razorpay to prevent retries
      res.json({ status: "error" });
    }
  });

  // Admin manually mark installment as paid (for bank transfers, etc.)
  app.post("/api/admin/applications/:id/mark-paid-manually", requireRole("ADMIN"), async (req, res) => {
    try {
      const { installmentId, notes, transactionRef } = req.body;
      const currentUser = await storage.getUser(req.session!.userId!);

      if (!installmentId) {
        return res.status(400).json({ message: "installmentId is required" });
      }

      // Get installment
      const [installment] = await db.select().from(paymentInstallments)
        .where(eq(paymentInstallments.id, installmentId))
        .limit(1);

      if (!installment) {
        return res.status(404).json({ message: "Installment not found" });
      }

      // Mark as paid
      await db.update(paymentInstallments)
        .set({
          status: "PAID",
          paidAt: new Date(),
          razorpayPaymentId: `MANUAL_${transactionRef || Date.now()}`,
        })
        .where(eq(paymentInstallments.id, installmentId));

      // Update application
      const allInstallments = await db.select().from(paymentInstallments)
        .where(eq(paymentInstallments.applicationId, installment.applicationId));

      const totalPaid = allInstallments
        .filter((i: any) => i.status === "PAID" || i.id === installmentId)
        .reduce((sum: number, i: any) => sum + parseFloat(i.amount), 0);

      const allPaid = allInstallments.every((i: any) => i.status === "PAID" || i.id === installmentId);

      await storage.updateApplication(installment.applicationId, {
        totalPaidAmount: totalPaid.toString(),
        status: (allPaid ? "PAID" : "PARTIALLY_PAID") as any,
        paid: allPaid,
        paymentConfirmed: true,
        paymentConfirmedBy: currentUser!.id,
        paymentConfirmedAt: new Date(),
        selectionNotes: notes,
      });

      res.json({ success: true, message: "Payment marked manually" });
    } catch (error) {
      console.error("Error marking payment manually:", error);
      res.status(500).json({ message: "Failed to mark payment" });
    }
  });

  // Admin sends payment reminder email for next pending installment
  app.post("/api/admin/applications/:id/send-payment-reminder", requireRole("ADMIN"), async (req, res) => {
    try {
      const { sendPaymentReminderEmail } = await import("./services/email-service");
      const applicationId = req.params.id;

      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Get all installments
      const installments = await db.select().from(paymentInstallments)
        .where(eq(paymentInstallments.applicationId, applicationId))
        .orderBy(asc(paymentInstallments.installmentNumber));

      // Find next pending installment
      const nextPendingInstallment = installments.find((i: any) => i.status === "PENDING");

      if (!nextPendingInstallment) {
        return res.status(400).json({ 
          message: "No pending installments found. All payments are complete." 
        });
      }

      // Get user email and name
      const formData = (application.formJson as any) || {};
      let recipientEmail: string | null = null;
      let recipientName = "Student";

      if (application.userId) {
        const user = await storage.getUser(application.userId);
        if (user?.email) {
          recipientEmail = user.email;
          recipientName = user.name || "Student";
        }
      }

      if (!recipientEmail) {
        recipientEmail = formData.email || formData.personalEmail || formData.contactEmail || null;
        recipientName = formData.fullName || formData.name || formData.contactPerson || "Student";
      }

      if (!recipientEmail) {
        return res.status(400).json({ 
          message: "No email address found for this applicant." 
        });
      }

      // Calculate days remaining until due date
      const dueDate = nextPendingInstallment.dueDate ? new Date(nextPendingInstallment.dueDate) : new Date();
      const now = new Date();
      const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemainingText = daysRemaining > 0 ? daysRemaining : 0;

      // Send reminder email
      await sendPaymentReminderEmail(
        recipientEmail,
        recipientName,
        parseFloat(nextPendingInstallment.amount),
        dueDate,
        applicationId,
        daysRemainingText
      );

      res.json({
        success: true,
        message: "Payment reminder email sent successfully",
        installment: {
          number: nextPendingInstallment.installmentNumber,
          amount: parseFloat(nextPendingInstallment.amount),
          dueDate: dueDate.toISOString(),
          daysRemaining: daysRemainingText,
        },
      });
    } catch (error: any) {
      console.error("Error sending payment reminder:", error);
      res.status(500).json({ 
        message: error.message || "Failed to send payment reminder" 
      });
    }
  });

  // ============================================
  // END RAZORPAY PAYMENT ENDPOINTS
  // ============================================

  // ============================================
  // FEE TRACKER ENDPOINTS
  // ============================================

  // Get logged-in user's own program application
  app.get("/api/auth/my-application", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const userApplications = await storage.getApplicationsByUser(userId);
      const programApplication = userApplications.find(
        (a: any) => a.type !== "TEAM"
      );
      if (!programApplication) {
        return res.status(404).json({ message: "No application found" });
      }
      res.json(programApplication);
    } catch (error) {
      console.error("Error fetching user's application:", error);
      res.status(500).json({ message: "Failed to fetch application" });
    }
  });

  // Admin: get all applications with payment summary filtered by type
  app.get("/api/admin/payments/overview", requireRole("ADMIN"), async (req, res) => {
    try {
      const { calculateInstallmentPlan } = await import("./services/payment-service");
      const applicationType = req.query.type as string | undefined;
      let allApplications = await storage.getApplications();
      allApplications = allApplications.filter((a: any) => a.type !== "TEAM");
      if (applicationType) {
        allApplications = allApplications.filter((a: any) => a.type === applicationType);
      }
      const result = await Promise.all(
        allApplications.map(async (application: any) => {
          const user = application.userId ? await storage.getUser(application.userId) : null;
          const formData = (application.formJson as any) || {};
          const name = user?.name || formData.fullName || formData.contactPerson || "Unknown";
          const email = user?.email || formData.email || formData.personalEmail || "N/A";
          const plan = formData.plan || "";
          const calculatedFee = getFeeByType(application.type as string, plan);
          const totalAmount = calculatedFee > 0 ? calculatedFee : parseFloat(application.feeAmount as string || "0");
          const dbInstallments = await db.select().from(paymentInstallments)
            .where(eq(paymentInstallments.applicationId, application.id))
            .orderBy(asc(paymentInstallments.installmentNumber));
          const manualPaymentsList = await db.select().from(manualPayments)
            .where(eq(manualPayments.applicationId, application.id));
          const paidFromInstallments = dbInstallments
            .filter((i: any) => i.status === "PAID")
            .reduce((sum: number, i: any) => sum + parseFloat(i.amount), 0);
          const paidFromManual = manualPaymentsList.reduce(
            (sum: number, mp: any) => sum + parseFloat(mp.amountPaid as string), 0);
          const totalPaid = paidFromInstallments + paidFromManual;
          const pendingAmount = Math.max(0, totalAmount - totalPaid);
          let registrationFee = application.customFeeAmount
            ? parseFloat(application.customFeeAmount as string) : Math.floor(totalAmount * 0.1);
          if (isNaN(registrationFee) || registrationFee < 1 || registrationFee >= totalAmount) {
            registrationFee = Math.floor(totalAmount * 0.1);
          }
          const installmentPlan = calculateInstallmentPlan(totalAmount, registrationFee);
          const installmentSummary = installmentPlan.map((planItem: any) => {
            const dbItem = dbInstallments.find((d: any) => d.installmentNumber === planItem.installmentNumber);
            return {
              number: planItem.installmentNumber,
              type: planItem.installmentType,
              amount: dbItem ? parseFloat(dbItem.amount) : planItem.amount,
              status: dbItem ? dbItem.status : "PENDING",
              paidAt: dbItem?.paidAt || null,
            };
          });
          return {
            applicationId: application.id,
            userId: application.userId,
            name,
            email,
            type: application.type,
            status: application.status,
            totalAmount,
            totalPaid,
            pendingAmount,
            installments: installmentSummary,
          };
        })
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching payments overview:", error);
      res.status(500).json({ message: "Failed to fetch payments overview" });
    }
  });

  // Admin: send bulk payment reminders for all pending users of a given type
  app.post("/api/admin/payments/notify-all", requireRole("ADMIN"), async (req, res) => {
    try {
      const { sendPaymentReminderEmail } = await import("./services/email-service");
      const { applicationType } = req.body as { applicationType: string };
      if (!applicationType) {
        return res.status(400).json({ message: "applicationType is required" });
      }
      let allApplications = await storage.getApplications();
      allApplications = allApplications.filter((a: any) => a.type === applicationType);
      let sentCount = 0;
      let skippedCount = 0;
      for (const application of allApplications) {
        // Skip fully paid
        const formData = (application.formJson as any) || {};
        const totalFee = getFeeByType(application.type as string, formData.plan || "");
        const dbInst = await db.select().from(paymentInstallments)
          .where(eq(paymentInstallments.applicationId, application.id));
        const paidAmount = dbInst.filter((i: any) => i.status === "PAID")
          .reduce((s: number, i: any) => s + parseFloat(i.amount), 0);
        if (totalFee > 0 && paidAmount >= totalFee) { skippedCount++; continue; }
        const next = await getNextPendingInstallment(application);
        if (!next) { skippedCount++; continue; }
        const { email: recipientEmail, name: recipientName } = await resolveRecipient(application);
        if (!recipientEmail) { skippedCount++; continue; }
        const daysRemaining = Math.max(0, Math.ceil((next.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        try {
          await sendPaymentReminderEmail(recipientEmail, recipientName, next.amount, next.dueDate, application.id, daysRemaining);
          sentCount++;
        } catch (_e) {
          console.error("Failed to send reminder:", _e);
          skippedCount++;
        }
      }
      res.json({ success: true, message: "Reminders sent: " + sentCount + ", Skipped: " + skippedCount, sentCount, skippedCount });
    } catch (error) {
      console.error("Error sending bulk reminders:", error);
      res.status(500).json({ message: "Failed to send bulk reminders" });
    }
  });

  // Helper: resolve recipient email/name from application
  async function resolveRecipient(application: any): Promise<{ email: string | null; name: string }> {
    const formData = (application.formJson as any) || {};
    let email: string | null = null;
    let name = "Student";
    if (application.userId) {
      const user = await storage.getUser(application.userId);
      if (user && user.email) { email = user.email; name = user.name || "Student"; }
    }
    if (!email) {
      email = formData.email || formData.personalEmail || formData.contactEmail || null;
      name = formData.fullName || formData.name || formData.contactPerson || "Student";
    }
    return { email, name };
  }

  // Helper: get next pending installment — falls back to calculated plan when no DB rows exist
  async function getNextPendingInstallment(application: any): Promise<{ amount: number; dueDate: Date } | null> {
    const { calculateInstallmentPlan } = await import("./services/payment-service");
    const formData = (application.formJson as any) || {};
    const plan = formData.plan || "";
    const totalAmount = getFeeByType(application.type as string, plan);

    const dbInstallments = await db
      .select()
      .from(paymentInstallments)
      .where(eq(paymentInstallments.applicationId, application.id))
      .orderBy(asc(paymentInstallments.installmentNumber));

    // If DB rows exist, find the first PENDING one
    if (dbInstallments.length > 0) {
      const pending = dbInstallments.find((i: any) => i.status === "PENDING");
      if (!pending) return null;
      return {
        amount: parseFloat(pending.amount),
        dueDate: pending.dueDate ? new Date(pending.dueDate) : new Date(),
      };
    }

    // No DB rows: use calculated plan — the registration fee (installment 1) is due first
    if (totalAmount <= 0) return null;
    const registrationFee = Math.floor(totalAmount * 0.1);
    const installmentPlan = calculateInstallmentPlan(totalAmount, registrationFee);
    if (!installmentPlan || installmentPlan.length === 0) return null;
    const first = installmentPlan[0];
    return {
      amount: first.amount,
      dueDate: new Date(),
    };
  }

  // POST /api/admin/payments/notify-all-types — bulk email to ALL participant types
  app.post("/api/admin/payments/notify-all-types", requireRole("ADMIN"), async (req, res) => {
    try {
      const { sendPaymentReminderEmail } = await import("./services/email-service");
      const types = ["FOUNDER", "COFOUNDER", "LEARNER"];
      let totalSent = 0;
      let totalSkipped = 0;

      for (const applicationType of types) {
        let allApplications = await storage.getApplications();
        allApplications = allApplications.filter((a: any) => a.type === applicationType);

        for (const application of allApplications) {
          // Skip fully paid
          const manualPaid = await db.select().from(manualPayments).where(eq(manualPayments.applicationId, application.id));
          const formData = (application.formJson as any) || {};
          const totalFee = getFeeByType(application.type as string, formData.plan || "");
          const dbInst = await db.select().from(paymentInstallments).where(eq(paymentInstallments.applicationId, application.id));
          const paidInst = dbInst.filter((i: any) => i.status === "PAID").reduce((s: number, i: any) => s + parseFloat(i.amount), 0);
          const paidManual = manualPaid.reduce((s: number, m: any) => s + parseFloat(m.amountPaid as string), 0);
          if (totalFee > 0 && (paidInst + paidManual) >= totalFee) { totalSkipped++; continue; }

          const next = await getNextPendingInstallment(application);
          if (!next) { totalSkipped++; continue; }

          const { email: recipientEmail, name: recipientName } = await resolveRecipient(application);
          if (!recipientEmail) { totalSkipped++; continue; }

          const daysRemaining = Math.max(0, Math.ceil((next.dueDate.getTime() - Date.now()) / 86400000));
          try {
            await sendPaymentReminderEmail(recipientEmail, recipientName, next.amount, next.dueDate, application.id, daysRemaining);
            totalSent++;
          } catch (_e) { totalSkipped++; }
        }
      }

      res.json({
        success: true,
        message: "Bulk reminders sent: " + totalSent + ", Skipped: " + totalSkipped,
        sentCount: totalSent,
        skippedCount: totalSkipped,
      });
    } catch (error) {
      console.error("Error sending bulk reminders to all types:", error);
      res.status(500).json({ message: "Failed to send bulk reminders" });
    }
  });

  // POST /api/admin/payments/:applicationId/send-email
  app.post("/api/admin/payments/:applicationId/send-email", requireRole("ADMIN"), async (req, res) => {
    try {
      const { sendPaymentReminderEmail } = await import("./services/email-service");
      const application = await storage.getApplication(req.params.applicationId);
      if (!application) return res.status(404).json({ message: "Application not found" });

      const next = await getNextPendingInstallment(application);
      if (!next) return res.status(400).json({ message: "No pending installment found" });

      const { email: recipientEmail, name: recipientName } = await resolveRecipient(application);
      if (!recipientEmail) return res.status(400).json({ message: "No email address found for this application" });

      const daysRemaining = Math.max(0, Math.ceil((next.dueDate.getTime() - Date.now()) / 86400000));
      await sendPaymentReminderEmail(recipientEmail, recipientName, next.amount, next.dueDate, application.id, daysRemaining);

      res.json({ success: true, message: "Payment reminder sent to " + recipientEmail });
    } catch (error) {
      console.error("Error sending individual payment email:", error);
      res.status(500).json({ message: "Failed to send payment reminder email" });
    }
  });

  // POST /api/admin/payments/:applicationId/send-notification
  app.post("/api/admin/payments/:applicationId/send-notification", requireRole("ADMIN"), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.applicationId);
      if (!application) return res.status(404).json({ message: "Application not found" });
      // Resolve userId — either directly from the application, or by looking up the user by email
      let targetUserId = application.userId;
      if (!targetUserId) {
        const { email: recipientEmail } = await resolveRecipient(application);
        if (recipientEmail) {
          const foundUser = await storage.getUserByEmail(recipientEmail);
          if (foundUser) targetUserId = foundUser.id;
        }
      }
      if (!targetUserId) return res.status(400).json({ message: "No user account linked to this application. Ask them to register first." });

      const next = await getNextPendingInstallment(application);
      const amount = next ? next.amount : 0;
      const dueDateStr = next ? next.dueDate.toLocaleDateString("en-IN") : "soon";

      const notifMessage = next
        ? "Your next installment of Rs." + amount.toLocaleString("en-IN") + " is due on " + dueDateStr + ". Please complete your payment to continue."
        : "You have a pending payment. Please check your fee details and complete your payment.";

      await storage.createNotification({
        userId: targetUserId,
        type: "PAYMENT_REMINDER" as any,
        title: "Payment Reminder",
        message: notifMessage,
        status: "UNREAD" as any,
        metadataJson: { applicationId: application.id },
      });

      res.json({ success: true, message: "In-app notification sent successfully" });
    } catch (error) {
      console.error("Error sending in-app notification:", error);
      res.status(500).json({ message: "Failed to send notification" });
    }
  });

  // ============================================
  // END FEE TRACKER ENDPOINTS
  // ============================================

  // Accept application and create user account
  app.post("/api/admin/applications/:id/accept", requireRole("ADMIN"), async (req, res) => {
    try {
      const { generateCredentials } = await import("./services/credential-service");
      const { sendAcceptanceEmail, sendTeamApplicationInviteEmail } = await import("./services/email-service");

      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // TEAM applications: no credential creation; invites are sent only after acceptance.
      if (application.type === "TEAM") {
        const currentUser = await storage.getUser(req.session!.userId!);
        const { cohortId, selectionNotes } = req.body || {};

        if (!cohortId || typeof cohortId !== "string") {
          return res.status(400).json({ message: "cohortId is required to accept a TEAM application" });
        }

        const updated = await storage.updateApplication(req.params.id, {
          status: "ACCEPTED" as any,
          cohortId,
          reviewerId: currentUser!.id,
          reviewedAt: new Date(),
          selectionNotes: selectionNotes || application.selectionNotes,
        });

        const crypto = await import("crypto");
        const members = await storage.getTeamApplicationMembers(application.id);
        const form = (application.formJson as any) || {};
        const rawPortalUrl = process.env.PORTAL_URL || `${req.protocol}://${req.get("host")}`;
        const portalUrl = /^https?:\/\//i.test(rawPortalUrl)
          ? rawPortalUrl
          : rawPortalUrl.startsWith("localhost") || rawPortalUrl.startsWith("127.0.0.1")
            ? `http://${rawPortalUrl}`
            : `https://${rawPortalUrl}`;

        const failures: Array<{ email: string; error: string }> = [];
        let sent = 0;

        for (const member of members) {
          if (member.individualApplicationId) {
            continue;
          }
          const token = crypto.randomBytes(24).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
          const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

          await storage.createTeamApplicationInvite({
            memberId: member.id,
            tokenHash,
            expiresAt,
            sentAt: new Date(),
          } as any);

          await storage.updateTeamApplicationMember(member.id, {
            status: "INVITED" as any,
          });

          const roleLabel = member.role === "COFOUNDER"
            ? `Co-Founder (${member.cofounderRole || ""})`.trim()
            : member.role === "LEARNER"
              ? `Intern (${member.internTrack || ""})`.trim()
              : "Founder";

          const inviteUrl = `${portalUrl}/plans/team-invite/${token}`;

          try {
            await sendTeamApplicationInviteEmail({
              to: member.email,
              teamName: form.team_name || "Team",
              roleLabel,
              inviteUrl,
            });
            sent += 1;
          } catch (e: any) {
            console.error("Failed to send team invite email:", e);
            failures.push({ email: member.email, error: e?.message || String(e) });
          }
        }

        return res.json({
          message: "TEAM application accepted. Invites sent.",
          application: updated,
          invitedCount: sent,
          failed: failures,
        });
      }

      // Get email from application form data first
      const formData = application.formJson as any;
      const email = formData?.email;
      if (!email) {
        return res.status(400).json({ message: "Application email not found" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if application already has a userId (regardless of status)
      if (application.userId) {
        const linkedUser = await storage.getUser(application.userId);
        if (linkedUser) {
          console.log(`⚠️ Application already linked to user: ${linkedUser.email} (ID: ${linkedUser.id})`);
          console.log(`   - Application status: ${application.status}`);
          console.log(`   - Application email: ${normalizedEmail}`);
          console.log(`   - Linked user email: ${linkedUser.email?.toLowerCase().trim()}`);
          
          // Check if the linked user's email matches the application email
          const linkedUserEmailNormalized = linkedUser.email?.toLowerCase().trim();
          if (linkedUserEmailNormalized === normalizedEmail) {
            // Email matches - this is the correct user, just update status if needed
            if (application.status === "ACCEPTED") {
              return res.status(400).json({ 
                message: `Application already accepted and linked to user account: ${linkedUser.email}`,
                existingUserId: linkedUser.id,
                existingUserEmail: linkedUser.email
              });
            }
            
            // Update status to ACCEPTED since user already exists and is linked
            console.log(`✅ Application has userId matching email. Updating status to ACCEPTED.`);
            await storage.updateApplication(req.params.id, {
              status: "ACCEPTED",
            });
            
            return res.json({ 
              message: `Application linked to existing user account: ${linkedUser.email}`,
              user: {
                id: linkedUser.id,
                email: linkedUser.email,
                name: linkedUser.name,
                role: linkedUser.role
              },
              application: await storage.getApplication(req.params.id)
            });
          } else {
            // Email doesn't match - unlink the application and proceed with normal acceptance flow
            console.warn(`⚠️ Application userId (${linkedUser.id}) email (${linkedUser.email}) doesn't match application email (${normalizedEmail}). Unlinking and proceeding.`);
            // Unlink the application by setting userId to null
            await storage.updateApplication(req.params.id, {
              userId: null,
            });
            console.log(`✅ Application unlinked. Proceeding with normal acceptance flow.`);
            // Continue to normal flow below (don't return, let it fall through)
          }
        }
      }

      // Check if payment is confirmed (skip for MENTOR applications)
      if (application.type !== "MENTOR" && !application.paymentConfirmed) {
        return res.status(400).json({ message: "Payment must be confirmed before accepting application" });
      }

      // Check if user already exists by email
      console.log(`🔍 Checking for existing user with email: ${email} (normalized: ${normalizedEmail})`);
      console.log(`🔍 Application ID: ${application.id}, Current status: ${application.status}, Current userId: ${application.userId || 'none'}`);
      
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        console.log(`ℹ️ User already exists: ${existingUser.email} (ID: ${existingUser.id})`);
        console.log(`   - User role: ${existingUser.role}`);
        console.log(`   - User name: ${existingUser.name}`);
        
        // For MENTOR applications, always generate NEW credentials (user shouldn't exist since we don't create on application)
        // But handle edge case where user might exist from previous application
        if (application.type === "MENTOR") {
          console.log(`🔐 Generating NEW credentials for mentor user`);
          
          const { password, hashedPassword } = await generateCredentials();
          
          // Update user with new password
          await storage.updateUser(existingUser.id, {
            password: hashedPassword,
            role: "MENTOR", // Ensure role is MENTOR
          });
          
          // Link application to user and update status
          await storage.updateApplication(req.params.id, {
            userId: existingUser.id,
            status: "ACCEPTED",
          });
          
          // Create or update mentor profile with credentials approved
          try {
            console.log(`📋 Creating/updating mentor profile for existing user ${existingUser.id}`);
            
            const existingProfile = await storage.getMentorProfileByUserId(existingUser.id);
            
            const mentorData = {
              education: formData?.highestEducation || formData?.education || null,
              skills: formData?.keySkills ? formData.keySkills.split(',').map((s: string) => s.trim()) : [],
              experience: formData?.totalExperience || formData?.experience || null,
              tracksJson: formData?.areaOfInterest || formData?.tracks || [],
              linkedinUrl: formData?.linkedin || formData?.linkedinUrl || null,
              githubUrl: formData?.github || formData?.githubUrl || null,
              portfolioUrl: formData?.portfolio || formData?.portfolioUrl || null,
              description: formData?.bio || formData?.aboutYourself || null,
              aboutMentor: formData?.mentorshipExperience || formData?.about || null,
              cvUrl: formData?.resumeUrl || formData?.cvUrl || null,
              certificationsUrl: formData?.certificatesUrl || null,
              videoUrl: formData?.videoUrl || null,
              credentialsShared: true,
              credentialsApprovedBy: req.session!.userId!, // Admin who accepted
              credentialsApprovedAt: new Date(),
            };
            
            if (existingProfile) {
              await storage.updateMentorProfile(existingProfile.id, mentorData);
              console.log(`✅ Mentor profile updated for user ${existingUser.id}`);
            } else {
              await storage.createMentorProfile({
                userId: existingUser.id,
                ...mentorData,
              });
              console.log(`✅ Mentor profile created for user ${existingUser.id}`);
            }
          } catch (mentorProfileError) {
            console.error(`❌ Error creating/updating mentor profile:`, mentorProfileError);
          }
          
          // Send acceptance email
          try {
            const portalUrl = process.env.PORTAL_URL || "http://localhost:5000";
            await sendAcceptanceEmail(
              normalizedEmail,
              formData?.fullName || existingUser.name || "User",
              { email: normalizedEmail, password },
              portalUrl
            );
          } catch (emailError) {
            console.error("Failed to send acceptance email:", emailError);
          }
          
          console.log(`✅ Credentials generated for mentor: ${existingUser.email}`);
          return res.json({
            message: "Application accepted and credentials generated",
            user: { ...existingUser, password: undefined },
            userId: existingUser.id,
            credentials: {
              email: normalizedEmail,
              password, // Return plain password for admin confirmation
            },
          });
        }
        
        // For other application types, return error
        return res.status(400).json({ 
          message: `User account already exists for this email: ${existingUser.email}. Would you like to link this application to the existing user?`,
          existingUserId: existingUser.id,
          existingUserEmail: existingUser.email
        });
      }
      console.log(`✅ No existing user found for ${normalizedEmail}, proceeding with account creation`);

      // Determine user role based on application type
      let userRole: string;
      if (application.type === "FOUNDER") {
        userRole = "FOUNDER";
      } else if (application.type === "COFOUNDER") {
        userRole = "COFOUNDER";
      } else if (application.type === "LEARNER") {
        userRole = "LEARNER";
      } else if (application.type === "MENTOR") {
        userRole = "MENTOR";
      } else {
        userRole = "LEARNER"; // Default fallback
      }

      // Generate credentials
      const { password, hashedPassword } = await generateCredentials();

      console.log(`🔐 Generated credentials for ${email}:`);
      console.log(`   - Plain password length: ${password.length}`);
      console.log(`   - Hashed password length: ${hashedPassword.length}`);
      console.log(`   - Hashed password starts with: ${hashedPassword.substring(0, 10)}...`);
      console.log(`   - User role: ${userRole}`);

      // Create user account
      const userData = {
        name: formData?.fullName || "User",
        email: normalizedEmail, // Use normalized email
        password: hashedPassword,
        role: userRole as "FOUNDER" | "COFOUNDER" | "LEARNER" | "ADMIN" | "MENTOR" | "UNIVERSITY" | "CORPORATE",
        phone: formData?.phone || formData?.contactNumber || undefined, // For mentors, use contactNumber
      };

      console.log(`📝 Creating user with data:`, {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        hasPassword: !!userData.password,
        passwordLength: userData.password?.length,
        hasPhone: !!userData.phone,
      });

      let user;
      try {
        user = await storage.createUser(userData);
        console.log(`✅ User created successfully:`);
        console.log(`   - User ID: ${user.id}`);
        console.log(`   - Email: ${user.email}`);
        console.log(`   - Role: ${user.role}`);
        console.log(`   - Password saved: ${user.password ? 'Yes' : 'No'}`);
        console.log(`   - Password hash length: ${user.password?.length || 0}`);
        console.log(`   - Password hash preview: ${user.password ? user.password.substring(0, 30) + '...' : 'N/A'}`);
      } catch (createError: any) {
        console.error(`❌ Error creating user:`, createError);
        console.error(`   - Error message: ${createError.message}`);
        console.error(`   - Error code: ${createError.code}`);
        console.error(`   - Error detail: ${createError.detail}`);
        throw createError;
      }

      // Link application to user
      await storage.updateApplication(req.params.id, {
        userId: user.id,
        status: "ACCEPTED",
      });

      // For LEARNER applications with a cohortId, assign user to cohort
      if ((application.type === "LEARNER" || application.type === "PROFESSIONAL") && formData?.cohortId) {
        try {
          console.log(`📋 Assigning learner ${user.id} to cohort ${formData.cohortId}`);
          await storage.createCohortUser({
            userId: user.id,
            cohortId: formData.cohortId,
          });
          console.log(`✅ User assigned to cohort successfully`);
        } catch (cohortUserError) {
          console.error(`❌ Error assigning user to cohort:`, cohortUserError);
          // Don't fail the request if cohort assignment fails
        }
      }

      // For MENTOR applications, create mentor profile with credentials approved
      if (application.type === "MENTOR") {
        try {
          console.log(`📋 Creating mentor profile for new user ${user.id}`);
          
          const mentorData = {
            userId: user.id,
            education: formData?.highestEducation || formData?.education || null,
            skills: formData?.keySkills ? formData.keySkills.split(',').map((s: string) => s.trim()) : [],
            experience: formData?.totalExperience || formData?.experience || null,
            tracksJson: formData?.areaOfInterest || formData?.tracks || [],
            linkedinUrl: formData?.linkedin || formData?.linkedinUrl || null,
            githubUrl: formData?.github || formData?.githubUrl || null,
            portfolioUrl: formData?.portfolio || formData?.portfolioUrl || null,
            description: formData?.bio || formData?.aboutYourself || null,
            aboutMentor: formData?.mentorshipExperience || formData?.about || null,
            cvUrl: formData?.resumeUrl || formData?.cvUrl || null,
            certificationsUrl: formData?.certificatesUrl || null,
            videoUrl: formData?.videoUrl || null,
            credentialsShared: true,
            credentialsApprovedBy: req.session!.userId!, // Admin who accepted
            credentialsApprovedAt: new Date(),
          };
          
          await storage.createMentorProfile(mentorData);
          console.log(`✅ Mentor profile created successfully for user ${user.id}`);
        } catch (mentorProfileError) {
          console.error(`❌ Error creating mentor profile:`, mentorProfileError);
          // Don't fail the request if profile creation fails
        }
      }

      // Send acceptance email
      try {
        const portalUrl = process.env.PORTAL_URL || "http://localhost:5000";
        await sendAcceptanceEmail(
          normalizedEmail, // Use normalized email
          formData?.fullName || "User",
          { email, password },
          portalUrl
        );
      } catch (emailError) {
        console.error("Failed to send acceptance email:", emailError);
        // Don't fail the request if email fails
      }

      res.json({
        message: "Application accepted and user account created",
        user: { ...user, password: undefined },
        userId: user.id,
        credentials: {
          email,
          password, // Return plain password for admin confirmation
        },
      });
    } catch (error) {
      console.error("Error accepting application:", error);
      res.status(500).json({ message: "Failed to accept application" });
    }
  });

  // Schedule meeting for application
  app.post("/api/admin/applications/:id/schedule-meeting", requireRole("ADMIN"), async (req, res) => {
    try {
      const { date, time, agenda } = req.body;
      const { createCalendarEvent } = await import("./services/calendar-service");
      const { sendMeetingInviteToCandidate, sendMeetingInviteToAdmin } = await import("./services/email-service");

      if (!date || !time) {
        return res.status(400).json({ message: "Date and time are required" });
      }

      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      const formData = application.formJson as any;
      const candidateEmail = formData?.email;
      const candidateName = formData?.fullName || "Candidate";

      if (!candidateEmail) {
        return res.status(400).json({ message: "Candidate email not found" });
      }

      // Get admin email
      const currentUser = await storage.getUser(req.session!.userId!);
      const adminEmail = currentUser?.email;

      // Create Google Calendar event
      const { eventId, meetLink } = await createCalendarEvent(
        date,
        time,
        `Interview with ${candidateName} - StartupUniv`,
        agenda || `Interview for ${application.type} position`,
        candidateEmail,
        adminEmail
      );

      // Update application with meeting details
      const meetingDateTime = new Date(`${date}T${time}`);
      const updated = await storage.updateApplication(req.params.id, {
        meetingScheduledAt: meetingDateTime,
        meetingLink: meetLink,
        meetingAgenda: agenda || "",
        meetingGoogleEventId: eventId,
      });

      // Send meeting invites via email
      try {
        await sendMeetingInviteToCandidate(candidateEmail, candidateName, {
          date,
          time,
          meetingLink: meetLink,
          agenda: agenda || "",
          candidateName,
        });

        if (adminEmail) {
          await sendMeetingInviteToAdmin(adminEmail, candidateName, {
            date,
            time,
            meetingLink: meetLink,
            agenda: agenda || "",
            candidateName,
          });
        }
      } catch (emailError) {
        console.error("Failed to send meeting invites:", emailError);
        // Don't fail the request if email fails
      }

      res.json({
        message: "Meeting scheduled successfully",
        meeting: {
          date,
          time,
          link: meetLink,
          agenda: agenda || "",
          eventId,
        },
        application: updated,
      });
    } catch (error: any) {
      const errMsg = error?.message ?? String(error);
      console.error("Error scheduling meeting:", errMsg, error);
      // If credentials are missing, log a clear hint for production (ECS/Secrets Manager)
      if (errMsg.includes("credentials not configured") || errMsg.includes("REFRESH_TOKEN is required")) {
        console.error("Hint: Set GOOGLE_CALENDAR_* in AWS Secrets Manager and ensure ECS task definition includes them. Merge and deploy workflow-only-on-push-main if not yet on main.");
      }
      res.status(500).json({ message: "Failed to schedule meeting" });
    }
  });

  // Update meeting agenda
  app.patch("/api/admin/applications/:id/meeting", requireRole("ADMIN"), async (req, res) => {
    try {
      const { agenda } = req.body;
      const { updateEventDescription } = await import("./services/calendar-service");

      if (!agenda) {
        return res.status(400).json({ message: "Agenda is required" });
      }

      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (!application.meetingGoogleEventId) {
        return res.status(400).json({ message: "No meeting scheduled for this application" });
      }

      // Update Google Calendar event
      await updateEventDescription(application.meetingGoogleEventId, agenda);

      // Update application
      const updated = await storage.updateApplication(req.params.id, {
        meetingAgenda: agenda,
      });

      res.json({
        message: "Meeting agenda updated",
        application: updated,
      });
    } catch (error) {
      console.error("Error updating meeting agenda:", error);
      res.status(500).json({ message: "Failed to update meeting agenda" });
    }
  });

  // =====================
  // Assessment Routes
  // =====================

  app.get("/api/assessments", async (req, res) => {
    const { cohortId, active } = req.query;

    if (cohortId && typeof cohortId === "string") {
      const assessments = await storage.getAssessmentsByCohort(cohortId);
      return res.json(assessments);
    }

    if (active === "true") {
      const assessments = await storage.getActiveAssessments();
      return res.json(assessments);
    }

    const assessments = await storage.getAssessments();
    res.json(assessments);
  });

  app.get("/api/assessments/:id", async (req, res) => {
    const assessment = await storage.getAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const questions = await storage.getQuestionsByAssessment(assessment.id);
    res.json({ ...assessment, questions });
  });

  app.post("/api/assessments", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session!.userId!);
      const assessment = await storage.createAssessment({
        ...req.body,
        createdBy: currentUser!.id,
      });
      res.status(201).json(assessment);
    } catch (error) {
      console.error("Create assessment error:", error);
      res.status(400).json({ message: "Failed to create assessment" });
    }
  });

  app.patch("/api/assessments/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    const updated = await storage.updateAssessment(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Assessment not found" });
    }
    res.json(updated);
  });

  app.delete("/api/assessments/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    const deleted = await storage.deleteAssessment(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Assessment not found" });
    }
    res.json({ message: "Assessment deleted successfully" });
  });

  // Assessment Questions (Admin and Manager can create)
  app.post("/api/assessments/:assessmentId/questions", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    try {
      const question = await storage.createAssessmentQuestion({
        ...req.body,
        assessmentId: req.params.assessmentId,
      });
      res.status(201).json(question);
    } catch (error) {
      console.error("Create question error:", error);
      res.status(400).json({ message: "Failed to create question" });
    }
  });

  app.patch("/api/assessments/:assessmentId/questions/:questionId", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    const updated = await storage.updateAssessmentQuestion(req.params.questionId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Question not found" });
    }
    res.json(updated);
  });

  app.delete("/api/assessments/:assessmentId/questions/:questionId", requireRole("ADMIN", "MANAGER"), async (req, res) => {
    const deleted = await storage.deleteAssessmentQuestion(req.params.questionId);
    if (!deleted) {
      return res.status(404).json({ message: "Question not found" });
    }
    res.json({ message: "Question deleted successfully" });
  });

  // Assessment Results (Admin)
  app.get("/api/assessments/:id/results", requireRole("ADMIN"), async (req, res) => {
    const assessment = await storage.getAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const attempts = await storage.getAttemptsByAssessment(assessment.id);
    const enrichedAttempts = await Promise.all(
      attempts.map(async (attempt) => {
        const user = attempt.userId ? await storage.getUser(attempt.userId) : null;
        const application = attempt.applicationId ? await storage.getApplication(attempt.applicationId) : null;
        return {
          ...attempt,
          user: user ? { id: user.id, name: user.name, email: user.email } : null,
          application,
        };
      })
    );

    res.json({ assessment, attempts: enrichedAttempts });
  });

  // Get pending assessments that need grading (Admin)
  app.get("/api/admin/assessments/pending-grading", requireRole("ADMIN"), async (req, res) => {
    try {
      const allAssessments = await storage.getAssessments();
      const pendingAssessments = [];

      for (const assessment of allAssessments) {
        const attempts = await storage.getAttemptsByAssessment(assessment.id);
        const submittedAttempts = attempts.filter(a => a.status === "SUBMITTED" || a.status === "GRADED");

        if (submittedAttempts.length > 0) {
          // Check if any need grading (have subjective questions)
          const questions = await storage.getQuestionsByAssessment(assessment.id);
          const hasSubjectiveQuestions = questions.some(q => q.type === "SHORT_ANSWER" || q.type === "ESSAY");

          let needsGradingCount = 0;
          for (const attempt of submittedAttempts) {
            if (attempt.status === "GRADED") continue;
            if (!hasSubjectiveQuestions) continue; // Auto-graded, no manual grading needed

            // Check if all subjective answers are graded
            const answers = await storage.getAnswersByAttempt(attempt.id);
            const subjectiveQIds = questions.filter(q => q.type === "SHORT_ANSWER" || q.type === "ESSAY").map(q => q.id);
            const hasUngraded = subjectiveQIds.some(qId => {
              const answer = answers.find(a => a.questionId === qId);
              return !answer || answer.awardedScore === null || answer.awardedScore === undefined;
            });

            if (hasUngraded) {
              needsGradingCount++;
            }
          }

          if (needsGradingCount > 0 || submittedAttempts.length > 0) {
            pendingAssessments.push({
              assessment,
              totalAttempts: submittedAttempts.length,
              needsGrading: needsGradingCount,
              graded: submittedAttempts.filter(a => a.status === "GRADED").length,
            });
          }
        }
      }

      res.json(pendingAssessments);
    } catch (error) {
      console.error("Get pending assessments error:", error);
      res.status(500).json({ message: "Failed to get pending assessments" });
    }
  });

  // Detailed Attempt Results (for learners and admins)
  app.get("/api/attempts/:attemptId/details", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session!.userId!);
    const attempt = await storage.getAssessmentAttempt(req.params.attemptId);

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    // Only allow the user who took the attempt OR admins/managers/mentors to view details
    const isAdmin = currentUser!.role === "ADMIN";
    const isManager = currentUser!.role === "MANAGER";
    const isMentor = currentUser!.role === "MENTOR";
    if (attempt.userId !== currentUser!.id && !isAdmin && !isManager && !isMentor) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Only show details for submitted or graded attempts
    if (attempt.status !== "SUBMITTED" && attempt.status !== "GRADED") {
      return res.status(400).json({ message: "Attempt has not been submitted yet" });
    }

    // For learners, only show details if results are published
    // Managers and admins can always see details
    if (!isAdmin && !isManager && !isMentor && !attempt.resultsPublished) {
      return res.status(403).json({ message: "Results have not been published yet. Please check back later." });
    }

    const assessment = await storage.getAssessment(attempt.assessmentId);
    const questions = await storage.getQuestionsByAssessment(attempt.assessmentId);
    const answers = await storage.getAnswersByAttempt(attempt.id);

    // Build detailed breakdown
    const questionDetails = questions.map((question) => {
      const answer = answers.find(a => a.questionId === question.id);
      let userResponse = answer?.responseJson as string | null;
      // Parse the JSON response - it's stored as a JSON string (e.g., "\"Do Coding\"")
      if (userResponse) {
        try {
          userResponse = JSON.parse(userResponse);
        } catch (e) {
          // If parsing fails, use the raw value
        }
      }
      const awardedScore = answer?.awardedScore ?? null;
      // Don't auto-determine isCorrect - manager will mark each question manually
      // isCorrect is only true if manager has explicitly graded it as correct (awardedScore === maxScore)
      const isCorrect = awardedScore !== null && awardedScore === question.maxScore;

      return {
        questionId: question.id,
        answerId: answer?.id || null,
        type: question.type,
        prompt: question.prompt,
        options: question.optionsJson,
        correctAnswer: question.correctAnswer,
        userAnswer: userResponse,
        maxScore: question.maxScore,
        awardedScore,
        isCorrect,
        order: question.order,
      };
    }).sort((a, b) => (a.order || 0) - (b.order || 0));

    // Get user info if admin/manager is viewing
    let userInfo = null;
    if ((isAdmin || isManager) && attempt.userId) {
      const attemptUser = await storage.getUser(attempt.userId);
      userInfo = attemptUser ? {
        id: attemptUser.id,
        name: attemptUser.name,
        email: attemptUser.email
      } : null;
    }

    res.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        score: attempt.score,
        maxScore: attempt.maxScore,
        passed: attempt.passed,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
      },
      assessment: {
        id: assessment!.id,
        title: assessment!.title,
        passingScore: assessment!.passingScore,
        durationMinutes: assessment!.durationMinutes,
      },
      user: userInfo,
      questions: questionDetails,
      summary: {
        totalQuestions: questions.length,
        correctAnswers: questionDetails.filter(q => q.isCorrect).length,
        totalScore: attempt.score ?? 0, // Will be 0 until manager reviews
        maxScore: attempt.maxScore || 0,
        percentage: attempt.maxScore && attempt.score !== null ? Math.round((attempt.score / attempt.maxScore) * 100) : 0,
        passed: attempt.passed, // null until manager reviews
      },
    });
  });

  // Grade individual answer (Admin/Manager/Mentor)
  app.post("/api/answers/:answerId/grade", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session!.userId!);
      const isAdmin = currentUser!.role === "ADMIN";
      const isManager = currentUser!.role === "MANAGER";
      const isMentor = currentUser!.role === "MENTOR";

      if (!isAdmin && !isManager && !isMentor) {
        return res.status(403).json({ message: "Only admins, managers, and mentors can grade answers" });
      }

      const answer = await storage.getAssessmentAnswer(req.params.answerId);
      if (!answer) {
        return res.status(404).json({ message: "Answer not found" });
      }

      const { awardedScore } = req.body;
      if (typeof awardedScore !== 'number' || awardedScore < 0) {
        return res.status(400).json({ message: "Invalid score" });
      }

      // Get the question to validate max score
      const questions = await storage.getQuestionsByAssessment(
        (await storage.getAssessmentAttempt(answer.attemptId))!.assessmentId
      );
      const question = questions.find(q => q.id === answer.questionId);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      if (awardedScore > (question.maxScore || 1)) {
        return res.status(400).json({ message: `Score cannot exceed ${question.maxScore || 1}` });
      }

      // Update the answer with the graded score
      const updated = await storage.updateAssessmentAnswer(answer.id, { awardedScore });

      // Recalculate attempt total score (but don't auto-determine pass/fail)
      const attempt = await storage.getAssessmentAttempt(answer.attemptId);
      const allAnswers = await storage.getAnswersByAttempt(answer.attemptId);
      const totalScore = allAnswers.reduce((sum, a) => sum + (a.awardedScore || 0), 0);

      // Calculate max score from all questions
      const maxScore = questions.reduce((sum, q) => sum + (q.maxScore || 1), 0);

      // Update attempt with new score but keep passed as null - manager will decide pass/fail manually
      // Don't auto-calculate passed - manager will review all questions and make the decision
      await storage.updateAssessmentAttempt(attempt!.id, {
        score: totalScore,
        maxScore,
        // Keep passed as null - manager will decide in the review route
        passed: null,
        // Don't auto-mark as GRADED - manager will mark it when they make pass/fail decision
        status: attempt!.status,
      });

      res.json({
        answer: updated,
        attemptScore: totalScore,
        maxScore,
        // Don't return passed - manager will decide manually
        passed: null
      });
    } catch (error) {
      console.error("Grade answer error:", error);
      res.status(500).json({ message: "Failed to grade answer" });
    }
  });

  // Publish assessment results for an attempt (Admin only)
  app.post("/api/attempts/:attemptId/publish", requireRole("ADMIN"), async (req, res) => {
    try {
      const attempt = await storage.getAssessmentAttempt(req.params.attemptId);

      if (!attempt) {
        return res.status(404).json({ message: "Attempt not found" });
      }

      if (attempt.status === "IN_PROGRESS") {
        return res.status(400).json({ message: "Cannot publish results for an in-progress attempt" });
      }

      const updated = await storage.updateAssessmentAttempt(attempt.id, {
        resultsPublished: true,
      });

      res.json({
        message: "Results published successfully",
        attempt: updated
      });
    } catch (error) {
      console.error("Publish results error:", error);
      res.status(500).json({ message: "Failed to publish results" });
    }
  });

  // Unpublish assessment results for an attempt (Admin only)
  app.post("/api/attempts/:attemptId/unpublish", requireRole("ADMIN"), async (req, res) => {
    try {
      const attempt = await storage.getAssessmentAttempt(req.params.attemptId);

      if (!attempt) {
        return res.status(404).json({ message: "Attempt not found" });
      }

      const updated = await storage.updateAssessmentAttempt(attempt.id, {
        resultsPublished: false,
      });

      res.json({
        message: "Results unpublished successfully",
        attempt: updated
      });
    } catch (error) {
      console.error("Unpublish results error:", error);
      res.status(500).json({ message: "Failed to unpublish results" });
    }
  });

  // Rescore an attempt (Admin only) - recalculates scores for MCQ/TRUE_FALSE questions
  app.post("/api/attempts/:attemptId/rescore", requireRole("ADMIN"), async (req, res) => {
    try {
      const attempt = await storage.getAssessmentAttempt(req.params.attemptId);

      if (!attempt) {
        return res.status(404).json({ message: "Attempt not found" });
      }

      if (attempt.status === "IN_PROGRESS") {
        return res.status(400).json({ message: "Cannot rescore an in-progress attempt" });
      }

      const assessment = await storage.getAssessment(attempt.assessmentId);
      const questions = await storage.getQuestionsByAssessment(attempt.assessmentId);
      const answers = await storage.getAnswersByAttempt(attempt.id);

      // Helper to normalize response value from JSON column
      const normalizeResponse = (responseJson: unknown): string => {
        if (typeof responseJson === 'string') {
          try {
            const parsed = JSON.parse(responseJson);
            if (typeof parsed === 'string') {
              return parsed.trim();
            }
            return String(parsed).trim();
          } catch {
            return responseJson.trim();
          }
        }
        if (responseJson === null || responseJson === undefined) {
          return '';
        }
        return String(responseJson).trim();
      };

      let totalScore = 0;
      let maxScore = 0;
      let rescored = 0;

      // Rescore MCQ and TRUE_FALSE questions
      for (const question of questions) {
        maxScore += question.maxScore || 1;
        const answer = answers.find(a => a.questionId === question.id);

        if (answer) {
          if (question.type === "MCQ" || question.type === "TRUE_FALSE") {
            if (question.correctAnswer) {
              const response = normalizeResponse(answer.responseJson);
              const correctAnswer = question.correctAnswer.trim();

              if (response === correctAnswer) {
                await storage.updateAssessmentAnswer(answer.id, { awardedScore: question.maxScore || 1 });
                totalScore += question.maxScore || 1;
                rescored++;
              } else {
                await storage.updateAssessmentAnswer(answer.id, { awardedScore: 0 });
                rescored++;
              }
            }
          } else {
            // For SHORT_ANSWER and ESSAY, keep existing score
            totalScore += answer.awardedScore || 0;
          }
        }
      }

      // passingScore is a percentage, so calculate actual percentage achieved
      const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
      const passed = percentage >= (assessment?.passingScore || 0);

      const updated = await storage.updateAssessmentAttempt(attempt.id, {
        score: totalScore,
        maxScore,
        passed,
      });

      res.json({
        message: `Rescored successfully. ${rescored} answers updated.`,
        attempt: updated,
        totalScore,
        maxScore,
        percentage: Math.round(percentage),
        passed
      });
    } catch (error) {
      console.error("Rescore error:", error);
      res.status(500).json({ message: "Failed to rescore attempt" });
    }
  });

  // Assessment Assignments (Admin)
  app.get("/api/assessments/:id/assignments", requireRole("ADMIN"), async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsByAssessmentWithUsers(req.params.id);
      res.json(assignments);
    } catch (error) {
      console.error("Get assignments error:", error);
      res.status(500).json({ message: "Failed to get assignments" });
    }
  });

  app.post("/api/assessments/:id/assignments", requireRole("ADMIN"), async (req, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "userIds must be a non-empty array" });
      }

      const adminId = req.session!.userId;
      const results = [];

      for (const userId of userIds) {
        try {
          const assignment = await storage.createAssessmentAssignment({
            assessmentId: req.params.id,
            userId,
            assignedBy: adminId,
          });
          results.push(assignment);
        } catch (error: any) {
          // Skip duplicate assignments (unique constraint violation)
          if (error.code !== '23505') {
            throw error;
          }
        }
      }

      res.status(201).json(results);
    } catch (error) {
      console.error("Create assignments error:", error);
      res.status(400).json({ message: "Failed to create assignments" });
    }
  });

  app.delete("/api/assessments/:id/assignments/:userId", requireRole("ADMIN"), async (req, res) => {
    try {
      await storage.deleteAssessmentAssignment(req.params.id, req.params.userId);
      res.json({ message: "Assignment removed successfully" });
    } catch (error) {
      console.error("Delete assignment error:", error);
      res.status(400).json({ message: "Failed to remove assignment" });
    }
  });

  // Assign assessment to an application (creates user assignment)
  app.post("/api/applications/assign-assessment", requireRole("ADMIN"), async (req, res) => {
    try {
      const { applicationId, assessmentId } = req.body;
      const adminId = req.session!.userId!;

      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      const assessment = await storage.getAssessment(assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      // Check if assessment has questions
      const questions = await storage.getQuestionsByAssessment(assessmentId);
      if (!questions || questions.length === 0) {
        return res.status(400).json({
          message: "Assessment has no questions. Please add questions before assigning."
        });
      }

      // Generate public token
      const crypto = await import("crypto");
      const publicToken = crypto.randomBytes(32).toString("hex");

      // Get candidate email from application
      const formData = application.formJson as any;
      const candidateEmail = formData?.email;
      if (!candidateEmail) {
        return res.status(400).json({ message: "Application has no email address" });
      }

      // Get or create user for the assignment
      let userId = application.userId;
      if (!userId) {
        // Try to find user by email first
        const existingUser = await storage.getUserByEmail(candidateEmail);
        if (existingUser) {
          userId = existingUser.id;
        } else {
          // Create a user for the assessment if none exists
          const { hashPassword } = await import("./services/credential-service");
          const newUser = await storage.createUser({
            email: candidateEmail,
            password: await hashPassword(Math.random().toString(36)),
            name: formData?.fullName || candidateEmail.split("@")[0],
            role: "LEARNER",
          });
          userId = newUser.id;
        }
      }

      // Create assignment with public token
      try {
        const assignment = await storage.createAssessmentAssignment({
          assessmentId,
          userId: userId,
          assignedBy: adminId,
          publicToken,
          email: candidateEmail,
        });

        // Send email with assessment link
        const { sendAssessmentAssignmentEmail } = await import("./services/email-service");
        // Use request origin for deployed apps, fallback to env variable or localhost
        const origin = req.headers.origin || req.headers.referer?.replace(/\/.*$/, '') || process.env.APP_URL || "http://localhost:5432";
        const assessmentLink = `${origin}/assessment/${publicToken}`;
        
        console.log("📧 [ADMIN] Sending assessment email:", {
          to: candidateEmail,
          name: formData?.fullName || "Candidate",
          assessmentTitle: assessment.title,
          assessmentLink,
          publicToken
        });
        
        try {
          await sendAssessmentAssignmentEmail(
            candidateEmail,
            formData?.fullName || "Candidate",
            assessment.title,
            assessmentLink
          );
          console.log("✅ [ADMIN] Assessment email sent successfully to", candidateEmail);
        } catch (emailError) {
          console.error("❌ [ADMIN] Failed to send assessment email:", emailError);
          // Don't fail the whole request if email fails
        }

        res.status(201).json(assignment);
      } catch (error: any) {
        if (error.code === '23505') {
          return res.status(400).json({ message: "Assessment is already assigned to this applicant" });
        }
        throw error;
      }
    } catch (error) {
      console.error("Assign assessment to application error:", error);
      res.status(500).json({ message: "Failed to assign assessment" });
    }
  });

  // Get assessments assigned to an application's user
  app.get("/api/applications/:id/assessments", requireRole("ADMIN"), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (!application.userId) {
        return res.json([]);
      }

      // Get all assignments for this user
      const assignments = await storage.getAssignmentsByUser(application.userId);

      // Get assessment details and attempt status
      const assessmentsWithStatus = await Promise.all(
        assignments.map(async (assignment) => {
          const assessment = await storage.getAssessment(assignment.assessmentId);
          const attempt = await storage.getAttemptByUserAndAssessment(application.userId!, assignment.assessmentId);

          return {
            id: assignment.id,
            assessmentId: assessment?.id,
            userId: assignment.userId,
            status: attempt?.status || "NOT_STARTED",
            score: attempt?.score,
            submittedAt: attempt?.submittedAt,
            assessment: assessment ? {
              id: assessment.id,
              title: assessment.title,
              durationMinutes: assessment.durationMinutes,
              passingScore: assessment.passingScore,
            } : null,
          };
        })
      );

      res.json(assessmentsWithStatus.filter(a => a.assessment !== null));
    } catch (error) {
      console.error("Get application assessments error:", error);
      res.status(500).json({ message: "Failed to get assessments" });
    }
  });

  // =====================
  // Assessment Attempt Routes (for applicants)
  // =====================
  // Get available assessments for current user
  app.get("/api/my-assessments", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session!.userId!);
    const activeAssessments = await storage.getActiveAssessments();

    // Get assessments specifically assigned to this user
    const userAssignments = await storage.getAssignmentsByUser(currentUser!.id);
    const assignedAssessmentIds = new Set(userAssignments.map(a => a.assessmentId));

    // Include both active assessments AND specifically assigned assessments
    const allAssessments = await storage.getAssessments();
    const assignedInactiveAssessments = allAssessments.filter(
      a => assignedAssessmentIds.has(a.id) && !a.isActive
    );

    // Combine active assessments with assigned inactive assessments
    const combinedAssessments = [...activeAssessments, ...assignedInactiveAssessments];
    const uniqueAssessments = Array.from(
      new Map(combinedAssessments.map(a => [a.id, a])).values()
    );

    // Check which assessments the user has already attempted
    const assessmentsWithStatus = await Promise.all(
      uniqueAssessments.map(async (assessment) => {
        const attempt = await storage.getAttemptByUserAndAssessment(currentUser!.id, assessment.id);
        const isAssigned = assignedAssessmentIds.has(assessment.id);

        // Hide score details if results are not yet published
        let safeAttempt = null;
        if (attempt) {
          if (attempt.resultsPublished) {
            safeAttempt = attempt;
          } else {
            // Hide score details but show status
            safeAttempt = {
              ...attempt,
              score: null,
              maxScore: null,
              passed: null,
            };
          }
        }

        return {
          ...assessment,
          attempt: safeAttempt,
          canStart: !attempt || attempt.status === "EXPIRED",
          isAssigned,
        };
      })
    );

    res.json(assessmentsWithStatus);
  });

  // Start an assessment attempt
  app.post("/api/assessments/:id/start", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session!.userId!);
    const assessment = await storage.getAssessment(req.params.id);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    // Check if user has an individual assignment (allows access even if not globally active)
    const userAssignments = await storage.getAssignmentsByUser(currentUser!.id);
    const isIndividuallyAssigned = userAssignments.some(a => a.assessmentId === assessment.id);

    if (!assessment.isActive && !isIndividuallyAssigned) {
      return res.status(400).json({ message: "Assessment is not active" });
    }

    // Check if user already has an in-progress attempt
    const existingAttempt = await storage.getAttemptByUserAndAssessment(currentUser!.id, assessment.id);
    if (existingAttempt && existingAttempt.status === "IN_PROGRESS") {
      // Get questions (without correct answers for security) even for existing attempts
      const questions = await storage.getQuestionsByAssessment(assessment.id);
      const safeQuestions = questions.map(q => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        optionsJson: q.optionsJson,
        maxScore: q.maxScore,
        order: q.order,
      }));
      return res.json({ attempt: existingAttempt, questions: safeQuestions });
    }
    if (existingAttempt && existingAttempt.status === "SUBMITTED") {
      return res.status(400).json({ message: "You have already completed this assessment" });
    }

    // Calculate expiry time based on assessment duration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (assessment.durationMinutes || 60));

    const attempt = await storage.createAssessmentAttempt({
      assessmentId: assessment.id,
      userId: currentUser!.id,
      applicationId: req.body.applicationId || null,
      status: "IN_PROGRESS",
      expiresAt,
    });

    // Get questions (without correct answers for security)
    const questions = await storage.getQuestionsByAssessment(assessment.id);
    const safeQuestions = questions.map(q => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      optionsJson: q.optionsJson,
      maxScore: q.maxScore,
      order: q.order,
    }));

    res.status(201).json({ attempt, questions: safeQuestions });
  });

  // Save answer during assessment
  app.post("/api/attempts/:attemptId/answers", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session!.userId!);
    const attempt = await storage.getAssessmentAttempt(req.params.attemptId);

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (attempt.userId !== currentUser!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return res.status(400).json({ message: "Attempt is not in progress" });
    }

    // Check if attempt has expired
    if (attempt.expiresAt && new Date() > new Date(attempt.expiresAt)) {
      await storage.updateAssessmentAttempt(attempt.id, { status: "EXPIRED" });
      return res.status(400).json({ message: "Assessment time has expired" });
    }

    const { questionId, response } = req.body;

    // Check if answer already exists and update it
    const existingAnswers = await storage.getAnswersByAttempt(attempt.id);
    const existingAnswer = existingAnswers.find(a => a.questionId === questionId);

    if (existingAnswer) {
      const updated = await storage.updateAssessmentAnswer(existingAnswer.id, {
        responseJson: response,
      });
      return res.json(updated);
    }

    try {
      const answer = await storage.createAssessmentAnswer({
        attemptId: attempt.id,
        questionId,
        responseJson: response,
      });
      res.status(201).json(answer);
    } catch (error: any) {
      // Handle race condition: if answer was created between check and insert
      if (error.code === '23505' && error.constraint === 'assessment_answers_attempt_question_idx') {
        // Answer was created by another request, fetch and update it
        const existingAnswers = await storage.getAnswersByAttempt(attempt.id);
        const existingAnswer = existingAnswers.find(a => a.questionId === questionId);
        if (existingAnswer) {
          const updated = await storage.updateAssessmentAnswer(existingAnswer.id, {
            responseJson: response,
          });
          return res.json(updated);
        }
      }
      throw error;
    }
  });

  // Submit assessment attempt
  app.post("/api/attempts/:attemptId/submit", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session!.userId!);
    const attempt = await storage.getAssessmentAttempt(req.params.attemptId);

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (attempt.userId !== currentUser!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return res.status(400).json({ message: "Attempt is not in progress" });
    }

    // Get assessment and questions for scoring
    const assessment = await storage.getAssessment(attempt.assessmentId);
    const questions = await storage.getQuestionsByAssessment(attempt.assessmentId);
    const answers = await storage.getAnswersByAttempt(attempt.id);

    let totalScore = 0;
    let maxScore = 0;

    // Helper to normalize response value from JSON column
    const normalizeResponse = (responseJson: unknown): string => {
      if (typeof responseJson === 'string') {
        // Try to parse if it looks like a JSON string
        try {
          const parsed = JSON.parse(responseJson);
          if (typeof parsed === 'string') {
            return parsed.trim();
          }
          return String(parsed).trim();
        } catch {
          return responseJson.trim();
        }
      }
      if (responseJson === null || responseJson === undefined) {
        return '';
      }
      return String(responseJson).trim();
    };

    // Don't auto-score - manager will review all questions manually
    // Calculate max score but leave awardedScore as null for manager review
    for (const question of questions) {
      maxScore += question.maxScore || 1;
      const answer = answers.find(a => a.questionId === question.id);

      if (answer) {
        // Leave awardedScore as null - manager will grade all questions
        // Only set to null if it's not already set (for SHORT_ANSWER/ESSAY)
        if (answer.awardedScore === null || answer.awardedScore === undefined) {
          // Keep it null for manual review
        }
      }
    }

    // Don't calculate score or pass/fail - manager will review and decide
    const updated = await storage.updateAssessmentAttempt(attempt.id, {
      status: "SUBMITTED",
      submittedAt: new Date(),
      score: null, // Manager will set after review
      maxScore,
      passed: null, // Manager will decide pass/fail
    });

    // Don't update entranceScore on submission - manager will set it after review
    // Entrance score will be updated when manager reviews and sets the final score

    // Don't reveal scores to learner - they need to wait for results to be published
    res.json({
      ...updated,
      score: null,
      maxScore: null,
      passed: null,
      passingScore: null,
      resultsPublished: false,
      message: "Your assessment has been submitted. Results will be available after review.",
    });
  });

  // =====================
  // Team Routes
  // =====================

  app.get("/api/teams", requireAuth, async (req, res) => {
    try {
      const { cohortId } = req.query;
      if (cohortId && typeof cohortId === "string") {
        const teams = await storage.getTeamsByCohort(cohortId);
        return res.json(teams);
      }

      const currentUser = await storage.getUser(req.session!.userId!);
      if (currentUser?.role === "ADMIN") {
        const teams = await storage.getTeams();
        return res.json(teams);
      }

      // For mentors and learners, get only their assigned teams
      const assignments = await storage.getRoleAssignmentsByUser(currentUser!.id);
      const teamIds = Array.from(new Set(assignments.map(a => a.teamId)));
      const teams = await Promise.all(teamIds.map(id => storage.getTeam(id)));
      res.json(teams.filter(Boolean));
    } catch (error: any) {
      console.error("Get teams error:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get("/api/teams/metrics", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session!.userId!);
      let teams = [];

      if (currentUser?.role === "ADMIN") {
        teams = await storage.getTeams();
      } else {
        // For mentors and learners, get teams they're members of
        const assignments = await storage.getRoleAssignmentsByUser(req.session!.userId!);
        const teamIds = Array.from(new Set(assignments.map(a => a.teamId)));
        const teamsData = await Promise.all(teamIds.map(id => storage.getTeam(id)));
        teams = teamsData.filter(Boolean);
      }

      const { getTeamHealthMetrics } = await import("./team-health-calculator.js");

      const metrics: { [teamId: string]: { completionRate: number; healthScore: number; totalTasks: number; completedTasks: number; memberCount: number } } = {};

      for (const team of teams) {
        if (!team) continue;
        const teamMetrics = await getTeamHealthMetrics(team.id);
        const teamMembers = await storage.getRoleAssignmentsByTeam(team.id);
        metrics[team.id] = {
          completionRate: teamMetrics.completionRate,
          healthScore: teamMetrics.healthScore,
          totalTasks: teamMetrics.totalTasks,
          completedTasks: teamMetrics.completedTasks,
          memberCount: teamMembers.length,
        };
      }

      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch team metrics" });
    }
  });

  app.get("/api/teams/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const user = await storage.getUser(userId);
      
      console.log("🔍 Fetching team:", req.params.id);
      const team = await storage.getTeam(req.params.id);
      if (!team) {
        console.log("⚠️ Team not found:", req.params.id);
        return res.status(404).json({ message: "Team not found" });
      }

      // Authorization check: Only allow access if user is admin, or a member of this team
      if (user?.role !== "ADMIN") {
        const userAssignments = await storage.getRoleAssignmentsByUser(userId);
        const isTeamMember = userAssignments.some(a => a.teamId === team.id);
        if (!isTeamMember) {
          console.log("⚠️ Unauthorized team access attempt:", { userId, teamId: team.id });
          return res.status(403).json({ message: "You don't have access to this team" });
        }
      }

      // Get additional team data
      console.log(`[Team Details] Fetching team ${team.id}, problemStatementId: ${team.problemStatementId}`);
      const [members, sprints, seedFund, capTable, evidenceList, problemStatement] = await Promise.all([
        storage.getRoleAssignmentsByTeam(team.id),
        storage.getSprintsByTeam(team.id),
        storage.getSeedFundByTeam(team.id),
        storage.getCapTableByTeam(team.id),
        storage.getEvidenceByTeam(team.id),
        team.problemStatementId ? storage.getProblemStatement(team.problemStatementId) : Promise.resolve(null),
      ]);
      
      console.log(`[Team Details] Problem statement fetched:`, problemStatement ? { id: problemStatement.id, title: problemStatement.title } : 'null');

      // Get member details
      const membersWithDetails = await Promise.all(
        members.map(async (m) => {
          const user = await storage.getUser(m.userId);
          return { ...m, user: user ? { ...user, password: undefined } : null };
        })
      );

      console.log("✅ Team fetched successfully:", team.id);
      res.json({
        ...team,
        members: membersWithDetails,
        sprints,
        seedFund,
        capTable,
        evidence: evidenceList,
        problemStatement,
      });
    } catch (error: any) {
      console.error("❌ Error fetching team:", error);
      console.error("Error fetching team:", error);
      res.status(500).json({
        message: "Failed to fetch team"
      });
    }
  });

  app.post("/api/teams", requireRole("ADMIN", "FOUNDER"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const currentUser = await storage.getUser(userId);

      console.log("🏗️ Creating team for user:", {
        userId,
        userRole: currentUser?.role,
        teamData: req.body,
      });

      // Get an active cohort if cohortId is not provided (cohortId is required in schema)
      let cohortId = req.body.cohortId;
      if (!cohortId && currentUser?.role === "FOUNDER") {
        // Try to find an active cohort
        const cohorts = await storage.getCohorts();
        const activeCohort = cohorts.find(c => c.isActive);
        if (activeCohort) {
          cohortId = activeCohort.id;
          console.log("📋 Using active cohort:", activeCohort.id, activeCohort.name);
        } else if (cohorts.length > 0) {
          // If no active cohort, use the first available cohort
          cohortId = cohorts[0].id;
          console.log("📋 Using first available cohort:", cohorts[0].id, cohorts[0].name);
        } else {
          // If no cohorts exist, return an error
          return res.status(400).json({
            message: "No cohort available. Please contact admin to create a cohort first.",
            error: "No cohorts found in database"
          });
        }
      }

      if (!cohortId) {
        return res.status(400).json({
          message: "Cohort ID is required",
          error: "cohortId must be provided"
        });
      }

      // Prepare team data
      const teamData = {
        name: req.body.name || `${currentUser?.name || "Founder"}'s Team`,
        cohortId: cohortId,
        problemStatementId: req.body.problemStatementId || null,
        health: req.body.health || "G",
      };

      console.log("📝 Team data to create:", teamData);

      // If founder is creating team, auto-assign them as Promoter
      const team = await storage.createTeam(teamData);

      console.log("✅ Team created:", { teamId: team.id, teamName: team.name });

      // Link problem statement to this team (so team members can see it on Problem Statement tab)
      if (team.problemStatementId) {
        await storage.updateProblemStatement(team.problemStatementId, { teamId: team.id });
        console.log("✅ Problem statement linked to team:", team.problemStatementId);
      }

      // If founder created the team, add them to it
      if (currentUser?.role === "FOUNDER") {
        try {
          await storage.createRoleAssignment({
            teamId: team.id,
            userId: userId,
            role: "Founder",
            stipendBand: "A",
          });
          console.log("✅ Founder added to team as Founder");
        } catch (roleError: any) {
          console.error("❌ Error adding founder to team:", roleError);
          // Don't fail the request, but log the error
        }
      }

      // Create seed fund for team (only if admin)
      if (currentUser?.role === "ADMIN") {
        try {
          await storage.createSeedFund({
            teamId: team.id,
            amount: "1000000",
            sourcesJson: { startupVarsity: 1000000 },
            disbursedAmount: "0",
          });
          console.log("✅ Seed fund created for team");
        } catch (seedError: any) {
          console.error("❌ Error creating seed fund:", seedError);
          // Don't fail the request if seed fund creation fails
        }
      }

      res.status(201).json(team);
    } catch (error: any) {
      console.error("❌ Error creating team:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail,
      });
      res.status(400).json({ message: "Failed to create team" });
    }
  });

  app.patch("/api/teams/:id", requireRole("ADMIN", "MENTOR"), async (req, res) => {
    try {
      const teamId = req.params.id;
      const existingTeam = await storage.getTeam(teamId);
      if (!existingTeam) {
        return res.status(404).json({ message: "Team not found" });
      }
      const updated = await storage.updateTeam(teamId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Team not found" });
      }
      // When admin assigns a problem statement to a team, sync problem_statement.teamId (so all team members see it)
      if (req.body.problemStatementId != null) {
        if (existingTeam.problemStatementId && existingTeam.problemStatementId !== req.body.problemStatementId) {
          await storage.updateProblemStatement(existingTeam.problemStatementId, { teamId: null });
        }
        await storage.updateProblemStatement(req.body.problemStatementId, { teamId });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Update team error:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  // Delete a team (admin only)
  app.delete("/api/teams/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const teamId = req.params.id;
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      await storage.deleteTeam(teamId);
      res.json({ message: "Team deleted successfully" });
    } catch (error: any) {
      console.error("Delete team error:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Generate cap table for team
  app.post("/api/teams/:id/cap-table", requireRole("ADMIN"), async (req, res) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      const members = await storage.getRoleAssignmentsByTeam(team.id);
      const membersWithNames = await Promise.all(
        members.map(async (m) => {
          const user = await storage.getUser(m.userId);
          return { userId: m.userId, role: m.role, name: user?.name || "Unknown" };
        })
      );

      const capTableEntries = generateCapTable(team.id, membersWithNames);

      // Create cap table entries
      const created = await Promise.all(
        capTableEntries.map(entry => storage.createCapTableEntry(entry))
      );

      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: "Failed to generate cap table" });
    }
  });

  // =====================
  // Role Assignment Routes
  // =====================

  app.get("/api/teams/:teamId/members", requireAuth, async (req, res) => {
    try {
      const members = await storage.getRoleAssignmentsByTeam(req.params.teamId);

      // Get user details for each member
      const membersWithDetails = await Promise.all(
        members.map(async (m) => {
          if (!m.userId) {
            console.warn(`Role assignment ${m.id} has no userId`);
            return {
              ...m,
              user: null,
              userRole: null
            };
          }
          const user = await storage.getUser(m.userId);
          if (!user) {
            console.warn(`User ${m.userId} not found for role assignment ${m.id}`);
          }
          return {
            ...m,
            user: user ? {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role
            } : null,
            userRole: user?.role // Include userRole at top level for easier access
          };
        })
      );

      res.json(membersWithDetails);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  app.post("/api/teams/:teamId/members", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const currentUser = await storage.getUser(userId);
      const { userId: targetUserId, role, stipendBand } = req.body;
      const teamId = req.params.teamId;

      // Mentors cannot add members to teams
      if (currentUser?.role === "MENTOR") {
        return res.status(403).json({ message: "Mentors do not have permission to add members to teams" });
      }

      // Check if user is admin OR if user is a founder/cofounder who is part of this team
      const isAdmin = currentUser?.role === "ADMIN";
      let canAddMember = isAdmin;

      if (!isAdmin) {
        // Check if user is a founder/cofounder in this team
        const userAssignments = await storage.getRoleAssignmentsByUser(userId);
        const userTeamAssignment = userAssignments.find(a => a.teamId === teamId);
        if (userTeamAssignment && (currentUser?.role === "FOUNDER" || currentUser?.role === "COFOUNDER")) {
          canAddMember = true;
        }
      }

      if (!canAddMember) {
        return res.status(403).json({ message: "You don't have permission to add members to this team" });
      }

      // Check if user is already a member of this team
      const existingAssignments = await storage.getRoleAssignmentsByTeam(teamId);
      const alreadyMember = existingAssignments.find(a => a.userId === targetUserId);

      if (alreadyMember) {
        return res.status(400).json({ message: "User is already a member of this team" });
      }

      console.log("➕ Adding member to team:", {
        teamId,
        targetUserId,
        role,
        founderId: userId,
      });

      const assignment = await storage.createRoleAssignment({
        teamId,
        userId: targetUserId,
        role,
        stipendBand: stipendBand || (role === "Promoter" ? "A" : role === "CoPromoter" ? "B" : "C"),
      });

      // Auto-close all pending applications for this user now that they're assigned to a team
      await autoCloseApplicationsOnTeamAssignment(targetUserId);

      console.log("✅ Member added to team:", {
        assignmentId: assignment.id,
        teamId: assignment.teamId,
        userId: assignment.userId,
        role: assignment.role,
      });

      // Get team and target user details for notification
      const team = await storage.getTeam(teamId);
      const targetUser = await storage.getUser(targetUserId);
      
      // If founder is adding members and has a published PS, ensure it's linked to the team
      if (currentUser?.role === "FOUNDER" && team && !team.problemStatementId) {
        try {
          const founderPublishedPS = await storage.getProblemStatements({ 
            status: "PUBLISHED", 
            createdBy: userId 
          });
          if (founderPublishedPS.length > 0) {
            const ps = founderPublishedPS[0];
            // Link PS to team (both directions)
            await storage.updateProblemStatement(ps.id, { teamId: team.id });
            await storage.updateTeam(team.id, { problemStatementId: ps.id });
            console.log(`✅ Linked founder's published PS ${ps.id} to team ${team.id} when adding member`);
          }
        } catch (error) {
          console.error("⚠️ Error linking PS to team (non-critical):", error);
          // Don't fail the add member operation if linking fails
        }
      }
      
      // Create notification for the added member (co-founder, mentor, or learner)
      if (targetUser && team) {
        try {
          const roleLabel = role === "Promoter" ? "Mentor" :
                           role === "CoPromoter" ? "Co-Founder" :
                           role === "Member" ? "Team Member" : role;
          
          await storage.createNotification({
            userId: targetUserId,
            type: "TEAM_MEMBER_APPLICATION_ACCEPTED" as any,
            title: `Added to Team: ${team.name}`,
            message: `${currentUser?.name || "A founder"} has added you as a ${roleLabel} to the team "${team.name}". You can now access the team dashboard.`,
            status: "UNREAD" as any,
            metadataJson: {
              teamId: teamId,
              teamName: team.name,
              addedBy: currentUser?.id,
              addedByName: currentUser?.name,
              role: role,
              roleLabel: roleLabel,
            },
          });
          console.log(`✅ Notification created for team member: ${targetUser.name} (${targetUser.email})`);
        } catch (notifError: any) {
          console.error("Error creating notification for team member addition:", notifError);
          // Don't fail the request if notification creation fails
        }
      }

      res.status(201).json(assignment);
    } catch (error: any) {
      console.error("Error adding team member:", error);
      res.status(400).json({ message: "Failed to add team member" });
    }
  });

  app.patch("/api/role-assignments/:id", requireRole("ADMIN"), async (req, res) => {
    const updated = await storage.updateRoleAssignment(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Role assignment not found" });
    }
    res.json(updated);
  });

  app.delete("/api/teams/:teamId/members/:userId", requireRole("ADMIN"), async (req, res) => {
    try {
      const { teamId, userId } = req.params;

      const members = await storage.getRoleAssignmentsByTeam(teamId);
      const assignment = members.find(m => m.userId === userId);

      if (!assignment) {
        return res.status(404).json({ message: "Team member not found" });
      }

      await storage.deleteRoleAssignment(assignment.id);
      res.json({ message: "Team member removed successfully" });
    } catch (error) {
      console.error("Remove team member error:", error);
      res.status(400).json({ message: "Failed to remove team member" });
    }
  });

  // Get unassigned learners for team assignment
  app.get("/api/admin/unassigned-learners", requireRole("ADMIN"), async (req, res) => {
    try {
      const users = await storage.getUsers();
      const learners = users.filter(u => u.role === "LEARNER");

      // Get all role assignments to find which learners are already assigned
      const allTeams = await storage.getTeams();
      const assignedUserIds = new Set<string>();

      for (const team of allTeams) {
        const members = await storage.getRoleAssignmentsByTeam(team.id);
        members.forEach(m => assignedUserIds.add(m.userId));
      }

      const unassigned = learners.filter(l => !assignedUserIds.has(l.id));
      res.json(unassigned.map(u => ({ ...u, password: undefined })));
    } catch (error) {
      console.error("Get unassigned learners error:", error);
      res.status(500).json({ message: "Failed to get unassigned learners" });
    }
  });

  app.get("/api/admin/unassigned-users", requireRole("ADMIN"), async (req, res) => {
    try {
      const { teamRole } = req.query;
      
      // Map team role to user role
      const roleMapping: { [key: string]: string } = {
        "Promoter": "FOUNDER",
        "CoPromoter": "COFOUNDER",
        "Member": "LEARNER",
        "Mentor": "MENTOR"
      };

      const userRole = roleMapping[teamRole as string];
      if (!userRole) {
        return res.status(400).json({ message: "Invalid team role" });
      }

      const users = await storage.getUsers();
      const filteredUsers = users.filter(u => u.role === userRole);

      // Get all role assignments
      const allTeams = await storage.getTeams();
      const userTeamCount = new Map<string, number>();

      for (const team of allTeams) {
        const members = await storage.getRoleAssignmentsByTeam(team.id);
        members.forEach(m => {
          userTeamCount.set(m.userId, (userTeamCount.get(m.userId) || 0) + 1);
        });
      }

      // Filter based on role
      const availableUsers = filteredUsers.filter(user => {
        const teamCount = userTeamCount.get(user.id) || 0;
        
        // Mentors can be in up to 2 teams
        if (userRole === "MENTOR") {
          return teamCount < 2;
        }
        
        // Other roles can only be in 1 team
        return teamCount === 0;
      });

      res.json(availableUsers.map(u => ({ ...u, password: undefined })));
    } catch (error) {
      console.error("Get unassigned users error:", error);
      res.status(500).json({ message: "Failed to get unassigned users" });
    }
  });

  // =====================
  // Sprint Routes
  // =====================

  app.get("/api/teams/:teamId/sprints", requireAuth, async (req, res) => {
    try {
      // Was requireAuth alone, so any signed-in user could list any team's sprints — the same
      // hole that GET /api/sprints/:id already closed. Tightened here because learners now read
      // this endpoint to page through their own team's phases, which makes it load-bearing.
      const allowed = await isTeamMemberOrAdmin(req.session!.userId!, req.params.teamId);
      if (!allowed) {
        return res.status(403).json({ message: "You are not a member of this team" });
      }

      const sprints = await storage.getSprintsByTeam(req.params.teamId);
      res.json(sprints);
    } catch (error: any) {
      console.error("Get sprints error:", error);
      res.status(500).json({ message: "Failed to fetch sprints" });
    }
  });

  app.get("/api/sprints/:id", requireAuth, async (req, res) => {
    try {
      const sprint = await storage.getSprint(req.params.id);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      // This endpoint used to be requireAuth only, so any signed-in user could
      // read any team's sprint (goals, objectives, mentor reviews) by id.
      const allowed = await isTeamMemberOrAdmin(req.session!.userId!, sprint.teamId);
      if (!allowed) {
        return res.status(403).json({ message: "You are not a member of this team" });
      }

      let tasks: any[] = [];
      let reviews: any[] = [];
      let standups: any[] = [];
      let evidenceList: any[] = [];
      let resourcesList: any[] = [];
      try {
        tasks = await storage.getTasksBySprint(sprint.id);
      } catch (tasksErr: any) {
        console.error("Get sprint tasks error:", tasksErr?.message || tasksErr);
      }
      try {
        reviews = await storage.getReviewsBySprint(sprint.id);
      } catch (reviewsErr: any) {
        console.error("Get sprint reviews error (optional):", reviewsErr?.message || reviewsErr);
      }
      // Standups, evidence and resources are optional: a sprint with none of
      // them is normal, and a failure here should not take the whole sprint
      // view down.
      try {
        standups = await storage.getDailyStandupsBySprint(sprint.id);
      } catch (standupErr: any) {
        console.error("Get sprint standups error (optional):", standupErr?.message || standupErr);
      }
      try {
        evidenceList = await storage.getEvidenceBySprint(sprint.id);
      } catch (evidenceErr: any) {
        console.error("Get sprint evidence error (optional):", evidenceErr?.message || evidenceErr);
      }
      try {
        resourcesList = await storage.getSprintResources(sprint.id);
      } catch (resourcesErr: any) {
        console.error("Get sprint resources error (optional):", resourcesErr?.message || resourcesErr);
      }

      // Names for the people attached to reviews, standups and evidence, so the
      // client doesn't have to fan out a request per row.
      const nameCache = new Map<string, string | null>();
      const nameFor = async (id: string | null | undefined): Promise<string | null> => {
        if (!id) return null;
        if (!nameCache.has(id)) {
          const u = await storage.getUser(id);
          nameCache.set(id, u?.name ?? null);
        }
        return nameCache.get(id) ?? null;
      };

      const sprintJson = {
        ...sprint,
        startDate: sprint.startDate instanceof Date ? sprint.startDate.toISOString() : sprint.startDate,
        endDate: sprint.endDate instanceof Date ? sprint.endDate.toISOString() : sprint.endDate,
        passedAt: sprint.passedAt != null && sprint.passedAt instanceof Date ? sprint.passedAt.toISOString() : sprint.passedAt,
        createdAt: sprint.createdAt instanceof Date ? sprint.createdAt.toISOString() : sprint.createdAt,
        tasks: await Promise.all(
          tasks.map(async (t: any) => ({
            ...t,
            submissionProgress: await taskSubmissionProgress(t),
            startDate: t.startDate != null && t.startDate instanceof Date ? t.startDate.toISOString() : t.startDate,
            endDate: t.endDate != null && t.endDate instanceof Date ? t.endDate.toISOString() : t.endDate,
            createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
          }))
        ),
        reviews: await Promise.all(
          reviews.map(async (r: any) => ({
            ...r,
            mentorName: await nameFor(r.mentorId),
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          }))
        ),
        standups: await Promise.all(
          standups.map(async (s: any) => ({
            ...s,
            authorName: await nameFor(s.authorId),
            createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
          }))
        ),
        evidence: await Promise.all(
          evidenceList.map(async (e: any) => ({
            ...e,
            submitterName: await nameFor(e.submittedBy),
            createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
          }))
        ),
        resources: await Promise.all(
          resourcesList.map(async (r: any) => ({
            ...r,
            uploaderName: await nameFor(r.uploadedById),
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          }))
        ),
      };
      res.json(sprintJson);
    } catch (error: any) {
      console.error("Get sprint error:", error?.message || error, error?.stack);
      res.status(500).json({ message: "Failed to fetch sprint" });
    }
  });

  app.post("/api/teams/:teamId/sprints", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { name, startDate, endDate, goals, objectives, deliverables } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }

      // Check if user has permission to create sprint
      // Founders and co-founders can create sprints for their team
      const team = await storage.getTeam(req.params.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      const user = await storage.getUser(userId);
      const assignments = await storage.getRoleAssignmentsByTeam(req.params.teamId);
      const userAssignment = assignments.find(a => a.userId === userId);

      const isAdmin = user?.role === "ADMIN";
      const isFounder = user?.role === "FOUNDER" && userAssignment;
      const isMentor = user?.role === "MENTOR" && userAssignment;

      if (!isAdmin && !isFounder && !isMentor) {
        return res.status(403).json({ message: "You don't have permission to create sprints for this team" });
      }

      const existingSprints = await storage.getSprintsByTeam(req.params.teamId);

      const sprint = await storage.createSprint({
        teamId: req.params.teamId,
        index: existingSprints.length + 1,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        goals: goals || null,
        objectives: objectives || null,
        deliverables: deliverables || null,
      });

      // Create notification for all team members when sprint is created
      try {
        const teamAssignments = await storage.getRoleAssignmentsByTeam(req.params.teamId);
        const creator = await storage.getUser(userId);
        
        // Notify all team members (learners, co-founders)
        for (const assignment of teamAssignments) {
          await storage.createNotification({
            userId: assignment.userId,
            type: "SPRINT_CREATED" as any,
            title: `New Sprint ${sprint.index} Created`,
            message: `${creator?.name || "A team member"} has created Sprint ${sprint.index} for your team.`,
            status: "UNREAD" as any,
            metadataJson: {
              sprintId: sprint.id,
              teamId: req.params.teamId,
              sprintIndex: sprint.index,
            },
          });
        }
      } catch (notifError: any) {
        console.error("Error creating notification for sprint:", notifError);
        // Don't fail the request if notification creation fails
      }
      
      res.status(201).json(sprint);
    } catch (error: any) {
      console.error("Create sprint error:", error);
      res.status(400).json({ message: "Failed to create sprint" });
    }
  });

  // ---------------------------------------------------------------------------
  // Sprint Resources — reference material (docs, decks, datasets, any file
  // type) a team attaches to a sprint. Shown in the sprint's Resources tab and
  // in View Details. Files themselves go through the same generic
  // /api/objects/upload + /api/objects/view-url pair the Demo and Evidence
  // tabs already use; these routes only record/list/remove the association
  // between an uploaded file and a sprint.
  // ---------------------------------------------------------------------------
  const SPRINT_RESOURCE_MAX_FILES = 30;

  // Same bar as sprint creation: admins, plus founders/mentors assigned to
  // this team. Kept separate from isTeamMemberOrAdmin (used for viewing)
  // because resources are reference material a lead publishes, not something
  // every learner should be able to add or remove.
  async function canManageSprintResources(userId: string, teamId: string): Promise<boolean> {
    const user = await storage.getUser(userId);
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    if (user.role !== "FOUNDER" && user.role !== "MENTOR") return false;
    const assignments = await storage.getRoleAssignmentsByTeam(teamId);
    return assignments.some((a) => a.userId === userId);
  }

  app.get("/api/sprints/:sprintId/resources", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.sprintId);
      if (!sprint) return res.status(404).json({ message: "Sprint not found" });

      const allowed = await isTeamMemberOrAdmin(userId, sprint.teamId);
      if (!allowed) {
        return res.status(403).json({ message: "You are not a member of this team" });
      }

      const resources = await storage.getSprintResources(sprint.id);
      const enriched = await Promise.all(
        resources.map(async (r) => {
          const uploader = await storage.getUser(r.uploadedById);
          return {
            ...r,
            uploaderName: uploader?.name || null,
            createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          };
        })
      );
      res.json(enriched);
    } catch (error: any) {
      console.error("Get sprint resources error:", error);
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  app.post("/api/sprints/:sprintId/resources", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.sprintId);
      if (!sprint) return res.status(404).json({ message: "Sprint not found" });

      const allowed = await canManageSprintResources(userId, sprint.teamId);
      if (!allowed) {
        return res
          .status(403)
          .json({ message: "You don't have permission to add resources to this sprint" });
      }

      const { fileName, objectKey, contentType, fileSize, url } = req.body || {};
      const type = req.body?.type === "link" ? "link" : "file";

      if (!fileName) {
        return res.status(400).json({ message: "fileName is required" });
      }

      if (type === "link") {
        if (!url || typeof url !== "string") {
          return res.status(400).json({ message: "url is required for a link resource" });
        }
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("Unsupported protocol");
          }
        } catch {
          return res.status(400).json({ message: "Enter a valid http(s) URL" });
        }
      } else if (!objectKey) {
        return res.status(400).json({ message: "fileName and objectKey are required" });
      }

      // A key already attached elsewhere can't be re-claimed by a second
      // resource row (mirrors the same check ticket attachments use).
      if (type === "file") {
        const existing = await storage.getSprintResourceByObjectKey(objectKey);
        if (existing) {
          return res.status(400).json({ message: "This file has already been attached" });
        }
      }

      const currentResources = await storage.getSprintResources(sprint.id);
      if (currentResources.length >= SPRINT_RESOURCE_MAX_FILES) {
        return res
          .status(400)
          .json({ message: `At most ${SPRINT_RESOURCE_MAX_FILES} resources per sprint` });
      }

      const resource = await storage.createSprintResource({
        sprintId: sprint.id,
        type,
        fileName,
        objectKey: type === "file" ? objectKey : null,
        url: type === "link" ? url : null,
        contentType: contentType ?? null,
        fileSize: typeof fileSize === "number" ? fileSize : null,
        uploadedById: userId,
      });

      res.status(201).json(resource);
    } catch (error: any) {
      console.error("Add sprint resource error:", error);
      res.status(400).json({ message: "Failed to add resource" });
    }
  });

  app.delete("/api/sprints/:sprintId/resources/:resourceId", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.sprintId);
      if (!sprint) return res.status(404).json({ message: "Sprint not found" });

      const resources = await storage.getSprintResources(sprint.id);
      const resource = resources.find((r) => r.id === req.params.resourceId);
      if (!resource) return res.status(404).json({ message: "Resource not found" });

      const isUploader = resource.uploadedById === userId;
      const canManage = await canManageSprintResources(userId, sprint.teamId);
      if (!isUploader && !canManage) {
        return res.status(403).json({ message: "You don't have permission to remove this resource" });
      }

      await storage.deleteSprintResource(resource.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete sprint resource error:", error);
      res.status(500).json({ message: "Failed to remove resource" });
    }
  });

  /**
   * Whether the caller may edit this sprint. The board has always asked for this on every
   * sprint view, but the route did not exist — so it 404'd, was retried twice by the
   * default query policy, and the client fell back to hardcoding `true` for admins,
   * founders and mentors. A learner or co-founder therefore had `canEdit` left as null by
   * a failing request rather than by an actual decision.
   *
   * The logic already existed for enforcement; this only exposes it so the UI can agree
   * with what the mutations will allow. Read-only, and mutations still check for themselves.
   */
  app.get("/api/sprints/:id/can-edit", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.id);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }
      const currentUser = await storage.getUser(userId);
      const isAdmin = currentUser?.role === "ADMIN";
      const canEdit = isAdmin || (await storage.hasSprintEditPermission(sprint.id, userId));
      res.json({ canEdit });
    } catch (error) {
      console.error("Sprint can-edit error:", error);
      res.status(500).json({ message: "Failed to check sprint edit permission" });
    }
  });

  app.patch("/api/sprints/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.id);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      // Check edit permission (admins always allowed)
      const currentUser = await storage.getUser(userId);
      const isAdmin = currentUser?.role === "ADMIN";
      const hasPermission = isAdmin || await storage.hasSprintEditPermission(sprint.id, userId);
      if (!hasPermission) {
        return res.status(403).json({ message: "You don't have permission to edit this sprint" });
      }

      const { name, startDate, endDate, goals, objectives, deliverables, index, ...rest } = req.body;
      const updateData: any = { ...rest };
      if (index !== undefined) updateData.index = parseInt(index);
      if (name !== undefined) {
        updateData.name = typeof name === "string" && name.trim() ? name.trim() : null;
      }
      if (goals !== undefined) updateData.goals = goals || null;
      if (objectives !== undefined) updateData.objectives = objectives || null;
      if (deliverables !== undefined) updateData.deliverables = deliverables || null;
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate) updateData.endDate = new Date(endDate);

      const updated = await storage.updateSprint(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Update sprint error:", error);
      res.status(400).json({ message: "Failed to update sprint" });
    }
  });

  app.delete("/api/sprints/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.id);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      const currentUser = await storage.getUser(userId);
      const isAdmin = currentUser?.role === "ADMIN";
      const hasPermission = isAdmin || await storage.hasSprintEditPermission(sprint.id, userId);
      if (!hasPermission) {
        return res.status(403).json({ message: "You don't have permission to delete this sprint" });
      }

      await storage.deleteSprint(req.params.id);
      res.json({ message: "Sprint deleted successfully" });
    } catch (error: any) {
      console.error("Delete sprint error:", error);
      res.status(500).json({ message: "Failed to delete sprint" });
    }
  });

  // =====================
  // Programme Plan Import (issue #258)
  // =====================

  /**
   * Turns the uploaded CSV into a validated plan, or an HTTP error describing why it cannot be.
   *
   * The raw file text is what crosses the wire, not the browser's parse of it, so the server
   * validates exactly what the admin uploaded rather than trusting a client that could send
   * anything. Both the dry-run and the apply go through here, so they cannot disagree.
   */
  function planFromRequestBody(body: any):
    | { ok: true; plan: ProgrammePlan }
    | { ok: false; status: number; payload: any } {
    const csv = body?.csv;
    if (typeof csv !== "string" || csv.trim() === "") {
      return {
        ok: false,
        status: 400,
        payload: { message: "No programme plan file contents were sent" },
      };
    }
    // Same ceiling the browser enforces, repeated here because the browser is not the only
    // possible caller.
    if (csv.length > 4_000_000) {
      return { ok: false, status: 413, payload: { message: "That file is too large to be a programme plan" } };
    }

    const parsed = parsePlanSheet(parseCsv(csv));
    if (!parsed.ok) {
      return {
        ok: false,
        status: 400,
        payload: { message: "The programme plan has problems that need fixing", errors: parsed.errors },
      };
    }
    return { ok: true, plan: parsed.plan };
  }

  /** Resolves the cohort start date every sprint window is derived from. */
  async function cohortStartForTeam(
    teamId: string
  ): Promise<
    | { ok: true; team: NonNullable<Awaited<ReturnType<typeof storage.getTeam>>>; cohort: NonNullable<Awaited<ReturnType<typeof storage.getCohort>>> }
    | { ok: false; status: number; message: string }
  > {
    const team = await storage.getTeam(teamId);
    if (!team) return { ok: false, status: 404, message: "Team not found" };
    const cohort = await storage.getCohort(team.cohortId);
    if (!cohort) {
      return { ok: false, status: 404, message: "That team's cohort no longer exists" };
    }
    return { ok: true, team, cohort };
  }

  /**
   * One notification per team member, summarising the whole import.
   *
   * Deliberately NOT the per-sprint and per-task notifications the manual endpoints emit. Those
   * fire once per member per row, so a cohort-wide import — ten teams, eight sprints, thirty tasks
   * each, a dozen members — would insert several thousand rows one sequential await at a time, and
   * bury every recipient. Reuses SPRINT_CREATED rather than adding a value to the notification_type
   * enum, since ALTER TYPE cannot run inside a transaction and the meaning is close enough.
   */
  async function notifyPlanApplied(
    teamId: string,
    actorId: string,
    diff: TeamPlanDiff
  ): Promise<void> {
    if (isNoOp(diff)) return; // nothing changed, so nothing worth telling anyone about

    try {
      const [assignments, actor] = await Promise.all([
        storage.getRoleAssignmentsByTeam(teamId),
        storage.getUser(actorId),
      ]);

      const parts: string[] = [];
      const created = diff.summary.sprintsCreated;
      const updated = diff.summary.sprintsUpdated;
      if (created > 0) parts.push(`${created} new sprint${created === 1 ? "" : "s"}`);
      if (updated > 0) parts.push(`${updated} updated`);
      const taskCount = diff.summary.tasksCreated;
      if (taskCount > 0) parts.push(`${taskCount} task${taskCount === 1 ? "" : "s"}`);

      const message = `${actor?.name || "An admin"} applied the programme plan to your team: ${parts.join(", ")}.`;

      await Promise.all(
        assignments.map((assignment) =>
          storage.createNotification({
            userId: assignment.userId,
            type: "SPRINT_CREATED" as any,
            title: "Programme plan applied",
            message,
            status: "UNREAD" as any,
            metadataJson: { teamId, summary: diff.summary },
          })
        )
      );
    } catch (notifError: any) {
      // The plan is already committed; failing the request now would tell the admin it did not
      // work when it did.
      console.error("Programme plan applied, but notifying the team failed:", notifError);
    }
  }

  /** Dates are Date objects in the diff; the client only needs the calendar day. */
  function serializeDiff(diff: TeamPlanDiff) {
    return {
      ...diff,
      sprints: diff.sprints.map((s) => ({
        ...s,
        startDate: s.startDate.toISOString(),
        endDate: s.endDate.toISOString(),
      })),
    };
  }

  // Preview for a single team. Reads only.
  app.post(
    "/api/teams/:teamId/programme-plan/dry-run",
    requireRole("ADMIN"),
    async (req, res) => {
      try {
        const parsed = planFromRequestBody(req.body);
        if (!parsed.ok) return res.status(parsed.status).json(parsed.payload);

        const resolved = await cohortStartForTeam(req.params.teamId);
        if (!resolved.ok) return res.status(resolved.status).json({ message: resolved.message });

        const diff = await storage.diffProgrammePlan(
          req.params.teamId,
          parsed.plan,
          resolved.cohort.startDate
        );
        res.json({
          team: { id: resolved.team.id, name: resolved.team.name },
          cohort: {
            id: resolved.cohort.id,
            name: resolved.cohort.name,
            startDate: resolved.cohort.startDate,
            endDate: resolved.cohort.endDate,
          },
          diff: serializeDiff(diff),
        });
      } catch (error: any) {
        console.error("Programme plan dry-run error:", error);
        res.status(500).json({ message: "Could not work out what this plan would change" });
      }
    }
  );

  // Commits to a single team, in one transaction.
  app.post("/api/teams/:teamId/programme-plan/apply", requireRole("ADMIN"), async (req, res) => {
    try {
      const parsed = planFromRequestBody(req.body);
      if (!parsed.ok) return res.status(parsed.status).json(parsed.payload);

      const resolved = await cohortStartForTeam(req.params.teamId);
      if (!resolved.ok) return res.status(resolved.status).json({ message: resolved.message });

      const diff = await storage.applyProgrammePlan(
        req.params.teamId,
        parsed.plan,
        resolved.cohort.startDate
      );
      await notifyPlanApplied(req.params.teamId, req.session!.userId!, diff);

      res.json({
        team: { id: resolved.team.id, name: resolved.team.name },
        diff: serializeDiff(diff),
      });
    } catch (error: any) {
      console.error("Programme plan apply error:", error);
      res.status(500).json({ message: "Could not apply the programme plan" });
    }
  });

  /**
   * Cohort-wide preview and apply. One plan, every team in the cohort — which is the point, since
   * teams in a cohort follow the same programme.
   *
   * Each team is applied in its own transaction rather than one spanning the cohort: a single
   * failing team should not roll back the nine that succeeded, and the response says exactly which
   * ones failed so the admin can re-run just those. Re-running is safe by design.
   */
  for (const mode of ["dry-run", "apply"] as const) {
    app.post(`/api/cohorts/:cohortId/programme-plan/${mode}`, requireRole("ADMIN"), async (req, res) => {
      try {
        const parsed = planFromRequestBody(req.body);
        if (!parsed.ok) return res.status(parsed.status).json(parsed.payload);

        const cohort = await storage.getCohort(req.params.cohortId);
        if (!cohort) return res.status(404).json({ message: "Cohort not found" });

        const teams = await storage.getTeamsByCohort(req.params.cohortId);
        if (teams.length === 0) {
          return res.status(400).json({ message: "That cohort has no teams to apply a plan to" });
        }

        const results: any[] = [];
        for (const team of teams) {
          try {
            const diff =
              mode === "apply"
                ? await storage.applyProgrammePlan(team.id, parsed.plan, cohort.startDate)
                : await storage.diffProgrammePlan(team.id, parsed.plan, cohort.startDate);

            if (mode === "apply") {
              await notifyPlanApplied(team.id, req.session!.userId!, diff);
            }
            results.push({ team: { id: team.id, name: team.name }, diff: serializeDiff(diff) });
          } catch (teamError: any) {
            console.error(`Programme plan ${mode} failed for team ${team.id}:`, teamError);
            results.push({
              team: { id: team.id, name: team.name },
              error: teamError?.message || "Failed",
            });
          }
        }

        res.json({
          cohort: {
            id: cohort.id,
            name: cohort.name,
            startDate: cohort.startDate,
            endDate: cohort.endDate,
          },
          applied: mode === "apply",
          teams: results,
          failedTeams: results.filter((r) => r.error).length,
        });
      } catch (error: any) {
        console.error(`Cohort programme plan ${mode} error:`, error);
        res.status(500).json({ message: `Could not ${mode === "apply" ? "apply" : "preview"} the programme plan` });
      }
    });
  }

  // =====================
  // Task Routes
  // =====================

  app.get("/api/sprints/:sprintId/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getTasksBySprint(req.params.sprintId);
      res.json(await withSubmissionProgress(tasks));
    } catch (error) {
      console.error("Get sprint tasks error:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/api/my-tasks", requireAuth, async (req, res) => {
    try {
      // Returns full task objects on purpose — callers need assigneeIds,
      // objectives and deliverables, not just a summary.
      const tasks = await storage.getTasksByAssignee(req.session!.userId!);
      res.json(await withSubmissionProgress(tasks));
    } catch (error) {
      console.error("Get my-tasks error:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/sprints/:sprintId/tasks", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.sprintId);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      // Check edit permission
      const hasPermission = await storage.hasSprintEditPermission(sprint.id, userId);
      if (!hasPermission) {
        return res.status(403).json({ message: "You don't have permission to create tasks for this sprint" });
      }

      const {
        title,
        description,
        objectives,
        deliverables,
        startDate,
        endDate,
        dependencies,
        priority,
        assigneeId: assigneeIdBody,
        assigneeIds: assigneeIdsBody,
        status,
        points
      } = req.body;

      const titleError = taskTitleError(title);
      if (titleError) {
        return res.status(400).json({ message: titleError });
      }

      const assigneeIdsArray = Array.isArray(assigneeIdsBody) && assigneeIdsBody.length > 0
        ? assigneeIdsBody.filter((id: unknown) => typeof id === "string")
        : null;
      const singleAssigneeId = assigneeIdBody || (assigneeIdsArray && assigneeIdsArray.length > 0 ? assigneeIdsArray[0] : null);

      const task = await storage.createTask({
        sprintId: req.params.sprintId,
        teamId: sprint.teamId, // Add teamId from sprint
        title: title.trim(),
        description: description || null,
        objectives: objectives || null,
        deliverables: deliverables || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        dependencies: dependencies ? JSON.stringify(dependencies) : null,
        priority: priority || "MEDIUM",
        assigneeId: singleAssigneeId || null,
        assigneeIds: assigneeIdsArray ?? null,
        assignedBy: userId, // Track who assigned the task
        status: status || "TODO",
        points: points || 1,
      });

      // Create notification for task assignee(s) or all team members
      try {
        const team = await storage.getTeam(sprint.teamId);
        if (team) {
          const teamAssignments = await storage.getRoleAssignmentsByTeam(team.id);
          const creator = await storage.getUser(userId);
          const notifyUserIds = assigneeIdsArray && assigneeIdsArray.length > 0 ? assigneeIdsArray : (singleAssigneeId ? [singleAssigneeId] : []);

          if (notifyUserIds.length > 0) {
            for (const uid of notifyUserIds) {
              await storage.createNotification({
                userId: uid,
                type: "TASK_CREATED" as any,
                title: `New Task: ${title}`,
                message: `${creator?.name || "Someone"} has assigned you a new task: "${title}"`,
                status: "UNREAD" as any,
                metadataJson: {
                  taskId: task.id,
                  sprintId: sprint.id,
                  teamId: team.id,
                  assigneeId: uid,
                },
              });
            }
          } else {
            // If not assigned, notify all team members (learners)
            for (const assignment of teamAssignments) {
              const user = await storage.getUser(assignment.userId);
              // Notify learners and co-founders
              if (user && (user.role === "LEARNER" || user.role === "COFOUNDER")) {
                await storage.createNotification({
                  userId: assignment.userId,
                  type: "TASK_CREATED" as any,
                  title: `New Task: ${title}`,
                  message: `${creator?.name || "Someone"} has created a new task: "${title}"`,
                  status: "UNREAD" as any,
                  metadataJson: {
                    taskId: task.id,
                    sprintId: sprint.id,
                    teamId: team.id,
                  },
                });
              }
            }
          }
        }
      } catch (notifError: any) {
        console.error("Error creating notification for task:", notifError);
        // Don't fail the request if notification creation fails
      }

      res.status(201).json(task);
    } catch (error: any) {
      console.error("Create task error:", error);
      res.status(400).json({ message: "Failed to create task" });
    }
  });

  // Create standalone task (without sprint) - for team-level tasks
  app.post("/api/teams/:teamId/tasks", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const team = await storage.getTeam(req.params.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Check if user is founder, mentor, or admin
      const user = await storage.getUser(userId);
      console.log("DEBUG - Full user object:", JSON.stringify(user, null, 2));
      console.log("DEBUG - User role specifically:", user?.role);
      console.log("DEBUG - Role comparison:", {
        'user?.role === "ADMIN"': user?.role === "ADMIN",
        'user?.role === "FOUNDER"': user?.role === "FOUNDER", 
        'user?.role === "MENTOR"': user?.role === "MENTOR",
        'user?.role === "COFOUNDER"': user?.role === "COFOUNDER"
      });

      const isAdmin = user?.role === "ADMIN";
      const isFounder = user?.role === "FOUNDER";
      const isMentor = user?.role === "MENTOR";

      console.log("DEBUG - Permission check:", { isAdmin, isFounder, isMentor, userRole: user?.role });

      // Only founders, mentors, and admins can create standalone tasks
      if (!isAdmin && !isFounder && !isMentor) {
        console.log("DEBUG - Access denied. User role:", user?.role, "Required: ADMIN, FOUNDER, or MENTOR");
        return res.status(403).json({ message: "Only founders, mentors, and admins can create tasks" });
      }

      const {
        title,
        description,
        objectives,
        deliverables,
        startDate,
        endDate,
        dependencies,
        priority,
        assigneeId,
        status,
        points
      } = req.body;

      const titleError = taskTitleError(title);
      if (titleError) {
        return res.status(400).json({ message: titleError });
      }

      const task = await storage.createTask({
        sprintId: null, // Standalone task - no sprint
        teamId: req.params.teamId,
        title: title.trim(),
        description: description || null,
        objectives: objectives || null,
        deliverables: deliverables || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        dependencies: dependencies ? JSON.stringify(dependencies) : null,
        priority: priority || "MEDIUM",
        assigneeId: assigneeId || null,
        assignedBy: userId, // Track who assigned the task
        status: status || "TODO",
        points: points || 1,
      });

      // Create notification for task assignee or all team members
      try {
        const team = await storage.getTeam(req.params.teamId);
        if (team) {
          const teamAssignments = await storage.getRoleAssignmentsByTeam(team.id);
          const creator = await storage.getUser(userId);
          
          // If task is assigned, notify only the assignee
          if (assigneeId) {
            await storage.createNotification({
              userId: assigneeId,
              type: "TASK_CREATED" as any,
              title: `New Task: ${title}`,
              message: `${creator?.name || "Someone"} has assigned you a new task: "${title}"`,
              status: "UNREAD" as any,
              metadataJson: {
                taskId: task.id,
                teamId: team.id,
                assigneeId: assigneeId,
              },
            });
          } else {
            // If not assigned, notify all team members (learners)
            for (const assignment of teamAssignments) {
              const user = await storage.getUser(assignment.userId);
              // Notify learners and co-founders
              if (user && (user.role === "LEARNER" || user.role === "COFOUNDER")) {
                await storage.createNotification({
                  userId: assignment.userId,
                  type: "TASK_CREATED" as any,
                  title: `New Task: ${title}`,
                  message: `${creator?.name || "Someone"} has created a new task: "${title}"`,
                  status: "UNREAD" as any,
                  metadataJson: {
                    taskId: task.id,
                    teamId: team.id,
                  },
                });
              }
            }
          }
        }
      } catch (notifError: any) {
        console.error("Error creating notification for standalone task:", notifError);
        // Don't fail the request if notification creation fails
      }

      res.status(201).json(task);
    } catch (error: any) {
      console.error("Create standalone task error:", error);
      res.status(400).json({ message: "Failed to create task" });
    }
  });

  // Get tasks for a team (for learners to view)
  app.get("/api/teams/:teamId/tasks", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const team = await storage.getTeam(req.params.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Check if user is member of the team or admin
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "ADMIN";
      const assignments = await storage.getRoleAssignmentsByTeam(team.id);
      const isMember = assignments.some(a => a.userId === userId);

      if (!isAdmin && !isMember) {
        return res.status(403).json({ message: "You don't have access to this team's tasks" });
      }

      // Enriched so the analytics breakdown can tell submitted from merely assigned.
      const teamTasks = await storage.getTasksByTeam(req.params.teamId);
      res.json(await withSubmissionProgress(teamTasks));
    } catch (error: any) {
      console.error("Get team tasks error:", error);
      res.status(400).json({ message: "Failed to get team tasks" });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check permission - either sprint-based or team-based
      let hasPermission = false;

      // Get current user to check their role
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isAdmin = user.role === "ADMIN";
      const isLearner = user.role === "LEARNER";

      // Debug logging
      console.log("Task update permission check:", {
        userId,
        taskId: task.id,
        taskAssigneeId: task.assigneeId,
        userRole: user.role,
        isLearner,
        taskSprintId: task.sprintId,
        taskTeamId: task.teamId,
        isAssignee: task.assigneeId === userId,
        assigneeIdType: typeof task.assigneeId,
        userIdType: typeof userId
      });

      // Check if user is assignee or reviewer
      const multiAssigneeIds = normalizeTaskAssigneeIds(task.assigneeIds);
      const isAssignee = Boolean(
        (task.assigneeId && String(task.assigneeId) === String(userId)) ||
        multiAssigneeIds.some((id) => String(id) === String(userId))
      );
      const isReviewer = task.reviewerId && (task.reviewerId === userId || String(task.reviewerId) === String(userId));

      // Determine if user has permission
      if (isAssignee) {
        hasPermission = true;
        console.log("✅ Permission granted: User is the assignee");
      } else if (isReviewer) {
        hasPermission = true;
        console.log("✅ Permission granted: User is the reviewer");
      }
      // Learners can ONLY update tasks assigned to them or tasks they're reviewing
      else if (isLearner) {
        console.log("❌ Permission denied: Learner trying to update task not assigned to them");
        return res.status(403).json({
          message: "You can only update tasks assigned to you or tasks you're reviewing. This task is not assigned to you."
        });
      }
      // Admins, Founders, and Co-founders can update any task
      else if (task.sprintId) {
        // Task belongs to a sprint - check sprint permission
        const sprint = await storage.getSprint(task.sprintId);
        if (!sprint) {
          return res.status(404).json({ message: "Sprint not found" });
        }
        hasPermission = await storage.hasSprintEditPermission(sprint.id, userId);
      } else if (task.teamId) {
        // Standalone task - check if user is founder, co-founder, or admin
        const assignments = await storage.getRoleAssignmentsByTeam(task.teamId);
        const isFounder = assignments.some(
          a => a.userId === userId && a.role === "Promoter"
        );
        const isCoFounder = assignments.some(
          a => a.userId === userId && a.role === "CoPromoter"
        );
        hasPermission = isAdmin || isFounder || isCoFounder;
      }

      if (!hasPermission) {
        return res.status(403).json({ message: "You don't have permission to edit this task" });
      }

      // Handle dependencies if provided
      const updateData: any = { ...req.body };
      const newStatus = updateData.status;
      const reviewComment = updateData.reviewComment;

      // The Edit Task dialog sends `title` through this route, so a rename has to clear the same
      // bar as a create — otherwise "-" is rejected on create and then walked straight back in.
      // Only checked when the field is present: most callers PATCH just a status.
      if (updateData.title !== undefined) {
        const titleError = taskTitleError(updateData.title);
        if (titleError) {
          return res.status(400).json({ message: titleError });
        }
        updateData.title = String(updateData.title).trim();
      }

      // Assignees must be team members who actually do the work. Mentors and
      // admins do the assigning, so they are rejected here as well as being
      // absent from the picker — otherwise a hand-crafted request could still
      // land a task on a mentor.
      if (updateData.assigneeIds !== undefined || updateData.assigneeId !== undefined) {
        const requested = new Set<string>([
          ...normalizeTaskAssigneeIds(updateData.assigneeIds),
          ...(typeof updateData.assigneeId === "string" && updateData.assigneeId
            ? [updateData.assigneeId]
            : []),
        ]);

        if (requested.size > 0) {
          const taskTeamId =
            task.teamId ??
            (task.sprintId ? (await storage.getSprint(task.sprintId))?.teamId : undefined);
          const teamAssignments = taskTeamId
            ? await storage.getRoleAssignmentsByTeam(taskTeamId)
            : [];
          const onTeam = new Set(teamAssignments.map((a) => a.userId));

          for (const candidateId of requested) {
            if (!onTeam.has(candidateId)) {
              return res.status(400).json({
                message: "Tasks can only be assigned to members of this team",
              });
            }
            const candidate = await storage.getUser(candidateId);
            if (candidate?.role === "MENTOR" || candidate?.role === "ADMIN") {
              return res.status(400).json({
                message: `${candidate.name || "This user"} is a ${candidate.role.toLowerCase()} — they assign tasks rather than receive them.`,
              });
            }
          }
        }
      }

      // Status change validations
      if (newStatus !== undefined) {
        // Prevent assignees from directly setting status to DONE
        if (isAssignee && !isReviewer && newStatus === "DONE") {
          return res.status(403).json({
            message: "You cannot directly mark a task as DONE. Please change the status to REVIEW first, and the reviewer will mark it as DONE."
          });
        }

        // Sending a task back is a rejection of the submissions sitting in front of the
        // reviewer, so record it on them too. Without this the task-level "Request Changes"
        // and the per-submission review disagreed: the task bounced to IN_PROGRESS while its
        // evidence stayed PENDING, so the queue still showed it as awaiting a first look and
        // the learner had no per-submission feedback to work from.
        if (newStatus === "IN_PROGRESS" && task.status === "REVIEW" && !isAssignee) {
          const pending = (await storage.getEvidenceByTask(task.id)).filter(
            (ev: any) => (ev.status ?? "PENDING") === "PENDING"
          );
          for (const ev of latestPerSubmitter(pending)) {
            await storage.reviewEvidence(ev.id, {
              status: "CHANGES_REQUESTED",
              feedback: typeof reviewComment === "string" && reviewComment.trim()
                ? reviewComment.trim()
                : "Changes requested — see the task comment.",
              reviewedBy: userId,
            });
          }
        }

        // A task cannot be completed while submissions are still unaccepted. Only bites once
        // evidence exists, so a task nobody submitted evidence for behaves exactly as before
        // and nothing already in flight is retroactively blocked.
        if (newStatus === "DONE" && task.status !== "DONE") {
          const submissions = await storage.getEvidenceByTask(task.id);
          const blocked = completionBlockedReason(submissions);
          if (blocked) {
            return res.status(409).json({
              message: `Review the submissions before completing this task. ${blocked}`,
              informational: true,
              // Lets the client title this correctly and point at the review queue, rather
              // than reusing the assignee-facing "waiting on your teammates" wording.
              reason: "REVIEW_SUBMISSIONS_FIRST",
              ...summariseEvidence(submissions),
            });
          }
        }

        // Multi-assignee: all assignees must submit evidence before task can move to REVIEW
        if (isAssignee && newStatus === "REVIEW" && task.status !== "REVIEW") {
          const progress = await taskSubmissionProgress(task);
          if (progress && !progress.allSubmitted) {
            // Not a rejection of the caller's own work — their evidence is
            // already saved. The shared task just isn't ready for review yet,
            // and it advances by itself once the last person submits.
            const names = progress.pendingAssignees.map((p) => p.name).join(", ");
            return res.status(409).json({
              message:
                `This task is shared by ${progress.totalAssignees} members and moves to review automatically ` +
                `once everyone has submitted. ${progress.submittedCount} of ${progress.totalAssignees} done — ` +
                `still waiting on ${names}.`,
              informational: true,
              ...progress,
            });
          }
        }

        // When status changes to REVIEW, auto-assign reviewer
        if (newStatus === "REVIEW" && task.status !== "REVIEW") {
          // Determine reviewer: use assignedBy, or fallback to Founder if assignedBy is inactive
          let reviewerId = task.assignedBy;
          
          if (reviewerId) {
            const assignedByUser = await storage.getUser(reviewerId);
            if (!assignedByUser) {
              // assignedBy user is inactive, find Founder from team
              reviewerId = null;
            }
          }

          // If no valid assignedBy, find Founder from team
          if (!reviewerId) {
            let teamId = task.teamId;
            
            // If task is in a sprint, get teamId from sprint
            if (!teamId && task.sprintId) {
              const sprint = await storage.getSprint(task.sprintId);
              if (sprint) {
                teamId = sprint.teamId;
              }
            }
            
            if (teamId) {
              const assignments = await storage.getRoleAssignmentsByTeam(teamId);
              const founderAssignment = assignments.find(a => a.role === "Promoter");
              if (founderAssignment) {
                reviewerId = founderAssignment.userId;
              } else {
                // Fallback: find any user with FOUNDER role in the team
                for (const member of assignments) {
                  const memberUser = await storage.getUser(member.userId);
                  if (memberUser && memberUser.role === "FOUNDER") {
                    reviewerId = memberUser.id;
                    break;
                  }
                }
              }
            }
          }

          if (reviewerId) {
            updateData.reviewerId = reviewerId;
            updateData.reviewComment = null; // Clear previous review comment
          } else {
            console.warn(`⚠️ Task ${task.id} moved to REVIEW but no reviewer could be assigned. assignedBy=${task.assignedBy}, teamId=${task.teamId}, sprintId=${task.sprintId}`);
          }
        }

        // When status changes away from REVIEW, clear reviewerId
        if (newStatus !== "REVIEW" && task.status === "REVIEW") {
          updateData.reviewerId = null;
        }

        // Require a comment when a reviewer sends work back — the assignee needs something to
        // act on. Approving (DONE) needs no comment: an acceptance speaks for itself, which is
        // the same rule the client and the per-submission review use, so requiring one here
        // made every Approve click fail with a 400 the UI had no dialog for.
        if (isReviewer && !isAssignee && newStatus !== task.status && newStatus !== "DONE") {
          if (!reviewComment || reviewComment.trim() === "") {
            return res.status(400).json({
              message: "Review comment is required when changing task status as a reviewer."
            });
          }
          updateData.reviewComment = reviewComment;
        } else if (isReviewer && !isAssignee && typeof reviewComment === "string" && reviewComment.trim()) {
          // A reviewer may still leave a comment with an approval; keep it if they did.
          updateData.reviewComment = reviewComment.trim();
        }
      }

      if (updateData.dependencies !== undefined) {
        updateData.dependencies = updateData.dependencies ? JSON.stringify(updateData.dependencies) : null;
      }
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }

      const updated = await storage.updateTask(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Send notifications for status changes
      try {
        let teamId = task.teamId;
        if (!teamId && task.sprintId) {
          const sprint = await storage.getSprint(task.sprintId);
          if (sprint) {
            teamId = sprint.teamId;
          }
        }
        
        if (teamId && newStatus !== undefined && newStatus !== task.status) {
          const currentUser = await storage.getUser(userId);
          
          // When assignee changes status to REVIEW, notify reviewer
          if (newStatus === "REVIEW" && task.status !== "REVIEW" && isAssignee && updated.reviewerId) {
            await storage.createNotification({
              userId: updated.reviewerId,
              type: "TASK_CREATED" as any, // Reusing TASK_CREATED type for task review notifications
              title: `Task Ready for Review: ${task.title}`,
              message: `${currentUser?.name || "Someone"} has marked task "${task.title}" as ready for review.`,
              status: "UNREAD" as any,
              metadataJson: {
                taskId: task.id,
                sprintId: task.sprintId,
                teamId: task.teamId,
                assigneeId: task.assigneeId,
                reviewerId: updated.reviewerId,
              },
            });
          }
          
          // When reviewer changes status, notify assignee
          if (isReviewer && !isAssignee && task.assigneeId && newStatus !== task.status) {
            await storage.createNotification({
              userId: task.assigneeId,
              type: "TASK_CREATED" as any, // Reusing TASK_CREATED type for task status change notifications
              title: `Task Status Updated: ${task.title}`,
              message: `${currentUser?.name || "Reviewer"} has changed task "${task.title}" status to ${newStatus}.${reviewComment ? ` Comment: ${reviewComment}` : ""}`,
              status: "UNREAD" as any,
              metadataJson: {
                taskId: task.id,
                sprintId: task.sprintId,
                teamId: task.teamId,
                assigneeId: task.assigneeId,
                reviewerId: userId,
                newStatus: newStatus,
              },
            });
          }
        }
      } catch (notifError: any) {
        console.error("Error creating notification for task status change:", notifError);
        // Don't fail the request if notification creation fails
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Update task error:", error);
      res.status(400).json({ message: "Failed to update task" });
    }
  });

  // Delete a task - only the mentor who created it (assignedBy) can delete
  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only the mentor (or admin) who created the task can delete it
      const isAdmin = user.role === "ADMIN";
      const isCreator = task.assignedBy === userId;
      if (!isAdmin && !isCreator) {
        return res.status(403).json({ message: "Only the mentor who created this task can delete it" });
      }

      await storage.deleteTask(req.params.id);
      res.json({ message: "Task deleted successfully" });
    } catch (error: any) {
      console.error("Delete task error:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // =====================
  // Admin Team Sprint Management Routes
  // =====================

  // Get all teams with basic info for admin dropdown
  app.get("/api/admin/teams", requireRole("ADMIN"), async (req, res) => {
    try {
      const teams = await storage.getTeams();
      const teamsWithDetails = await Promise.all(
        teams.map(async (team) => {
          const problemStatement = team.problemStatementId
            ? await storage.getProblemStatement(team.problemStatementId)
            : null;
          const cohort = await storage.getCohort(team.cohortId);
          return {
            id: team.id,
            name: team.name,
            cohortName: cohort?.name || "Unknown",
            problemStatement: problemStatement ? {
              id: problemStatement.id,
              title: problemStatement.title,
              track: problemStatement.track,
            } : null,
          };
        })
      );
      res.json(teamsWithDetails);
    } catch (error: any) {
      console.error("Get teams error:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // Get team details with founders, co-founders, members, and problem statement
  app.get("/api/admin/teams/:teamId/details", requireRole("ADMIN", "MENTOR"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const user = await storage.getUser(userId);
      const team = await storage.getTeam(req.params.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Mentors can only access teams they are assigned to
      if (user?.role === "MENTOR") {
        const userAssignments = await storage.getRoleAssignmentsByUser(userId);
        const isTeamMember = userAssignments.some(a => a.teamId === team.id);
        if (!isTeamMember) {
          return res.status(403).json({ message: "You don't have access to this team" });
        }
      }

      const assignments = await storage.getRoleAssignmentsByTeam(team.id);
      const problemStatement = team.problemStatementId
        ? await storage.getProblemStatement(team.problemStatementId)
        : null;

      // Get user details for each assignment
      const membersWithDetails = await Promise.all(
        assignments.map(async (assignment) => {
          const user = await storage.getUser(assignment.userId);
          return {
            userId: assignment.userId,
            name: user?.name || "Unknown",
            email: user?.email || "Unknown",
            role: assignment.role,
            userRole: user?.role,
            stipendBand: assignment.stipendBand,
          };
        })
      );

      // Categorize members
      const founders = membersWithDetails.filter(m =>
        m.userRole === "FOUNDER"
      );
      const coFounders = membersWithDetails.filter(m =>
        m.userRole === "COFOUNDER"
      );
      const mentors = membersWithDetails.filter(m =>
        m.userRole === "MENTOR"
      );
      const learners = membersWithDetails.filter(m =>
        m.userRole === "LEARNER" || m.role === "Member"
      );

      res.json({
        team: {
          id: team.id,
          name: team.name,
          health: team.health,
        },
        problemStatement: problemStatement ? {
          id: problemStatement.id,
          title: problemStatement.title,
          track: problemStatement.track,
          overview: problemStatement.overview,
        } : null,
        founders,
        coFounders,
        mentors,
        learners,
        allMembers: membersWithDetails,
      });
    } catch (error: any) {
      console.error("Get team details error:", error);
      res.status(500).json({ message: "Failed to fetch team details" });
    }
  });

  // Get all sprints across all teams (admin view) - for meetings tab sprint selector
  app.get("/api/admin/sprints", requireRole("ADMIN"), async (req, res) => {
    try {
      const teams = await storage.getTeams();
      const allSprintsNested = await Promise.all(
        teams.map(async (team) => {
          const sprints = await storage.getSprintsByTeam(team.id);
          return sprints.map((sprint) => ({
            ...sprint,
            teamName: team.name,
          }));
        })
      );
      res.json(allSprintsNested.flat().sort((a, b) => a.index - b.index));
    } catch (error: any) {
      console.error("Get all sprints error:", error);
      res.status(500).json({ message: "Failed to fetch sprints" });
    }
  });

  // Get all sprints for a team (admin view)
  app.get("/api/admin/teams/:teamId/sprints", requireRole("ADMIN"), async (req, res) => {
    try {
      const sprints = await storage.getSprintsByTeam(req.params.teamId);
      const sprintsWithTasks = await Promise.all(
        sprints.map(async (sprint) => {
          const tasks = await storage.getTasksBySprint(sprint.id);
          return {
            ...sprint,
            tasks: tasks.map(task => ({
              ...task,
              dependencies: task.dependencies ? JSON.parse(task.dependencies as string) : [],
            })),
          };
        })
      );
      res.json(sprintsWithTasks);
    } catch (error: any) {
      console.error("Get team sprints error:", error);
      res.status(500).json({ message: "Failed to fetch sprints" });
    }
  });

  // =====================
  // Sprint Permissions Routes
  // =====================

  // Get permissions for a sprint
  app.get("/api/sprints/:sprintId/permissions", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.sprintId);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      // Only founders can view permissions
      const team = await storage.getTeam(sprint.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      const assignments = await storage.getRoleAssignmentsByTeam(team.id);
      const userAssignment = assignments.find(a => a.userId === userId);
      const user = await storage.getUser(userId);

      const isFounder = user?.role === "FOUNDER" && userAssignment;
      if (!isFounder) {
        return res.status(403).json({ message: "Only founders can view sprint permissions" });
      }

      const permissions = await storage.getSprintPermissionsBySprint(req.params.sprintId);
      const permissionsWithUsers = await Promise.all(
        permissions.map(async (perm) => {
          const user = await storage.getUser(perm.userId);
          return {
            ...perm,
            userName: user?.name || "Unknown",
            userEmail: user?.email || "Unknown",
          };
        })
      );
      res.json(permissionsWithUsers);
    } catch (error: any) {
      console.error("Get permissions error:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // Grant edit permission to a user
  app.post("/api/sprints/:sprintId/permissions", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { targetUserId, canEdit } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ message: "targetUserId is required" });
      }

      const sprint = await storage.getSprint(req.params.sprintId);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      // Only founders can grant permissions
      const team = await storage.getTeam(sprint.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      const assignments = await storage.getRoleAssignmentsByTeam(team.id);
      const userAssignment = assignments.find(a => a.userId === userId);
      const user = await storage.getUser(userId);

      const isFounder = user?.role === "FOUNDER" && userAssignment;
      if (!isFounder) {
        return res.status(403).json({ message: "Only founders can grant sprint permissions" });
      }

      // Check if permission already exists
      const existing = await storage.getSprintPermission(req.params.sprintId, targetUserId);
      if (existing) {
        // Update existing permission
        const updated = await storage.updateSprintPermission(existing.id, {
          canEdit: canEdit !== false,
          revokedAt: canEdit === false ? new Date() : null,
        });
        res.json(updated);
      } else {
        // Create new permission
        const permission = await storage.createSprintPermission({
          sprintId: req.params.sprintId,
          userId: targetUserId,
          canEdit: canEdit !== false,
          grantedBy: userId,
        });
        res.status(201).json(permission);
      }
    } catch (error: any) {
      console.error("Grant permission error:", error);
      res.status(400).json({ message: "Failed to grant permission" });
    }
  });

  // Revoke permission
  app.delete("/api/sprints/:sprintId/permissions/:userId", requireAuth, async (req, res) => {
    try {
      const currentUserId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.sprintId);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      // Only founders can revoke permissions
      const team = await storage.getTeam(sprint.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      const assignments = await storage.getRoleAssignmentsByTeam(team.id);
      const userAssignment = assignments.find(a => a.userId === currentUserId);
      const user = await storage.getUser(currentUserId);

      const isFounder = user?.role === "FOUNDER" && userAssignment;
      if (!isFounder) {
        return res.status(403).json({ message: "Only founders can revoke sprint permissions" });
      }

      const revoked = await storage.revokeSprintPermission(req.params.sprintId, req.params.userId);
      if (revoked) {
        res.json({ message: "Permission revoked" });
      } else {
        res.status(404).json({ message: "Permission not found" });
      }
    } catch (error: any) {
      console.error("Revoke permission error:", error);
      res.status(400).json({ message: "Failed to revoke permission" });
    }
  });

  // =====================
  // Zoho Integration Routes - REMOVED
  // =====================

  // All Zoho routes have been removed - tasks are now stored only in database

  // =====================
  // Review Routes
  // =====================

  app.get("/api/sprints/:sprintId/reviews", requireAuth, async (req, res) => {
    const reviews = await storage.getReviewsBySprint(req.params.sprintId);
    res.json(reviews);
  });

  app.post("/api/sprints/:sprintId/reviews", requireRole("MENTOR", "ADMIN"), async (req, res) => {
    try {
      const review = await storage.createReview({
        ...req.body,
        sprintId: req.params.sprintId,
        mentorId: req.session!.userId!,
      });
      res.status(201).json(review);
    } catch (error) {
      res.status(400).json({ message: "Failed to create review" });
    }
  });

  app.patch("/api/reviews/:id", requireRole("MENTOR", "ADMIN"), async (req, res) => {
    const updated = await storage.updateReview(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Review not found" });
    }
    res.json(updated);
  });

  // =====================
  // Evidence Routes
  // =====================

  // Helper: check if user is a member of the team or is ADMIN
  /**
   * The team to show a user who may sit on more than one.
   *
   * Callers used to take `assignments[0]`, but role assignments came back in
   * whatever order postgres chose, so a member on two teams could be handed an
   * arbitrary one — and with it the wrong problem statement, or an empty list.
   * That is why an assigned problem statement appeared for some team members and
   * not others.
   *
   * Prefers the most recent team that actually has a problem statement, and only
   * falls back to the newest assignment when none of them do.
   */
  async function primaryTeamForUser(userId: string) {
    const assignments = await storage.getRoleAssignmentsByUser(userId);
    if (assignments.length === 0) return { assignment: null, team: null };

    const candidates = await Promise.all(
      assignments.map(async (a) => ({ a, t: await storage.getTeam(a.teamId) }))
    );
    const chosen =
      candidates.find((c) => c.t && c.t.problemStatementId) ??
      candidates.find((c) => c.t);

    return { assignment: chosen?.a ?? assignments[0], team: chosen?.t ?? null };
  }

  /** The team a task belongs to, whether it is a sprint task or standalone. */
  async function teamIdForTask(task: { teamId?: string | null; sprintId?: string | null }) {
    if (task.teamId) return task.teamId;
    if (task.sprintId) return (await storage.getSprint(task.sprintId))?.teamId ?? null;
    return null;
  }

  /**
   * Who has and hasn't submitted evidence on a shared task.
   *
   * A task assigned to several people only moves to REVIEW once everyone has
   * submitted (see the gate in PATCH /api/tasks/:id). Without this the people
   * involved had no way to see what they were waiting for.
   *
   * Returns null for single-assignee and unassigned tasks — there is no group
   * progress to report.
   */
  async function taskSubmissionProgress(task: {
    id: string;
    assigneeId?: string | null;
    assigneeIds?: unknown;
  }) {
    const assigneeIds = normalizeTaskAssigneeIds(task.assigneeIds);
    if (assigneeIds.length < 2) return null;

    const evidence = await storage.getEvidenceByTask(task.id);
    const submitted = new Set(
      evidence.map((ev) => ev.submittedBy).filter(Boolean) as string[]
    );
    const pendingIds = assigneeIds.filter((id) => !submitted.has(id));

    const pending = await Promise.all(
      pendingIds.map(async (id) => {
        const u = await storage.getUser(id);
        return { userId: id, name: u?.name ?? "Unknown" };
      })
    );

    return {
      totalAssignees: assigneeIds.length,
      submittedCount: assigneeIds.length - pendingIds.length,
      pendingAssignees: pending,
      allSubmitted: pendingIds.length === 0,
    };
  }

  /**
   * Moves a shared task to REVIEW once its last assignee has submitted, so it
   * does not sit finished-but-not-submitted waiting for somebody to flip the
   * status by hand. Returns the progress snapshot and whether it advanced.
   */
  async function advanceTaskIfAllSubmitted(task: any) {
    const progress = await taskSubmissionProgress(task);
    let autoAdvanced = false;
    if (progress?.allSubmitted && task.status !== "REVIEW" && task.status !== "DONE") {
      const reviewerId = await resolveTaskReviewer(task);
      await storage.updateTask(task.id, {
        status: "REVIEW",
        reviewerId: reviewerId ?? null,
        reviewComment: null,
      } as any);
      autoAdvanced = true;
      console.log(
        `📋 Task ${task.id} auto-advanced to REVIEW — all ${progress.totalAssignees} assignees submitted` +
          (reviewerId ? ` (reviewer ${reviewerId})` : " (no reviewer could be resolved)")
      );
    }
    return { progress, autoAdvanced };
  }

  /**
   * Attaches submission state to each task: the "1 of 3 submitted" progress for shared tasks,
   * plus who has submitted and who has been asked for changes.
   *
   * `submitters` covers what `submissionProgress` cannot — that is null for a single-assignee
   * task, so there was no way to ask "has this person submitted?" for most of the board, which
   * is exactly what a per-member breakdown needs.
   *
   * One query for the whole list. This ran one per task, so a 23-task team meant 23 queries
   * just to render a page.
   */
  async function withSubmissionProgress(tasks: any[]) {
    if (tasks.length === 0) return tasks;

    const rows = await storage.getEvidenceByTasks(tasks.map((t) => t.id));

    // Names are needed for whoever submitted and for whoever is still outstanding on a shared
    // task: somebody who has not submitted has no evidence row to be found by.
    const needNames = new Set<string>();
    for (const row of rows) {
      if ((row as any).submittedBy) needNames.add(String((row as any).submittedBy));
    }
    for (const task of tasks) {
      for (const id of normalizeTaskAssigneeIds(task.assigneeIds)) needNames.add(String(id));
    }
    const names = new Map<string, string>();
    for (const id of needNames) {
      names.set(id, (await storage.getUser(id))?.name ?? "Unknown");
    }

    const byTask = new Map<string, any[]>();
    for (const row of rows) {
      const key = String((row as any).taskId);
      byTask.set(key, [...(byTask.get(key) ?? []), row]);
    }

    return tasks.map((t) => {
      const mine = byTask.get(String(t.id)) ?? [];
      const latest = latestPerSubmitter(mine);
      return {
        ...t,
        submissionProgress: submissionProgressFrom(t, mine, names),
        submitters: [
          ...new Set(mine.map((e: any) => e.submittedBy).filter(Boolean).map(String)),
        ],
        changesRequestedBy: latest
          .filter((e: any) => e.status === "CHANGES_REQUESTED" && e.submittedBy)
          .map((e: any) => String(e.submittedBy)),
        // Names for this task's assignees, resolved here because the team payload only carries
        // current members. Somebody removed from a team keeps their tasks, and the analytics
        // table could only call them "Former member" — which says there is a problem without
        // saying whose work needs reassigning.
        assigneeNames: Object.fromEntries(
          normalizeTaskAssigneeIds(t.assigneeIds)
            .map((id) => [String(id), names.get(String(id)) ?? "Unknown"])
        ),
      };
    });
  }

  /** The shared-task progress figures, from evidence already in hand. */
  function submissionProgressFrom(
    task: { assigneeIds?: unknown },
    evidenceRows: any[],
    names: Map<string, string>
  ) {
    const assigneeIds = normalizeTaskAssigneeIds(task.assigneeIds);
    if (assigneeIds.length < 2) return null;

    const submitted = new Set(evidenceRows.map((ev) => ev.submittedBy).filter(Boolean).map(String));
    const pendingIds = assigneeIds.filter((id) => !submitted.has(String(id)));
    return {
      totalAssignees: assigneeIds.length,
      submittedCount: assigneeIds.length - pendingIds.length,
      pendingAssignees: pendingIds.map((id) => ({
        userId: id,
        name: names.get(String(id)) ?? "Unknown",
      })),
      allSubmitted: pendingIds.length === 0,
    };
  }

  /** Reviewer for a task moving to REVIEW: whoever assigned it, else the team's founder. */
  async function resolveTaskReviewer(task: {
    assignedBy?: string | null;
    teamId?: string | null;
    sprintId?: string | null;
  }): Promise<string | null> {
    if (task.assignedBy && (await storage.getUser(task.assignedBy))) {
      return task.assignedBy;
    }
    const teamId = await teamIdForTask(task);
    if (!teamId) return null;

    const assignments = await storage.getRoleAssignmentsByTeam(teamId);
    const promoter = assignments.find((a) => a.role === "Promoter" || a.role === "Founder");
    if (promoter) return promoter.userId;

    for (const member of assignments) {
      const u = await storage.getUser(member.userId);
      if (u?.role === "FOUNDER") return u.id;
    }
    return null;
  }

  async function isTeamMemberOrAdmin(userId: string, teamId: string): Promise<boolean> {
    const user = await storage.getUser(userId);
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    // Founders/Cofounders who own the team can view its data
    // Removed check for team.createdBy as the field does not exist in the teams table
    // If needed, add logic here to check role assignments for FOUNDER/COFOUNDER
    const assignments = await storage.getRoleAssignmentsByUser(userId);
    return assignments.some(a => a.teamId === teamId);
  }

  // Get evidence for a team (with submitter names)
  app.get("/api/teams/:teamId/evidence", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const teamId = req.params.teamId;

      // Check team membership or admin
      const allowed = await isTeamMemberOrAdmin(userId, teamId);
      if (!allowed) {
        return res.status(403).json({ message: "You are not a member of this team" });
      }

      const evidenceList = await storage.getEvidenceByTeam(teamId);

      // Attach submitter name to each evidence item
      const enriched = await Promise.all(
        evidenceList.map(async (ev) => {
          let submitterName: string | null = null;
          if (ev.submittedBy) {
            const submitter = await storage.getUser(ev.submittedBy);
            submitterName = submitter?.name || null;
          }
          return { ...ev, submitterName };
        })
      );

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching team evidence:", error);
      res.status(500).json({ message: "Failed to fetch evidence" });
    }
  });

  // Create evidence for a team
  app.post("/api/teams/:teamId/evidence", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const teamId = req.params.teamId;

      // Check team membership or admin
      const allowed = await isTeamMemberOrAdmin(userId, teamId);
      if (!allowed) {
        return res.status(403).json({ message: "You are not a member of this team" });
      }

      const evidenceItem = await storage.createEvidence({
        ...req.body,
        teamId,
        submittedBy: userId,
      });

      // Evidence posted here may still name a task. Run the same shared-task
      // bookkeeping as the task-scoped route rather than letting the outcome
      // depend on which endpoint the caller happened to use.
      if (req.body?.taskId) {
        const task = await storage.getTask(req.body.taskId);
        if (task) {
          const { progress, autoAdvanced } = await advanceTaskIfAllSubmitted(task);
          return res.status(201).json({ ...evidenceItem, progress, autoAdvanced });
        }
      }

      res.status(201).json(evidenceItem);
    } catch (error) {
      console.error("Error creating evidence:", error);
      res.status(400).json({ message: "Failed to create evidence" });
    }
  });

  // Get evidence by sprint (with submitter names)
  app.get("/api/sprints/:sprintId/evidence", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.sprintId);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      // Check team membership or admin
      const allowed = await isTeamMemberOrAdmin(userId, sprint.teamId);
      if (!allowed) {
        return res.status(403).json({ message: "You are not a member of this team" });
      }

      const evidenceList = await storage.getEvidenceBySprint(req.params.sprintId);

      // Attach submitter name
      const enriched = await Promise.all(
        evidenceList.map(async (ev) => {
          let submitterName: string | null = null;
          if (ev.submittedBy) {
            const submitter = await storage.getUser(ev.submittedBy);
            submitterName = submitter?.name || null;
          }
          return { ...ev, submitterName };
        })
      );

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching sprint evidence:", error);
      res.status(500).json({ message: "Failed to fetch evidence" });
    }
  });

  // Create evidence for sprint
  app.post("/api/sprints/:sprintId/evidence", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sprint = await storage.getSprint(req.params.sprintId);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      // Check team membership or admin
      const allowed = await isTeamMemberOrAdmin(userId, sprint.teamId);
      if (!allowed) {
        return res.status(403).json({ message: "You are not a member of this team" });
      }

      const evidenceItem = await storage.createEvidence({
        ...req.body,
        sprintId: req.params.sprintId,
        teamId: sprint.teamId,
        submittedBy: userId,
      });
      res.status(201).json(evidenceItem);
    } catch (error) {
      console.error("Error creating sprint evidence:", error);
      res.status(400).json({ message: "Failed to create evidence" });
    }
  });

  // Get evidence by task
  app.get("/api/tasks/:taskId/evidence", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      // Determine teamId for permission check: prefer task.teamId, else task.sprintId -> sprint.teamId
      let teamId: string | null = task.teamId || null;
      if (!teamId && task.sprintId) {
        const sprint = await storage.getSprint(task.sprintId);
        teamId = sprint ? sprint.teamId : null;
      }

      if (!teamId) return res.status(400).json({ message: "Task has no associated team" });

      const allowed = await isTeamMemberOrAdmin(userId, teamId);
      if (!allowed) return res.status(403).json({ message: "You are not a member of this team" });

      const evidenceList = await storage.getEvidenceByTask(req.params.taskId);

      const enriched = await Promise.all(
        evidenceList.map(async (ev) => {
          let submitterName: string | null = null;
          if (ev.submittedBy) {
            const submitter = await storage.getUser(ev.submittedBy);
            submitterName = submitter?.name || null;
          }
          return { ...ev, submitterName };
        })
      );

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching task evidence:", error);
      res.status(500).json({ message: "Failed to fetch evidence" });
    }
  });

  // Create evidence for a specific task (resolves teamId server-side — works for learners without role assignments)
  app.post("/api/tasks/:taskId/evidence", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      // Resolve teamId from task → sprint
      let teamId: string | null = task.teamId || null;
      if (!teamId && task.sprintId) {
        const sprint = await storage.getSprint(task.sprintId);
        teamId = sprint ? sprint.teamId : null;
      }
      if (!teamId) return res.status(400).json({ message: "Task has no associated team" });

      // Assignee or team member or admin can submit evidence
      const allowed = await isTeamMemberOrAdmin(userId, teamId);
      const isAssignee = Boolean(
        (task.assigneeId && String(task.assigneeId) === String(userId)) ||
        normalizeTaskAssigneeIds(task.assigneeIds).some((id) => String(id) === String(userId))
      );
      if (!allowed && !isAssignee) {
        return res.status(403).json({ message: "You are not allowed to submit evidence for this task" });
      }

      const evidenceItem = await storage.createEvidence({
        ...req.body,
        taskId: req.params.taskId,
        teamId,
        submittedBy: userId,
      });

      const { progress, autoAdvanced } = await advanceTaskIfAllSubmitted(task);
      res.status(201).json({ ...evidenceItem, progress, autoAdvanced });
    } catch (error) {
      console.error("Error creating task evidence:", error);
      res.status(400).json({ message: "Failed to create evidence" });
    }
  });

  // Delete evidence
  /**
   * Who may review a submission: the same people who may complete the task — an admin, the
   * team's founder or co-founder, or a mentor assigned to that team. Assignees are excluded
   * even though they are team members, because reviewing your own work is not review.
   */
  async function canReviewEvidenceOnTask(userId: string, task: any): Promise<boolean> {
    const user = await storage.getUser(userId);
    if (!user) return false;
    if (user.role === "ADMIN") return true;

    const assigneeIds = normalizeTaskAssigneeIds(task.assigneeIds);
    const isAssignee =
      (task.assigneeId && String(task.assigneeId) === String(userId)) ||
      assigneeIds.some((id) => String(id) === String(userId));
    if (isAssignee) return false;

    if (task.reviewerId && String(task.reviewerId) === String(userId)) return true;

    const teamId = await teamIdForTask(task);
    if (!teamId) return false;
    const assignments = await storage.getRoleAssignmentsByTeam(teamId);
    const mine = assignments.find((a) => a.userId === userId);
    if (!mine) return false;

    // Any mentor on the team may review any submission on it, whichever kind the task names.
    // The kind decides what a reviewer is shown first, not what they are allowed to do — an
    // academic mentor is not turned away from a task marked INDUSTRY, because the alternative
    // is work sitting unreviewed whenever the named kind is away or the team has none.
    if (user.role === "MENTOR" || mine.role === "Mentor") return true;
    return mine.role === "Promoter" || mine.role === "Founder" || mine.role === "CoPromoter";
  }

  /** Submissions waiting on this user, across every team they mentor. */
  app.get("/api/evidence/pending-review", requireAuth, async (req, res) => {
    try {
      res.json(await storage.getEvidencePendingReviewFor(req.session!.userId!));
    } catch (error) {
      console.error("Pending review error:", error);
      res.status(500).json({ message: "Failed to fetch submissions awaiting review" });
    }
  });

  /** Accept one submission, or send it back with feedback. */
  app.patch("/api/evidence/:id/review", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const item = await storage.getEvidence(req.params.id);
      if (!item) return res.status(404).json({ message: "Evidence not found" });
      if (!item.taskId) {
        return res.status(400).json({ message: "This evidence is not attached to a task" });
      }

      const task = await storage.getTask(item.taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });

      if (!(await canReviewEvidenceOnTask(userId, task))) {
        return res.status(403).json({
          message: "Only a mentor, founder or admin on this team can review submissions",
        });
      }

      const { status, feedback } = req.body ?? {};
      const inputError = reviewInputError(status, feedback);
      if (inputError) return res.status(400).json({ message: inputError });

      const updated = await storage.reviewEvidence(req.params.id, {
        status,
        feedback: typeof feedback === "string" ? feedback.trim() : null,
        reviewedBy: userId,
      });

      // Report the task's standing back, so the reviewer sees what is still outstanding
      // without a second request.
      const all = await storage.getEvidenceByTask(task.id);
      const summary = summariseEvidence(all);

      // Changes requested means the work is not finished: put the task back in progress so it
      // leaves the reviewer's board and reappears on the learner's.
      if (status === "CHANGES_REQUESTED" && task.status === "REVIEW") {
        await storage.updateTask(task.id, { status: "IN_PROGRESS" } as any);
      }

      // Wrapped, and this is the point: the review above is already written. A notification
      // failing must not report somebody's completed review as failed. It did — `TASK_UPDATED`
      // is not one of the 24 values notifications.type accepts, so every Accept click saved the
      // verdict and then answered 500, and the reviewer clicked again on work already done.
      // The `as any` on the type is what stopped the compiler saying so.
      try {
        if (item.submittedBy) {
          await storage.createNotification({
            userId: item.submittedBy,
            type: "ASSESSMENT_REVIEWED" as any,
            title: status === "ACCEPTED" ? "Submission accepted" : "Changes requested",
            message:
              status === "ACCEPTED"
                ? `Your submission for "${task.title}" was accepted.`
                : `Your submission for "${task.title}" needs changes: ${String(feedback).trim()}`,
            status: "UNREAD" as any,
            metadataJson: { taskId: task.id, evidenceId: item.id },
          });
        }
      } catch (notifyError) {
        console.error("Evidence review notification error:", notifyError);
      }

      res.json({ ...updated, summary });
    } catch (error) {
      console.error("Review evidence error:", error);
      res.status(500).json({ message: "Failed to review this submission" });
    }
  });

  app.delete("/api/evidence/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const user = await storage.getUser(userId);
      const ev = await storage.getEvidence(req.params.id);

      if (!ev) {
        return res.status(404).json({ message: "Evidence not found" });
      }

      // Only the submitter, team founder, mentor, or admin can delete
      const isSubmitter = ev.submittedBy === userId;
      const isAdmin = user?.role === "ADMIN";

      // Check if user is founder/mentor of the team
      let isTeamLeader = false;
      if (!isSubmitter && !isAdmin) {
        const assignments = await storage.getRoleAssignmentsByUser(userId);
        const teamAssignment = assignments.find(a => a.teamId === ev.teamId);
        if (teamAssignment && (teamAssignment.role === "Founder" || teamAssignment.role === "Mentor")) {
          isTeamLeader = true;
        }
      }

      if (!isSubmitter && !isAdmin && !isTeamLeader) {
        return res.status(403).json({ message: "You can only delete your own evidence or evidence in teams you lead" });
      }

      await storage.deleteEvidence(req.params.id);
      res.json({ message: "Evidence deleted" });
    } catch (error) {
      console.error("Error deleting evidence:", error);
      res.status(500).json({ message: "Failed to delete evidence" });
    }
  });

  // =====================
  // Review Routes
  // =====================

  app.get("/api/sprints/:sprintId/reviews", requireAuth, async (req, res) => {
    const reviews = await storage.getReviewsBySprint(req.params.sprintId);
    res.json(reviews);
  });

  app.post("/api/sprints/:sprintId/reviews", requireRole("MENTOR", "ADMIN"), async (req, res) => {
    try {
      const review = await storage.createReview({
        ...req.body,
        sprintId: req.params.sprintId,
        mentorId: req.session!.userId!,
      });
      res.status(201).json(review);
    } catch (error) {
      res.status(400).json({ message: "Failed to create review" });
    }
  });

  app.patch("/api/reviews/:id", requireRole("MENTOR", "ADMIN"), async (req, res) => {
    const updated = await storage.updateReview(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Review not found" });
    }
    res.json(updated);
  });

  // =====================
  // Daily Standup Routes
  // =====================

  app.get("/api/sprints/:sprintId/standups", requireAuth, async (req, res) => {
    const standups = await storage.getDailyStandupsBySprint(req.params.sprintId);
    res.json(standups);
  });

  app.post("/api/sprints/:sprintId/standups", requireAuth, async (req, res) => {
    try {
      const standup = await storage.createDailyStandup({
        ...req.body,
        sprintId: req.params.sprintId,
        authorId: req.session!.userId!,
      });
      res.status(201).json(standup);
    } catch (error) {
      res.status(400).json({ message: "Failed to create standup" });
    }
  });

  // =====================
  // Sprint Demo Routes
  // =====================

  app.patch("/api/sprints/:id/demo", requireAuth, async (req, res) => {
    try {
      const { demoUrl, demoNotes } = req.body;
      const updated = await storage.updateSprint(req.params.id, {
        demoUrl,
        demoNotes,
      });
      if (!updated) {
        return res.status(404).json({ message: "Sprint not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Failed to update demo" });
    }
  });

  // =====================
  // Object Storage Routes for Demo Upload
  // =====================

  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      // Use S3 if available. Generate an objectKey and return both the
      // presigned PUT URL and the objectKey so the client can request a
      // signed GET/download URL later.
      if (process.env.AWS_S3_BUCKET_NAME) {
        const { S3StorageService } = await import("./s3Storage");
        const storageService = new S3StorageService();
        const privateDir = storageService.getPrivateObjectDir();
        const objectId = randomUUID();
        const objectKey = `${privateDir}/${objectId}`;
        const uploadURL = await storageService.getSignedUploadURL(objectKey, "application/octet-stream", 900);
        res.json({ uploadURL, objectKey });
      } else {
        const { ObjectStorageService } = await import("./objectStorage");
        const objectStorageService = new ObjectStorageService();
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        res.json({ uploadURL });
      }
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  app.post("/api/objects/view-url", requireAuth, async (req: Request, res: Response) => {
    try {
      const { objectKey } = req.body;
      if (!objectKey) return res.status(400).json({ message: "objectKey is required" });
      const { S3StorageService } = await import("./s3Storage");
      const storageService = new S3StorageService();
      const exists = await storageService.objectExists(objectKey);
      if (!exists) return res.status(404).json({ message: "File not found" });
      const fileUrl = await storageService.getSignedDownloadURL(objectKey, 3600);
      res.json({ fileUrl, objectKey });
    } catch (error) {
      console.error("Error generating view URL:", error);
      res.status(500).json({ message: "Failed to generate view URL" });
    }
  });

  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    try {
      // Use S3 if AWS_S3_BUCKET_NAME is set, otherwise use GCS
      if (process.env.AWS_S3_BUCKET_NAME) {
        const { S3StorageService, ObjectNotFoundError } = await import("./s3Storage");
        const storageService = new S3StorageService();
        // Extract object key from path like /objects/entity-id
        const objectKey = req.path.replace("/objects/", "");
        const privateDir = storageService.getPrivateObjectDir();
        const fullKey = `${privateDir}/${objectKey}`;
        const canAccess = await storageService.canAccessObjectEntity({
          userId: req.session!.userId,
          objectKey: fullKey,
          requestedPermission: "READ" as any,
        });
        if (!canAccess) {
          return res.sendStatus(401);
        }
        await storageService.downloadObject(fullKey, res);
      } else {
        const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
        const { ObjectPermission } = await import("./objectAcl");
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(req.path);
        const canAccess = await objectStorageService.canAccessObjectEntity({
          objectFile,
          userId: req.session!.userId,
          requestedPermission: ObjectPermission.READ,
        });
        if (!canAccess) {
          return res.sendStatus(401);
        }
        objectStorageService.downloadObject(objectFile, res);
      }
    } catch (error) {
      const { ObjectNotFoundError } = await import(process.env.AWS_S3_BUCKET_NAME ? "./s3Storage" : "./objectStorage");
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      console.error("Error serving object:", error);
      return res.sendStatus(500);
    }
  });

  app.put("/api/sprints/:id/demo-upload", requireAuth, async (req, res) => {
    try {
      const { demoUrl, demoNotes } = req.body;
      if (!demoUrl) {
        return res.status(400).json({ message: "demoUrl is required" });
      }

      // Use S3 if AWS_S3_BUCKET_NAME is set, otherwise use GCS
      let objectPath: string;
      if (process.env.AWS_S3_BUCKET_NAME) {
        const { S3StorageService } = await import("./s3Storage");
        const storageService = new S3StorageService();
        objectPath = await storageService.trySetObjectEntityAclPolicy(
          demoUrl,
          {
            owner: req.session!.userId!,
            visibility: "private",
          }
        );
      } else {
        const { ObjectStorageService } = await import("./objectStorage");
        const objectStorageService = new ObjectStorageService();
        objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
          demoUrl,
          {
            owner: req.session!.userId!,
            visibility: "private",
          }
        );
      }

      const updated = await storage.updateSprint(req.params.id, {
        demoUrl: objectPath,
        demoNotes,
      });

      if (!updated) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      res.json({ objectPath, sprint: updated });
    } catch (error) {
      console.error("Error updating demo:", error);
      res.status(500).json({ message: "Failed to update demo" });
    }
  });

  // =====================
  // Sprint Pass/Fail with Stipend Trigger
  // =====================

  /**
   * What is still outstanding on a sprint, so the person closing it can see the cost first.
   *
   * Read-only and deliberately permissive about what it reports: closing is not blocked on any
   * of this. A programme that could not end a phase over one unreviewed submission would strand
   * the whole team, so the confirmation informs rather than gates.
   */
  app.get("/api/sprints/:id/close-summary", requireRole("MENTOR", "ADMIN"), async (req, res) => {
    try {
      const sprint = await storage.getSprint(req.params.id);
      if (!sprint) return res.status(404).json({ message: "Sprint not found" });

      const tasks = await storage.getTasksBySprint(sprint.id);
      const submissions = await storage.getEvidenceByTasks(tasks.map((t) => t.id));
      const members = await storage.getRoleAssignmentsByTeam(sprint.teamId);

      // The phase a learner moves to on close is whatever comes next by index and is not
      // already closed — the same rule /api/my-sprint uses to pick what they see.
      const all = await storage.getSprintsByTeam(sprint.teamId);
      const next = all.find((s) => s.index > sprint.index && !s.passed) ?? null;

      res.json({
        ...summariseSprintClose(sprint, tasks, submissions),
        sprint: { id: sprint.id, index: sprint.index, name: sprint.name ?? null },
        // Mentors are excluded: the pass route skips them for stipends, so the count shown
        // here has to match who is actually affected.
        affectedMembers: (
          await Promise.all(members.map(async (m) => (await storage.getUser(m.userId))?.role))
        ).filter((role) => role && role !== "MENTOR" && role !== "ADMIN").length,
        nextSprint: next
          ? {
              id: next.id,
              index: next.index,
              name: next.name ?? null,
              startDate: next.startDate,
              phase: sprintPhase(next),
            }
          : null,
      });
    } catch (error) {
      console.error("Sprint close summary error:", error);
      res.status(500).json({ message: "Failed to work out what closing this sprint would do" });
    }
  });

  app.post("/api/sprints/:id/pass", requireRole("MENTOR", "ADMIN"), async (req, res) => {
    try {
      const sprint = await storage.getSprint(req.params.id);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      // Update sprint as passed
      const updated = await storage.updateSprint(req.params.id, {
        passed: true,
        passedAt: new Date(),
      });

      // Trigger stipend disbursement for team members
      const team = await storage.getTeam(sprint.teamId);
      if (team) {
        const members = await storage.getRoleAssignmentsByTeam(team.id);
        const month = new Date().toISOString().slice(0, 7); // e.g., "2024-12"
        const rules = await storage.getStipendRules();

        for (const member of members) {
          // Check user role instead of team role - only founders, co-founders, and learners get stipends
          const user = await storage.getUser(member.userId);
          if (user?.role === "MENTOR") continue; // Skip mentors based on user role

          const band = member.stipendBand || "C";
          const rule = rules.find(r => r.band === band);
          const amount = rule?.monthlyAmount || STIPEND_BANDS[band as keyof typeof STIPEND_BANDS] || 10000;

          // Check if stipend already exists for this month
          const existingStipends = await storage.getStipendDisbursementsByUser(member.userId);
          const alreadyDisbursed = existingStipends.some(s => s.month === month && s.teamId === team.id);

          if (!alreadyDisbursed) {
            await storage.createStipendDisbursement({
              teamId: team.id,
              userId: member.userId,
              month,
              amount: amount.toString(),
              status: "RELEASED",
              reason: `Sprint ${sprint.index} passed`,
            });
          }
        }
      }

      // Tell the team the phase moved. /api/my-sprint shows a learner the first sprint that is
      // not passed, so closing this one silently swaps the whole board under them — nobody was
      // told which phase they are now in, or that the previous one had ended.
      try {
        const all = await storage.getSprintsByTeam(sprint.teamId);
        const next = all.find((s) => s.index > sprint.index && !s.passed) ?? null;
        const closedName = sprint.name ? `${sprint.name}` : `Sprint ${sprint.index}`;
        const nextName = next
          ? next.name
            ? `${next.name}`
            : `Sprint ${next.index}`
          : null;

        const members = await storage.getRoleAssignmentsByTeam(sprint.teamId);
        for (const member of members) {
          await storage.createNotification({
            userId: member.userId,
            // SPRINT_PASSED is not in the notifications.type enum either. This call is
            // wrapped, so it failed silently and teams were never told the phase had moved.
            type: "SPRINT_CREATED" as any,
            title: nextName ? `${closedName} complete` : `${closedName} complete`,
            message: nextName
              ? `${closedName} has been closed. Your team is now on ${nextName}.`
              : `${closedName} has been closed. This was the final sprint.`,
            status: "UNREAD" as any,
            metadataJson: { sprintId: sprint.id, nextSprintId: next?.id ?? null },
          });
        }
      } catch (notifyError) {
        // A failed notification must not undo a close that already happened and already
        // released stipends.
        console.error("Sprint close notification error:", notifyError);
      }

      res.json({ message: "Sprint marked as passed, stipends released", sprint: updated });
    } catch (error) {
      console.error("Error passing sprint:", error);
      res.status(400).json({ message: "Failed to pass sprint" });
    }
  });

  app.post("/api/sprints/:id/fail", requireRole("MENTOR", "ADMIN"), async (req, res) => {
    try {
      const sprint = await storage.getSprint(req.params.id);
      if (!sprint) {
        return res.status(404).json({ message: "Sprint not found" });
      }

      // Update sprint as failed
      const updated = await storage.updateSprint(req.params.id, {
        passed: false,
        passedAt: null,
      });

      // Hold stipends for team members
      const team = await storage.getTeam(sprint.teamId);
      if (team) {
        const members = await storage.getRoleAssignmentsByTeam(team.id);
        const month = new Date().toISOString().slice(0, 7);

        for (const member of members) {
          // Check user role instead of team role - only founders, co-founders, and learners get stipends
          const user = await storage.getUser(member.userId);
          if (user?.role === "MENTOR") continue; // Skip mentors based on user role

          const band = member.stipendBand || "C";
          const rule = await storage.getStipendRuleByBand(band);
          const amount = rule?.monthlyAmount || STIPEND_BANDS[band as keyof typeof STIPEND_BANDS] || 10000;

          const existingStipends = await storage.getStipendDisbursementsByUser(member.userId);
          const alreadyExists = existingStipends.some(s => s.month === month && s.teamId === team.id);

          if (!alreadyExists) {
            await storage.createStipendDisbursement({
              teamId: team.id,
              userId: member.userId,
              month,
              amount: amount.toString(),
              status: "HOLD",
              reason: `Sprint ${sprint.index} failed - gating triggered`,
            });
          }
        }
      }

      res.json({ message: "Sprint marked as failed, stipends held", sprint: updated });
    } catch (error) {
      console.error("Error failing sprint:", error);
      res.status(400).json({ message: "Failed to fail sprint" });
    }
  });

  // =====================
  // GitHub/CI Webhook Stub for Evidence Locker
  // =====================

  app.post("/api/webhook/github", async (req, res) => {
    try {
      // Stub webhook for GitHub events (PRs, CI runs)
      const { action, repository, pull_request, check_run, teamId, sprintId } = req.body;

      if (!teamId) {
        return res.status(400).json({ message: "teamId is required" });
      }

      let evidenceType: "PR" | "CI" | "Ticket" | "Doc" | "Demo" = "PR";
      let title = "";
      let url = "";
      let metaJson: Record<string, unknown> = {};

      if (pull_request) {
        evidenceType = "PR";
        title = pull_request.title || "Pull Request";
        url = pull_request.html_url || pull_request.url;
        metaJson = {
          prNumber: pull_request.number,
          state: pull_request.state,
          repo: repository?.full_name,
          author: pull_request.user?.login,
          action,
        };
      } else if (check_run) {
        evidenceType = "CI";
        title = check_run.name || "CI Run";
        url = check_run.html_url || check_run.details_url;
        metaJson = {
          conclusion: check_run.conclusion,
          status: check_run.status,
          repo: repository?.full_name,
          action,
        };
      }

      const evidenceItem = await storage.createEvidence({
        teamId,
        sprintId: sprintId || null,
        submittedBy: null, // Webhook-created evidence has no user
        type: evidenceType,
        title,
        url,
        metaJson,
      });

      res.status(201).json(evidenceItem);
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ message: "Failed to process webhook" });
    }
  });

  // =====================
  // Seed Fund Routes
  // =====================

  app.get("/api/teams/:teamId/seed-fund", requireAuth, async (req, res) => {
    const seedFund = await storage.getSeedFundByTeam(req.params.teamId);
    if (!seedFund) {
      return res.status(404).json({ message: "Seed fund not found" });
    }
    res.json(seedFund);
  });

  app.patch("/api/seed-funds/:id", requireRole("ADMIN"), async (req, res) => {
    const updated = await storage.updateSeedFund(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Seed fund not found" });
    }
    res.json(updated);
  });

  // =====================
  // Cap Table Routes
  // =====================

  app.get("/api/teams/:teamId/cap-table", requireAuth, async (req, res) => {
    const capTable = await storage.getCapTableByTeam(req.params.teamId);
    res.json(capTable);
  });

  // =====================
  // Stipend Routes
  // =====================

  app.get("/api/stipend-rules", requireAuth, async (req, res) => {
    const rules = await storage.getStipendRules();
    res.json(rules);
  });

  app.get("/api/teams/:teamId/stipends", requireAuth, async (req, res) => {
    const stipends = await storage.getStipendDisbursementsByTeam(req.params.teamId);
    res.json(stipends);
  });

  app.get("/api/my-stipends", requireAuth, async (req, res) => {
    const stipends = await storage.getStipendDisbursementsByUser(req.session!.userId!);
    res.json(stipends);
  });

  // Generate monthly stipends for a team
  app.post("/api/teams/:teamId/stipends/generate", requireRole("ADMIN"), async (req, res) => {
    try {
      const { month } = req.body; // e.g., "2024-01"

      const team = await storage.getTeam(req.params.teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      const allMembers = await storage.getRoleAssignmentsByTeam(team.id);
      const rules = await storage.getStipendRules();

      // Mentors are paid through the honorarium flow, not the stipend engine.
      // They carry no stipend band, and the `|| "C"` fallback below would
      // otherwise silently enrol them at Member rates on top of that.
      //
      // Filtered on the platform role, matching the other two stipend paths
      // (see the `user?.role === "MENTOR"` checks above) — a MENTOR can sit on
      // a team under any team role, so the team role alone is not reliable.
      const memberUsers = await Promise.all(
        allMembers.map(async (m) => ({ m, user: await storage.getUser(m.userId) }))
      );
      const members = memberUsers
        .filter(({ m, user }) => user?.role !== "MENTOR" && m.role !== "Mentor")
        .map(({ m }) => m);

      const disbursements = await Promise.all(
        members.map(async (member) => {
          const band = member.stipendBand || "C";
          const rule = rules.find(r => r.band === band);
          const amount = rule?.monthlyAmount || STIPEND_BANDS[band as keyof typeof STIPEND_BANDS] || 20000;

          return storage.createStipendDisbursement({
            teamId: team.id,
            userId: member.userId,
            month,
            amount: amount.toString(),
            status: "PENDING",
          });
        })
      );

      res.status(201).json(disbursements);
    } catch (error) {
      res.status(400).json({ message: "Failed to generate stipends" });
    }
  });

  app.patch("/api/stipends/:id", requireRole("ADMIN"), async (req, res) => {
    const updated = await storage.updateStipendDisbursement(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Stipend disbursement not found" });
    }
    res.json(updated);
  });

  // =====================
  // Team Meetings Routes
  // =====================

  // Helper: convert a naive local date+time string in a given timezone to a UTC Date
  const toUTCFromTimezone = (dateStr: string, timeStr: string, timezone: string): Date => {
    const naiveUtcDate = new Date(`${dateStr}T${timeStr}:00Z`);
    const tzName = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(naiveUtcDate).find((p) => p.type === 'timeZoneName')?.value || 'GMT+0';
    const match = tzName.match(/GMT([+-]\d+)(?::(\d+))?/);
    if (!match) return naiveUtcDate;
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2] || '0');
    const offsetMinutes = hours * 60 + (hours >= 0 ? minutes : -minutes);
    return new Date(naiveUtcDate.getTime() - offsetMinutes * 60 * 1000);
  };

  // Create team meeting
  app.post("/api/teams/:teamId/meetings", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const currentUser = await storage.getUser(userId);
      const teamId = req.params.teamId;
      const { title, agenda, date, time, durationMinutes, timezone, attendeeIds, sprintId } = req.body;
      // Where the session happens. Absent means Google Meet, so a client that predates this
      // still gets exactly the behaviour it had.
      const platform = normaliseMeetingPlatform(req.body?.meetingPlatform);
      const externalLink = typeof req.body?.meetingLink === "string" ? req.body.meetingLink.trim() : "";

      if (!title || !date || !time) {
        return res.status(400).json({ message: "Title, date, and time are required" });
      }

      if (!attendeeIds || !Array.isArray(attendeeIds) || attendeeIds.length === 0) {
        return res.status(400).json({ message: "At least one attendee must be selected" });
      }

      // Verify team exists
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Check permissions
      const isAdmin = currentUser?.role === "ADMIN";
      const assignments = await storage.getRoleAssignmentsByTeam(teamId);
      const userAssignment = assignments.find(a => a.userId === userId);

      // For mentors, must be assigned to the team
      if (currentUser?.role === "MENTOR" && !userAssignment && !isAdmin) {
        return res.status(403).json({ message: "You are not assigned to this team" });
      }

      // Allow FOUNDER, COFOUNDER, MENTOR (if assigned), or ADMIN
      const canCreate = isAdmin || 
        (currentUser?.role === "FOUNDER" && userAssignment) ||
        (currentUser?.role === "COFOUNDER" && userAssignment) ||
        (currentUser?.role === "MENTOR" && userAssignment);

      if (!canCreate) {
        return res.status(403).json({ message: "You don't have permission to create meetings for this team" });
      }

      const meetingDateTime = toUTCFromTimezone(date, time, timezone || "Asia/Kolkata");
      const now = new Date();
      const isInPast = meetingDateTime.getTime() < now.getTime();

      // A past time is allowed, on either platform. This used to demand 10 minutes' notice, which
      // made it impossible to log a session that had already happened -- and that is now the main
      // reason a mentor creates a meeting at all: to attach the recording of one they just ran.
      //
      // What a past meeting does not get is a calendar event (see below). It is a record of
      // something that happened, so there is nothing to join and nobody to remind.

      const linkProblem = meetingLinkError(platform, externalLink);
      if (linkProblem) {
        return res.status(400).json({ message: linkProblem });
      }

      // For mentors: check for conflicts (only check their own meetings across all teams).
      // Skipped for a past meeting -- you cannot double-book a session that already happened, and
      // refusing to log one because it overlapped something else would be nonsense.
      if (currentUser?.role === "MENTOR" && !isAdmin && !isInPast) {
        const userMeetings = await storage.getTeamMeetingsByUser(userId);
        const meetingEndTime = new Date(meetingDateTime);
        meetingEndTime.setMinutes(meetingEndTime.getMinutes() + (durationMinutes || 30));

        const hasConflict = userMeetings.some(meeting => {
          if (meeting.deletedAt) return false;
          const existingStart = new Date(meeting.scheduledAt);
          const existingEnd = new Date(existingStart);
          existingEnd.setMinutes(existingEnd.getMinutes() + (meeting.durationMinutes || 30));

          // Check if time ranges overlap
          return (meetingDateTime < existingEnd && meetingEndTime > existingStart);
        });

        if (hasConflict) {
          return res.status(400).json({ message: "You have a conflicting meeting at this time" });
        }
      }

      // Get all team members to verify attendees are valid
      const teamMembers = await storage.getRoleAssignmentsByTeam(teamId);
      const validAttendeeIds = teamMembers.map(m => m.userId);
      const invalidAttendees = attendeeIds.filter((id: string) => !validAttendeeIds.includes(id));
      
      if (invalidAttendees.length > 0) {
        return res.status(400).json({ message: "Some selected attendees are not members of this team" });
      }

      // Get attendee emails
      const attendeeEmails = await Promise.all(
        attendeeIds.map(async (id: string) => {
          const user = await storage.getUser(id);
          return user?.email;
        })
      );
      const validEmails = attendeeEmails.filter(Boolean) as string[];

      if (validEmails.length === 0) {
        return res.status(400).json({ message: "No valid email addresses found for attendees" });
      }

      // Get organizer email
      const organizerEmail = currentUser?.email;
      if (!organizerEmail) {
        return res.status(400).json({ message: "Organizer email not found" });
      }

      // Create the Google Calendar event.
      //
      // Skipped entirely for a meeting logged in the past: inviting the team to a session that
      // already finished emails everyone about something they cannot attend, and asking Google to
      // mint a Meet link for it would advertise a call that never took place. An external link is
      // still stored for reference, it just is not sent round.
      //
      // For a future meeting both platforms get an invite -- Google Meet has its link generated,
      // and OTHER carries the mentor's link on the event, so learners keep the same calendar entry
      // and reminder they have always had.
      let eventId: string | undefined;
      let meetLink: string | undefined = platform === "OTHER" ? externalLink : undefined;

      if (!isInPast) {
        try {
          const { createTeamMeetingEvent } = await import("./services/calendar-service");
          const calendarResult = await createTeamMeetingEvent(
            date,
            time,
            title,
            agenda || title,
            validEmails,
            organizerEmail,
            durationMinutes || 30,
            timezone || "Asia/Kolkata",
            platform === "OTHER" ? externalLink : undefined
          );
          eventId = calendarResult.eventId;
          meetLink = calendarResult.meetLink;
        } catch (calendarError: any) {
          console.error("Failed to create calendar event:", calendarError);
          // Continue without calendar event - meeting will still be created. For an external
          // meeting the mentor's link survives regardless, since it did not come from Google.
        }
      }

      // Create meeting in database
      const meeting = await storage.createTeamMeeting({
        teamId,
        createdBy: userId,
        title,
        agenda: agenda || null,
        scheduledAt: meetingDateTime,
        durationMinutes: durationMinutes || 30,
        timezone: timezone || "Asia/Kolkata",
        meetingLink: meetLink || null,
        meetingPlatform: platform,
        googleEventId: eventId || null,
        attendeeIds,
        sprintId: sprintId || null,
        notes: null,
        deletedAt: null,
      });

      // Create notifications for all attendees
      try {
        for (const attendeeId of attendeeIds) {
          if (attendeeId !== userId) { // Don't notify creator
            await storage.createNotification({
              userId: attendeeId,
              type: "TEAM_MEETING_CREATED",
              status: "UNREAD",
              title: "New Team Meeting",
              message: `${currentUser?.name || "Someone"} scheduled a meeting: ${title}`,
              metadataJson: {
                meetingId: meeting.id,
                teamId: teamId,
                teamName: team.name,
                scheduledAt: meetingDateTime.toISOString(),
              },
            });
          }
        }
      } catch (notificationError) {
        console.error("Failed to create notifications:", notificationError);
        // Don't fail the request if notifications fail
      }

      res.status(201).json(meeting);
    } catch (error: any) {
      console.error("Error creating team meeting:", error);
      res.status(500).json({ message: "Failed to create meeting" });
    }
  });

  // Get team meetings
  app.get("/api/teams/:teamId/meetings", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const currentUser = await storage.getUser(userId);
      const teamId = req.params.teamId;

      // Verify team exists
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Check if user is member of team or admin
      const isAdmin = currentUser?.role === "ADMIN";
      const assignments = await storage.getRoleAssignmentsByTeam(teamId);
      const userAssignment = assignments.find(a => a.userId === userId);

      if (!isAdmin && !userAssignment) {
        return res.status(403).json({ message: "You are not a member of this team" });
      }

      const meetings = await storage.getTeamMeetingsByTeam(teamId);
      
      // Enrich with creator and team info
      const enrichedMeetings = await Promise.all(
        meetings.map(async (meeting) => {
          const creator = await storage.getUser(meeting.createdBy);
          return {
            ...meeting,
            creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : null,
            teamName: team.name,
          };
        })
      );

      res.json(enrichedMeetings);
    } catch (error: any) {
      console.error("Error fetching team meetings:", error);
      res.status(500).json({ message: "Failed to fetch meetings" });
    }
  });

  // Get user's meetings (across all teams)
  app.get("/api/my-meetings", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const meetings = await storage.getTeamMeetingsByUser(userId);

      // Enrich with team and creator info
      const enrichedMeetings = await Promise.all(
        meetings.map(async (meeting) => {
          const team = await storage.getTeam(meeting.teamId);
          const creator = await storage.getUser(meeting.createdBy);
          return {
            ...meeting,
            team: team ? { id: team.id, name: team.name } : null,
            creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : null,
          };
        })
      );

      res.json(enrichedMeetings);
    } catch (error: any) {
      console.error("Error fetching user meetings:", error);
      res.status(500).json({ message: "Failed to fetch meetings" });
    }
  });

  // Update team meeting
  app.patch("/api/teams/:teamId/meetings/:meetingId", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const currentUser = await storage.getUser(userId);
      const { teamId, meetingId } = req.params;
      const { title, agenda, date, time, durationMinutes, timezone, attendeeIds, sprintId, notes, momTitle, momDate, momDocument } = req.body;

      // Verify meeting exists and belongs to team
      const meeting = await storage.getTeamMeeting(meetingId);
      if (!meeting || meeting.teamId !== teamId) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      // Check permissions: creator or admin
      const isAdmin = currentUser?.role === "ADMIN";
      if (!isAdmin && meeting.createdBy !== userId) {
        return res.status(403).json({ message: "You can only update meetings you created" });
      }

      // Platform and link are editable so a mentor can correct a pasted link. Absent means
      // "leave as it is", which is what an older client sends.
      const currentPlatform = normaliseMeetingPlatform(meeting.meetingPlatform);
      const nextPlatform =
        req.body?.meetingPlatform === undefined
          ? currentPlatform
          : normaliseMeetingPlatform(req.body.meetingPlatform);
      const nextLink =
        typeof req.body?.meetingLink === "string" ? req.body.meetingLink.trim() : undefined;

      // Build update data
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (agenda !== undefined) updateData.agenda = agenda;
      if (date && time) {
        // No minimum notice, matching creation: a mentor logging a session they already ran must
        // be able to correct its time afterwards.
        updateData.scheduledAt = toUTCFromTimezone(date, time, timezone || "Asia/Kolkata");
      }

      // Switching to an external meeting needs a link; switching back to Google Meet would need a
      // fresh Meet link, which only gets minted when a calendar event is created, so that
      // direction is refused plainly instead of silently keeping the old link under a new label.
      if (currentPlatform === "OTHER" && nextPlatform === "GOOGLE_MEET") {
        return res.status(400).json({
          message:
            "This meeting cannot be switched to Google Meet. Cancel it and create a new Google Meet meeting instead.",
        });
      }
      if (nextPlatform !== currentPlatform) {
        updateData.meetingPlatform = nextPlatform;
      }
      if (nextLink !== undefined && nextPlatform === "OTHER") {
        const linkProblem = meetingLinkError(nextPlatform, nextLink);
        if (linkProblem) return res.status(400).json({ message: linkProblem });
        updateData.meetingLink = nextLink;
      }
      // Becoming external without ever supplying a link would leave learners a Google link for a
      // meeting no longer held there.
      if (nextPlatform === "OTHER" && !nextLink && !meeting.meetingLink) {
        return res.status(400).json({ message: "Paste the link learners should join." });
      }
      if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
      if (timezone !== undefined) updateData.timezone = timezone;
      if (attendeeIds !== undefined) {
        if (!Array.isArray(attendeeIds) || attendeeIds.length === 0) {
          return res.status(400).json({ message: "At least one attendee must be selected" });
        }
        updateData.attendeeIds = attendeeIds;
      }
      if (sprintId !== undefined) updateData.sprintId = sprintId;
      if (notes !== undefined) updateData.notes = notes;
      if (momTitle !== undefined) updateData.momTitle = momTitle;
      if (momDate !== undefined) updateData.momDate = momDate ? new Date(momDate) : null;
      if (momDocument !== undefined) updateData.momDocument = momDocument;

      // Update Google Calendar event if googleEventId exists and time/date changed
      if (meeting.googleEventId && (date || time || durationMinutes || timezone)) {
        try {
          const { updateEventDescription, deleteCalendarEvent, createTeamMeetingEvent } = await import("./services/calendar-service");
          
          // Get updated meeting data
          const finalDate = date || meeting.scheduledAt.toISOString().split('T')[0];
          const finalTime = time || meeting.scheduledAt.toISOString().split('T')[1].slice(0, 5);
          const finalDuration = durationMinutes || meeting.durationMinutes || 30;
          const finalTimezone = timezone || meeting.timezone || "Asia/Kolkata";
          const finalAttendeeIds = attendeeIds || meeting.attendeeIds || [];
          
          // Get attendee emails
          const attendeeEmails = await Promise.all(
            finalAttendeeIds.map(async (id: string) => {
              const user = await storage.getUser(id);
              return user?.email;
            })
          );
          const validEmails = attendeeEmails.filter(Boolean) as string[];
          const organizerEmail = currentUser?.email || "";

          // Delete old event and create new one
          await deleteCalendarEvent(meeting.googleEventId);
          const calendarResult = await createTeamMeetingEvent(
            finalDate,
            finalTime,
            updateData.title || meeting.title,
            updateData.agenda || meeting.agenda || meeting.title,
            validEmails,
            organizerEmail,
            finalDuration,
            finalTimezone
          );
          updateData.googleEventId = calendarResult.eventId;
          updateData.meetingLink = calendarResult.meetLink;
        } catch (calendarError) {
          console.error("Failed to update calendar event:", calendarError);
          // Continue without calendar update
        }
      } else if (agenda && meeting.googleEventId) {
        // Just update description if only agenda changed
        try {
          const { updateEventDescription } = await import("./services/calendar-service");
          await updateEventDescription(meeting.googleEventId, agenda);
        } catch (calendarError) {
          console.error("Failed to update calendar event description:", calendarError);
        }
      }

      const updated = await storage.updateTeamMeeting(meetingId, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      // Create notifications for attendees about update
      try {
        const finalAttendeeIds = attendeeIds || meeting.attendeeIds || [];
        const team = await storage.getTeam(teamId);
        for (const attendeeId of finalAttendeeIds) {
          if (attendeeId !== userId) {
            await storage.createNotification({
              userId: attendeeId,
              type: "TEAM_MEETING_UPDATED",
              status: "UNREAD",
              title: "Team Meeting Updated",
              message: `${currentUser?.name || "Someone"} updated the meeting: ${updated.title}`,
              metadataJson: {
                meetingId: updated.id,
                teamId: teamId,
                teamName: team?.name || "",
                scheduledAt: updated.scheduledAt.toISOString(),
              },
            });
          }
        }
      } catch (notificationError) {
        console.error("Failed to create update notifications:", notificationError);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating team meeting:", error);
      res.status(500).json({ message: "Failed to update meeting" });
    }
  });

  // Delete team meeting (soft delete)
  app.delete("/api/teams/:teamId/meetings/:meetingId", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const currentUser = await storage.getUser(userId);
      const { teamId, meetingId } = req.params;

      // Verify meeting exists and belongs to team
      const meeting = await storage.getTeamMeeting(meetingId);
      if (!meeting || meeting.teamId !== teamId) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      // Check permissions: creator or admin
      const isAdmin = currentUser?.role === "ADMIN";
      if (!isAdmin && meeting.createdBy !== userId) {
        return res.status(403).json({ message: "You can only delete meetings you created" });
      }

      // Delete Google Calendar event if exists
      if (meeting.googleEventId) {
        try {
          const { deleteCalendarEvent } = await import("./services/calendar-service");
          await deleteCalendarEvent(meeting.googleEventId);
        } catch (calendarError) {
          console.error("Failed to delete calendar event:", calendarError);
          // Continue with soft delete even if calendar deletion fails
        }
      }

      // Soft delete meeting
      const deleted = await storage.deleteTeamMeeting(meetingId);
      if (!deleted) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      // Create notifications for attendees about cancellation
      try {
        const team = await storage.getTeam(teamId);
        for (const attendeeId of meeting.attendeeIds || []) {
          if (attendeeId !== userId) {
            await storage.createNotification({
              userId: attendeeId,
              type: "TEAM_MEETING_CANCELLED",
              status: "UNREAD",
              title: "Team Meeting Cancelled",
              message: `${currentUser?.name || "Someone"} cancelled the meeting: ${meeting.title}`,
              metadataJson: {
                meetingId: meeting.id,
                teamId: teamId,
                teamName: team?.name || "",
                scheduledAt: meeting.scheduledAt.toISOString(),
              },
            });
          }
        }
      } catch (notificationError) {
        console.error("Failed to create cancellation notifications:", notificationError);
      }

      res.json({ message: "Meeting deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting team meeting:", error);
      res.status(500).json({ message: "Failed to delete meeting" });
    }
  });


  // =====================
  // Meeting session recordings
  //
  // A mentor runs a session on Zoom/Meet, then attaches the recording here. Everyone on the
  // team can watch it; an admin can watch any team's.
  //
  // The file never passes through this process. The browser PUTs it straight to S3 against a
  // presigned URL and plays it back from a signed GET, so a 1GB recording costs the container
  // nothing — it runs on a t3a.small whose root volume has already filled once and broken a
  // deploy. Only the object key is stored.
  // =====================

  /** Resolves the meeting, the caller's platform role, and whether they are on its team. */
  async function recordingContext(userId: string, teamId: string, meetingId: string) {
    const meeting = await storage.getTeamMeeting(meetingId);
    if (!meeting || meeting.teamId !== teamId || meeting.deletedAt) return null;

    const user = await storage.getUser(userId);
    const assignments = await storage.getRoleAssignmentsByTeam(teamId);
    const viewer = {
      userId,
      role: user?.role ?? null,
      isTeamMember: assignments.some((a) => a.userId === userId),
    };
    return { meeting, viewer };
  }

  // Step 1: hand the browser somewhere to PUT the file.
  app.post(
    "/api/teams/:teamId/meetings/:meetingId/recording/upload-url",
    requireAuth,
    async (req, res) => {
      try {
        const { teamId, meetingId } = req.params;
        const ctx = await recordingContext(req.session!.userId!, teamId, meetingId);
        if (!ctx) return res.status(404).json({ message: "Meeting not found" });

        if (!canUploadRecording(ctx.viewer)) {
          return res
            .status(403)
            .json({ message: "Only mentors on this team can upload a session recording" });
        }

        const { fileName, fileType, fileSize } = req.body || {};
        // Same function the file picker ran, so the message here matches what the browser said.
        const problem = recordingFileError(fileName, fileType, fileSize);
        if (problem) return res.status(400).json({ message: problem });

        const uniqueId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
        const objectKey = recordingObjectKey(teamId, meetingId, fileName, uniqueId);

        const { s3Storage } = await import("./s3");
        const uploadUrl = await s3Storage.getSignedUploadURL(
          objectKey,
          fileType || "video/mp4",
          RECORDING_UPLOAD_URL_TTL_SECONDS
        );

        res.json({ uploadUrl, objectKey });
      } catch (error: any) {
        console.error("Recording upload URL error:", error);
        res.status(500).json({ message: "Failed to start the upload" });
      }
    }
  );

  // Step 2: the browser reports the upload finished; attach it to the meeting.
  app.put("/api/teams/:teamId/meetings/:meetingId/recording", requireAuth, async (req, res) => {
    try {
      const { teamId, meetingId } = req.params;
      const userId = req.session!.userId!;
      const ctx = await recordingContext(userId, teamId, meetingId);
      if (!ctx) return res.status(404).json({ message: "Meeting not found" });

      if (!canUploadRecording(ctx.viewer)) {
        return res
          .status(403)
          .json({ message: "Only mentors on this team can upload a session recording" });
      }

      const { objectKey, fileName, contentType, durationSeconds } = req.body || {};
      if (!objectKey || typeof objectKey !== "string") {
        return res.status(400).json({ message: "objectKey is required" });
      }
      // The key must be one we issued for THIS meeting. Without this a mentor could attach any
      // object in the bucket — including another team's recording — by naming its key.
      if (!objectKey.startsWith(`meetings/recordings/${teamId}/${meetingId}/`)) {
        return res.status(400).json({ message: "That file does not belong to this meeting" });
      }

      const { s3Storage } = await import("./s3");
      // Read the size back from S3 rather than trusting what the client reported. A presigned
      // PUT carries no size condition, so the figure checked when the URL was issued was only
      // ever a declaration; this is the authoritative one. Over the cap, the object is deleted
      // rather than left to sit in the bucket being paid for.
      const stored = await s3Storage.getObjectMetadata(objectKey);
      if (!stored) {
        return res
          .status(400)
          .json({ message: "The upload did not complete. Please try again." });
      }
      if (stored.size > RECORDING_MAX_BYTES) {
        await s3Storage.deleteObject(objectKey);
        return res.status(400).json({
          message: `Recording is ${formatBytes(stored.size)} — the limit is ${formatBytes(RECORDING_MAX_BYTES)}.`,
        });
      }

      // Replacing an existing recording: drop the old object once the new one is verified, so a
      // superseded 800MB file is not paid for indefinitely.
      const previousKey = ctx.meeting.recordingObjectKey;

      const updated = await storage.updateTeamMeeting(meetingId, {
        recordingObjectKey: objectKey,
        recordingFileName: typeof fileName === "string" ? fileName.slice(0, 300) : null,
        recordingSizeBytes: stored.size,
        recordingContentType: stored.contentType ?? (typeof contentType === "string" ? contentType : null),
        recordingDurationSeconds:
          typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
            ? Math.round(durationSeconds)
            : null,
        recordingUploadedBy: userId,
        recordingUploadedAt: new Date(),
      });

      if (previousKey && previousKey !== objectKey) {
        await s3Storage.deleteObject(previousKey);
      }

      // Tell the team there is something to watch. Wrapped, and after the recording is already
      // saved: a notification that fails must never fail the upload it is reporting on. That
      // exact mistake made every evidence review return 500 while saving the review.
      try {
        const assignments = await storage.getRoleAssignmentsByTeam(teamId);
        const uploader = await storage.getUser(userId);
        await Promise.all(
          assignments
            .filter((a) => a.userId !== userId)
            .map((a) =>
              // TEAM_MEETING_UPDATED, not a recording-specific type: notification_type is a
              // Postgres enum, and adding a value to it needs ALTER TYPE ... ADD VALUE, which
              // cannot run inside a transaction and so does not belong in this migration. The
              // literal is deliberately not cast — `as any` on this field is precisely what let
              // an invalid value reach production and 500 every evidence review.
              storage.createNotification({
                userId: a.userId,
                type: "TEAM_MEETING_UPDATED",
                status: "UNREAD",
                title: "Session recording available",
                message: `${uploader?.name ?? "Your mentor"} uploaded the recording of "${ctx.meeting.title}".`,
                metadataJson: { teamId, meetingId, meetingTitle: ctx.meeting.title },
              })
            )
        );
      } catch (notifyError) {
        console.error("Recording notification error:", notifyError);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Attach recording error:", error);
      res.status(500).json({ message: "Failed to save the recording" });
    }
  });

  // Step 3: a signed URL to play it. Issued per request and short-lived, so a forwarded link
  // stops working rather than becoming a public copy of the session.
  app.get(
    "/api/teams/:teamId/meetings/:meetingId/recording/url",
    requireAuth,
    async (req, res) => {
      try {
        const { teamId, meetingId } = req.params;
        const ctx = await recordingContext(req.session!.userId!, teamId, meetingId);
        if (!ctx) return res.status(404).json({ message: "Meeting not found" });

        if (!canViewRecording(ctx.viewer)) {
          return res.status(403).json({ message: "You are not a member of this team" });
        }
        if (!ctx.meeting.recordingObjectKey) {
          return res.status(404).json({ message: "No recording has been uploaded yet" });
        }

        const { s3Storage } = await import("./s3");
        const url = await s3Storage.getSignedDownloadURL(
          ctx.meeting.recordingObjectKey,
          RECORDING_VIEW_URL_TTL_SECONDS
        );

        res.json({
          url,
          // So the player can refresh before the URL dies mid-watch instead of after.
          expiresInSeconds: RECORDING_VIEW_URL_TTL_SECONDS,
          fileName: ctx.meeting.recordingFileName,
          contentType: ctx.meeting.recordingContentType,
          durationSeconds: ctx.meeting.recordingDurationSeconds,
          sizeBytes: ctx.meeting.recordingSizeBytes,
        });
      } catch (error: any) {
        console.error("Recording view URL error:", error);
        res.status(500).json({ message: "Failed to open the recording" });
      }
    }
  );

  app.delete(
    "/api/teams/:teamId/meetings/:meetingId/recording",
    requireAuth,
    async (req, res) => {
      try {
        const { teamId, meetingId } = req.params;
        const ctx = await recordingContext(req.session!.userId!, teamId, meetingId);
        if (!ctx) return res.status(404).json({ message: "Meeting not found" });

        if (!canDeleteRecording(ctx.viewer, ctx.meeting)) {
          return res
            .status(403)
            .json({ message: "Only an admin or the mentor who uploaded it can remove a recording" });
        }
        if (!ctx.meeting.recordingObjectKey) {
          return res.status(404).json({ message: "No recording has been uploaded yet" });
        }

        const { s3Storage } = await import("./s3");
        await s3Storage.deleteObject(ctx.meeting.recordingObjectKey);

        // Cleared even if S3 refused: the row is what the team sees, and a card offering a
        // recording that cannot be fetched is worse than an object left in the bucket.
        const updated = await storage.updateTeamMeeting(meetingId, {
          recordingObjectKey: null,
          recordingFileName: null,
          recordingSizeBytes: null,
          recordingContentType: null,
          recordingDurationSeconds: null,
          recordingUploadedBy: null,
          recordingUploadedAt: null,
        });

        res.json(updated);
      } catch (error: any) {
        console.error("Delete recording error:", error);
        res.status(500).json({ message: "Failed to remove the recording" });
      }
    }
  );

  // =====================
  // Invoice Routes
  // =====================

  app.get("/api/invoices", requireAuth, async (req, res) => {
    const currentUser = await storage.getUser(req.session!.userId!);

    if (currentUser?.role === "ADMIN") {
      const invoices = await storage.getInvoices();
      return res.json(invoices);
    }

    const invoices = await storage.getInvoicesByUser(currentUser!.id);
    res.json(invoices);
  });

  app.get("/api/invoices/:id", requireAuth, async (req, res) => {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.json(invoice);
  });

  app.post("/api/invoices", requireRole("ADMIN"), async (req, res) => {
    try {
      const invoice = await storage.createInvoice(req.body);
      res.status(201).json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Failed to create invoice" });
    }
  });

  app.patch("/api/invoices/:id", requireRole("ADMIN"), async (req, res) => {
    const updated = await storage.updateInvoice(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.json(updated);
  });

  // =====================
  // Organization Routes
  // =====================

  app.get("/api/organizations", requireRole("ADMIN"), async (req, res) => {
    const { type } = req.query;
    if (type && typeof type === "string") {
      const orgs = await storage.getOrganizationsByType(type);
      return res.json(orgs);
    }
    const orgs = await storage.getOrganizations();
    res.json(orgs);
  });

  app.get("/api/organizations/:id", requireAuth, async (req, res) => {
    const org = await storage.getOrganization(req.params.id);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }
    res.json(org);
  });

  app.post("/api/organizations", requireRole("ADMIN"), async (req, res) => {
    try {
      const org = await storage.createOrganization(req.body);
      res.status(201).json(org);
    } catch (error) {
      res.status(400).json({ message: "Failed to create organization" });
    }
  });

  // =====================
  // MOU Routes
  // =====================

  app.get("/api/organizations/:orgId/mous", requireAuth, async (req, res) => {
    const mous = await storage.getMousByOrg(req.params.orgId);
    res.json(mous);
  });

  app.post("/api/mous", requireRole("ADMIN"), async (req, res) => {
    try {
      const mou = await storage.createMou(req.body);
      res.status(201).json(mou);
    } catch (error) {
      res.status(400).json({ message: "Failed to create MOU" });
    }
  });

  app.patch("/api/mous/:id", requireRole("ADMIN"), async (req, res) => {
    const updated = await storage.updateMou(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "MOU not found" });
    }
    res.json(updated);
  });

  // =====================
  // Certificate Routes
  // =====================

  app.get("/api/my-certificates", requireAuth, async (req, res) => {
    const certs = await storage.getCertificatesByUser(req.session!.userId!);
    res.json(certs);
  });

  app.post("/api/certificates", requireRole("ADMIN"), async (req, res) => {
    try {
      const cert = await storage.createCertificate(req.body);
      res.status(201).json(cert);
    } catch (error) {
      res.status(400).json({ message: "Failed to create certificate" });
    }
  });

  // =====================
  // Blog Routes
  // =====================

  app.get("/api/blog", async (req, res) => {
    const posts = await storage.getPublishedBlogPosts();
    res.json(posts);
  });

  app.get("/api/blog/:slug", async (req, res) => {
    const post = await storage.getBlogPostBySlug(req.params.slug);
    if (!post) {
      return res.status(404).json({ message: "Blog post not found" });
    }
    res.json(post);
  });

  app.post("/api/blog", requireRole("ADMIN"), async (req, res) => {
    try {
      const post = await storage.createBlogPost(req.body);
      res.status(201).json(post);
    } catch (error) {
      res.status(400).json({ message: "Failed to create blog post" });
    }
  });

  app.patch("/api/blog/:id", requireRole("ADMIN"), async (req, res) => {
    const updated = await storage.updateBlogPost(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Blog post not found" });
    }
    res.json(updated);
  });

  // =====================
  // FAQ Routes
  // =====================

  app.get("/api/faqs", async (req, res) => {
    const faqs = await storage.getFaqs();
    res.json(faqs);
  });

  app.post("/api/faqs", requireRole("ADMIN"), async (req, res) => {
    try {
      const faq = await storage.createFaq(req.body);
      res.status(201).json(faq);
    } catch (error) {
      res.status(400).json({ message: "Failed to create FAQ" });
    }
  });

  app.patch("/api/faqs/:id", requireRole("ADMIN"), async (req, res) => {
    const updated = await storage.updateFaq(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "FAQ not found" });
    }
    res.json(updated);
  });

  app.delete("/api/faqs/:id", requireRole("ADMIN"), async (req, res) => {
    await storage.deleteFaq(req.params.id);
    res.json({ message: "FAQ deleted" });
  });

  // =====================
  // Contact Form
  // =====================

  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, phone, subject, message } = req.body;

      // Validate required fields
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: "Name, email, subject, and message are required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      // Send email using the email service
      const { sendContactFormEmail } = await import("./services/email-service");
      await sendContactFormEmail(name, email, phone || null, subject, message);

      res.status(200).json({ message: "Your message has been sent successfully. We'll get back to you within 24-48 hours." });
    } catch (error: any) {
      console.error("Error processing contact form:", error);
      res.status(500).json({ message: "Failed to send message. Please try again later." });
    }
  });

  // =====================
  // Dashboard Stats (Admin)
  // =====================

  // Import problem statements from S3
  app.post("/api/admin/import-problem-statements", requireRole("ADMIN"), async (req, res) => {
    try {
      const { loadProblemStatementsFromS3 } = await import("../scripts/load-problem-statements-from-s3");
      await loadProblemStatementsFromS3();
      res.json({ message: "Problem statements imported successfully" });
    } catch (error: any) {
      console.error("Import error:", error);
      res.status(500).json({ message: `Failed to import: ${error.message}` });
    }
  });

  // Founder stats endpoint
  app.get("/api/founder/stats", requireRole("FOUNDER", "COFOUNDER"), async (req, res) => {
    try {
      console.log("🔍 /api/founder/stats - Request received");
      const userId = req.session!.userId!;
      console.log("👤 User ID:", userId);

      // Get founder's team
      const assignments = await storage.getRoleAssignmentsByUser(userId);
      const team = assignments.length > 0 ? await storage.getTeam(assignments[0].teamId) : null;

      // Get team member applications sent by founder
      const applications = await storage.getTeamMemberApplicationsByFounder(userId);
      const pendingApplications = applications.filter(a => a.status === "PENDING");
      const acceptedApplications = applications.filter(a => a.status === "ACCEPTED");

      // Get team members if team exists
      let teamMembers = [];
      if (team) {
        const teamAssignments = await storage.getRoleAssignmentsByTeam(team.id);
        teamMembers = await Promise.all(
          teamAssignments.map(async (a) => {
            const user = await storage.getUser(a.userId);
            return {
              id: a.userId,
              name: user?.name || "Unknown",
              role: a.role,
              email: user?.email || "",
            };
          })
        );
      }

      res.json({
        hasTeam: !!team,
        teamName: team?.name || null,
        teamMembers: teamMembers.length,
        pendingApplications: pendingApplications.length,
        acceptedApplications: acceptedApplications.length,
        totalApplications: applications.length,
        cofoundersApplied: applications.filter(a => a.targetUserRole === "COFOUNDER").length,
        mentorsApplied: applications.filter(a => a.targetUserRole === "MENTOR").length,
        learnersApplied: applications.filter(a => a.targetUserRole === "LEARNER").length,
      });
    } catch (error: any) {
      console.error("Error fetching founder stats:", error);
      res.status(500).json({ message: "Failed to fetch founder stats" });
    }
  });

  app.get("/api/admin/stats", requireRole("ADMIN"), async (req, res) => {
    try {
      console.log("🔍 /api/admin/stats - Session:", {
        sessionId: req.sessionID,
        userId: req.session?.userId,
      });

      // Check database connection first
      try {
        const { pool } = await import("./db");
        await pool.query("SELECT 1");
        console.log("✅ Database connection verified");
      } catch (dbError: any) {
        console.error("❌ Database connection failed:", dbError);
        return res.status(500).json({
          message: "Database connection failed",
          error: dbError.message || "Cannot connect to database",
          hint: "Check DATABASE_URL environment variable and database accessibility"
        });
      }

      const [users, applications, teams, cohorts] = await Promise.all([
        storage.getUsers(),
        storage.getApplications(),
        storage.getTeams(),
        storage.getCohorts(),
      ]);

      console.log("✅ Stats data:", {
        users: users.length,
        applications: applications.length,
        teams: teams.length,
        cohorts: cohorts.length,
      });

      const stats = {
        totalUsers: users.length,
        totalApplications: applications.length,
        pendingApplications: applications.filter(a => a.status === "NEW" || a.status === "REVIEW").length,
        totalTeams: teams.length,
        activeCohorts: cohorts.filter(c => c.isActive).length,
        usersByRole: {
          learners: users.filter(u => u.role === "LEARNER").length,
          mentors: users.filter(u => u.role === "MENTOR").length,
          admins: users.filter(u => u.role === "ADMIN").length,
        },
        applicationsByStatus: {
          new: applications.filter(a => a.status === "NEW").length,
          review: applications.filter(a => a.status === "REVIEW").length,
          offer: applications.filter(a => a.status === "OFFER").length,
          paid: applications.filter(a => a.status === "PAID").length,
          reject: applications.filter(a => a.status === "REJECT").length,
        },
      };

      res.json(stats);
    } catch (error: any) {
      console.error("❌ /api/admin/stats error:", error);
      console.error("Error stack:", error.stack);
      console.error("Error fetching stats:", error);
      res.status(500).json({
        message: "Failed to fetch stats"
      });
    }
  });

  // Get recent applications for admin dashboard
  app.get("/api/admin/recent-applications", requireRole("ADMIN"), async (req, res) => {
    try {
      const applications = await storage.getApplications();
      const recentApps = applications
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(app => {
          const formData = app.formJson as any;
          return {
            id: app.id,
            name: formData?.fullName || formData?.contactPerson || formData?.institutionName || "Unknown",
            email: formData?.email || formData?.contactEmail || "N/A",
            type: app.type,
            status: app.status,
            createdAt: app.createdAt,
          };
        });
      res.json(recentApps);
    } catch (error: any) {
      console.error("❌ /api/admin/recent-applications error:", error);
      console.error("Error fetching recent applications:", error);
      res.status(500).json({
        message: "Failed to fetch recent applications"
      });
    }
  });

  // Get cohort dashboard stats (for active cohort)
  app.get("/api/admin/cohort-stats", requireRole("ADMIN"), async (req, res) => {
    try {
      console.log("🔍 /api/admin/cohort-stats - Session:", {
        sessionId: req.sessionID,
        userId: req.session?.userId,
      });

      // Check database connection first
      try {
        const { pool } = await import("./db");
        await pool.query("SELECT 1");
        console.log("✅ Database connection verified");
      } catch (dbError: any) {
        console.error("❌ Database connection failed:", dbError);
        return res.status(500).json({
          message: "Failed to fetch cohort stats",
          error: "Database connection failed",
          details: dbError.message || "Cannot connect to database",
          hint: "Check DATABASE_URL environment variable and database accessibility"
        });
      }

      // Get the active cohort
      console.log("🔍 Fetching active cohorts...");
      const activeCohorts = await storage.getActiveCohorts();
      console.log(`✅ Found ${activeCohorts.length} active cohort(s)`);
      if (activeCohorts.length === 0) {
        return res.json({
          name: "No Active Cohort",
          currentSprint: 0,
          totalSprints: 8,
          weeksRemaining: 0,
          teamHealth: { green: 0, amber: 0, red: 0 },
          seedDeployed: 0,
          stipendsDisbursed: 0,
        });
      }

      const cohort = activeCohorts[0];
      const [teams, applications] = await Promise.all([
        storage.getTeamsByCohort(cohort.id),
        storage.getApplicationsByCohort(cohort.id),
      ]);

      // Calculate team health using the same logic as team metrics
      let greenTeams = 0, amberTeams = 0, redTeams = 0;
      const { getTeamHealthMetrics } = await import("./team-health-calculator.js");

      for (const team of teams) {
        try {
          const teamMetrics = await getTeamHealthMetrics(team.id);
          const healthStatus = teamMetrics.healthStatus;
          if (healthStatus === "G") greenTeams++;
          else if (healthStatus === "A") amberTeams++;
          else if (healthStatus === "R") redTeams++;
          else greenTeams++; // default to green
        } catch (error) {
          console.error(`Error calculating health for team ${team.id}:`, error);
          greenTeams++; // default to green on error
        }
      }

      // Calculate seed deployed and stipends
      let seedDeployed = 0;
      let stipendsDisbursed = 0;
      for (const team of teams) {
        const seedFund = await storage.getSeedFundByTeam(team.id);
        if (seedFund) {
          seedDeployed += parseFloat(seedFund.amount || "0");
        }
        const stipends = await storage.getStipendDisbursementsByTeam(team.id);
        for (const s of stipends) {
          if (s.status === "RELEASED") {
            stipendsDisbursed += parseFloat(s.amount || "0");
          }
        }
      }

      // Calculate current sprint number from teams' sprints
      let maxSprintCompleted = 0;
      for (const team of teams) {
        const sprints = await storage.getSprintsByTeam(team.id);
        const passedSprints = sprints.filter(s => s.passed).length;
        if (passedSprints > maxSprintCompleted) {
          maxSprintCompleted = passedSprints;
        }
      }

      // Calculate weeks remaining
      const now = new Date();
      const endDate = new Date(cohort.endDate);
      const weeksRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)));

      const stats = {
        name: cohort.name,
        currentSprint: maxSprintCompleted + 1,
        totalSprints: 8,
        weeksRemaining,
        teamHealth: {
          green: greenTeams,
          amber: amberTeams,
          red: redTeams,
        },
        seedDeployed,
        stipendsDisbursed,
      };

      console.log("✅ Cohort stats calculated successfully");
      res.json(stats);
    } catch (error: any) {
      console.error("❌ Cohort stats error:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      console.error("Error fetching cohort stats:", error);
      res.status(500).json({
        message: "Failed to fetch cohort stats"
      });
    }
  });

  // Get cohort dashboard stats (by cohort ID)
  app.get("/api/admin/cohort-stats/:cohortId", requireRole("ADMIN"), async (req, res) => {
    try {
      const cohort = await storage.getCohort(req.params.cohortId);
      if (!cohort) {
        return res.status(404).json({ message: "Cohort not found" });
      }

      const [teams, applications] = await Promise.all([
        storage.getTeamsByCohort(req.params.cohortId),
        storage.getApplicationsByCohort(req.params.cohortId),
      ]);

      // Calculate team health using the same logic as team metrics
      let greenTeams = 0, amberTeams = 0, redTeams = 0;
      const { getTeamHealthMetrics } = await import("./team-health-calculator.js");

      for (const team of teams) {
        try {
          const teamMetrics = await getTeamHealthMetrics(team.id);
          const healthStatus = teamMetrics.healthStatus;
          if (healthStatus === "G") greenTeams++;
          else if (healthStatus === "A") amberTeams++;
          else if (healthStatus === "R") redTeams++;
          else greenTeams++; // default to green
        } catch (error) {
          console.error(`Error calculating health for team ${team.id}:`, error);
          greenTeams++; // default to green on error
        }
      }

      // Calculate seed deployed and stipends
      let seedDeployed = 0;
      let stipendsDisbursed = 0;
      for (const team of teams) {
        const seedFund = await storage.getSeedFundByTeam(team.id);
        if (seedFund) {
          seedDeployed += parseFloat(seedFund.amount || "0");
        }
        const stipends = await storage.getStipendDisbursementsByTeam(team.id);
        for (const s of stipends) {
          if (s.status === "RELEASED") {
            stipendsDisbursed += parseFloat(s.amount || "0");
          }
        }
      }

      // Get learner count from role assignments
      let learnerCount = 0;
      let mentorCount = 0;
      for (const team of teams) {
        const assignments = await storage.getRoleAssignmentsByTeam(team.id);
        for (const a of assignments) {
          const user = await storage.getUser(a.userId);
          if (user?.role === "LEARNER") learnerCount++;
          if (user?.role === "MENTOR") mentorCount++;
        }
      }

      // Calculate current sprint number from teams' sprints
      let maxSprintCompleted = 0;
      for (const team of teams) {
        const sprints = await storage.getSprintsByTeam(team.id);
        const passedSprints = sprints.filter(s => s.passed).length;
        if (passedSprints > maxSprintCompleted) {
          maxSprintCompleted = passedSprints;
        }
      }

      // Calculate weeks remaining
      const now = new Date();
      const endDate = new Date(cohort.endDate);
      const weeksRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)));

      const stats = {
        name: cohort.name,
        currentSprint: maxSprintCompleted + 1,
        totalSprints: 8,
        weeksRemaining,
        teamHealth: {
          green: greenTeams,
          amber: amberTeams,
          red: redTeams,
        },
        seedDeployed,
        stipendsDisbursed,
      };

      res.json(stats);
    } catch (error) {
      console.error("Cohort stats error:", error);
      res.status(500).json({ message: "Failed to fetch cohort stats" });
    }
  });

  // =====================
  // Learner Dashboard APIs
  // =====================

  // Get learner's team information
  app.get("/api/my-team", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const assignments = await storage.getRoleAssignmentsByUser(userId);

      if (assignments.length === 0) {
        return res.json(null);
      }

      // Pick the team to show. assignments is newest-first, but "newest" is not
      // necessarily the one the member cares about: a learner who sits on more
      // than one team was being shown an arbitrary team, and with it the wrong
      // problem statement or none at all. Prefer the most recent team that
      // actually has a problem statement, and only fall back to the newest
      // assignment when none of them do.
      const { assignment: chosenAssignment, team: chosenTeam } =
        await primaryTeamForUser(userId);
      const assignment = chosenAssignment ?? assignments[0];
      const team = chosenTeam;

      if (!team) {
        return res.json(null);
      }

      // Get team members with all available data
      const teamAssignments = await storage.getRoleAssignmentsByTeam(team.id);
      const members = await Promise.all(
        teamAssignments.map(async (a) => {
          const user = await storage.getUser(a.userId);
          if (!user) {
            return {
              id: a.userId,
              name: "Unknown",
              email: "",
              role: a.role,
              band: a.stipendBand,
              userRole: undefined,
            };
          }

          // Get mentor profile if user is a mentor
          let mentorProfile = null;
          if (user.role === "MENTOR") {
            mentorProfile = await storage.getMentorProfileByUserId(a.userId);
          }

          return {
            id: a.userId,
            name: user.name || "Unknown",
            email: user.email || "",
            phone: user.phone || undefined,
            role: a.role,
            band: a.stipendBand,
            userRole: user.role, // Include actual user role (FOUNDER, COFOUNDER, MENTOR, LEARNER)
            avatarUrl: user.avatarUrl || undefined,
            bio: mentorProfile?.description || mentorProfile?.aboutMentor || undefined,
            specialization: mentorProfile?.skills ? (Array.isArray(mentorProfile.skills) ? mentorProfile.skills.join(", ") : mentorProfile.skills) : undefined,
          };
        })
      );

      // Get user's cap table entry for equity info
      const capTable = await storage.getCapTableByTeam(team.id);
      const userEntry = capTable.find(e => e.userId === userId);

      // Get problem statement for track info (founder's uploaded & admin-approved)
      let problemStatementId = team.problemStatementId;
      let problem = problemStatementId ? await storage.getProblemStatement(problemStatementId) : null;

      // Fallback 1: if team has no problemStatementId but a published problem statement is linked
      // to this team (teamId), use it so team members can see founder's problem statement
      if (!problem && !problemStatementId) {
        const psByTeam = await storage.getProblemStatementByTeamId(team.id);
        if (psByTeam) {
          problemStatementId = psByTeam.id;
          problem = psByTeam;
          await storage.updateTeam(team.id, { problemStatementId: psByTeam.id });
        }
      }

      // Fallback 2 (backfill): if still no problem, try to find the founder's published PS and link it
      if (!problem && !problemStatementId) {
        try {
          const founderMember = members.find(m => m.userRole === "FOUNDER");
          if (founderMember) {
            const founderPublished = await storage.getProblemStatements({
              status: "PUBLISHED",
              createdBy: founderMember.id,
            });

            // If founder has exactly one published PS, automatically link it to this team
            if (founderPublished.length === 1) {
              const ps = founderPublished[0];
              await storage.updateProblemStatement(ps.id, { teamId: team.id });
              await storage.updateTeam(team.id, { problemStatementId: ps.id });
              problemStatementId = ps.id;
              problem = ps;
              console.log("✅ Auto-linked founder's published problem statement to team from /api/my-team", {
                teamId: team.id,
                problemStatementId: ps.id,
              });
            }
          }
        } catch (err) {
          console.error("⚠️ Failed to auto-link founder problem statement in /api/my-team:", err);
        }
      }

      res.json({
        id: team.id,
        name: team.name,
        track: problem?.track || "EduTech",
        healthStatus: team.health === "G" ? "Green" : team.health === "A" ? "Amber" : "Red",
        problemStatementId: problemStatementId ?? team.problemStatementId,
        userRole: assignment.role,
        userBand: assignment.stipendBand,
        userEquity: userEntry?.percent || "0",
        members,
      });
    } catch (error) {
      console.error("My team error:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  // Get learner's current sprint information
  app.get("/api/my-sprint", requireAuth, async (req, res) => {
    const empty = () => res.json({ sprint: null, tasks: [], totalSprints: 0, completedTasks: 0, totalTasks: 0 });
    try {
      const userId = req.session!.userId!;
      const assignments = await storage.getRoleAssignmentsByUser(userId);

      if (!assignments?.length) {
        return empty();
      }

      const teamId = assignments[0].teamId;
      let sprints: any[] = [];
      try {
        sprints = await storage.getSprintsByTeam(teamId);
      } catch (err: any) {
        console.error("My sprint getSprintsByTeam error:", err?.message || err, err?.stack);
        return empty();
      }

      if (!sprints?.length) {
        return empty();
      }

      const currentSprint = sprints.find((s: any) => !s.passed) || sprints[sprints.length - 1];
      if (!currentSprint) {
        return empty();
      }

      let allTasks: any[] = [];
      try {
        allTasks = await storage.getTasksBySprint(currentSprint.id);
      } catch (err: any) {
        console.error("My sprint getTasksBySprint error:", err?.message || err, err?.stack);
      }

      const completedTasksList = allTasks.filter((t: any) => t.status === "DONE");
      const startVal = currentSprint.startDate != null ? new Date(currentSprint.startDate) : null;
      const endVal = currentSprint.endDate != null ? new Date(currentSprint.endDate) : null;
      const today = new Date();
      const endDate = endVal || today;
      const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

      let status = "ACTIVE";
      if (startVal && today < startVal) status = "PLANNING";
      else if (endVal && today > endVal) status = "REVIEW";
      if (currentSprint.passed) status = "COMPLETED";

      const startDateStr = currentSprint.startDate instanceof Date ? currentSprint.startDate.toISOString() : currentSprint.startDate;
      const endDateStr = currentSprint.endDate instanceof Date ? currentSprint.endDate.toISOString() : currentSprint.endDate;
      const passedAtStr = currentSprint.passedAt != null && currentSprint.passedAt instanceof Date ? currentSprint.passedAt.toISOString() : currentSprint.passedAt;

      res.json({
        sprint: {
          id: currentSprint.id,
          index: currentSprint.index,
          number: currentSprint.index,
          title: currentSprint.goals || `Sprint ${currentSprint.index}`,
          startDate: startDateStr,
          endDate: endDateStr,
          passed: currentSprint.passed ?? false,
          passedAt: passedAtStr || null,
          status,
          demoUrl: currentSprint.demoUrl ?? null,
          demoNotes: currentSprint.demoNotes ?? null,
          daysLeft,
        },
        tasks: await Promise.all((allTasks || []).map(async (t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description ?? null,
          status: t.status,
          assigneeId: t.assigneeId ?? null,
          // Without this a learner who is only in assigneeIds (a shared task)
          // looks like a non-assignee to the board, so the submit flow never
          // offers them the evidence dialog.
          assigneeIds: normalizeTaskAssigneeIds(t.assigneeIds),
          assignedBy: t.assignedBy ?? null,
          submissionProgress: await taskSubmissionProgress(t),
          points: t.points ?? 1,
          priority: t.priority ?? "MEDIUM",
          objectives: t.objectives ?? null,
          deliverables: t.deliverables ?? null,
          startDate: t.startDate != null && t.startDate instanceof Date ? t.startDate.toISOString() : t.startDate ?? null,
          endDate: t.endDate != null && t.endDate instanceof Date ? t.endDate.toISOString() : t.endDate ?? null,
          reviewerId: t.reviewerId ?? null,
          reviewComment: t.reviewComment ?? null,
        }))),
        totalSprints: sprints.length,
        completedTasks: completedTasksList.length,
        totalTasks: (allTasks || []).length,
      });
    } catch (error: any) {
      console.error("My sprint error:", error?.message || error, error?.stack);
      return empty();
    }
  });

  // Get learner's tasks
  // Get learner's stipend information
  app.get("/api/my-stipends", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const disbursements = await storage.getStipendDisbursementsByUser(userId);

      // Get user's band from their role assignment
      const assignments = await storage.getRoleAssignmentsByUser(userId);
      const band = assignments[0]?.stipendBand || "C";

      // Get stipend rule for this band
      const rule = await storage.getStipendRuleByBand(band);
      const monthlyAmount = rule?.monthlyAmount || (band === "A" ? "25000" : band === "B" ? "20000" : "10000");

      const released = disbursements.filter(d => d.status === "RELEASED");
      const pending = disbursements.filter(d => d.status === "PENDING");
      const totalReleased = released.reduce((sum, d) => sum + parseFloat(d.amount || "0"), 0);

      res.json({
        band,
        monthlyAmount,
        totalReleased,
        nextDueDate: pending[0]?.month || null,
        disbursements: disbursements.map(d => ({
          id: d.id,
          month: d.month,
          amount: d.amount,
          status: d.status,
        })),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stipends" });
    }
  });

  // =====================
  // Mentor Dashboard APIs
  // =====================

  // Get mentor's assigned teams
  app.get("/api/mentor/teams", requireRole("MENTOR"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const assignments = await storage.getRoleAssignmentsByUser(userId);

      // Filter to only include teams where mentor has "Mentor" or "Promoter" role
      // This ensures mentors only see teams they are actually mentoring (max 2 teams)
      const mentorAssignments = assignments.filter(a => a.role === "Mentor" || a.role === "Promoter");

      const teams = await Promise.all(
        mentorAssignments.map(async (a) => {
          const team = await storage.getTeam(a.teamId);
          if (!team) return null;

          const sprints = await storage.getSprintsByTeam(team.id);
          const currentSprint = sprints.find(s => !s.passed) || sprints[sprints.length - 1];

          const members = await storage.getRoleAssignmentsByTeam(team.id);
          const learnerCount = members.filter(m => m.role !== "Mentor" && m.role !== "Promoter").length;

          // Get problem statement for track info
          const problem = team.problemStatementId ? await storage.getProblemStatement(team.problemStatementId) : null;

          return {
            id: team.id,
            name: team.name,
            track: problem?.track || "EduTech",
            healthStatus: team.health === "G" ? "Green" : team.health === "A" ? "Amber" : "Red",
            memberCount: learnerCount,
            currentSprint: currentSprint?.index || 1,
            problemStatementId: team.problemStatementId,
          };
        })
      );

      res.json(teams.filter(Boolean));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch mentor teams" });
    }
  });

  // Get mentor's pending reviews
  app.get("/api/mentor/reviews", requireRole("MENTOR"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const reviews = await storage.getReviewsByMentor(userId);

      // Get pending (not yet submitted) reviews - those without scores
      const pendingReviews = reviews.filter(r => !r.score);

      const enrichedReviews = await Promise.all(
        pendingReviews.slice(0, 10).map(async (r) => {
          const sprint = await storage.getSprint(r.sprintId);
          const team = sprint ? await storage.getTeam(sprint.teamId) : null;

          return {
            id: r.id,
            teamName: team?.name || "Unknown Team",
            sprintNumber: sprint?.index || 0,
            notes: r.notes || "",
            dueDate: sprint?.endDate,
          };
        })
      );

      res.json(enrichedReviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Get mentor's sprints across all assigned teams
  app.get("/api/mentor/sprints", requireRole("MENTOR"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const assignments = await storage.getRoleAssignmentsByUser(userId);

      const sprintsWithTeam = await Promise.all(
        assignments.map(async (a) => {
          const team = await storage.getTeam(a.teamId);
          if (!team) return [];

          const sprints = await storage.getSprintsByTeam(team.id);
          return sprints.map(s => ({
            ...s,
            teamName: team.name,
            teamId: team.id,
          }));
        })
      );

      res.json(sprintsWithTeam.flat());
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sprints" });
    }
  });

  // Get mentor's sessions
  app.get("/api/mentor/sessions", requireRole("MENTOR"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sessions = await storage.getMentorSessionsByMentor(userId);

      const enrichedSessions = await Promise.all(
        sessions.map(async (s) => {
          const team = await storage.getTeam(s.teamId);
          return {
            ...s,
            teamName: team?.name || "Unknown Team",
          };
        })
      );

      res.json(enrichedSessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  // Create mentor session
  app.post("/api/mentor/sessions", requireRole("MENTOR"), async (req, res) => {
    try {
      const { teamId, sprintId, occurredAt, durationMinutes, sessionType, notes, attendeeIds } =
        req.body || {};

      if (!teamId) return res.status(400).json({ message: "A team is required" });

      // Named fields rather than a spread of req.body. The spread let a caller set any column on
      // the row, and silently dropped anything that matched none — which is how the session type
      // was being lost: the client posted `type`, there is no `type` column, and Drizzle ignored
      // it, so every session was filed as the default "check-in".
      const when = occurredAt ? new Date(occurredAt) : new Date();
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ message: "That session date could not be read" });
      }

      const session = await storage.createMentorSession({
        mentorId: req.session!.userId!,
        teamId,
        sprintId: sprintId || null,
        occurredAt: when,
        durationMinutes: Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 60,
        sessionType: typeof sessionType === "string" && sessionType ? sessionType : "check-in",
        notes: typeof notes === "string" ? notes : null,
        attendeeIds: Array.isArray(attendeeIds) ? attendeeIds : null,
      });
      res.status(201).json(session);
    } catch (error) {
      // Logged. This used to answer 400 with a fixed string and no trace of the cause, so a
      // failure here left nothing to diagnose from.
      console.error("Create mentor session error:", error);
      res.status(400).json({ message: "Failed to create session" });
    }
  });

  // Update mentor session
  app.patch("/api/mentor/sessions/:id", requireRole("MENTOR"), async (req, res) => {
    const updated = await storage.updateMentorSession(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json(updated);
  });

  // Delete mentor session
  app.delete("/api/mentor/sessions/:id", requireRole("MENTOR"), async (req, res) => {
    await storage.deleteMentorSession(req.params.id);
    res.json({ message: "Session deleted" });
  });

  // Get mentor's honorariums
  app.get("/api/mentor/honorariums", requireRole("MENTOR"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const honorariums = await storage.getMentorHonorariumsByMentor(userId);
      res.json(honorariums);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch honorariums" });
    }
  });

  // Generate honorarium calculation for a mentor
  app.post("/api/mentor/honorariums/calculate", requireRole("ADMIN"), async (req, res) => {
    try {
      const { mentorId, month, hourlyRate = 1000 } = req.body;

      const sessions = await storage.getMentorSessionsByMentor(mentorId);
      const monthSessions = sessions.filter(s => s.occurredAt.toISOString().slice(0, 7) === month);

      const totalMinutes = monthSessions.reduce((sum, s) => sum + (s.durationMinutes || 60), 0);
      const totalHours = totalMinutes / 60;
      const amount = totalHours * hourlyRate;

      const honorarium = await storage.createMentorHonorarium({
        mentorId,
        month,
        sessionsCount: monthSessions.length,
        totalHours: totalHours.toString(),
        amount: amount.toString(),
        status: "PENDING",
      });

      res.status(201).json(honorarium);
    } catch (error) {
      res.status(400).json({ message: "Failed to calculate honorarium" });
    }
  });

  // Export honorariums as CSV
  app.get("/api/mentor/honorariums/export", requireRole("ADMIN"), async (req, res) => {
    try {
      const { month } = req.query;

      // Get all mentors
      const mentors = await storage.getUsersByRole("MENTOR");

      // Build CSV data
      let csvContent = "Mentor Name,Email,Month,Sessions,Total Hours,Amount,Status\n";

      for (const mentor of mentors) {
        const honorariums = await storage.getMentorHonorariumsByMentor(mentor.id);
        const filtered = month
          ? honorariums.filter(h => h.month === month)
          : honorariums;

        for (const h of filtered) {
          csvContent += `"${mentor.name}","${mentor.email}","${h.month}",${h.sessionsCount},"${h.totalHours}","${h.amount}","${h.status}"\n`;
        }

        // If no honorarium exists for this month but mentor has sessions
        if (month && filtered.length === 0) {
          const sessions = await storage.getMentorSessionsByMentor(mentor.id);
          const monthSessions = sessions.filter(s => s.occurredAt.toISOString().slice(0, 7) === month);
          if (monthSessions.length > 0) {
            const totalMinutes = monthSessions.reduce((sum, s) => sum + (s.durationMinutes || 60), 0);
            const totalHours = (totalMinutes / 60).toFixed(2);
            const amount = (parseFloat(totalHours) * 1000).toFixed(2);
            csvContent += `"${mentor.name}","${mentor.email}","${month}",${monthSessions.length},"${totalHours}","${amount}","NOT_CALCULATED"\n`;
          }
        }
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="honorariums-${month || "all"}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ message: "Failed to export honorariums" });
    }
  });

  // Update honorarium status
  app.patch("/api/mentor/honorariums/:id", requireRole("ADMIN"), async (req, res) => {
    const updated = await storage.updateMentorHonorarium(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Honorarium not found" });
    }
    res.json(updated);
  });

  // =====================
  // University Dashboard APIs
  // =====================

  // Get university stats
  app.get("/api/university/stats", requireRole("UNIVERSITY"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const user = await storage.getUser(userId);

      if (!user?.orgId) {
        return res.json({
          studentsEnrolled: 0,
          teamsFormed: 0,
          creditsEarned: 0,
          mouStatus: "Pending",
          students: [],
        });
      }

      // Get users from this organization
      const orgUsers = await storage.getUsersByOrg(user.orgId);
      const learners = orgUsers.filter(u => u.role === "LEARNER");

      // Get MoU status
      const mous = await storage.getMousByOrg(user.orgId);
      const activeMou = mous.find(m => m.status === "ACTIVE");

      // Get credit maps (programHours is the field name in schema)
      const creditMaps = await storage.getCreditMapsByOrg(user.orgId);
      const totalCredits = creditMaps.reduce((sum, cm) => sum + (cm.programHours || 0), 0);

      // Get teams with university students
      const teamIds = new Set<string>();
      for (const learner of learners) {
        const assignments = await storage.getRoleAssignmentsByUser(learner.id);
        assignments.forEach(a => teamIds.add(a.teamId));
      }

      // Get student details with team info
      const students = await Promise.all(
        learners.slice(0, 20).map(async (s) => {
          const assignments = await storage.getRoleAssignmentsByUser(s.id);
          const team = assignments[0] ? await storage.getTeam(assignments[0].teamId) : null;

          return {
            id: s.id,
            name: s.name,
            teamName: team?.name || "Unassigned",
            role: assignments[0]?.role || "Pending",
            healthStatus: team?.health === "G" ? "Green" : team?.health === "A" ? "Amber" : team?.health === "R" ? "Red" : "Green",
          };
        })
      );

      res.json({
        studentsEnrolled: learners.length,
        teamsFormed: teamIds.size,
        creditsEarned: totalCredits,
        mouStatus: activeMou ? "Active" : "Pending",
        students,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch university stats" });
    }
  });

  // =====================
  // Corporate Dashboard APIs
  // =====================

  // Get corporate stats
  app.get("/api/corporate/stats", requireRole("CORPORATE"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const user = await storage.getUser(userId);

      if (!user?.orgId) {
        return res.json({
          challengesSponsored: 0,
          teamsParticipating: 0,
          pilotsInProgress: 0,
          challenges: [],
        });
      }

      // Get all problem statements (corporates can view all as potential sponsors)
      const allProblems = await storage.getProblemStatements();

      // For now, show a subset of problems as "sponsored" (could be enhanced with a sponsorOrgId field later)
      const corporateProblems = allProblems.slice(0, 3);

      // Get teams working on these problems
      const teams = await storage.getTeams();
      const relevantTeams = teams.filter(t =>
        corporateProblems.some(p => p.id === t.problemStatementId)
      );

      const challenges = await Promise.all(
        corporateProblems.map(async (p) => {
          const problemTeams = relevantTeams.filter(t => t.problemStatementId === p.id);

          return {
            id: p.id,
            title: p.title,
            track: p.track,
            teamsCount: problemTeams.length,
            status: problemTeams.length > 0 ? "Active" : "Open",
          };
        })
      );

      res.json({
        challengesSponsored: corporateProblems.length,
        teamsParticipating: relevantTeams.length,
        pilotsInProgress: relevantTeams.filter(t => t.health === "G").length,
        challenges,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch corporate stats" });
    }
  });

  // =====================
  // Manager Routes
  // =====================

  // Manager applications - LEARNER and TEAM types
  app.get("/api/manager/applications", requireRole("MANAGER"), async (req, res) => {
    try {
      const { status, search } = req.query;
      let applications = await storage.getApplications();

      // Filter only LEARNER and TEAM type applications
      applications = applications.filter(a => a.type === "LEARNER" || a.type === "TEAM");

      // Apply filters
      if (status && typeof status === "string") {
        applications = applications.filter(a => a.status === status);
      }

      // Search filter
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        applications = applications.filter(app => {
          const formData = app.formJson as any;
          const name = (formData?.fullName || "").toLowerCase();
          const email = (formData?.email || "").toLowerCase();
          const appId = app.id.toLowerCase();
          return name.includes(searchLower) || email.includes(searchLower) || appId.includes(searchLower);
        });
      }

      // Add user details
      const enrichedApplications = await Promise.all(
        applications.map(async (app) => {
          const user = app.userId ? await storage.getUser(app.userId) : null;
          const formData = app.formJson as any;
          return {
            ...app,
            name: formData?.fullName || "Unknown",
            email: formData?.email || "N/A",
            user: user ? { id: user.id, name: user.name, email: user.email } : null,
          };
        })
      );

      res.json(enrichedApplications);
    } catch (error) {
      console.error("Error fetching manager applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Get team applications for manager
  app.get("/api/manager/team-applications", requireRole("MANAGER"), async (req, res) => {
    try {
      const { status, cohortId, search } = req.query;
      let applications = await storage.getApplications();

      // Filter for TEAM applications only
      applications = applications.filter(a => a.type === "TEAM");

      // Apply additional filters
      if (status && typeof status === "string") {
        applications = applications.filter(a => a.status === status);
      }
      if (cohortId && typeof cohortId === "string") {
        applications = applications.filter(a => a.cohortId === cohortId);
      }

      // Search filter (by team name, leader name, or email)
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        applications = applications.filter(app => {
          const formData = app.formJson as any;
          const teamName = (formData?.team_name || "").toLowerCase();
          const leaderName = (formData?.team_leader_full_name || "").toLowerCase();
          const leaderEmail = (formData?.team_leader_email || "").toLowerCase();
          return teamName.includes(searchLower) || leaderName.includes(searchLower) || leaderEmail.includes(searchLower);
        });
      }

      // Add team members and cohort details
      const enrichedApplications = await Promise.all(
        applications.map(async (app) => {
          const teamMembers = await storage.getTeamApplicationMembers(app.id);
          const cohort = app.cohortId ? await storage.getCohort(app.cohortId) : null;
          return {
            ...app,
            formData: app.formJson,
            teamMembers,
            cohort,
          };
        })
      );

      res.json(enrichedApplications);
    } catch (error) {
      console.error("Error fetching team applications:", error);
      res.status(500).json({ message: "Failed to fetch team applications" });
    }
  });

  // Get single team application details for manager
  app.get("/api/manager/team-applications/:id", requireRole("MANAGER"), async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (application.type !== "TEAM") {
        return res.status(400).json({ message: "Application is not a team application" });
      }

      const teamMembers = await storage.getTeamApplicationMembers(application.id);
      
      // Enrich team members with individual application and user details
      const enrichedMembers = await Promise.all(
        teamMembers.map(async (member) => {
          let individualApplication = null;
          let user = null;
          
          if (member.individualApplicationId) {
            individualApplication = await storage.getApplication(member.individualApplicationId);
            if (individualApplication?.userId) {
              user = await storage.getUser(individualApplication.userId);
            }
          }
          
          return {
            ...member,
            individualApplication,
            user,
          };
        })
      );

      const cohort = application.cohortId ? await storage.getCohort(application.cohortId) : null;

      res.json({
        ...application,
        formData: application.formJson,
        teamMembers: enrichedMembers,
        cohort,
      });
    } catch (error) {
      console.error("Error fetching team application details:", error);
      res.status(500).json({ message: "Failed to fetch team application details" });
    }
  });

  // Manager stats
  app.get("/api/manager/stats", requireRole("MANAGER"), async (req, res) => {
    try {
      const applications = await storage.getApplications();
      const learnerApplications = applications.filter(a => a.type === "LEARNER");
      const teamApplications = applications.filter(a => a.type === "TEAM");

      res.json({
        totalApplications: learnerApplications.length + teamApplications.length,
        newApplications: learnerApplications.filter(a => a.status === "NEW").length + teamApplications.filter(a => a.status === "NEW").length,
        reviewApplications: learnerApplications.filter(a => a.status === "REVIEW").length + teamApplications.filter(a => a.status === "REVIEW").length,
        acceptedApplications: learnerApplications.filter(a => a.status === "ACCEPTED").length + teamApplications.filter(a => a.status === "ACCEPTED").length,
        rejectedApplications: learnerApplications.filter(a => a.status === "REJECT").length + teamApplications.filter(a => a.status === "REJECT").length,
      });
    } catch (error) {
      console.error("Error fetching manager stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get single application details (for manager detail view)
  // NOTE: This must be BEFORE the POST route to avoid route conflicts
  app.get("/api/manager/applications/:id", requireRole("MANAGER"), async (req, res) => {
    try {
      console.log("🔍 Manager fetching application details:", req.params.id);
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        console.log("❌ Application not found:", req.params.id);
        return res.status(404).json({ message: "Application not found" });
      }

      // Only allow managers to view LEARNER and TEAM applications
      if (application.type !== "LEARNER" && application.type !== "TEAM") {
        console.log("❌ Access denied - not a LEARNER/TEAM application:", application.type);
        return res.status(403).json({ message: "Access denied. Managers can only view LEARNER and TEAM applications." });
      }

      const user = application.userId ? await storage.getUser(application.userId) : null;
      const reviewer = application.reviewerId ? await storage.getUser(application.reviewerId) : null;
      const formData = application.formJson as any;

      const teamMembers = application.type === "TEAM"
        ? await storage.getTeamApplicationMembers(application.id)
        : undefined;

      console.log("✅ Returning application details");
      res.json({
        ...application,
        formData,
        teamMembers,
        user: user ? { id: user.id, name: user.name, email: user.email } : null,
        reviewer: reviewer ? { id: reviewer.id, name: reviewer.name } : null,
      });
    } catch (error: any) {
      console.error("❌ Error fetching application details:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        message: "Failed to fetch application details",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // Accept TEAM application (manager) and send invites
  app.post("/api/manager/applications/:id/accept", requireRole("MANAGER"), async (req, res) => {
    try {
      const { sendTeamApplicationInviteEmail } = await import("./services/email-service");
      const currentUser = await storage.getUser(req.session!.userId!);

      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (application.type !== "TEAM") {
        return res.status(400).json({ message: "Only TEAM applications can be accepted via this endpoint" });
      }

      const { cohortId, selectionNotes } = req.body || {};
      if (!cohortId || typeof cohortId !== "string") {
        return res.status(400).json({ message: "cohortId is required" });
      }

      const updated = await storage.updateApplication(req.params.id, {
        status: "ACCEPTED" as any,
        cohortId,
        reviewerId: currentUser!.id,
        reviewedAt: new Date(),
        selectionNotes: selectionNotes || application.selectionNotes,
      });

      const crypto = await import("crypto");
      const members = await storage.getTeamApplicationMembers(application.id);
      const form = (application.formJson as any) || {};
      const rawPortalUrl = process.env.PORTAL_URL || `${req.protocol}://${req.get("host")}`;
      const portalUrl = /^https?:\/\//i.test(rawPortalUrl)
        ? rawPortalUrl
        : rawPortalUrl.startsWith("localhost") || rawPortalUrl.startsWith("127.0.0.1")
          ? `http://${rawPortalUrl}`
          : `https://${rawPortalUrl}`;

      const failures: Array<{ email: string; error: string }> = [];
      let sent = 0;

      for (const member of members) {
        if (member.individualApplicationId) {
          continue;
        }
        const token = crypto.randomBytes(24).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

        await storage.createTeamApplicationInvite({
          memberId: member.id,
          tokenHash,
          expiresAt,
          sentAt: new Date(),
        } as any);

        await storage.updateTeamApplicationMember(member.id, {
          status: "INVITED" as any,
        });

        const roleLabel = member.role === "COFOUNDER"
          ? `Co-Founder (${member.cofounderRole || ""})`.trim()
          : member.role === "LEARNER"
            ? `Intern (${member.internTrack || ""})`.trim()
            : "Founder";

        const inviteUrl = `${portalUrl}/plans/team-invite/${token}`;

        try {
          await sendTeamApplicationInviteEmail({
            to: member.email,
            teamName: form.team_name || "Team",
            roleLabel,
            inviteUrl,
          });
          sent += 1;
        } catch (e: any) {
          console.error("Failed to send team invite email:", e);
          failures.push({ email: member.email, error: e?.message || String(e) });
        }
      }

      res.json({
        message: "TEAM application accepted. Invites sent.",
        application: updated,
        invitedCount: sent,
        failed: failures,
      });
    } catch (error) {
      console.error("Error accepting TEAM application (manager):", error);
      res.status(500).json({ message: "Failed to accept TEAM application" });
    }
  });

  // Stream CV as attachment for managers (forces download instead of open in browser)
  app.get("/api/manager/applications/:id/documents/cv/download", requireRole("MANAGER"), async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getApplication(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      if (application.type !== "LEARNER") {
        return res.status(403).json({ message: "Access denied. Managers can only view LEARNER applications." });
      }
      const formData = application.formJson as any;
      const cvFileName = formData?.cvFileName || "Resume.pdf";
      const cvS3Key = formData?.cvS3Key;
      const resumeS3Key = formData?.resumeObjectKey || formData?.resumeS3Key;
      const cvUrl = formData?.cvUrl;
      const resumeUrl = formData?.resumeUrl;
      let objectKey: string | null = cvS3Key || resumeS3Key || null;
      if (!objectKey && (cvUrl || resumeUrl)) {
        try {
          const urlObj = new URL(cvUrl || resumeUrl!);
          const pathParts = urlObj.pathname.split("/").filter((p: string) => p);
          const appIndex = pathParts.findIndex((p: string) => p === "applications");
          objectKey = appIndex >= 0 ? pathParts.slice(appIndex).join("/") : pathParts.join("/");
        } catch {
          objectKey = null;
        }
      }
      if (!objectKey && cvFileName) {
        objectKey = `applications/${id}/cv/${cvFileName}`;
      }
      if (!objectKey || !process.env.AWS_S3_BUCKET_NAME) {
        return res.status(404).json({ message: "CV not available for download" });
      }
      const { S3StorageService } = await import("./s3Storage");
      const storageService = new S3StorageService();
      const safeName = /[^\w\s.-]/g.test(cvFileName) ? "Resume.pdf" : cvFileName;
      res.setHeader("Content-Disposition", `attachment; filename="${safeName.replace(/"/g, "%22")}"`);
      await storageService.downloadObject(objectKey, res, 3600);
    } catch (err: any) {
      if (err.name === "ObjectNotFoundError") {
        return res.status(404).json({ message: "CV not found" });
      }
      console.error("Error streaming manager CV download:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download file" });
      }
    }
  });

  // Get application documents (CV, etc.) for managers
  app.get("/api/manager/applications/:id/documents/:documentType", requireRole("MANAGER"), async (req, res) => {
    try {
      const { id, documentType } = req.params;
      const application = await storage.getApplication(id);

      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Only allow managers to view LEARNER type applications
      if (application.type !== "LEARNER") {
        return res.status(403).json({ message: "Access denied. Managers can only view LEARNER applications." });
      }

      const formData = application.formJson as any;

      if (documentType === "cv") {
        const cvFileName = formData?.cvFileName;
        const cvFileSize = formData?.cvFileSize;
        const cvFileType = formData?.cvFileType;
        const cvS3Key = formData?.cvS3Key; // Check if S3 key is stored
        const cvUrl = formData?.cvUrl; // Check if CV URL is stored (from ObjectUploader)
        const resumeUrl = formData?.resumeUrl; // Check for resumeUrl (mentor applications)
        const resumeS3Key = formData?.resumeObjectKey || formData?.resumeS3Key; // Check for resume S3 key

        // Check if CV exists in any form
        if (!cvFileName && !cvS3Key && !cvUrl && !resumeUrl && !resumeS3Key) {
          return res.status(404).json({ message: "CV not found for this application" });
        }

        // Determine the S3 object key - prioritize stored keys
        let objectKey: string | null = null;
        if (cvS3Key) {
          objectKey = cvS3Key;
        } else if (resumeS3Key) {
          objectKey = resumeS3Key;
        } else if (cvUrl || resumeUrl) {
          // Try to extract object key from URL
          const urlToParse = cvUrl || resumeUrl;
          try {
            const urlObj = new URL(urlToParse);
            // For S3 signed URLs, the key is usually in the pathname
            // Format: /bucket-name/key or /key
            const pathname = urlObj.pathname;
            // Remove leading slash and extract key
            const pathParts = pathname.split('/').filter(p => p);
            if (pathParts.length > 0) {
              // Find 'applications' in path and get everything after it
              const appIndex = pathParts.findIndex(p => p === 'applications');
              if (appIndex >= 0) {
                objectKey = pathParts.slice(appIndex).join('/');
              } else {
                // If no 'applications' found, use all parts as key
                objectKey = pathParts.join('/');
              }
            }
          } catch (e) {
            console.warn("Could not parse CV URL to extract object key:", urlToParse);
          }
        }

        // If we have an object key, always generate a fresh signed URL (more reliable)
        if (objectKey) {
          // Generate fresh signed URL
          if (process.env.AWS_S3_BUCKET_NAME) {
            const { S3StorageService } = await import("./s3Storage");
            const storageService = new S3StorageService();
            try {
              const signedUrl = await storageService.getSignedDownloadURL(objectKey, 3600); // 1 hour expiry
              return res.json({
                fileName: cvFileName || "Resume.pdf",
                fileSize: cvFileSize || 0,
                fileType: cvFileType || "application/pdf",
                downloadUrl: signedUrl,
                viewUrl: signedUrl,
              });
            } catch (s3Error: any) {
              console.error("Error generating signed URL from object key:", s3Error);
              // Fall through to try URL or construct key from filename
            }
          } else {
            // For GCS or other storage
            const { ObjectStorageService } = await import("./objectStorage");
            const objectStorageService = new ObjectStorageService();
            const objectPath = objectKey.startsWith("/") ? objectKey : `/${objectKey}`;
            try {
              const signedUrl = await objectStorageService.getSignedDownloadURL(objectPath, 3600);
              return res.json({
                fileName: cvFileName || "Resume.pdf",
                fileSize: cvFileSize || 0,
                fileType: cvFileType || "application/pdf",
                downloadUrl: signedUrl,
                viewUrl: signedUrl,
              });
            } catch (storageError: any) {
              console.error("Error generating signed URL from object key:", storageError);
              // Fall through to try URL or construct key from filename
            }
          }
        }

        // If we have a URL but couldn't extract/generate signed URL, try using it directly
        // (might work if it's still valid or public)
        const finalCvUrl = cvUrl || resumeUrl;
        if (finalCvUrl && !objectKey) {
          return res.json({
            fileName: cvFileName || "Resume.pdf",
            fileSize: cvFileSize || 0,
            fileType: cvFileType || "application/pdf",
            downloadUrl: finalCvUrl,
            viewUrl: finalCvUrl,
          });
        }

        // Fallback: construct the key from application ID and filename
        if (!objectKey && cvFileName) {
          objectKey = `applications/${id}/cv/${cvFileName}`;
        }

        // Generate signed URL for S3 using constructed key
        if (objectKey) {
          if (process.env.AWS_S3_BUCKET_NAME) {
            const { S3StorageService } = await import("./s3Storage");
            const storageService = new S3StorageService();
            const signedUrl = await storageService.getSignedDownloadURL(objectKey, 3600); // 1 hour expiry

            return res.json({
              fileName: cvFileName || "Resume.pdf",
              fileSize: cvFileSize || 0,
              fileType: cvFileType || "application/pdf",
              downloadUrl: signedUrl,
              viewUrl: signedUrl, // Same URL for viewing
            });
          } else {
            // For GCS or other storage
            const { ObjectStorageService } = await import("./objectStorage");
            const objectStorageService = new ObjectStorageService();
            const objectPath = objectKey.startsWith("/") ? objectKey : `/${objectKey}`;
            const signedUrl = await objectStorageService.getSignedDownloadURL(objectPath, 3600);

            return res.json({
              fileName: cvFileName || "Resume.pdf",
              fileSize: cvFileSize || 0,
              fileType: cvFileType || "application/pdf",
              downloadUrl: signedUrl,
              viewUrl: signedUrl,
            });
          }
        }
      }

      res.status(400).json({ message: "Invalid document type" });
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // Manager assign assessment with public token
  app.post("/api/manager/applications/assign-assessment", requireRole("MANAGER"), async (req, res) => {
    try {
      const { applicationId, assessmentId, email } = req.body;
      const managerId = req.session!.userId!;

      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (application.type !== "LEARNER") {
        return res.status(400).json({ message: "Can only assign assessments to LEARNER applications" });
      }

      const assessment = await storage.getAssessment(assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      // Check if assessment has questions
      const questions = await storage.getQuestionsByAssessment(assessmentId);
      if (!questions || questions.length === 0) {
        return res.status(400).json({
          message: "Assessment has no questions. Please add questions before assigning."
        });
      }

      // Generate public token
      const crypto = await import("crypto");
      const publicToken = crypto.randomBytes(32).toString("hex");

      // Get candidate email from application or provided email
      const formData = application.formJson as any;
      const candidateEmail = email || formData?.email;
      if (!candidateEmail) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Get or create user for the assignment
      let userId = application.userId;
      if (!userId) {
        // Try to find user by email first
        const existingUser = await storage.getUserByEmail(candidateEmail);
        if (existingUser) {
          userId = existingUser.id;
        } else {
          // Create a user for the assessment if none exists
          const { hashPassword } = await import("./services/credential-service");
          const newUser = await storage.createUser({
            email: candidateEmail,
            password: await hashPassword(Math.random().toString(36)),
            name: formData?.fullName || candidateEmail.split("@")[0],
            role: "LEARNER",
          });
          userId = newUser.id;
        }
      }

      // Create assignment with public token
      try {
        const assignment = await storage.createAssessmentAssignment({
          assessmentId,
          userId: userId,
          assignedBy: managerId,
          publicToken,
          email: candidateEmail,
        });

        // Send email with assessment link
        const { sendAssessmentAssignmentEmail } = await import("./services/email-service");
        // Use request origin for deployed apps, fallback to env variable or localhost
        const origin = req.headers.origin || req.headers.referer?.replace(/\/.*$/, '') || process.env.APP_URL || "http://localhost:5432";
        const assessmentLink = `${origin}/assessment/${publicToken}`;
        
        console.log("📧 [MANAGER] Sending assessment email:", {
          to: candidateEmail,
          name: formData?.fullName || "Candidate",
          assessmentTitle: assessment.title,
          assessmentLink,
          publicToken
        });
        
        try {
          await sendAssessmentAssignmentEmail(
            candidateEmail,
            formData?.fullName || "Candidate",
            assessment.title,
            assessmentLink
          );
          console.log("✅ [MANAGER] Assessment email sent successfully to", candidateEmail);
        } catch (emailError) {
          console.error("❌ [MANAGER] Failed to send assessment email:", emailError);
          // Don't fail the whole request if email fails
        }

        res.status(201).json(assignment);
      } catch (error: any) {
        if (error.code === '23505') {
          return res.status(400).json({ message: "Assessment is already assigned to this applicant" });
        }
        throw error;
      }
    } catch (error) {
      console.error("Assign assessment error:", error);
      res.status(500).json({ message: "Failed to assign assessment" });
    }
  });

  // Manager get assessments for review
  app.get("/api/manager/assessments", requireRole("MANAGER"), async (req, res) => {
    try {
      const assessments = await storage.getAssessments();
      // Enrich with question count
      const enrichedAssessments = await Promise.all(
        assessments.map(async (assessment) => {
          const questions = await storage.getQuestionsByAssessment(assessment.id);
          return {
            ...assessment,
            questionCount: questions.length,
            hasQuestions: questions.length > 0,
          };
        })
      );
      res.json(enrichedAssessments);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ message: "Failed to fetch assessments" });
    }
  });

  // Manager get assessment with questions
  // NOTE: This must be BEFORE /api/manager/assessments/:id/attempts to avoid route conflicts
  app.get("/api/manager/assessments/:id", requireRole("MANAGER"), async (req, res) => {
    try {
      const assessment = await storage.getAssessment(req.params.id);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }
      const questions = await storage.getQuestionsByAssessment(assessment.id);
      res.json({
        ...assessment,
        questions,
        questionCount: questions.length,
        hasQuestions: questions.length > 0,
      });
    } catch (error) {
      console.error("Error fetching assessment:", error);
      res.status(500).json({ message: "Failed to fetch assessment" });
    }
  });

  // Manager get questions for an assessment
  app.get("/api/manager/assessments/:id/questions", requireRole("MANAGER"), async (req, res) => {
    try {
      const questions = await storage.getQuestionsByAssessment(req.params.id);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // Manager get assessment attempts for review
  app.get("/api/manager/assessments/:id/attempts", requireRole("MANAGER"), async (req, res) => {
    try {
      const attempts = await storage.getAttemptsByAssessment(req.params.id);
      const enrichedAttempts = await Promise.all(
        attempts.map(async (attempt) => {
          const user = await storage.getUser(attempt.userId);
          let application = attempt.applicationId ? await storage.getApplication(attempt.applicationId) : null;

          // If applicationId is null, try to find application by userId
          if (!application && user) {
            const userApplications = await storage.getApplicationsByUser(user.id);
            // Get the most recent LEARNER application
            application = userApplications.find(app => app.type === "LEARNER") || userApplications[0] || null;

            // If we found an application, update the attempt to link it
            if (application && !attempt.applicationId) {
              await storage.updateAssessmentAttempt(attempt.id, { applicationId: application.id });
              attempt.applicationId = application.id;
            }
          }

          return {
            ...attempt,
            user: user ? { id: user.id, name: user.name, email: user.email } : null,
            application: application ? {
              id: application.id,
              name: (application.formJson as any)?.fullName || "Unknown",
              email: (application.formJson as any)?.email || "N/A",
            } : null,
          };
        })
      );
      res.json(enrichedAttempts);
    } catch (error) {
      console.error("Error fetching assessment attempts:", error);
      res.status(500).json({ message: "Failed to fetch attempts" });
    }
  });

  // Manager review assessment attempt (pass/fail)
  app.post("/api/manager/assessments/attempts/:id/review", requireRole("MANAGER"), async (req, res) => {
    try {
      const { passed } = req.body;
      const attempt = await storage.getAssessmentAttempt(req.params.id);
      if (!attempt) {
        return res.status(404).json({ message: "Attempt not found" });
      }

      // Calculate passing score (75%)
      const assessment = await storage.getAssessment(attempt.assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      // Recalculate total score from all graded answers
      const answers = await storage.getAnswersByAttempt(attempt.id);
      const questions = await storage.getQuestionsByAssessment(attempt.assessmentId);
      let totalScore = 0;
      let maxScore = 0;

      for (const question of questions) {
        maxScore += question.maxScore || 1;
        const answer = answers.find(a => a.questionId === question.id);
        if (answer && answer.awardedScore !== null && answer.awardedScore !== undefined) {
          totalScore += answer.awardedScore;
        }
      }

      // Check if all questions have been reviewed
      const allReviewed = questions.every(q => {
        const answer = answers.find(a => a.questionId === q.id);
        return answer && answer.awardedScore !== null && answer.awardedScore !== undefined;
      });

      if (!allReviewed) {
        return res.status(400).json({ message: "Please review all questions before making a pass/fail decision" });
      }

      const passingScore = Math.ceil(maxScore * 0.75);
      const finalPassed = passed === true;

      const updated = await storage.updateAssessmentAttempt(req.params.id, {
        score: totalScore,
        maxScore,
        passed: finalPassed,
        status: "GRADED",
        resultsPublished: true,
      });

      // Update application entrance score when manager makes final decision
      if (attempt.applicationId) {
        await storage.updateApplication(attempt.applicationId, {
          entranceScore: totalScore,
        });
      }

      // Send response immediately, then handle notifications asynchronously
      res.json(updated);

      // Notify all admins about the assessment review (async, non-blocking)
      // Use setImmediate to run after response is sent
      setImmediate(async () => {
        try {
          // Get user info for notification
          const attemptUser = await storage.getUser(attempt.userId);
          const candidateName = attemptUser?.name || "Candidate";
          const candidateEmail = attemptUser?.email || "";

          // Notify all admins about the assessment review
          let admins: any[] = [];
          try {
            admins = await storage.getUsersByRole("ADMIN");
            console.log(`📧 Notifying ${admins.length} admin(s) about assessment review`);
            for (const admin of admins) {
              try {
                await storage.createNotification({
                  userId: admin.id,
                  type: "ASSESSMENT_REVIEWED" as any, // Type assertion to handle enum issues
                  title: `Assessment Reviewed - ${candidateName}`,
                  message: `Manager has reviewed the assessment for ${candidateName}. Result: ${finalPassed ? "PASSED" : "FAILED"} (Score: ${attempt.score || 0}/${attempt.maxScore || 0}).`,
                  metadataJson: {
                    attemptId: attempt.id,
                    assessmentId: assessment.id,
                    candidateId: attempt.userId,
                    candidateName,
                    candidateEmail,
                    passed: finalPassed,
                    score: totalScore,
                    maxScore: maxScore,
                    applicationId: attempt.applicationId,
                  },
                });
                console.log(`✅ Notification created for admin: ${admin.email}`);
              } catch (notifError: any) {
                console.error(`❌ Error creating notification for admin ${admin.email}:`, notifError);
                console.error("Notification error details:", {
                  message: notifError.message,
                  code: notifError.code,
                  detail: notifError.detail,
                });
                // If it's an enum error, suggest running migration
                if (notifError.message?.includes("invalid input value for enum") || notifError.detail?.includes("ASSESSMENT_REVIEWED")) {
                  console.error("⚠️  ASSESSMENT_REVIEWED notification type not found in database. Run: npm run db:add-assessment-reviewed-type");
                }
                // Continue with other admins even if one fails
              }
            }
          } catch (notifError: any) {
            console.error("❌ Error fetching admins for notification:", notifError);
          }

          // Send email notification to admins
          if (admins.length > 0) {
            try {
              const { sendCandidateSelectionNotificationToAdmin } = await import("./services/email-service");
              for (const admin of admins) {
                await sendCandidateSelectionNotificationToAdmin(
                  admin.email,
                  candidateName,
                  candidateEmail,
                  finalPassed
                );
              }
            } catch (emailError) {
              console.error("Error sending email notification to admin:", emailError);
            }
          }
        } catch (error: any) {
          console.error("❌ Error in async notification handler:", error);
        }
      });
    } catch (error: any) {
      console.error("❌ Error reviewing attempt:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail,
      });
      res.status(500).json({
        message: "Failed to review attempt",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // Manager notify admin about candidate selection
  // NOTE: This route must be defined AFTER /api/manager/applications/:id (GET) to avoid conflicts
  app.post("/api/manager/applications/:id/notify-admin", requireRole("MANAGER"), async (req, res) => {
    try {
      console.log("📧 ===== NOTIFY ADMIN ENDPOINT HIT =====");
      console.log("📧 Notify admin request for application:", req.params.id);
      console.log("📧 Request method:", req.method);
      console.log("📧 Request URL:", req.url);
      console.log("📧 Request params:", req.params);
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        console.log("❌ Application not found:", req.params.id);
        return res.status(404).json({ message: "Application not found" });
      }

      // Get assessment attempt
      const user = application.userId ? await storage.getUser(application.userId) : null;
      if (!user) {
        console.log("❌ Application has no linked user");
        return res.status(400).json({ message: "Application has no linked user" });
      }

      console.log("👤 Found user:", user.id, user.email);
      const assignments = await storage.getAssignmentsByUser(user.id);
      if (assignments.length === 0) {
        console.log("❌ No assessments assigned to user:", user.id);
        return res.status(400).json({ message: "No assessments assigned to this candidate" });
      }

      console.log("📋 Found", assignments.length, "assignment(s)");

      // Get the latest attempt
      let latestAttempt = null;
      for (const assignment of assignments) {
        const attempt = await storage.getAttemptByUserAndAssessment(user.id, assignment.assessmentId);
        if (attempt && (!latestAttempt || new Date(attempt.submittedAt || 0) > new Date(latestAttempt.submittedAt || 0))) {
          latestAttempt = attempt;
        }
      }

      if (!latestAttempt) {
        console.log("❌ No attempt found for user:", user.id);
        return res.status(400).json({ message: "No assessment attempt found" });
      }

      if (latestAttempt.status !== "GRADED") {
        console.log("❌ Attempt not graded. Status:", latestAttempt.status);
        return res.status(400).json({ message: "Assessment not yet reviewed" });
      }

      if (latestAttempt.passed === null || latestAttempt.passed === undefined) {
        console.log("❌ Attempt passed status is null");
        return res.status(400).json({ message: "Assessment review is incomplete. Please make a pass/fail decision first." });
      }

      console.log("✅ Found graded attempt:", latestAttempt.id, "Passed:", latestAttempt.passed);

      const formData = application.formJson as any;
      const candidateName = formData?.fullName || "Candidate";
      const candidateEmail = formData?.email || user.email;

      // Create notification for all admins
      const admins = await storage.getUsersByRole("ADMIN");
      console.log("👥 Found", admins.length, "admin(s) to notify");

      if (admins.length === 0) {
        return res.status(400).json({ message: "No admins found in the system" });
      }

      const { sendCandidateSelectionNotificationToAdmin } = await import("./services/email-service");

      // Build notification message with score details
      const scoreText = latestAttempt.score !== null && latestAttempt.maxScore !== null
        ? ` (Score: ${latestAttempt.score}/${latestAttempt.maxScore})`
        : "";
      const resultText = latestAttempt.passed ? "PASSED" : "FAILED";
      const actionText = latestAttempt.passed
        ? "Manager has requested to share credentials with this candidate."
        : "Manager has requested review of this candidate.";

      for (const admin of admins) {
        try {
          // Create notification
          await storage.createNotification({
            userId: admin.id,
            type: "CANDIDATE_SELECTED",
            title: `Assessment Review - ${candidateName} - ${resultText}`,
            message: `Candidate ${candidateName} has ${latestAttempt.passed ? "passed" : "failed"} the assessment${scoreText}. ${actionText}`,
            metadataJson: {
              applicationId: application.id,
              candidateId: user.id,
              attemptId: latestAttempt.id,
              passed: latestAttempt.passed,
              score: latestAttempt.score,
              maxScore: latestAttempt.maxScore,
            },
          });
          console.log("✅ Notification created for admin:", admin.email);
        } catch (notifError: any) {
          console.error("❌ Error creating notification for admin", admin.email, ":", notifError);
          console.error("Notification error details:", {
            message: notifError.message,
            code: notifError.code,
            detail: notifError.detail,
          });
          // Continue with other admins even if one fails
        }

        // Send email
        try {
          await sendCandidateSelectionNotificationToAdmin(
            admin.email,
            candidateName,
            candidateEmail,
            latestAttempt.passed || false
          );
          console.log("✅ Email sent to admin:", admin.email);
        } catch (emailError: any) {
          console.error("❌ Error sending email to admin", admin.email, ":", emailError);
          // Continue with other admins even if email fails
        }
      }

      res.json({ message: "Admin notified successfully" });
    } catch (error: any) {
      console.error("❌ Error notifying admin:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail,
      });
      res.status(500).json({
        message: "Failed to notify admin",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // Manager mentors
  app.get("/api/manager/mentors", requireRole("MANAGER"), async (req, res) => {
    try {
      const { track } = req.query;
      console.log("📋 Fetching mentors, track filter:", track || "all");

      let profiles = await storage.getMentorProfiles();
      console.log(`✅ Found ${profiles.length} mentor profile(s) in database`);

      if (track && typeof track === "string") {
        console.log(`🔍 Filtering by track: ${track}`);
        profiles = await storage.getMentorProfilesByTrack(track);
        console.log(`✅ ${profiles.length} mentor(s) match track: ${track}`);
      }

      // Enrich with user data
      console.log("👤 Enriching profiles with user data...");
      const enrichedProfiles = await Promise.all(
        profiles.map(async (profile) => {
          try {
            const user = await storage.getUser(profile.userId);
            if (!user) {
              console.warn(`⚠️  Mentor profile ${profile.id} has no linked user (userId: ${profile.userId})`);
            }
            return {
              ...profile,
              user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone } : null,
            };
          } catch (userError: any) {
            console.error(`❌ Error fetching user for mentor ${profile.id}:`, userError);
            return {
              ...profile,
              user: null,
            };
          }
        })
      );

      console.log(`✅ Returning ${enrichedProfiles.length} enriched mentor profile(s)`);
      res.json(enrichedProfiles);
    } catch (error: any) {
      console.error("❌ Error fetching mentors:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail,
      });
      res.status(500).json({
        message: "Failed to fetch mentors",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // Manager create mentor
  app.post("/api/manager/mentors", requireRole("MANAGER"), async (req, res) => {
    try {
      const {
        fullName,
        email,
        phone,
        education,
        skills,
        experience,
        tracks,
        linkedin,
        github,
        portfolio,
        description,
        aboutMentor,
        cvUrl,
        certificationsUrl,
        videoUrl,
      } = req.body;

      // Validate tracks (max 3)
      if (!Array.isArray(tracks) || tracks.length === 0 || tracks.length > 3) {
        return res.status(400).json({ message: "Tracks must be an array with 1-3 items" });
      }

      // Generate credentials
      const { generateCredentials, hashPassword } = await import("./services/credential-service");
      const { password, hashedPassword } = await generateCredentials();

      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name: fullName,
        phone,
        role: "MENTOR",
      });

      // Create mentor profile
      const profile = await storage.createMentorProfile({
        userId: user.id,
        education,
        skills: Array.isArray(skills) ? skills : skills ? [skills] : [],
        experience,
        tracksJson: tracks,
        linkedinUrl: linkedin,
        githubUrl: github,
        portfolioUrl: portfolio,
        description,
        aboutMentor,
        cvUrl,
        certificationsUrl: Array.isArray(certificationsUrl) ? JSON.stringify(certificationsUrl) : certificationsUrl,
        videoUrl,
        credentialsShared: false,
      });

      // Create notification for all admins (asynchronously to not block response)
      const admins = await storage.getUsersByRole("ADMIN");
      console.log("👥 ===== MENTOR CREATION NOTIFICATIONS =====");
      console.log("👥 Found", admins.length, "admin(s) to notify");
      console.log("👤 Mentor created:", fullName, "(", email, ")");

      const { sendMentorCreationNotificationToAdmin } = await import("./services/email-service");

      // Use setImmediate to send notifications asynchronously (don't block response)
      setImmediate(async () => {
        for (const admin of admins) {
          try {
            // Create in-app notification
            const notification = await storage.createNotification({
              userId: admin.id,
              type: "MENTOR_CREATED",
              title: `New Mentor Created - ${fullName}`,
              message: `A new mentor ${fullName} has been created. Please review and approve credential sharing.`,
              metadataJson: {
                mentorId: user.id,
                mentorProfileId: profile.id,
                mentorName: fullName,
                mentorEmail: email,
                password: password, // Store password temporarily for manager to retrieve after approval
              },
            });
            console.log("✅ Notification created for admin:", admin.email, "Notification ID:", notification.id);
          } catch (notifError: any) {
            console.error("❌ Error creating notification for admin", admin.email, ":", notifError);
            console.error("Notification error details:", {
              message: notifError.message,
              code: notifError.code,
              detail: notifError.detail,
            });
          }

          // Send email notification
          try {
            await sendMentorCreationNotificationToAdmin(admin.email, fullName, email);
            console.log("✅ Email sent to admin:", admin.email);
          } catch (emailError: any) {
            console.error("❌ Error sending email to admin:", admin.email, ":", emailError);
            console.error("Email error details:", {
              message: emailError.message,
              stack: emailError.stack,
            });
          }
        }
        console.log("✅ ===== MENTOR CREATION NOTIFICATIONS COMPLETE =====");
      });

      // Create notification for manager (asynchronously)
      const manager = await storage.getUser(req.session!.userId!);
      if (manager) {
        setImmediate(async () => {
          try {
            const managerNotif = await storage.createNotification({
              userId: manager.id,
              type: "MENTOR_CREATED",
              title: `Mentor Created - ${fullName}`,
              message: `Mentor ${fullName} has been created. Waiting for admin approval to share credentials.`,
              metadataJson: {
                mentorId: user.id,
                mentorProfileId: profile.id,
              },
            });
            console.log("✅ Notification created for manager:", manager.email, "Notification ID:", managerNotif.id);
          } catch (error: any) {
            console.error("❌ Error creating notification for manager:", error);
          }
        });
      }

      res.status(201).json({ user, profile, password }); // Return password for manager to share after approval
    } catch (error: any) {
      console.error("Error creating mentor:", error);
      if (error.code === '23505') {
        return res.status(400).json({ message: "Email already exists" });
      }
      res.status(500).json({ message: "Failed to create mentor" });
    }
  });

  // Generate password preview for mentor (before sharing)
  // NOTE: This route must be defined BEFORE the /password route to avoid route conflicts
  // More specific routes (with more path segments) must come before less specific ones
  app.get("/api/manager/mentors/:id/password-preview", requireRole("MANAGER"), async (req, res) => {
    try {
      console.log("🔑 Password preview requested for mentor profile:", req.params.id);
      const profile = await storage.getMentorProfile(req.params.id);
      if (!profile) {
        console.log("❌ Mentor profile not found:", req.params.id);
        return res.status(404).json({ message: "Mentor profile not found" });
      }

      if (!profile.credentialsApprovedBy) {
        console.log("❌ Credentials not approved for profile:", req.params.id);
        return res.status(400).json({ message: "Credentials not yet approved by admin" });
      }

      if (profile.credentialsShared) {
        console.log("❌ Credentials already shared for profile:", req.params.id);
        return res.status(400).json({ message: "Credentials already shared" });
      }

      // Generate a password preview (doesn't save it yet)
      const { generateCredentials } = await import("./services/credential-service");
      const { password } = await generateCredentials();

      console.log("✅ Password preview generated for profile:", req.params.id);
      res.json({ password });
    } catch (error: any) {
      console.error("❌ Error generating password preview:", error);
      res.status(500).json({ message: "Failed to generate password preview" });
    }
  });

  // Get mentor password from notification (for manager to share after approval)
  // NOTE: This route must come AFTER password-preview to avoid route conflicts
  app.get("/api/manager/mentors/:id/password", requireRole("MANAGER"), async (req, res) => {
    try {
      console.log("🔑 Password request for mentor profile:", req.params.id);
      const profile = await storage.getMentorProfile(req.params.id);
      if (!profile) {
        console.log("❌ Mentor profile not found:", req.params.id);
        return res.status(404).json({ message: "Mentor profile not found" });
      }

      if (!profile.credentialsApprovedBy) {
        console.log("❌ Credentials not approved for profile:", req.params.id);
        return res.status(400).json({ message: "Credentials not yet approved by admin" });
      }

      // Find the CREDENTIALS_APPROVED notification for this mentor
      const managerId = req.session!.userId!;
      const notifications = await storage.getNotificationsByUser(managerId);
      console.log("📋 Found", notifications.length, "notifications for manager");

      const approvalNotification = notifications.find(
        (n) => n.type === "CREDENTIALS_APPROVED" &&
          (n.metadataJson as any)?.mentorProfileId === profile.id
      );

      if (!approvalNotification) {
        console.log("❌ Approval notification not found for profile:", profile.id);
        return res.status(404).json({ message: "Password not found. Please contact admin." });
      }

      const metadata = approvalNotification.metadataJson as any;
      console.log("✅ Password found in notification metadata");
      res.json({ password: metadata?.password });
    } catch (error: any) {
      console.error("❌ Error getting mentor password:", error);
      res.status(500).json({ message: "Failed to get mentor password" });
    }
  });

  // Manager share mentor credentials (after admin approval)
  app.post("/api/manager/mentors/:id/share-credentials", requireRole("MANAGER"), async (req, res) => {
    try {
      const profile = await storage.getMentorProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Mentor profile not found" });
      }

      if (!profile.credentialsApprovedBy) {
        return res.status(400).json({ message: "Credentials not yet approved by admin" });
      }

      if (profile.credentialsShared) {
        return res.status(400).json({ message: "Credentials already shared" });
      }

      const user = await storage.getUser(profile.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get password from request (generated on frontend and displayed in dialog)
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      // Hash and update user's password in database
      const { hashPassword } = await import("./services/credential-service");
      const hashedPassword = await hashPassword(password);

      await storage.updateUser(user.id, {
        password: hashedPassword,
      });

      console.log(`✅ Updated password for mentor ${user.email}`);

      // Send credentials email
      const { sendMentorCredentialsEmail } = await import("./services/email-service");
      await sendMentorCredentialsEmail(
        user.email,
        user.name || "Mentor",
        {
          email: user.email,
          password,
        }
      );

      // Update profile
      await storage.updateMentorProfile(profile.id, {
        credentialsShared: true,
      });

      console.log(`✅ Credentials shared successfully for mentor ${user.email}`);
      res.json({ message: "Credentials shared successfully" });
    } catch (error) {
      console.error("Error sharing credentials:", error);
      res.status(500).json({ message: "Failed to share credentials" });
    }
  });

  // Manager notifications
  app.get("/api/manager/notifications", requireRole("MANAGER"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const notifications = await storage.getNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/manager/notifications/unread", requireRole("MANAGER"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const notifications = await storage.getUnreadNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/manager/notifications/:id/read", requireRole("MANAGER"), async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Admin notifications
  app.get("/api/admin/notifications", requireRole("ADMIN"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const allNotifications = await storage.getNotificationsByUser(userId);
      
      // Filter out archived notifications
      const notifications = allNotifications.filter(n => n.status !== "ARCHIVED");
      
      // Enrich MENTOR_CREATED notifications with approval status
      const enrichedNotifications = await Promise.all(
        notifications.map(async (notification) => {
          if (notification.type === "MENTOR_CREATED") {
            const metadata = notification.metadataJson as any;
            const mentorProfileId = metadata?.mentorProfileId;
            
            if (mentorProfileId) {
              try {
                const profile = await storage.getMentorProfile(mentorProfileId);
                return {
                  ...notification,
                  metadataJson: {
                    ...metadata,
                    isApproved: !!profile?.credentialsApprovedBy,
                    credentialsApprovedBy: profile?.credentialsApprovedBy || null,
                  },
                };
              } catch (error) {
                console.error("Error fetching mentor profile for notification:", error);
                return notification;
              }
            }
          }
          return notification;
        })
      );
      
      res.json(enrichedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // General notifications endpoint for all authenticated users
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const currentUser = await storage.getUser(userId);
      console.log("🔔 Fetching notifications for user:", {
        userId,
        userEmail: currentUser?.email,
        userRole: currentUser?.role,
      });
      const notifications = await storage.getNotificationsByUser(userId);
      const acceptedNotifications = notifications.filter(n => n.type === "TEAM_MEMBER_APPLICATION_ACCEPTED");
      console.log("📬 Notifications found:", {
        total: notifications.length,
        accepted: acceptedNotifications.length,
        types: notifications.map(n => n.type),
        statuses: notifications.map(n => n.status),
        acceptedDetails: acceptedNotifications.map(n => ({
          id: n.id,
          type: n.type,
          status: n.status,
          metadata: n.metadataJson,
        })),
      });
      res.json(notifications);
    } catch (error: any) {
      console.error("❌ Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const notification = await storage.getNotification(req.params.id);

      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Verify the notification belongs to the user
      if (notification.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.markNotificationAsRead(req.params.id);
      if (!updated) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.get("/api/admin/notifications/unread", requireRole("ADMIN"), async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const notifications = await storage.getUnreadNotificationsByUser(userId);
      res.json(notifications);
    } catch (error: any) {
      console.error("❌ Error fetching unread notifications:", error);
      console.error("Error fetching notifications:", error);
      res.status(500).json({
        message: "Failed to fetch notifications"
      });
    }
  });

  app.post("/api/admin/notifications/:id/read", requireRole("ADMIN"), async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Approve mentor credentials (from notification)
  app.post("/api/admin/notifications/:id/approve-mentor", requireRole("ADMIN"), async (req, res) => {
    try {
      const notification = await storage.getNotification(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      if (notification.type !== "MENTOR_CREATED") {
        return res.status(400).json({ message: "This notification is not for mentor approval" });
      }

      const metadata = notification.metadataJson as any;
      const mentorProfileId = metadata?.mentorProfileId;
      const mentorId = metadata?.mentorId;

      if (!mentorProfileId) {
        return res.status(400).json({ message: "Mentor profile ID not found in notification" });
      }

      const profile = await storage.getMentorProfile(mentorProfileId);
      if (!profile) {
        return res.status(404).json({ message: "Mentor profile not found" });
      }

      const adminId = req.session!.userId!;

      // Approve credentials
      await storage.updateMentorProfile(profile.id, {
        credentialsApprovedBy: adminId,
        credentialsApprovedAt: new Date(),
      });

      // Archive notification (so it doesn't show in the list anymore)
      await storage.updateNotification(notification.id, {
        status: "ARCHIVED",
        readAt: new Date(),
      });

      // Get user email for the notification
      const mentorUser = await storage.getUser(profile.userId);

      // Notify manager that credentials are approved (include password from notification)
      const managers = await storage.getUsersByRole("MANAGER");
      for (const manager of managers) {
        await storage.createNotification({
          userId: manager.id,
          type: "CREDENTIALS_APPROVED",
          title: `Mentor Credentials Approved`,
          message: `Credentials for mentor ${metadata?.mentorName || mentorUser?.name || "mentor"} have been approved. You can now share them.`,
          metadataJson: {
            mentorProfileId: profile.id,
            mentorId: mentorId,
            password: metadata?.password, // Include password so manager can share it
            mentorEmail: mentorUser?.email || metadata?.mentorEmail,
            mentorName: metadata?.mentorName || mentorUser?.name,
          },
        });
      }

      res.json({ message: "Mentor credentials approved successfully" });
    } catch (error: any) {
      console.error("Error approving mentor credentials:", error);
      res.status(500).json({ message: "Failed to approve mentor credentials" });
    }
  });

  // Reject/Remove mentor (from notification)
  app.post("/api/admin/notifications/:id/reject-mentor", requireRole("ADMIN"), async (req, res) => {
    try {
      const notification = await storage.getNotification(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      if (notification.type !== "MENTOR_CREATED") {
        return res.status(400).json({ message: "This notification is not for mentor rejection" });
      }

      const metadata = notification.metadataJson as any;
      const mentorProfileId = metadata?.mentorProfileId;
      const mentorId = metadata?.mentorId;

      if (!mentorProfileId || !mentorId) {
        return res.status(400).json({ message: "Mentor information not found in notification" });
      }

      // Delete mentor profile and user using drizzle ORM
      const { db } = await import("./db");
      const { mentorProfiles, users: usersTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // Delete mentor profile first (due to foreign key constraint)
      await db.delete(mentorProfiles).where(eq(mentorProfiles.id, mentorProfileId));

      // Delete user
      await db.delete(usersTable).where(eq(usersTable.id, mentorId));

      // Archive notification (so it doesn't show in the list anymore)
      await storage.updateNotification(notification.id, {
        status: "ARCHIVED",
        readAt: new Date(),
      });

      console.log(`✅ Mentor removed: Profile ${mentorProfileId}, User ${mentorId}`);
      res.json({ message: "Mentor removed successfully" });
    } catch (error: any) {
      console.error("Error rejecting mentor:", error);
      res.status(500).json({ message: "Failed to reject mentor" });
    }
  });

  // Handle assessment notification confirm (navigate to details)
  app.post("/api/admin/notifications/:id/confirm-assessment", requireRole("ADMIN"), async (req, res) => {
    try {
      const notification = await storage.getNotification(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      if (notification.type !== "ASSESSMENT_REVIEWED") {
        return res.status(400).json({ message: "This notification is not for assessment review" });
      }

      const metadata = notification.metadataJson as any;
      const applicationId = metadata?.applicationId;

      // Mark notification as read
      await storage.markNotificationAsRead(notification.id);

      // Return application ID for navigation
      res.json({
        message: "Notification confirmed",
        applicationId: applicationId,
        attemptId: metadata?.attemptId,
      });
    } catch (error: any) {
      console.error("Error confirming assessment notification:", error);
      res.status(500).json({ message: "Failed to confirm assessment notification" });
    }
  });

  // Public assessment - submit answers (no auth required) - MUST come before :token route
  console.log("✅ Registering route: POST /api/public/assessment/:attemptId/answers");
  app.post("/api/public/assessment/:attemptId/answers", async (req, res) => {
    try {
      const { questionId, response } = req.body;
      const attempt = await storage.getAssessmentAttempt(req.params.attemptId);

      if (!attempt) {
        return res.status(404).json({ message: "Attempt not found" });
      }

      if (attempt.status !== "IN_PROGRESS") {
        return res.status(400).json({ message: "Attempt is not in progress" });
      }

      // Check if answer already exists
      const existingAnswers = await storage.getAnswersByAttempt(attempt.id);
      const existingAnswer = existingAnswers.find(a => a.questionId === questionId);

      if (existingAnswer) {
        // Update existing answer
        await storage.updateAssessmentAnswer(existingAnswer.id, { responseJson: response });
        res.json({ message: "Answer updated" });
      } else {
        // Create new answer with error handling for race conditions
        try {
          await storage.createAssessmentAnswer({
            attemptId: attempt.id,
            questionId,
            responseJson: response,
          });
          res.json({ message: "Answer saved" });
        } catch (error: any) {
          // Handle race condition: if answer was created between check and insert
          if (error.code === '23505' && error.constraint === 'assessment_answers_attempt_question_idx') {
            // Answer was created by another request, fetch and update it
            const existingAnswers = await storage.getAnswersByAttempt(attempt.id);
            const existingAnswer = existingAnswers.find(a => a.questionId === questionId);
            if (existingAnswer) {
              await storage.updateAssessmentAnswer(existingAnswer.id, { responseJson: response });
              res.json({ message: "Answer updated" });
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error("Error saving answer:", error);
      res.status(500).json({ message: "Failed to save answer" });
    }
  });

  // TEST ROUTE - Simple test to verify routing works
  app.post("/api/test/submit", (req, res) => {
    console.log("✅ TEST ROUTE HIT!");
    res.json({ message: "Test route works!" });
  });

  // Public assessment - submit attempt (no auth required) - MUST come before :token route
  console.log("✅ Registering route: POST /api/public/assessment/:attemptId/submit");
  app.post("/api/public/assessment/:attemptId/submit", async (req, res) => {
    console.log("🔥 ROUTE HIT: POST /api/public/assessment/:attemptId/submit");
    console.log("🔥 Request URL:", req.url);
    console.log("🔥 Request method:", req.method);
    console.log("🔥 Request params:", req.params);
    try {
      console.log("📤 Public assessment submit request:", req.params.attemptId);
      const attempt = await storage.getAssessmentAttempt(req.params.attemptId);

      if (!attempt) {
        return res.status(404).json({ message: "Attempt not found" });
      }

      if (attempt.status !== "IN_PROGRESS") {
        return res.status(400).json({ message: "Attempt is not in progress" });
      }

      // Get assessment and questions for scoring
      const assessment = await storage.getAssessment(attempt.assessmentId);
      const questions = await storage.getQuestionsByAssessment(attempt.assessmentId);
      const answers = await storage.getAnswersByAttempt(attempt.id);

      let totalScore = 0;
      let maxScore = 0;

      // Helper to normalize response value from JSON column
      const normalizeResponse = (responseJson: unknown): string => {
        if (typeof responseJson === 'string') {
          try {
            const parsed = JSON.parse(responseJson);
            if (typeof parsed === 'string') {
              return parsed.trim();
            }
            return String(parsed).trim();
          } catch {
            return responseJson.trim();
          }
        }
        if (responseJson === null || responseJson === undefined) {
          return '';
        }
        return String(responseJson).trim();
      };

      // Don't auto-score - manager will review all questions manually
      // Calculate max score but leave awardedScore as null for manager review
      for (const question of questions) {
        maxScore += question.maxScore || 1;
        const answer = answers.find(a => a.questionId === question.id);

        if (answer) {
          // Leave awardedScore as null - manager will grade all questions manually
          // Don't set any score - manager will mark each question as correct/incorrect
        }
      }

      // Don't calculate score or pass/fail - manager will review and decide
      const updated = await storage.updateAssessmentAttempt(attempt.id, {
        status: "SUBMITTED",
        submittedAt: new Date(),
        score: null, // Manager will set after review
        maxScore,
        passed: null, // Manager will decide pass/fail
      });

      // Return results (for public assessments, don't show score - manager will review)
      res.json({
        score: null, // Manager will review and set score
        maxScore,
        passed: null, // Pending manager review
        passingScore: 75, // 75% threshold
        message: "Your assessment has been submitted. Results will be available after manager review.",
      });
    } catch (error) {
      console.error("Error submitting public assessment:", error);
      res.status(500).json({ message: "Failed to submit assessment" });
    }
  });

  // Public assessment route (no auth required)
  app.get("/api/public/assessment/:token", async (req, res) => {
    try {
      console.log("🔍 Fetching public assessment with token:", req.params.token);
      const assignment = await storage.getAssignmentByPublicToken(req.params.token);
      console.log("📋 Assignment found:", assignment ? "Yes" : "No");

      if (!assignment) {
        console.log("❌ Assignment not found for token:", req.params.token);
        return res.status(404).json({ message: "Assessment link not found or invalid" });
      }

      const assessment = await storage.getAssessment(assignment.assessmentId);
      if (!assessment) {
        console.log("❌ Assessment not found for ID:", assignment.assessmentId);
        return res.status(404).json({ message: "Assessment not found" });
      }

      console.log("✅ Returning assessment data");
      res.json({
        assignment,
        assessment: {
          id: assessment.id,
          title: assessment.title,
          description: assessment.description,
          durationMinutes: assessment.durationMinutes,
        },
      });
    } catch (error: any) {
      console.error("❌ Error fetching public assessment:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
      });
      res.status(500).json({
        message: "Failed to fetch assessment",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // Public assessment email verification
  app.post("/api/public/assessment/:token/verify-email", async (req, res) => {
    try {
      const { email } = req.body;
      const assignment = await storage.getAssignmentByPublicToken(req.params.token);

      if (!assignment) {
        return res.status(404).json({ message: "Assessment link not found or invalid" });
      }

      if (assignment.email?.toLowerCase() !== email?.toLowerCase()) {
        return res.status(403).json({ message: "Email does not match" });
      }

      // Check if attempt already exists
      if (assignment.userId) {
        const existingAttempt = await storage.getAttemptByUserAndAssessment(assignment.userId, assignment.assessmentId);
        if (existingAttempt && existingAttempt.status === "SUBMITTED") {
          return res.status(400).json({ message: "You have already completed this assessment" });
        }
      }

      res.json({ verified: true, assignment });
    } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  // Public start assessment attempt
  app.post("/api/public/assessment/:token/start", async (req, res) => {
    try {
      const { email } = req.body;
      const assignment = await storage.getAssignmentByPublicToken(req.params.token);

      if (!assignment) {
        return res.status(404).json({ message: "Assessment link not found" });
      }

      if (assignment.email?.toLowerCase() !== email?.toLowerCase()) {
        return res.status(403).json({ message: "Email does not match" });
      }

      const assessment = await storage.getAssessment(assignment.assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      // Get or create user
      let user = assignment.userId ? await storage.getUser(assignment.userId) : null;
      if (!user) {
        // Try to find user by email first
        user = await storage.getUserByEmail(email);
        if (!user) {
          // Create a temporary user for the assessment
          const { hashPassword } = await import("./services/credential-service");
          user = await storage.createUser({
            email: email,
            password: await hashPassword(Math.random().toString(36)),
            name: email.split("@")[0],
            role: "LEARNER",
          });
        }

        // Update assignment with userId if it doesn't have one
        if (!assignment.userId) {
          await storage.updateAssessmentAssignment(assignment.id, { userId: user.id });
        }
      }

      // Check for existing attempt
      const existingAttempt = await storage.getAttemptByUserAndAssessment(user.id, assessment.id);
      if (existingAttempt && existingAttempt.status === "SUBMITTED") {
        return res.status(400).json({ message: "You have already completed this assessment" });
      }
      if (existingAttempt && existingAttempt.status === "IN_PROGRESS") {
        // Return existing attempt
        const questions = await storage.getQuestionsByAssessment(assessment.id);
        const safeQuestions = questions.map(q => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          optionsJson: q.optionsJson,
          maxScore: q.maxScore,
          order: q.order,
        }));
        return res.json({ attempt: existingAttempt, questions: safeQuestions });
      }

      // Create new attempt
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + (assessment.durationMinutes || 60));

      const attempt = await storage.createAssessmentAttempt({
        assessmentId: assessment.id,
        userId: user.id,
        applicationId: null,
        status: "IN_PROGRESS",
        expiresAt,
      });

      // Get questions (without correct answers)
      const questions = await storage.getQuestionsByAssessment(assessment.id);
      const safeQuestions = questions.map(q => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        optionsJson: q.optionsJson,
        maxScore: q.maxScore,
        order: q.order,
      }));

      res.json({ attempt, questions: safeQuestions });
    } catch (error) {
      console.error("Error starting public assessment:", error);
      res.status(500).json({ message: "Failed to start assessment" });
    }
  });

  // Debug: Log all registered routes (development only)
  if (process.env.NODE_ENV === "development") {
    console.log("📋 Registered public assessment routes:");
    console.log("  - POST /api/public/assessment/:attemptId/answers");
    console.log("  - POST /api/public/assessment/:attemptId/submit");
    console.log("  - GET  /api/public/assessment/:token");
    console.log("  - POST /api/public/assessment/:token/verify-email");
    console.log("  - POST /api/public/assessment/:token/start");
  }

  // Admin approve mentor credentials
  app.post("/api/admin/mentors/:id/approve-credentials", requireRole("ADMIN"), async (req, res) => {
    try {
      const profile = await storage.getMentorProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Mentor profile not found" });
      }

      const adminId = req.session!.userId!;
      await storage.updateMentorProfile(profile.id, {
        credentialsApprovedBy: adminId,
        credentialsApprovedAt: new Date(),
      });

      // Notify manager
      const managerNotifications = await storage.getNotificationsByUser(profile.userId); // This should be the manager who created it
      // Actually, we need to track who created the mentor. For now, notify all managers
      const managers = await storage.getUsersByRole("MANAGER");
      for (const manager of managers) {
        await storage.createNotification({
          userId: manager.id,
          type: "CREDENTIALS_APPROVED",
          title: `Mentor Credentials Approved`,
          message: `Credentials for mentor have been approved. You can now share them.`,
          metadataJson: {
            mentorProfileId: profile.id,
            mentorId: profile.userId,
          },
        });
      }

      res.json({ message: "Credentials approved successfully" });
    } catch (error) {
      console.error("Error approving credentials:", error);
      res.status(500).json({ message: "Failed to approve credentials" });
    }
  });

  // ============================================
  // Problem Statements Routes
  // ============================================

  // Get signed upload URL for problem statement files
  app.post("/api/problem-statements/files/upload-url", requireAuth, async (req, res) => {
    try {
      const { fileName, fileType } = req.body;

      if (!fileName || !fileType) {
        return res.status(400).json({ message: "fileName and fileType are required" });
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'video/mp4',
        'video/quicktime',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      if (!allowedTypes.includes(fileType)) {
        return res.status(400).json({ message: "File type not allowed" });
      }

      if (process.env.AWS_S3_BUCKET_NAME) {
        const { S3StorageService } = await import("./s3Storage");
        const storageService = new S3StorageService();

        const timestamp = Date.now();
        const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const objectKey = `problem-statements/${req.user!.id}/${timestamp}-${safeFileName}`;

        const uploadURL = await storageService.getSignedUploadURL(objectKey, fileType, 600);

        res.json({ uploadURL, objectKey });
      } else {
        return res.status(501).json({ message: "S3 storage not configured" });
      }
    } catch (error: any) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Get signed view URL for problem statement files
  app.post("/api/problem-statements/files/view-url", requireAuth, async (req, res) => {
    try {
      const { objectKey } = req.body;

      if (!objectKey) {
        return res.status(400).json({ message: "objectKey is required" });
      }

      if (process.env.AWS_S3_BUCKET_NAME) {
        const { S3StorageService } = await import("./s3Storage");
        const storageService = new S3StorageService();

        const exists = await storageService.objectExists(objectKey);
        if (!exists) {
          return res.status(404).json({ message: "File not found" });
        }

        const fileUrl = await storageService.getSignedDownloadURL(objectKey, 3600);

        res.json({ fileUrl });
      } else {
        return res.status(501).json({ message: "S3 storage not configured" });
      }
    } catch (error: any) {
      console.error("Error generating view URL:", error);
      res.status(500).json({ message: "Failed to generate view URL" });
    }
  });

  // ---------------------------------------------------------------------
  // Tracks — the catalog backing problem_statements.track
  //
  // `track` used to be a postgres enum, so an industry that wasn't compiled
  // into the enum could not be stored. The list now lives in the `tracks`
  // table; admins can add to it at runtime. Because the database no longer
  // constrains the column, every write path must validate against the
  // catalog — see resolveTrackOrFail below.
  // ---------------------------------------------------------------------

  /**
   * Resolves a submitted track to its canonical catalog value.
   * Returns null and sends the response when the track is missing or unknown.
   */
  async function resolveTrackOrFail(
    rawTrack: unknown,
    res: Response,
    /**
     * The value currently stored on the row being updated. A retired track is
     * still accepted when it is what the row already had, so retiring a track
     * doesn't make every existing problem statement on it unsaveable — an admin
     * editing only the title would otherwise be blocked.
     */
    currentValue?: string | null
  ): Promise<string | null> {
    const value = typeof rawTrack === "string" ? rawTrack.trim() : "";
    if (!value) {
      res.status(400).json({ message: "track is required" });
      return null;
    }
    const existing = await storage.getTrackByValue(value);
    if (!existing) {
      res.status(400).json({
        message: `Unknown track "${value}". Pick one from the list, or ask an admin to add it.`,
      });
      return null;
    }
    if (!existing.isActive && existing.value !== currentValue) {
      res.status(400).json({
        message: `"${existing.label}" is no longer available. Pick another track.`,
      });
      return null;
    }
    return existing.value;
  }

  // Deliberately unauthenticated: the public application form at /apply needs
  // this list, and it is only industry names — the same values that were
  // already hardcoded into the client bundle. Writes stay admin-only below.
  app.get("/api/tracks", async (req, res) => {
    try {
      const includeInactive =
        req.query.includeInactive === "true" && req.user?.role === "ADMIN";
      const rows = await storage.getTracks(includeInactive);
      res.json(
        rows.map((t) => ({ value: t.value, label: t.label, isActive: t.isActive }))
      );
    } catch (error: any) {
      console.error("List tracks error:", error);
      res.status(500).json({ message: "Failed to load tracks" });
    }
  });

  // Only admins may introduce a new track.
  app.post("/api/tracks", requireAuth, requireRole("ADMIN"), async (req, res) => {
    try {
      const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
      if (!label) {
        return res.status(400).json({ message: "Track name is required" });
      }
      if (label.length > TRACK_LABEL_MAX_LENGTH) {
        return res.status(400).json({
          message: `Track name must be ${TRACK_LABEL_MAX_LENGTH} characters or fewer`,
        });
      }

      const value = slugifyTrack(label);
      if (!value) {
        return res
          .status(400)
          .json({ message: "Track name must contain at least one letter or number" });
      }

      // Match on the derived value AND the label (case-insensitively) using the
      // same helper the client uses, so "SaaS & B2B Software" resolves to the
      // seeded SaaS_B2B rather than creating a near-duplicate.
      const catalog = await storage.getTracks(true);
      const duplicate =
        findExistingTrack(label, catalog.map((t) => ({ value: t.value, label: t.label })));
      const existing = duplicate
        ? catalog.find((t) => t.value === duplicate.value)
        : await storage.getTrackByValue(value);

      if (existing) {
        // Retired track being asked for again: bring it back rather than erroring.
        if (!existing.isActive) {
          const revived = await storage.updateTrack(existing.id, { isActive: true });
          return res.json({
            value: revived?.value ?? existing.value,
            label: revived?.label ?? existing.label,
            reactivated: true,
          });
        }
        return res.status(409).json({
          message: `"${existing.label}" already exists`,
          track: { value: existing.value, label: existing.label },
        });
      }

      let created;
      try {
        created = await storage.createTrack(
          insertTrackSchema.parse({
            value,
            label,
            createdBy: req.user!.id,
          })
        );
      } catch (insertError: any) {
        // 23505 = unique_violation. Two admins submitting the same label at the
        // same time both pass the check above; the loser resolves to the row
        // the winner created rather than returning a 500.
        if (insertError?.code === "23505") {
          const raced = await storage.getTrackByValue(value);
          if (raced) {
            return res.status(409).json({
              message: `"${raced.label}" already exists`,
              track: { value: raced.value, label: raced.label },
            });
          }
        }
        throw insertError;
      }

      console.log(`🏷️  Track created: ${created.label} (${created.value}) by ${req.user!.email}`);
      res.status(201).json({ value: created.value, label: created.label });
    } catch (error: any) {
      console.error("Create track error:", error);
      res.status(500).json({ message: "Failed to create track" });
    }
  });

  // Rename or retire a track (admins only). Retiring hides it from pickers but
  // leaves existing problem statements pointing at it.
  app.patch("/api/tracks/:value", requireAuth, requireRole("ADMIN"), async (req, res) => {
    try {
      const existing = await storage.getTrackByValue(req.params.value);
      if (!existing) return res.status(404).json({ message: "Track not found" });

      const updates: { label?: string; isActive?: boolean } = {};

      if (typeof req.body?.label === "string") {
        const label = req.body.label.trim();
        if (!label) return res.status(400).json({ message: "Track name cannot be empty" });
        if (label.length > TRACK_LABEL_MAX_LENGTH) {
          return res.status(400).json({
            message: `Track name must be ${TRACK_LABEL_MAX_LENGTH} characters or fewer`,
          });
        }
        // Renaming has to run the same duplicate check as creating, or a rename
        // can produce two rows sharing a label.
        const catalog = await storage.getTracks(true);
        const clash = findExistingTrack(
          label,
          catalog
            .filter((t) => t.value !== existing.value)
            .map((t) => ({ value: t.value, label: t.label }))
        );
        if (clash) {
          return res.status(409).json({
            message: `"${clash.label}" already exists`,
            track: clash,
          });
        }
        updates.label = label;
      }
      if (typeof req.body?.isActive === "boolean") {
        updates.isActive = req.body.isActive;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Nothing to update" });
      }

      const updated = await storage.updateTrack(existing.id, updates as any);
      res.json({
        value: updated!.value,
        label: updated!.label,
        isActive: updated!.isActive,
      });
    } catch (error: any) {
      console.error("Update track error:", error);
      res.status(500).json({ message: "Failed to update track" });
    }
  });

  // Teams a given user is assigned to. Used by the assign dialog so an admin can
  // pick which of a mentor's teams should receive a problem statement —
  // /api/mentor/teams is MENTOR-gated and so unusable here.
  app.get("/api/admin/users/:userId/teams", requireAuth, requireRole("ADMIN"), async (req, res) => {
    try {
      const assignments = await storage.getRoleAssignmentsByUser(req.params.userId);
      const teams = await Promise.all(
        assignments.map(async (a) => {
          const team = await storage.getTeam(a.teamId);
          if (!team) return null;
          const ps = team.problemStatementId
            ? await storage.getProblemStatement(team.problemStatementId)
            : null;
          return {
            id: team.id,
            name: team.name,
            cohortId: team.cohortId,
            teamRole: a.role,
            // So the picker can show which teams are already taken.
            problemStatementId: team.problemStatementId ?? null,
            problemStatementTitle: ps?.title ?? null,
          };
        })
      );
      res.json(teams.filter(Boolean));
    } catch (error: any) {
      console.error("List user teams error:", error);
      res.status(500).json({ message: "Failed to load teams for this user" });
    }
  });

  // Create/submit a problem statement (Founders, Co-founders, Mentors)
  app.post("/api/problem-statements", requireAuth, async (req, res) => {
    try {
      const user = req.user!;

      // Allow ADMIN, FOUNDER, and MENTOR to create problem statements
      // Block COFOUNDER from creating problem statements
      if (!["ADMIN", "FOUNDER", "MENTOR"].includes(user.role)) {
        return res.status(403).json({ message: "Only admins, founders, and mentors can submit problem statements" });
      }

      // Prevent duplicate submissions: a user can submit only one problem statement (except for ADMIN)
      if (user.role !== "ADMIN") {
        const allStatements = await storage.getProblemStatements();
        const existing = allStatements.find(s => s.createdBy === user.id);
        if (existing) {
          return res.status(409).json({ message: "You have already submitted a problem statement" });
        }
      }

      const { title, overview, track, fileKeys, publish } = req.body;

      if (!title || !overview || !track) {
        return res.status(400).json({ message: "title, overview, and track are required" });
      }

      // The column is plain text now, so the catalog is the only thing keeping
      // junk out. Resolves to the canonical value (fixes casing differences).
      const resolvedTrack = await resolveTrackOrFail(track, res);
      if (!resolvedTrack) return;

      // Determine createdByRole based on user's role
      const createdByRole = user.role === "ADMIN" ? "ADMIN" : user.role === "MENTOR" ? "MENTOR" : "FOUNDER";

      // If admin wants to publish immediately, set status to PUBLISHED, otherwise PENDING
      const initialStatus = (user.role === "ADMIN" && publish === true) ? 'PUBLISHED' : 'PENDING';

      const problemStatementData: any = {
        title,
        overview,
        track: resolvedTrack,
        fileKeys: fileKeys || [],
        createdBy: user.id,
        createdByRole: createdByRole as any,
        status: initialStatus as any,
      };

      // If publishing immediately, set publishedAt and publishedBy
      if (initialStatus === 'PUBLISHED') {
        problemStatementData.publishedAt = new Date();
        problemStatementData.publishedBy = user.id;
      }

      console.log("📋 Creating problem statement with data:", {
        title: problemStatementData.title?.substring(0, 50),
        track: problemStatementData.track,
        createdBy: problemStatementData.createdBy,
        createdByRole: problemStatementData.createdByRole,
        status: problemStatementData.status,
        fileKeysCount: problemStatementData.fileKeys?.length || 0,
        userRole: user.role,
      });
      
      // Validate createdByRole value before inserting
      const validRoles = ["ADMIN", "MENTOR", "FOUNDER"];
      if (!validRoles.includes(problemStatementData.createdByRole)) {
        console.error("❌ Invalid createdByRole:", problemStatementData.createdByRole, "User role:", user.role);
        return res.status(400).json({ 
          message: `Invalid role: ${problemStatementData.createdByRole}. Must be one of: ${validRoles.join(", ")}` 
        });
      }

      console.log("✅ Validation passed, inserting into database...");
      const problemStatement = await storage.createProblemStatement(problemStatementData);
      console.log("✅ Problem statement created successfully:", problemStatement.id);

      // If admin published immediately, run the publish logic
      if (user.role === "ADMIN" && publish === true && initialStatus === 'PUBLISHED') {
        try {
          // Get founder's application to find their preferred track
          const creator = await storage.getUser(problemStatement.createdBy);
          
          // Only get applications if creator is not the current user (to avoid unnecessary query)
          // Use getApplicationsByUser instead of getApplications to avoid loading all applications
          let founderApp = null;
          if (creator && creator.id !== user.id) {
            try {
              const userApplications = await storage.getApplicationsByUser(problemStatement.createdBy);
              founderApp = userApplications.length > 0 ? userApplications[0] : null;
            } catch (appError: any) {
              console.error("Error getting applications (non-fatal):", appError);
              // Continue without founder app data
            }
          }

          let mentorTrack = problemStatement.track;
          if (founderApp?.formJson) {
            const formData = founderApp.formJson as any;
            if (formData.preferredTrack) {
              mentorTrack = formData.preferredTrack;
            }
          }

          // Find mentors with matching track in their tracksJson
          let matchingMentors: any[] = [];
          try {
            const allMentorProfiles = await storage.getMentorProfiles();
            matchingMentors = allMentorProfiles.filter(profile => {
              const tracks = profile.tracksJson as string[] | null;
              return tracks && tracks.includes(mentorTrack);
            });
          } catch (mentorError: any) {
            console.error("Error getting mentor profiles (non-fatal):", mentorError);
            // Continue without mentor notifications
          }

          // Create notifications for matching mentors (don't fail if this errors)
          for (const mentorProfile of matchingMentors) {
            try {
              await storage.createNotification({
                userId: mentorProfile.userId,
                type: 'PROBLEM_STATEMENT_PUBLISHED' as any,
                title: 'New Problem Statement Published',
                message: `A new problem statement has been published: "${problemStatement.title}"`,
                metadataJson: { problemStatementId: problemStatement.id },
              });
            } catch (notifError: any) {
              console.error(`Failed to create notification for mentor ${mentorProfile.userId}:`, notifError);
              // Continue with other notifications
            }
          }

          // Notify the creator that their problem statement was published
          // Only send notification if the creator is a FOUNDER (not if admin created it)
          if (creator && creator.id !== user.id && problemStatement.createdByRole === 'FOUNDER') {
            try {
              await storage.createNotification({
                userId: creator.id,
                type: 'PROBLEM_STATEMENT_PUBLISHED' as any,
                title: 'Your Problem Statement is Published',
                message: `Your problem statement "${problemStatement.title}" has been published and sent to mentors.`,
                metadataJson: { problemStatementId: problemStatement.id },
              });
            } catch (notifError: any) {
              console.error(`Failed to create notification for creator ${creator.id}:`, notifError);
              // Don't fail the request if notification fails
            }
          }
        } catch (publishError: any) {
          console.error("Error in publish logic (non-fatal):", publishError);
          // Don't fail the request if publish logic fails - problem statement is already created
        }
      } else {
        // Create notification for admins only if not published immediately
        try {
          const adminUsers = await storage.getUsersByRole("ADMIN");

          for (const admin of adminUsers) {
            try {
              await storage.createNotification({
                userId: admin.id,
                type: 'PROBLEM_STATEMENT_SUBMITTED' as any,
                title: 'New Problem Statement Submitted',
                message: `${user.name} has submitted a new problem statement: "${title}"`,
                metadataJson: { problemStatementId: problemStatement.id },
              });
            } catch (notifError: any) {
              console.error(`Failed to create notification for admin ${admin.id}:`, notifError);
              // Continue with other admins
            }
          }
        } catch (notifError: any) {
          console.error("Error creating admin notifications (non-fatal):", notifError);
          // Don't fail the request if notification creation fails
        }
      }

      res.json(problemStatement);
    } catch (error: any) {
      // Log detailed error server-side for debugging
      console.error("Error creating problem statement:", error);
      console.error("Error stack:", error.stack);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        column: error.column,
        stack: error.stack,
      });
      // Always log the full error for debugging
      console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      // Return generic error message to client (no database schema details)
      res.status(500).json({ 
        message: "Failed to create problem statement. Please try again later.",
        // Only include error details in development mode
        ...(process.env.NODE_ENV === "development" && {
          error: {
            message: error.message,
          }
        })
      });
    }
  });

  // Get all problem statements (filtered by role)
  app.get("/api/problem-statements", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      
      // Validate user object
      if (!user || !user.id || !user.role) {
        console.error("❌ Invalid user object in GET /api/problem-statements:", user);
        return res.status(401).json({ message: "Invalid user session" });
      }
      
      console.log(`📋 GET /api/problem-statements - User: ${user.id} (${user.role})`);
      
      // If caller specifically requests published statements, return a paginated
      // list of published problem statements for any authenticated user.
      if (req.query.status === 'PUBLISHED') {
        const page = parseInt((req.query.page as string) || "1", 10) || 1;
        const limit = parseInt((req.query.limit as string) || "16", 10) || 16;
        const category = req.query.category as string; // "open-challenges" or "join-founder-team"
        
        let allPublished = await storage.getProblemStatements({ status: 'PUBLISHED' });

        // Filter by category (createdByRole)
        if (category === 'open-challenges') {
          // Show only ADMIN and MENTOR created statements
          const beforeFilter = allPublished.length;
          allPublished = allPublished.filter(s => s.createdByRole === 'ADMIN' || s.createdByRole === 'MENTOR');
          console.log(`[Open Challenges] Filtered ${beforeFilter} published statements to ${allPublished.length} (ADMIN/MENTOR only)`);
          console.log(`[Open Challenges] Found statements:`, allPublished.map(s => ({ id: s.id, title: s.title, createdByRole: s.createdByRole })));
        } else if (category === 'join-founder-team') {
          // Show only FOUNDER created statements
          allPublished = allPublished.filter(s => s.createdByRole === 'FOUNDER');
        }

        // Don't hide problem statements - they remain visible to everyone
        // Apply button will be disabled for learners when learner count >= 7

        const total = allPublished.length;
        const start = (page - 1) * limit;
        const items = allPublished.slice(start, start + limit);
        
        console.log(`[Open Challenges] Pagination: page=${page}, limit=${limit}, total=${total}, showing items ${start} to ${start + limit - 1}`);
        console.log(`[Open Challenges] Items on this page:`, items.map(s => ({ id: s.id, title: s.title, createdByRole: s.createdByRole })));

        // Attach creator info and application counts
        const itemsWithCreator = await Promise.all(items.map(async (s: any) => {
          try {
            const creator = await storage.getUser(s.createdBy);
            const learnerCount = await storage.getLearnerApplicationCount(s.id);
            const cofounderCount = await storage.getCofounderApplicationCount(s.id);
            
            // Check if current user has already applied
            let userApplication = null;
            if (user.role === 'LEARNER' || user.role === 'COFOUNDER') {
              userApplication = await storage.getProblemStatementApplication(s.id, user.id);
            }
            
            return { 
              ...s, 
              creator: creator ? { id: creator.id, name: creator.name } : null,
              learnerApplicationCount: learnerCount,
              cofounderApplicationCount: cofounderCount,
              userApplication: userApplication,
              isTaken: !!s.teamFormedAt,
            };
          } catch (error) {
            console.error(`Error processing problem statement ${s.id}:`, error);
            // Return statement with default values if there's an error
            return {
              ...s,
              creator: null,
              learnerApplicationCount: 0,
              cofounderApplicationCount: 0,
              userApplication: null,
            };
          }
        }));

        return res.json({ items: itemsWithCreator, total, page, limit });
      }

      let filters: any = {};

      // Founders see their own problem statement; if a team is formed, they see the team's problem statement
      if (user.role === 'FOUNDER') {
        // Get user's team (if any)
        const assignments = await storage.getRoleAssignmentsByUser(user.id);
        if (assignments.length === 0) {
          // No team assigned yet: show the founder's own submitted problem statement (if any)
          const ownStatements = await storage.getProblemStatements({ createdBy: user.id });
          if (ownStatements.length === 0) {
            return res.json([]);
          }

          // Add application counts and isTaken for their own statement(s)
          const statementsWithCounts = await Promise.all(ownStatements.map(async (stmt: any) => {
            try {
              const learnerCount = await storage.getLearnerApplicationCount(stmt.id);
              const cofounderCount = await storage.getCofounderApplicationCount(stmt.id);
              return {
                ...stmt,
                learnerApplicationCount: learnerCount,
                cofounderApplicationCount: cofounderCount,
                isTaken: !!stmt.teamFormedAt,
              };
            } catch (error: any) {
              console.error(`Error getting counts for founder problem statement ${stmt.id}:`, error);
              return {
                ...stmt,
                learnerApplicationCount: 0,
                cofounderApplicationCount: 0,
                isTaken: !!stmt.teamFormedAt,
              };
            }
          }));

          return res.json(statementsWithCounts);
        }

        const team = await storage.getTeam(assignments[0].teamId);
        if (!team || !team.problemStatementId) {
          // Team exists but no problem statement linked yet:
          // fall back to showing the founder's own submitted problem statement (if any)
          const ownStatements = await storage.getProblemStatements({ createdBy: user.id });
          if (ownStatements.length === 0) {
            return res.json([]);
          }

          const statementsWithCounts = await Promise.all(ownStatements.map(async (stmt: any) => {
            try {
              const learnerCount = await storage.getLearnerApplicationCount(stmt.id);
              const cofounderCount = await storage.getCofounderApplicationCount(stmt.id);
              return {
                ...stmt,
                learnerApplicationCount: learnerCount,
                cofounderApplicationCount: cofounderCount,
                isTaken: !!stmt.teamFormedAt,
              };
            } catch (error: any) {
              console.error(`Error getting counts for founder problem statement ${stmt.id}:`, error);
              return {
                ...stmt,
                learnerApplicationCount: 0,
                cofounderApplicationCount: 0,
                isTaken: !!stmt.teamFormedAt,
              };
            }
          }));

          return res.json(statementsWithCounts);
        }

        // Get only the team's problem statement
        const teamStatement = await storage.getProblemStatement(team.problemStatementId);
        if (!teamStatement) {
          return res.json([]);
        }

        // Add application counts and isTaken
        try {
          const learnerCount = await storage.getLearnerApplicationCount(teamStatement.id);
          const cofounderCount = await storage.getCofounderApplicationCount(teamStatement.id);
          const statementWithCounts = {
            ...teamStatement,
            learnerApplicationCount: learnerCount,
            cofounderApplicationCount: cofounderCount,
            isTaken: !!teamStatement.teamFormedAt,
          };
          return res.json([statementWithCounts]);
        } catch (error: any) {
          console.error(`Error getting counts for problem statement ${teamStatement.id}:`, error);
          return res.json([{
            ...teamStatement,
            learnerApplicationCount: 0,
            cofounderApplicationCount: 0,
            isTaken: !!teamStatement.teamFormedAt,
          }]);
        }
      }
      
      // Co-founders and Learners see only their team's problem statement
      if (user.role === 'COFOUNDER' || user.role === 'LEARNER') {
        // Prefer the team that actually has a problem statement — see
        // primaryTeamForUser. Taking assignments[0] meant a member on more than
        // one team got an arbitrary team and an empty list.
        const { team } = await primaryTeamForUser(user.id);
        if (!team) {
          // No team assigned, return empty array
          return res.json([]);
        }

        if (!team.problemStatementId) {
          // No team or no problem statement assigned to team
          return res.json([]);
        }

        // Get only the team's problem statement
        const teamStatement = await storage.getProblemStatement(team.problemStatementId);
        if (!teamStatement) {
          return res.json([]);
        }

        // Add application counts and isTaken
        try {
          const learnerCount = await storage.getLearnerApplicationCount(teamStatement.id);
          const cofounderCount = await storage.getCofounderApplicationCount(teamStatement.id);
          const statementWithCounts = {
            ...teamStatement,
            learnerApplicationCount: learnerCount,
            cofounderApplicationCount: cofounderCount,
            isTaken: !!teamStatement.teamFormedAt,
          };
          return res.json([statementWithCounts]);
        } catch (error: any) {
          console.error(`Error getting counts for problem statement ${teamStatement.id}:`, error);
          return res.json([{
            ...teamStatement,
            learnerApplicationCount: 0,
            cofounderApplicationCount: 0,
            isTaken: !!teamStatement.teamFormedAt,
          }]);
        }
      }
      // Admins see pending for review
      else if (user.role === 'ADMIN') {
        // Show all for admin, or filter by status if query param provided
        if (req.query.status) {
          filters.status = req.query.status as string;
        }
      }
      // Mentors see only their team's problem statement
      else if (user.role === 'MENTOR') {
        // Get user's team
        const assignments = await storage.getRoleAssignmentsByUser(user.id);
        if (assignments.length === 0) {
          // No team assigned, return empty array
          return res.json([]);
        }

        const team = await storage.getTeam(assignments[0].teamId);
        if (!team || !team.problemStatementId) {
          // No team or no problem statement assigned to team
          return res.json([]);
        }

        // Get only the team's problem statement
        const teamStatement = await storage.getProblemStatement(team.problemStatementId);
        if (!teamStatement) {
          return res.json([]);
        }

        // Add application counts and isTaken
        try {
          const learnerCount = await storage.getLearnerApplicationCount(teamStatement.id);
          const cofounderCount = await storage.getCofounderApplicationCount(teamStatement.id);
          const statementWithCounts = {
            ...teamStatement,
            learnerApplicationCount: learnerCount,
            cofounderApplicationCount: cofounderCount,
            isTaken: !!teamStatement.teamFormedAt,
          };
          return res.json([statementWithCounts]);
        } catch (error: any) {
          console.error(`Error getting counts for problem statement ${teamStatement.id}:`, error);
          return res.json([{
            ...teamStatement,
            learnerApplicationCount: 0,
            cofounderApplicationCount: 0,
            isTaken: !!teamStatement.teamFormedAt,
          }]);
        }
      }

      // Call getProblemStatements - if filters is empty, pass undefined instead
      const statements = await storage.getProblemStatements(
        Object.keys(filters).length > 0 ? filters : undefined
      );

      // For other roles (ADMIN), return all statements
      let finalStatements = statements;

      // Add application counts and isTaken for all statements
      const statementsWithCounts = await Promise.all(finalStatements.map(async (stmt: any) => {
        try {
          const learnerCount = await storage.getLearnerApplicationCount(stmt.id);
          const cofounderCount = await storage.getCofounderApplicationCount(stmt.id);
          return {
            ...stmt,
            learnerApplicationCount: learnerCount,
            cofounderApplicationCount: cofounderCount,
            isTaken: !!stmt.teamFormedAt,
          };
        } catch (error: any) {
          console.error(`Error getting counts for problem statement ${stmt.id}:`, error);
          // Return statement with default counts if there's an error
          return {
            ...stmt,
            learnerApplicationCount: 0,
            cofounderApplicationCount: 0,
            isTaken: !!stmt.teamFormedAt,
          };
        }
      }));

      res.json(statementsWithCounts);
    } catch (error: any) {
      console.error("❌ Error fetching problem statements:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      });
      res.status(500).json({ 
        message: "Failed to fetch problem statements",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  // GET /api/mentor/my-problem-statements
  // Returns: mentor's own submitted PS + each team they are assigned to's PS.
  // Used by the /app/problem page for the mentor dropdown.
  app.get("/api/mentor/my-problem-statements", requireRole("MENTOR"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const results: Array<{ type: string; label: string; teamName?: string; ps: any }> = [];

      // 1. Mentor's own submitted PS(s)
      const ownPSs = await storage.getProblemStatements({ createdBy: userId });
      for (const ps of ownPSs) {
        results.push({ type: "own", label: ps.title, ps });
      }

      // 2. PSs from all teams the mentor is assigned to
      const assignments = await storage.getRoleAssignmentsByUser(userId);
      for (const assignment of assignments) {
        const team = await storage.getTeam(assignment.teamId);
        if (!team) continue;

        let ps: any = null;
        if (team.problemStatementId) {
          ps = await storage.getProblemStatement(team.problemStatementId);
        }
        if (!ps) {
          ps = await storage.getProblemStatementByTeamId(team.id);
        }

        if (ps) {
          // Avoid duplicates (e.g. mentor submitted a PS that is now their own team's PS)
          const alreadyAdded = results.some((r) => r.ps.id === ps.id);
          if (!alreadyAdded) {
            results.push({ type: "team", label: ps.title, teamName: team.name, ps });
          }
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error fetching mentor problem statements:", error);
      res.status(500).json({ message: "Failed to fetch mentor problem statements" });
    }
  });

  // Get problem statement by ID with full details
  app.get("/api/problem-statements/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const statement = await storage.getProblemStatementById(id);

      if (!statement) {
        return res.status(404).json({ message: "Problem statement not found" });
      }

      // Problem statements remain visible to everyone
      // Apply button will be disabled for learners when learner count >= 7

      // Generate signed URLs for files if using S3
      let fileUrls: Array<{ key: string; url: string }> = [];
      if (statement.fileKeys && statement.fileKeys.length > 0 && process.env.AWS_S3_BUCKET_NAME) {
        const { S3StorageService } = await import("./s3Storage");
        const storageService = new S3StorageService();

        fileUrls = await Promise.all(
          statement.fileKeys.map(async (key: string) => ({
            key,
            url: await storageService.getSignedDownloadURL(key, 3600)
          }))
        );
      }

      // Get creator details
      const creator = await storage.getUser(statement.createdBy);
      
      // Get application counts
      const learnerCount = await storage.getLearnerApplicationCount(statement.id);
      const cofounderCount = await storage.getCofounderApplicationCount(statement.id);
      
      // Check if user has already applied
      let userApplication = null;
      if (user.role === 'LEARNER' || user.role === 'COFOUNDER') {
        userApplication = await storage.getProblemStatementApplication(statement.id, user.id);
      }

      res.json({
        ...statement,
        fileUrls,
        creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : null,
        learnerApplicationCount: learnerCount,
        cofounderApplicationCount: cofounderCount,
        userApplication: userApplication,
        isTaken: !!statement.teamFormedAt,
      });
    } catch (error: any) {
      console.error("❌ Error fetching problem statement:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
        stack: error.stack,
      });
      res.status(500).json({ 
        message: "Failed to fetch problem statement",
        error: {
          message: error.message,
          code: error.code,
          detail: error.detail,
        }
      });
    }
  });

  // Update an existing problem statement (creator or admin)
  app.put("/api/problem-statements/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { title, overview, track, fileKeys } = req.body;

      const existing = await storage.getProblemStatementById(id);
      if (!existing) {
        return res.status(404).json({ message: "Problem statement not found" });
      }

      // Only the creator or an admin can edit
      if (existing.createdBy !== user.id && user.role !== "ADMIN") {
        return res.status(403).json({ message: "You can only edit your own problem statements" });
      }

      // Prevent edits after team formation — except for an admin correcting wording after the
      // fact (a typo, a rename like "Revenue" -> "Demand" Forecasting). A founder or mentor
      // editing the brief underneath a team that has already committed to it is the case this
      // guard exists for; an admin fixing the title is not that case.
      if (existing.teamFormedAt && user.role !== "ADMIN") {
        return res.status(400).json({ message: "Cannot edit problem statement after a team has been formed" });
      }

      // Non-admins cannot edit published statements
      if (existing.status === "PUBLISHED" && user.role !== "ADMIN") {
        return res.status(400).json({ message: "Cannot edit a published problem statement" });
      }

      if (!title || !overview || !track) {
        return res.status(400).json({ message: "title, overview, and track are required" });
      }

      // Same catalog check as on create — the column no longer constrains
      // itself. Passing the stored value keeps a retired track editable.
      const resolvedTrack = await resolveTrackOrFail(track, res, existing.track);
      if (!resolvedTrack) return;

      const updateData: any = {
        title,
        overview,
        track: resolvedTrack,
        fileKeys: fileKeys || [],
      };

      const updated = await storage.updateProblemStatement(id, updateData);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update problem statement" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating problem statement:", error);
      res.status(500).json({
        message: "Failed to update problem statement",
        ...(process.env.NODE_ENV === "development" && { error: error.message }),
      });
    }
  });

  // PATCH /api/problem-statements/:id/meta
  // Allows FOUNDER (creator) or MENTOR (assigned to the same team) to update
  // expected_outcomes and constraints_requirements only.
  // Existing fields (title, overview, track, status, files) are NOT touched.
  app.patch("/api/problem-statements/:id/meta", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Role gate — only founder or mentor may call this
      if (user.role !== "FOUNDER" && user.role !== "MENTOR") {
        return res.status(403).json({ message: "Only founders and mentors can update problem statement details." });
      }

      const existing = await storage.getProblemStatementById(id);
      if (!existing) {
        return res.status(404).json({ message: "Problem statement not found." });
      }

      if (user.role === "FOUNDER") {
        // Founder must be the original creator
        if (existing.createdBy !== user.id) {
          return res.status(403).json({ message: "You can only edit your own problem statements." });
        }
      } else {
        // Mentor: allow if creator OR assigned to the linked team
        const isCreator = existing.createdBy === user.id;
        if (!isCreator) {
          if (!existing.teamId) {
            return res.status(403).json({ message: "This problem statement is not yet linked to a team." });
          }
          const assignments = await storage.getRoleAssignmentsByUser(user.id);
          const onTeam = assignments.some((a) => a.teamId === existing.teamId);
          if (!onTeam) {
            return res.status(403).json({ message: "You are not assigned as a mentor for this team." });
          }
        }
      }

      const { expectedOutcomes, constraintsRequirements } = req.body as {
        expectedOutcomes?: string;
        constraintsRequirements?: string;
      };

      const updateData: Record<string, string | null> = {};
      if (expectedOutcomes !== undefined) updateData.expectedOutcomes = expectedOutcomes ?? null;
      if (constraintsRequirements !== undefined) updateData.constraintsRequirements = constraintsRequirements ?? null;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No fields to update." });
      }

      const updated = await storage.updateProblemStatement(id, updateData as any);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update problem statement." });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error patching problem statement meta:", error);
      res.status(500).json({ message: "Failed to update problem statement." });
    }
  });

  // Admin: Publish a problem statement
  app.post("/api/admin/problem-statements/:id/publish", requireAuth, requireRole('ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const statement = await storage.getProblemStatementById(id);

      if (!statement) {
        return res.status(404).json({ message: "Problem statement not found" });
      }

      if (statement.status === 'PUBLISHED') {
        return res.status(400).json({ message: "Problem statement already published" });
      }

      // Publish it
      const published = await storage.publishProblemStatement(id, req.user!.id);

      // Get founder's application to find their preferred track
      const creator = await storage.getUser(statement.createdBy);
      const applications = await storage.getApplications();
      const founderApp = applications.find(app => app.userId === statement.createdBy);

      let mentorTrack = statement.track;
      if (founderApp?.formJson) {
        const formData = founderApp.formJson as any;
        if (formData.preferredTrack) {
          mentorTrack = formData.preferredTrack;
        }
      }

      // Find mentors with matching track in their tracksJson
      const allMentorProfiles = await storage.getMentorProfiles();
      const matchingMentors = allMentorProfiles.filter(profile => {
        const tracks = profile.tracksJson as string[] | null;
        return tracks && tracks.includes(mentorTrack);
      });

      // Create notifications for matching mentors
      for (const mentorProfile of matchingMentors) {
        await storage.createNotification({
          userId: mentorProfile.userId,
          type: 'PROBLEM_STATEMENT_PUBLISHED' as any,
          title: 'New Problem Statement Published',
          message: `A new problem statement has been published: "${statement.title}"`,
          metadataJson: { problemStatementId: id },
        });
      }

      // When a founder's problem statement is accepted/published, make it their team's problem statement
      // so the founder and all their team members see it in the Problem Statements tab.
      if (statement.createdByRole === 'FOUNDER') {
        const founderId = statement.createdBy;
        const founderAssignments = await storage.getRoleAssignmentsByUser(founderId);

        if (founderAssignments.length === 0) {
          // Founder has no team yet: create one and assign founder so they (and future members) see this statement
          const cohorts = await storage.getCohorts();
          const cohort = cohorts[0];
          if (cohort) {
            const creator = await storage.getUser(founderId);
            const teamName = creator?.name ? `${creator.name}'s Team` : 'New Team';
            const team = await storage.createTeam({
              cohortId: cohort.id,
              name: teamName,
              problemStatementId: id,
              health: 'G' as any,
            });
            await storage.createRoleAssignment({
              teamId: team.id,
              userId: founderId,
              role: 'Founder' as any,
              stipendBand: 'A' as any,
            });
          }
        } else {
          // Founder already has a team: link this problem statement to it if not already set
          const team = await storage.getTeam(founderAssignments[0].teamId);
          if (team && !team.problemStatementId) {
            await storage.updateTeam(team.id, { problemStatementId: id });
          }
        }

        await storage.createNotification({
          userId: founderId,
          type: 'PROBLEM_STATEMENT_PUBLISHED' as any,
          title: 'Your Problem Statement is Published',
          message: `Your problem statement "${statement.title}" has been published. It is now your team's problem statement—you and your team members will see it in the Problem Statements tab.`,
          metadataJson: { problemStatementId: id },
        });

        // Link the published problem statement to the founder's team so all team members can see it
        try {
          const founderAssignments = await storage.getRoleAssignmentsByUser(statement.createdBy);
          const founderTeamAssignment = founderAssignments.find(a => a.role === "Founder" || a.role === "Promoter");
          
          if (founderTeamAssignment) {
            const team = await storage.getTeam(founderTeamAssignment.teamId);
            if (team) {
              // Link PS to team (both directions)
              await storage.updateProblemStatement(id, { teamId: team.id });
              if (!team.problemStatementId) {
                await storage.updateTeam(team.id, { problemStatementId: id });
              }
              console.log(`✅ Linked published problem statement ${id} to founder's team ${team.id}`);
            }
          }
        } catch (error) {
          console.error("⚠️ Error linking PS to team (non-critical):", error);
          // Don't fail the publish if linking fails - it can be done later
        }
      }

      res.json(published);
    } catch (error: any) {
      console.error("Error publishing problem statement:", error);
      res.status(500).json({ message: "Failed to publish problem statement" });
    }
  });

  // Admin: Assign founder and create team from problem statement applications
  app.post("/api/admin/problem-statements/:id/assign-founder", requireAuth, requireRole('ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const { cohortId, teamName } = req.body;
      const user = req.user!;

      // The team lead can be a FOUNDER (original behaviour) or a MENTOR.
      // `founderId` is still accepted so existing callers keep working.
      const leadRole: string = String(req.body.leadRole ?? "FOUNDER").toUpperCase();
      const leadUserId: string | undefined = req.body.leadUserId ?? req.body.founderId;

      if (leadRole !== "FOUNDER" && leadRole !== "MENTOR") {
        return res
          .status(400)
          .json({ message: 'leadRole must be either "FOUNDER" or "MENTOR"' });
      }

      // The two roles work differently on purpose.
      //
      // FOUNDER: the founder has no team yet, so this CREATES one from the
      // problem statement's applicants — needs a cohort and a team name.
      //
      // MENTOR: the mentor already mentors one or more teams, so this attaches
      // the statement to an EXISTING team rather than creating another. The
      // admin says which team, because teams.problemStatementId holds one value
      // and a mentor may have several teams.
      const existingTeamId: string | undefined = req.body.teamId;

      if (!leadUserId) {
        return res
          .status(400)
          .json({ message: "leadUserId (or founderId) is required" });
      }
      if (leadRole === "FOUNDER" && (!cohortId || !teamName)) {
        return res
          .status(400)
          .json({ message: "cohortId and teamName are required when assigning to a founder" });
      }
      if (leadRole === "MENTOR" && !existingTeamId) {
        return res
          .status(400)
          .json({ message: "teamId is required when assigning to a mentor — pick the mentor's team" });
      }

      // Team-level role and stipend band for the lead.
      //  - Founder: Band A, paid by the stipend engine.
      //  - Mentor:  no band. Mentors are paid through the honorarium flow, and
      //    stipend generation skips role='Mentor' so they are not paid twice.
      const leadTeamRole = leadRole === "MENTOR" ? "Mentor" : "Founder";
      const leadStipendBand = leadRole === "MENTOR" ? null : "A";
      const leadNoun = leadRole === "MENTOR" ? "mentor" : "founder";

      const statement = await storage.getProblemStatementById(id);
      if (!statement) {
        return res.status(404).json({ message: "Problem statement not found" });
      }

      if (statement.teamFormedAt) {
        return res.status(400).json({ message: "Team has already been formed for this problem statement" });
      }

      // Only the founder path creates a team, so only it needs a cohort.
      const cohort = leadRole === "FOUNDER" ? await storage.getCohort(cohortId) : null;
      if (leadRole === "FOUNDER" && !cohort) {
        return res.status(404).json({ message: "Cohort not found" });
      }

      // Verify the lead exists and actually holds the role being assigned
      const lead = await storage.getUser(leadUserId);
      if (!lead || lead.role !== leadRole) {
        return res
          .status(400)
          .json({ message: `Invalid ${leadNoun}. User must have ${leadRole} role` });
      }

      // A founder may lead only one team. Mentors deliberately may span several
      // teams, so the exclusivity check applies to founders only.
      if (leadRole === "FOUNDER") {
        const founderAssignments = await storage.getRoleAssignmentsByUser(leadUserId);
        if (founderAssignments.length > 0) {
          return res.status(400).json({ message: "This founder is already assigned to a team. Please select a different founder." });
        }
      } else {
        // MENTOR: attach the statement to a team the mentor already mentors.
        // No team is created and no applicants are pulled in — the team and its
        // members already exist and inherit the statement through
        // teams.problemStatementId.
        const targetTeam = await storage.getTeam(existingTeamId!);
        if (!targetTeam) {
          return res.status(404).json({ message: "Team not found" });
        }

        const mentorAssignments = await storage.getRoleAssignmentsByUser(leadUserId);
        if (!mentorAssignments.some((a) => a.teamId === targetTeam.id)) {
          return res.status(400).json({
            message: `${lead.name || "This mentor"} is not assigned to "${targetTeam.name}". Add them to the team first.`,
          });
        }

        if (targetTeam.problemStatementId && targetTeam.problemStatementId !== id) {
          const current = await storage.getProblemStatement(targetTeam.problemStatementId);
          return res.status(409).json({
            message: `"${targetTeam.name}" already has the problem statement "${current?.title ?? targetTeam.problemStatementId}". A team can only work on one.`,
          });
        }

        // Link both directions so every existing team member sees it.
        await storage.updateTeam(targetTeam.id, { problemStatementId: id } as any);
        await storage.updateProblemStatement(id, {
          teamId: targetTeam.id,
          teamFormedAt: new Date(),
        } as any);

        const teamAssignments = await storage.getRoleAssignmentsByTeam(targetTeam.id);
        for (const a of teamAssignments) {
          await storage.createNotification({
            userId: a.userId,
            type: 'TEAM_MEMBER_APPLICATION_ACCEPTED' as any,
            title: 'Problem statement assigned',
            message: `Your team "${targetTeam.name}" has been assigned the problem statement: "${statement.title}"`,
            metadataJson: { teamId: targetTeam.id, problemStatementId: id },
          });
        }

        console.log(
          `🎯 Problem statement ${id} attached to existing team ${targetTeam.id} via mentor ${leadUserId} (${teamAssignments.length} members notified)`
        );

        return res.json({
          message: `Problem statement assigned to "${targetTeam.name}"`,
          team: {
            id: targetTeam.id,
            name: targetTeam.name,
            cohortId: targetTeam.cohortId,
            problemStatementId: id,
          },
          membersNotified: teamAssignments.length,
        });
      }

      // Get all applications for this problem statement
      const allApplications = await storage.getProblemStatementApplications(id);
      
      // Get learners (take up to 7, or all available if less than 7)
      const learnerApplications = allApplications
        .filter(app => app.applicantRole === 'LEARNER')
        .slice(0, 7);

      // Get co-founders (take up to 2, or all available if less than 2)
      const cofounderApplications = allApplications
        .filter(app => app.applicantRole === 'COFOUNDER')
        .slice(0, 2);

      // Admin can assign founder even with fewer applications (no strict requirement)
      // Just log a warning if not enough applications
      if (learnerApplications.length < 7 || cofounderApplications.length < 2) {
        console.log(`⚠️ [Assign Founder] Admin assigning founder with fewer applications: ${learnerApplications.length} learners, ${cofounderApplications.length} co-founders`);
      }

      // Create team
      const team = await storage.createTeam({
        name: teamName,
        cohortId: cohortId,
        problemStatementId: id,
        health: 'G' as any,
      });
      
      console.log(`[Assign Founder] Team created: ${team.id}, problemStatementId: ${team.problemStatementId}, linked to problem statement: ${id}`);

      // Add the lead: Founder (Band A) or Mentor (no band)
      await storage.createRoleAssignment({
        teamId: team.id,
        userId: leadUserId,
        role: leadTeamRole as any,
        stipendBand: leadStipendBand as any,
      });

      // Add 2 co-founders as CoPromoter (Band B)
      for (const cofounderApp of cofounderApplications) {
        await storage.createRoleAssignment({
          teamId: team.id,
          userId: cofounderApp.applicantId,
          role: 'CoPromoter' as any,
          stipendBand: 'B' as any,
        });
        // Auto-close all other pending applications FIRST (before accepting this one)
        await autoCloseApplicationsOnTeamAssignment(cofounderApp.applicantId);
        // Mark THIS application as ACCEPTED (after closing others)
        await storage.updateProblemStatementApplicationStatus(cofounderApp.id, 'ACCEPTED');
        console.log(`✅ Cofounder ${cofounderApp.applicantId} application ${cofounderApp.id} marked ACCEPTED`);
      }

      // Add 7 learners as Member (Band C)
      for (const learnerApp of learnerApplications) {
        await storage.createRoleAssignment({
          teamId: team.id,
          userId: learnerApp.applicantId,
          role: 'Member' as any,
          stipendBand: 'C' as any,
        });
        // Auto-close all other pending applications FIRST (before accepting this one)
        await autoCloseApplicationsOnTeamAssignment(learnerApp.applicantId);
        // Mark THIS application as ACCEPTED (after closing others)
        await storage.updateProblemStatementApplicationStatus(learnerApp.id, 'ACCEPTED');
        console.log(`✅ Learner ${learnerApp.applicantId} application ${learnerApp.id} marked ACCEPTED`);
      }

      // Update problem statement to mark as team formed
      await storage.updateProblemStatement(id, {
        teamFormedAt: new Date(),
        teamId: team.id,
      });

      // Create notification for founder that they've been assigned to a team
      await storage.createNotification({
        userId: leadUserId,
        type: 'TEAM_MEMBER_APPLICATION_ACCEPTED' as any,
        title: 'You\'ve been assigned to a team',
        message: `You have been assigned as ${leadNoun} to "${teamName}" for problem statement: "${statement.title}"`,
        metadataJson: { teamId: team.id, problemStatementId: id },
      });

      // Create notifications for all team members
      const allTeamMembers = [...cofounderApplications, ...learnerApplications];
      for (const app of allTeamMembers) {
        await storage.createNotification({
          userId: app.applicantId,
          type: 'TEAM_MEMBER_APPLICATION_ACCEPTED' as any,
          title: 'Application Accepted - Team Formed',
          message: `Your application to "${statement.title}" has been accepted. You've been added to team "${teamName}".`,
          metadataJson: { teamId: team.id, problemStatementId: id },
        });
      }

      res.json({
        message: "Team created successfully",
        team: {
          id: team.id,
          name: team.name,
          cohortId: team.cohortId,
          problemStatementId: team.problemStatementId,
        },
      });
    } catch (error: any) {
      console.error("Error assigning founder and creating team:", error);
      res.status(500).json({ message: "Failed to assign founder and create team" });
    }
  });

  // Apply to a problem statement (LEARNER or COFOUNDER only)
  app.post("/api/problem-statements/:id/apply", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Only LEARNER and COFOUNDER can apply
      if (user.role !== 'LEARNER' && user.role !== 'COFOUNDER') {
        return res.status(403).json({ message: "Only learners and co-founders can apply to problem statements" });
      }

      const statement = await storage.getProblemStatementById(id);
      if (!statement) {
        return res.status(404).json({ message: "Problem statement not found" });
      }

      if (statement.status !== 'PUBLISHED') {
        return res.status(400).json({ message: "Can only apply to published problem statements" });
      }

      const existingAssignments = await storage.getRoleAssignmentsByUser(user.id);
      if (existingAssignments.length > 0) {
        return res.status(400).json({ message: "You are already part of a team and cannot apply to new problem statements" });
      }

      // Check if user has already applied
      const existingApplication = await storage.getProblemStatementApplication(id, user.id);
      if (existingApplication) {
        return res.status(409).json({ message: "You have already applied to this problem statement" });
      }

      // Check application limits
      const learnerCount = await storage.getLearnerApplicationCount(id);
      const cofounderCount = await storage.getCofounderApplicationCount(id);

      // Only block learners when learner count >= 7
      if (user.role === 'LEARNER' && learnerCount >= 7) {
        return res.status(400).json({ message: "Maximum number of learner applications reached for this problem statement" });
      }

      // Only block co-founders when co-founder count >= 2
      if (user.role === 'COFOUNDER' && cofounderCount >= 2) {
        return res.status(400).json({ message: "Maximum number of co-founder applications reached for this problem statement" });
      }

      // Co-founders can still apply even if learner count >= 7
      // Learners can still see the problem statement but Apply button will be disabled

      const { message } = req.body;

      // Create application
      const application = await storage.createProblemStatementApplication({
        problemStatementId: id,
        applicantId: user.id,
        applicantRole: user.role as any,
        status: 'PENDING' as any,
        message: message || null,
      });

      // Notifications are best-effort: if they fail, don't fail the application.
      try {
        // Determine who to notify based on createdByRole
        let notificationRecipients: any[] = [];

        if (statement.createdByRole === 'ADMIN' || statement.createdByRole === 'MENTOR') {
          // Notify all admins
          notificationRecipients = await storage.getUsersByRole("ADMIN");
        } else if (statement.createdByRole === 'FOUNDER') {
          // Notify the founder who created it
          const founder = await storage.getUser(statement.createdBy);
          if (founder) {
            notificationRecipients = [founder];
          }
        }

        // Create notifications
        for (const recipient of notificationRecipients) {
          // Get applicant details for better notification display
          const applicant = await storage.getUser(user.id);
          await storage.createNotification({
            userId: recipient.id,
            type: 'PROBLEM_STATEMENT_APPLICATION_RECEIVED' as any,
            title: 'New Application Received',
            message: `${user.name} (${user.role}) has applied to your problem statement: "${statement.title}"`,
            status: 'UNREAD' as any,
            metadataJson: {
              problemStatementId: statement.id,
              applicationId: application.id,
              applicantId: user.id,
              applicantRole: user.role,
              applicantName: applicant?.name || user.name,
              applicantEmail: applicant?.email || user.email,
            },
          });
          console.log(`✅ Notification created for ${recipient.role} ${recipient.name} (${recipient.email}) about application from ${user.name}`);
        }

        // Check if team is complete (7 learners AND 2 co-founders) and notify admin
        const newLearnerCount = user.role === 'LEARNER' ? learnerCount + 1 : learnerCount;
        const newCofounderCount = user.role === 'COFOUNDER' ? cofounderCount + 1 : cofounderCount;

        if (newLearnerCount >= 7 && newCofounderCount >= 2 && !statement.teamFormedAt) {
          // Check if notification was already sent (to avoid duplicate notifications)
          const adminUsers = await storage.getUsersByRole("ADMIN");
          let notificationExists = false;

          for (const admin of adminUsers) {
            const adminNotifications = await storage.getNotificationsByUser(admin.id);
            const teamCompleteNotificationExists = adminNotifications.some(n =>
              n.type === 'TEAM_COMPLETE_FOR_PROBLEM_STATEMENT' &&
              (n.metadataJson as any)?.problemStatementId === id &&
              n.status === 'UNREAD'
            );
            if (teamCompleteNotificationExists) {
              notificationExists = true;
              break;
            }
          }

          if (!notificationExists) {
            // Notify all admins that team is complete
            for (const admin of adminUsers) {
              await storage.createNotification({
                userId: admin.id,
                type: 'TEAM_COMPLETE_FOR_PROBLEM_STATEMENT' as any,
                title: 'Team Complete - Assign Founder',
                message: `Team complete for "${statement.title}": 7 learners and 2 co-founders have applied. Assign a founder to create the team.`,
                status: 'UNREAD' as any,
                metadataJson: {
                  problemStatementId: id,
                  learnerCount: newLearnerCount,
                  cofounderCount: newCofounderCount,
                },
              });
            }
            console.log(`✅ Team complete notification sent to admins for problem statement: ${statement.title}`);
          }
        }
      } catch (notifError: any) {
        console.error("Error creating problem statement application notifications:", notifError);
      }

      res.json(application);
    } catch (error: any) {
      console.error("Error applying to problem statement:", error);
      res.status(500).json({ message: "Failed to apply to problem statement" });
    }
  });

  // Get applications for a problem statement
  app.get("/api/problem-statements/:id/applications", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const statement = await storage.getProblemStatementById(id);
      if (!statement) {
        return res.status(404).json({ message: "Problem statement not found" });
      }

      // Only ADMIN, MENTOR (if they created it), or FOUNDER (if they created it) can view applications
      const canView = user.role === 'ADMIN' || 
                     (user.role === 'MENTOR' && statement.createdBy === user.id) ||
                     (user.role === 'FOUNDER' && statement.createdBy === user.id);

      if (!canView) {
        return res.status(403).json({ message: "You don't have permission to view applications for this problem statement" });
      }

      const applications = await storage.getProblemStatementApplications(id);
      
      // Attach applicant details
      const applicationsWithDetails = await Promise.all(applications.map(async (app) => {
        const applicant = await storage.getUser(app.applicantId);
        return {
          ...app,
          applicant: applicant ? {
            id: applicant.id,
            name: applicant.name,
            email: applicant.email,
            role: applicant.role,
          } : null,
        };
      }));

      res.json(applicationsWithDetails);
    } catch (error: any) {
      console.error("Error fetching problem statement applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Update application status
  app.put("/api/problem-statements/applications/:id/status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user!;

      if (!status || !["PENDING", "ACCEPTED", "REJECTED"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be PENDING, ACCEPTED, or REJECTED" });
      }

      const targetApp = await storage.getProblemStatementApplicationById(id);
      
      if (!targetApp) {
        return res.status(404).json({ message: "Application not found" });
      }

      const statement = await storage.getProblemStatementById(targetApp.problemStatementId);
      if (!statement) {
        return res.status(404).json({ message: "Problem statement not found" });
      }

      // Only ADMIN, MENTOR (if they created it), or FOUNDER (if they created it) can update status
      const canUpdate = user.role === 'ADMIN' || 
                       (user.role === 'MENTOR' && statement.createdBy === user.id) ||
                       (user.role === 'FOUNDER' && statement.createdBy === user.id);

      if (!canUpdate) {
        return res.status(403).json({ message: "You don't have permission to update this application" });
      }

      const updated = await storage.updateProblemStatementApplicationStatus(id, status as "PENDING" | "ACCEPTED" | "REJECTED");
      
      if (!updated) {
        return res.status(404).json({ message: "Application not found" });
      }

      // If accepted by a founder, automatically add the applicant to the founder's team
      if (status === "ACCEPTED" && user.role === "FOUNDER" && statement.createdBy === user.id) {
        try {
          const applicant = await storage.getUser(targetApp.applicantId);
          
          if (applicant) {
            console.log("🎯 Founder accepted problem statement application - adding applicant to team");
            console.log(`   - Applicant: ${applicant.name} (${applicant.email}), Role from application: ${targetApp.applicantRole}`);
            
            // Get founder's team by checking role assignments
            const founderAssignments = await storage.getRoleAssignmentsByUser(user.id);
            const founderTeamAssignment = founderAssignments.find(a => a.role === "Founder" || a.role === "Promoter");
            let teamId;
            
            if (!founderTeamAssignment) {
              // Create a new team for the founder if they don't have one
              console.log("📝 Creating new team for founder:", user.id);
              
              // Get a default cohort
              const cohorts = await storage.getCohorts();
              const activeCohort = cohorts.find(c => new Date(c.startDate) <= new Date() && new Date(c.endDate) >= new Date()) || cohorts[0];
              
              if (!activeCohort) {
                console.warn("⚠️ No cohort available, skipping team creation");
              } else {
                const newTeam = await storage.createTeam({
                  cohortId: activeCohort.id,
                  name: `${user.name}'s Team`,
                  health: "G",
                  problemStatementId: statement.id,
                });
                teamId = newTeam.id;
                
                // Assign founder to their own team with role "Founder" and stipend band A
                await storage.createRoleAssignment({
                  userId: user.id,
                  teamId: teamId,
                  role: "Founder",
                  stipendBand: "A",
                });
                console.log("✅ Created new team and assigned founder:", { teamId, founderId: user.id });
              }
            } else {
              teamId = founderTeamAssignment.teamId;
              console.log("✅ Using existing team:", { teamId });
              // Ensure team has problemStatementId so all team members can see the founder's problem statement
              const existingTeam = await storage.getTeam(teamId);
              if (existingTeam && !existingTeam.problemStatementId) {
                await storage.updateTeam(teamId, { problemStatementId: statement.id });
                console.log("✅ Set team problemStatementId so team members can see founder's problem statement");
              }
            }
            
            if (teamId) {
              // Check if applicant is already in the team
              const existingAssignments = await storage.getRoleAssignmentsByUser(applicant.id);
              const alreadyInTeam = existingAssignments.some(a => a.teamId === teamId);
              
              if (!alreadyInTeam) {
                // Determine the role based on the applicantRole from the problem statement application
                const assignmentRole = targetApp.applicantRole === "COFOUNDER" ? "CoPromoter" :
                                      targetApp.applicantRole === "LEARNER" ? "Member" : "Member";
                
                // Determine stipend band based on role
                const stipendBand = assignmentRole === "CoPromoter" ? "B" : "C";
                
                // Create role assignment for the applicant
                await storage.createRoleAssignment({
                  userId: applicant.id,
                  teamId: teamId,
                  role: assignmentRole,
                  stipendBand: stipendBand,
                });
                
                console.log("✅ Team assignment created:", {
                  userId: applicant.id,
                  userName: applicant.name,
                  teamId: teamId,
                  role: assignmentRole,
                  stipendBand: stipendBand,
                  applicantRole: targetApp.applicantRole,
                });

                // Auto-close all pending applications for this applicant now that they're assigned to a team
                await autoCloseApplicationsOnTeamAssignment(applicant.id);
                
                // Notify the applicant that they've been added to the team
                const team = await storage.getTeam(teamId);
                if (team) {
                  const roleLabel = assignmentRole === "CoPromoter" ? "Co-Founder" :
                                   assignmentRole === "Member" ? "Team Member" : assignmentRole;
                  
                  await storage.createNotification({
                    userId: applicant.id,
                    type: "TEAM_MEMBER_APPLICATION_ACCEPTED" as any,
                    title: `Added to Team: ${team.name}`,
                    message: `${user.name} has accepted your application and added you as a ${roleLabel} to the team "${team.name}". You can now access the team dashboard.`,
                    status: "UNREAD" as any,
                    metadataJson: {
                      teamId: team.id,
                      teamName: team.name,
                      role: assignmentRole,
                    },
                  });
                }
              } else {
                console.log("ℹ️ Applicant already in team, skipping assignment");
              }
            }
          }
        } catch (assignmentError) {
          console.error("❌ Error adding applicant to team:", assignmentError);
          // Don't fail the request if team assignment fails, but log the error
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating application status:", error);
      res.status(500).json({ message: "Failed to update application status" });
    }
  });

  // Admin: Reject a problem statement
  app.post("/api/admin/problem-statements/:id/reject", requireAuth, requireRole('ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const statement = await storage.getProblemStatementById(id);

      if (!statement) {
        return res.status(404).json({ message: "Problem statement not found" });
      }

      const updated = await storage.updateProblemStatement(id, {
        status: 'REJECTED' as any,
      });

      // Notify the founder
      await storage.createNotification({
        userId: statement.createdBy,
        type: 'PROBLEM_STATEMENT_SUBMITTED' as any,
        title: 'Problem Statement Rejected',
        message: `Your problem statement "${statement.title}" was not approved.`,
        metadataJson: { problemStatementId: id },
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error rejecting problem statement:", error);
      res.status(500).json({ message: "Failed to reject problem statement" });
    }
  });

  // =====================
  // Career / Job Postings Routes
  // =====================

  // Get all active job postings with filters
  app.get("/api/careers/jobs", async (req, res) => {
    try {
      const { location, jobType, areaOfInterest, experience } = req.query;

      const filters: any = {
        isActive: true, // Only return active job postings
      };

      if (location) {
        filters.location = location as string;
      }

      if (jobType) {
        const jobTypes = Array.isArray(jobType) ? jobType : [jobType];
        filters.jobType = jobTypes as string[];
      }

      if (areaOfInterest) {
        const areas = Array.isArray(areaOfInterest) ? areaOfInterest : [areaOfInterest];
        filters.areaOfInterest = areas as string[];
      }

      if (experience) {
        filters.experience = experience as string;
      }

      console.log(`🔍 Fetching careers jobs with filters:`, filters);
      const jobs = await storage.getMentorJobPostings(filters);
      console.log(`✅ Found ${jobs.length} active job postings`);
      res.json(jobs);
    } catch (error: any) {
      console.error("Error fetching job postings:", error);
      res.status(500).json({ message: "Failed to fetch job postings" });
    }
  });

  // Get single job posting
  app.get("/api/careers/jobs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const job = await storage.getMentorJobPosting(id);

      if (!job) {
        return res.status(404).json({ message: "Job posting not found" });
      }

      res.json(job);
    } catch (error: any) {
      console.error("Error fetching job posting:", error);
      res.status(500).json({ message: "Failed to fetch job posting" });
    }
  });

  // Submit mentor job application
  app.post("/api/careers/apply", async (req, res) => {
    try {
      const { jobPostingId, formData } = req.body;

      if (!jobPostingId || !formData) {
        return res.status(400).json({ message: "Job posting ID and form data are required" });
      }

      // Verify job posting exists and is active
      const job = await storage.getMentorJobPosting(jobPostingId);
      if (!job || !job.isActive) {
        return res.status(404).json({ message: "Job posting not found or inactive" });
      }

      // Do NOT create user for mentor applications - only store application
      // User will be created when admin accepts the application
      // Server-side per-role duplicate check to prevent duplicate mentor applications
      try {
        const dup = await checkContactDupes("MENTOR", formData?.email || null, formData?.contactNumber || formData?.phone || null);
        if (dup.emailExists || dup.phoneExists) {
          return res.status(400).json({
            message: "Duplicate contact for this role",
            emailExists: dup.emailExists,
            phoneExists: dup.phoneExists,
          });
        }
      } catch (e) {
        console.warn("Mentor duplicate check failed (continuing):", e);
      }
      
      // Extract resume URL and S3 key from attachments if present
      const resumeUrl = formData.attachments?.resume;
      const resumeS3Key = formData.attachments?.resumeObjectKey || null; // Get objectKey directly from attachments
      
      // Extract certificates and ID proof with S3 keys from attachments
      const certificates = formData.attachments?.certificates || [];
      const idProof = formData.attachments?.idProof;
      
      // Create application with CV/resume, certificates, and ID proof information
      // Do NOT set userId - user will be created when admin accepts
      const mentorAcceptedTerms = formData?.acceptTerms === true;

      const application = await storage.createApplication({
        type: "MENTOR",
        userId: null, // No user yet - will be created when admin accepts
        status: "NEW",
        formJson: {
          ...formData,
          jobPostingId,
          jobTitle: job.title,
          // Store CV/resume information for admin to view
          cvUrl: resumeUrl || null,
          cvS3Key: resumeS3Key || null,
          cvFileName: formData.attachments?.resume ? "Resume.pdf" : null,
          resumeUrl: resumeUrl || null, // Also store as resumeUrl for compatibility
          // Store certificates with S3 keys for admin to view
          certificates: Array.isArray(certificates) ? certificates.map((cert: any) => ({
            url: cert.url || cert,
            objectKey: cert.objectKey || null,
            fileName: cert.fileName || "certificate.pdf"
          })) : [],
          // Store ID proof with S3 key for admin to view
          idProof: idProof ? {
            url: idProof.url || idProof,
            objectKey: idProof.objectKey || null,
            fileName: idProof.fileName || "id-proof.pdf"
          } : null,
        },
        acceptedTermsAt: mentorAcceptedTerms ? new Date() : null,
      });
      
      console.log(`✅ Mentor application created: ${application.id}`);
      console.log(`   - CV URL: ${resumeUrl || 'none'}, S3 Key: ${resumeS3Key || 'none'}`);
      console.log(`   - Certificates: ${certificates.length} uploaded`);
      console.log(`   - ID Proof: ${idProof ? 'uploaded' : 'none'}`);
      
      // Create notification for admins about new mentor application
      try {
        const { db } = await import("./db");
        const { notifications, users } = await import("@shared/schema");
        const { eq, or } = await import("drizzle-orm");
        
        // Get all admin users
        const adminUsers = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.role, "ADMIN"));
        
        // Create notification for each admin
        const notificationPromises = adminUsers.map(admin => 
          db.insert(notifications).values({
            userId: admin.id,
            type: "CANDIDATE_SELECTED",
            title: `New Mentor Application Received`,
            message: `A new mentor application has been submitted by ${formData.fullName || 'Unknown'} for ${job.title}.`,
            status: "UNREAD",
            metadataJson: {
              applicationId: application.id,
              applicationType: "MENTOR",
              applicantName: formData.fullName || 'Unknown',
              jobPostingId: jobPostingId,
              jobTitle: job.title,
            },
          })
        );
        
        await Promise.all(notificationPromises);
        console.log(`✅ Created notifications for ${adminUsers.length} admin(s) about new mentor application`);
      } catch (notificationError) {
        console.error("⚠️ Failed to create notifications for new mentor application:", notificationError);
        // Don't fail the application creation if notification fails
      }

      // Send confirmation email
      try {
        const { sendMentorApplicationConfirmationEmail } = await import("./services/email-service");
        await sendMentorApplicationConfirmationEmail(
          formData.email,
          formData.fullName,
          job.title
        );
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
        // Don't fail the request if email fails
      }

      res.json({
        message: "Application submitted successfully",
        applicationId: application.id
      });
    } catch (error: any) {
      console.error("Error submitting application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Admin: Create job posting
  app.post("/api/admin/job-postings", requireAuth, requireRole('ADMIN'), async (req, res) => {
    console.log("📝 POST /api/admin/job-postings - Request received");
    try {
      const userId = req.session!.userId!;
      console.log("📝 Creating job posting with data:", { ...req.body, createdBy: userId });
      const posting = await storage.createMentorJobPosting({
        ...req.body,
        createdBy: userId,
      });
      console.log("✅ Job posting created successfully:", posting.id);
      res.json(posting);
    } catch (error: any) {
      console.error("❌ Error creating job posting:", error);
      res.status(500).json({ message: "Failed to create job posting" });
    }
  });

  // Admin: Update job posting
  app.put("/api/admin/job-postings/:id", requireAuth, requireRole('ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      console.log(`🔄 Updating job posting ${id}:`, { isActive: updateData.isActive, ...updateData });
      const updated = await storage.updateMentorJobPosting(id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Job posting not found" });
      }
      console.log(`✅ Job posting ${id} updated:`, { isActive: updated.isActive });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating job posting:", error);
      res.status(500).json({ message: "Failed to update job posting" });
    }
  });

  // Admin: Delete job posting
  app.delete("/api/admin/job-postings/:id", requireAuth, requireRole('ADMIN'), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteMentorJobPosting(id);
      res.json({ message: "Job posting deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting job posting:", error);
      res.status(500).json({ message: "Failed to delete job posting" });
    }
  });

  // Admin: Get all job postings (including inactive)
  app.get("/api/admin/job-postings", requireAuth, requireRole('ADMIN'), async (req, res) => {
    try {
      const jobs = await storage.getMentorJobPostings({});
      res.json(jobs);
    } catch (error: any) {
      console.error("Error fetching job postings:", error);
      res.status(500).json({ message: "Failed to fetch job postings" });
    }
  });

  // Chatbot Enquiries — leads collected by the AI chatbot widget
  app.get("/api/admin/chatbot-enquiries", requireAuth, requireRole("ADMIN"), async (req, res) => {
    try {
      const { pool } = await import("./db");
      const leadsResult = await pool.query(`
        SELECT id, name, email, phone, created_at
        FROM chat_leads
        ORDER BY created_at DESC
        LIMIT 200
      `);
      const leads = leadsResult.rows;

      const enriched = await Promise.all(
        leads.map(async (lead: any) => {
          const sessionsResult = await pool.query(
            `SELECT id, created_at FROM chat_sessions WHERE lead_id = $1 ORDER BY created_at DESC`,
            [lead.id]
          );
          const sessions = await Promise.all(
            sessionsResult.rows.map(async (session: any) => {
              const messagesResult = await pool.query(
                `SELECT role, content, created_at FROM chat_messages
                 WHERE session_id = $1 ORDER BY created_at ASC`,
                [session.id]
              );
              return { ...session, messages: messagesResult.rows };
            })
          );
          return { ...lead, sessions };
        })
      );

      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching chatbot enquiries:", error);
      res.status(500).json({ message: "Failed to fetch chatbot enquiries" });
    }
  });

  // Debug: Test route registration
  app.get("/api/debug/routes", (req, res) => {
    const routes: string[] = [];
    app._router?.stack?.forEach((middleware: any) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods).join(", ").toUpperCase();
        routes.push(`${methods} ${middleware.route.path}`);
      }
    });
    res.json({
      message: "Registered routes",
      publicAssessmentRoutes: routes.filter(r => r.includes("/api/public/assessment")),
      allRoutes: routes.slice(0, 50) // First 50 routes
    });
  });


  console.log("✅ Routes registered successfully");
  console.log("📋 Application CV upload route: POST /api/applications/cv/upload-url");
  console.log("📋 Mentor upload route: POST /api/mentors/files/upload-url");
  console.log("👁️ Mentor view route: POST /api/mentors/files/view-url");
  console.log("🔑 Manager mentor password route: GET /api/manager/mentors/:id/password");
  console.log("👁️ Manager password preview route: GET /api/manager/mentors/:id/password-preview");
  console.log("📤 Manager share credentials route: POST /api/manager/mentors/:id/share-credentials");
  console.log("📝 Problem Statements routes:");
  console.log("  - POST /api/problem-statements (create)");
  console.log("  - GET /api/problem-statements (list)");
  console.log("  - GET /api/problem-statements/:id (details)");
  console.log("  - POST /api/admin/problem-statements/:id/publish");
  console.log("💼 Job Postings routes:");
  console.log("  - GET /api/admin/job-postings (list all)");
  console.log("  - POST /api/admin/job-postings (create)");
  console.log("  - PUT /api/admin/job-postings/:id (update)");
  console.log("  - DELETE /api/admin/job-postings/:id (delete)");

                                                                                                                                                                                                                                                                                                              return httpServer;
}
