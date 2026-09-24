import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  decimal,
  json,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { isMeaningfulTitle, MIN_TASK_TITLE_LENGTH } from "./programmePlan";

// Enums

/**
 * A role-valued column. Deliberately a plain varchar rather than a pgEnum: enum values
 * cannot be added without DDL, nor removed at all, which makes admin-managed roles
 * impossible. `users.role` carries a foreign key to `roles.code` for integrity.
 *
 * The set of roles is whatever `roles` holds at runtime — seeded by
 * scripts/sql/add-dynamic-roles.sql and extendable from the admin UI — so never hardcode
 * a list of roles to validate or enumerate against. Read the table (GET /api/roles).
 */
const roleColumn = (name: string) => varchar(name, { length: 50 });

export const roles = pgTable("roles", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 50 }).notNull().unique(),
  label: text("label").notNull(),
  // System roles have behaviour attached in code (route guards, dashboards) and so
  // cannot be deleted; roles added through the UI are labels only and can be.
  isSystem: boolean("is_system").notNull().default(false),
  // Whether this role gets a headcount field in a cohort's composition
  includeInComposition: boolean("include_in_composition").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orgTypeEnum = pgEnum("org_type", [
  "UNIVERSITY",
  "CORPORATE",
  "STARTUPVARSITY",
]);

export const applicationTypeEnum = pgEnum("application_type", [
  "LEARNER",
  "UNIVERSITY",
  "CORPORATE",
  "PROFESSIONAL",
  "FOUNDER",
  "COFOUNDER",
  "MENTOR",
  "TEAM",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "NEW",
  "REVIEW",
  "OFFER",
  "PARTIALLY_PAID",
  "PAID",
  "ACCEPTED",
  "REJECT",
]);

export const teamMemberApplicationStatusEnum = pgEnum("team_member_application_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
]);

export const teamApplicationMemberStatusEnum = pgEnum("team_application_member_status", [
  "PENDING", // team application is NEW and not yet accepted
  "INVITED", // invite email sent
  "SUBMITTED", // individual application submitted via invite
]);

export const problemStatementApplicationStatusEnum = pgEnum("problem_statement_application_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
]);

export const teamRoleEnum = pgEnum("team_role", [
  "Founder",
  "Promoter",
  "CoPromoter",
  "Member",
  "Mentor",
]);

export const stipendBandEnum = pgEnum("stipend_band", ["A", "B", "C"]);

export const teamHealthEnum = pgEnum("team_health", ["R", "A", "G"]);

/**
 * DEPRECATED — no column uses this any more. `problem_statements.track` is now
 * plain text validated against the `tracks` catalog table (see
 * scripts/sql/add-tracks.sql).
 *
 * Kept declared on purpose: the type still exists in the database, and leaving
 * it here stops `drizzle-kit generate/push` from emitting a DROP TYPE, which
 * would make the migration hard to roll back. Do not add columns using it.
 * Remove both this and the database type together, once you're sure no
 * rollback is needed.
 */
export const trackEnum = pgEnum("track", [
  "SaaS_B2B",
  "AI",
  "FinTech",
  "HealthTech",
  "BioTech",
  "EdTech",
  "Consumer",
  "ECommerce",
  "Logistics",
  "PropTech",
  "AgriTech",
  "Climate",
  "Industrial",
  "Media",
  "GovTech",
  "MSME",
  // New domain-specific tracks (kept for frontend domain selections)
  "AI_Dev",
  "FullStack_GenAI",
  "Data_Analysis",
  "DevOps_Cloud",
  "Cybersecurity",
]);

export const evidenceTypeEnum = pgEnum("evidence_type", [
  "PR",
  "CI",
  "Ticket",
  "Doc",
  "Demo",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
]);

export const mouStatusEnum = pgEnum("mou_status", [
  "DRAFT",
  "PENDING",
  "SIGNED",
  "ACTIVE",
  "EXPIRED",
]);

export const stipendStatusEnum = pgEnum("stipend_status", [
  "PENDING",
  "RELEASED",
  "HOLD",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "PENDING",
  "PAID",
  "CANCELLED",
  "REFUNDED",
]);

export const certificateKindEnum = pgEnum("certificate_kind", [
  "Internship",
  "Experience",
  "Completion",
]);

export const standupMoodEnum = pgEnum("standup_mood", [
  "great",
  "good",
  "okay",
  "struggling",
  "blocked",
]);

export const honorariumStatusEnum = pgEnum("honorarium_status", [
  "PENDING",
  "APPROVED",
  "PAID",
]);

export const questionTypeEnum = pgEnum("question_type", [
  "MCQ",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "ESSAY",
]);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "IN_PROGRESS",
  "SUBMITTED",
  "GRADED",
  "EXPIRED",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "UPCOMING",
  "IN_PROGRESS",
  "COMPLETED",
  "OVERDUE",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "MENTOR_CREATED",
  "CANDIDATE_SELECTED",
  "CREDENTIALS_APPROVED",
  "ASSESSMENT_REVIEWED",
  "TEAM_MEMBER_APPLICATION_RECEIVED",
  "TEAM_MEMBER_APPLICATION_ACCEPTED",
  "TASK_CREATED",
  "SPRINT_CREATED",
  "PROBLEM_STATEMENT_SUBMITTED",
  "PROBLEM_STATEMENT_PUBLISHED",
  "PROBLEM_STATEMENT_APPLICATION_RECEIVED",
  "TEAM_COMPLETE_FOR_PROBLEM_STATEMENT",
  "TEAM_MEETING_CREATED",
  "TEAM_MEETING_UPDATED",
  "TEAM_MEETING_CANCELLED",
  "PAYMENT_REMINDER",
  "TICKET_ASSIGNED",
  "TICKET_TAGGED",
  "TICKET_ESCALATED",
  "TICKET_COMMENTED",
  "TICKET_CLOSED",
  "TICKET_REOPENED",
  "TICKET_SLA_BREACHED",
  "CHAT_MENTION",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "UNREAD",
  "READ",
  "ARCHIVED",
]);

export const problemStatementStatusEnum = pgEnum("problem_statement_status", [
  "PENDING",
  "PUBLISHED",
  "REJECTED",
]);

// Tables
export const users = pgTable("users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"),
  name: text("name").notNull(),
  phone: text("phone"),
  role: roleColumn("role")
    .notNull()
    .default("LEARNER")
    .references(() => roles.code),
  isAdmin: boolean("is_admin").default(false).notNull(),
  orgId: varchar("org_id", { length: 36 }),
  avatarUrl: text("avatar_url"),
  keycloakId: text("keycloak_id").unique(),
  firstTimeLogin: boolean("first_time_login").notNull().default(true),
  experienceFlag: json("experience_flag")
    .$type<{ hasSeenRolesResponsibilities?: boolean; hasSeenSidebarTooltip?: boolean }>()
    .notNull()
    .default(sql`'{"hasSeenRolesResponsibilities": false, "hasSeenSidebarTooltip": false}'::json`),
  customTag: text("custom_tag"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  passwordChangedAt: timestamp("password_changed_at"),
}, (table) => [
  index("users_org_id_idx").on(table.orgId),
  index("users_role_idx").on(table.role),
]);

export const organizations = pgTable("organizations", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: orgTypeEnum("type").notNull(),
  name: text("name").notNull(),
  city: text("city"),
  state: text("state"),
  country: text("country").default("India"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cohorts = pgTable("cohorts", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  location: text("location"),
  seats: integer("seats").default(100),
  // Planned headcount per role lives in `cohortRoleCounts` — one row per role, so roles
  // added at runtime are covered. Replaced the fixed mentor/founder/cofounder/learner
  // count columns, which could only ever describe those four.
  immersionWeeksJson: json("immersion_weeks_json"),
  isActive: boolean("is_active").default(true),
  isOpenForRegistration: boolean("is_open_for_registration").default(true), // Show in application dropdown
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Planned headcount per role for a cohort, one row per role.
 *
 * Both columns cascade on delete: a count has no meaning without its cohort, and a role
 * that no longer exists cannot be planned for. The role foreign key also stops a client
 * from storing counts against a code that was never registered.
 */
export const cohortRoleCounts = pgTable("cohort_role_counts", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  cohortId: varchar("cohort_id", { length: 36 })
    .notNull()
    .references(() => cohorts.id, { onDelete: "cascade" }),
  roleCode: roleColumn("role_code")
    .notNull()
    .references(() => roles.code, { onDelete: "cascade", onUpdate: "cascade" }),
  count: integer("count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("cohort_role_counts_cohort_id_idx").on(table.cohortId),
  uniqueIndex("cohort_role_counts_cohort_role_idx").on(table.cohortId, table.roleCode),
]);

// Cohort Users - Direct user-to-cohort assignment (for users not in teams)
export const cohortUsers = pgTable("cohort_users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  cohortId: varchar("cohort_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("cohort_users_user_id_idx").on(table.userId),
  index("cohort_users_cohort_id_idx").on(table.cohortId),
]);

export const applications = pgTable("applications", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: applicationTypeEnum("type").notNull(),
  userId: varchar("user_id", { length: 36 }),
  status: applicationStatusEnum("status").notNull().default("NEW"),
  formJson: json("form_json"),
  cohortId: varchar("cohort_id", { length: 36 }),
  feeAmount: decimal("fee_amount", { precision: 10, scale: 2 }).default(
    "100000"
  ),
  paid: boolean("paid").default(false),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  paymentAttempts: integer("payment_attempts").default(0),
  lastPaymentAttemptAt: timestamp("last_payment_attempt_at"),
  offerSentAt: timestamp("offer_sent_at"),
  offerExpiresAt: timestamp("offer_expires_at"),
  customFeeAmount: decimal("custom_fee_amount", { precision: 10, scale: 2 }),
  totalPaidAmount: decimal("total_paid_amount", { precision: 10, scale: 2 }).default("0"),
  reviewerId: varchar("reviewer_id", { length: 36 }),
  reviewedAt: timestamp("reviewed_at"),
  selectionNotes: text("selection_notes"),
  interviewScore: integer("interview_score"),
  entranceScore: integer("entrance_score"),
  meetingScheduledAt: timestamp("meeting_scheduled_at"),
  meetingLink: text("meeting_link"),
  meetingAgenda: text("meeting_agenda"),
  meetingGoogleEventId: text("meeting_google_event_id"),
  paymentConfirmed: boolean("payment_confirmed").default(false),
  paymentConfirmedAt: timestamp("payment_confirmed_at"),
  paymentConfirmedBy: varchar("payment_confirmed_by", { length: 36 }),
  acceptedTermsAt: timestamp("accepted_terms_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("applications_user_id_idx").on(table.userId),
  index("applications_cohort_id_idx").on(table.cohortId),
  index("applications_status_idx").on(table.status),
  index("applications_reviewer_id_idx").on(table.reviewerId),
]);

export const problemStatements = pgTable("problem_statements", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  overview: text("overview").notNull(),
  summary: text("summary"),
  difficulty: text("difficulty").default("Medium"),
  tags: text("tags").array(),
  // Text rather than trackEnum: the selectable list lives in the `tracks`
  // table so admins can add one without a schema change. Validated against
  // that catalog on write. See scripts/sql/add-tracks.sql.
  track: text("track").notNull(),
  fileKeys: text("file_keys").array(),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdByRole: roleColumn("created_by_role").notNull(), // ADMIN, MENTOR, or FOUNDER
  status: problemStatementStatusEnum("status").notNull().default("PENDING"),
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by", { length: 36 }),
  teamFormedAt: timestamp("team_formed_at"),
  teamId: varchar("team_id", { length: 36 }),
  expectedOutcomes: text("expected_outcomes"),
  constraintsRequirements: text("constraints_requirements"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("problem_statements_created_by_idx").on(table.createdBy),
  index("problem_statements_created_by_role_idx").on(table.createdByRole),
  index("problem_statements_status_idx").on(table.status),
  index("problem_statements_track_idx").on(table.track),
]);

export const teams = pgTable("teams", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  cohortId: varchar("cohort_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  problemStatementId: varchar("problem_statement_id", { length: 36 }),
  escrowAccountRef: text("escrow_account_ref"),
  health: teamHealthEnum("health").default("G"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("teams_cohort_id_idx").on(table.cohortId),
  index("teams_problem_statement_id_idx").on(table.problemStatementId),
]);

export const roleAssignments = pgTable("role_assignments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  role: teamRoleEnum("role").notNull(),
  // ACADEMIC | INDUSTRY, for members whose role is MENTOR. Deliberately not a separate user
  // role: `"MENTOR"` is compared literally in 87 places in server/routes.ts and 112 in the
  // client, so a new role code would carry none of those permissions. Typing the assignment
  // instead leaves every guard untouched and lets one person be the academic mentor on one
  // team and the industry mentor on another. NULL = untyped, which is today's behaviour.
  mentorKind: varchar("mentor_kind", { length: 20 }),
  stipendBand: stipendBandEnum("stipend_band"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("role_assignments_team_id_idx").on(table.teamId),
  index("role_assignments_user_id_idx").on(table.userId),
  uniqueIndex("role_assignments_team_user_idx").on(table.teamId, table.userId),
]);

export const teamMemberApplications = pgTable("team_member_applications", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  founderId: varchar("founder_id", { length: 36 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 36 }).notNull(),
  targetUserRole: roleColumn("target_user_role").notNull(), // COFOUNDER, MENTOR, or LEARNER
  message: text("message"),
  status: teamMemberApplicationStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("team_member_applications_founder_id_idx").on(table.founderId),
  index("team_member_applications_target_user_id_idx").on(table.targetUserId),
  uniqueIndex("team_member_applications_unique_idx").on(table.founderId, table.targetUserId),
]);

export const problemStatementApplications = pgTable("problem_statement_applications", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  problemStatementId: varchar("problem_statement_id", { length: 36 }).notNull(),
  applicantId: varchar("applicant_id", { length: 36 }).notNull(),
  applicantRole: roleColumn("applicant_role").notNull(), // LEARNER or COFOUNDER
  status: problemStatementApplicationStatusEnum("status").notNull().default("PENDING"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("problem_statement_applications_problem_statement_id_idx").on(table.problemStatementId),
  index("problem_statement_applications_applicant_id_idx").on(table.applicantId),
  uniqueIndex("problem_statement_applications_unique_idx").on(table.problemStatementId, table.applicantId),
]);

export const sprints = pgTable("sprints", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  index: integer("index").notNull(),
  // Short title for the sprint. Nullable because sprints created before this
  // column existed have none — the UI falls back to goals, then "Sprint N".
  name: text("name"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  goals: text("goals"),
  objectives: text("objectives"),
  deliverables: text("deliverables"),
  passed: boolean("passed"),
  passedAt: timestamp("passed_at"),
  demoUrl: text("demo_url"),
  demoNotes: text("demo_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("sprints_team_id_idx").on(table.teamId),
  uniqueIndex("sprints_team_index_idx").on(table.teamId, table.index),
]);

export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sprintId: varchar("sprint_id", { length: 36 }), // Nullable - tasks can exist without sprint
  teamId: varchar("team_id", { length: 36 }), // For standalone tasks (tasks without sprint)
  assigneeId: varchar("assignee_id", { length: 36 }),
  assigneeIds: json("assignee_ids"), // JSON array of user IDs for multi-assignee tasks
  assignedBy: varchar("assigned_by", { length: 36 }), // User who originally assigned the task
  reviewerId: varchar("reviewer_id", { length: 36 }), // User currently reviewing (when status is REVIEW)
  reviewComment: text("review_comment"), // Comment from reviewer when changing status
  title: text("title").notNull(),
  description: text("description"),
  objectives: text("objectives"),
  deliverables: text("deliverables"),
  status: taskStatusEnum("status").notNull().default("TODO"),
  priority: varchar("priority", { length: 20 }).default("MEDIUM"), // LOW, MEDIUM, HIGH
  points: integer("points").default(1),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  dependencies: json("dependencies"), // JSON array of task IDs
  // Stable positional key for a task generated from a programme plan template, e.g. "plan:s1:t0"
  // (see taskSourceKey in @shared/programmePlan). NULL for every hand-made task, which is what
  // keeps imports from touching them. Re-importing matches on (sprintId, sourceKey) so renaming a
  // task in the template updates the row instead of inserting a duplicate.
  sourceKey: varchar("source_key", { length: 64 }),
  // ACADEMIC | INDUSTRY when this task must be signed off by a particular kind of mentor;
  // NULL means any reviewer with permission, which is how every existing task behaves.
  requiresReviewFrom: varchar("requires_review_from", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("tasks_sprint_id_idx").on(table.sprintId),
  index("tasks_team_id_idx").on(table.teamId),
  index("tasks_assignee_id_idx").on(table.assigneeId),
  index("tasks_assigned_by_idx").on(table.assignedBy),
  index("tasks_reviewer_id_idx").on(table.reviewerId),
  // Partial: only importer-owned rows are in the index, so the many hand-made tasks with a NULL
  // source_key cannot collide with each other. Mirrors scripts/sql/add-task-source-key.sql.
  uniqueIndex("tasks_sprint_source_key_idx")
    .on(table.sprintId, table.sourceKey)
    .where(sql`source_key IS NOT NULL`),
]);

export const reviews = pgTable("reviews", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sprintId: varchar("sprint_id", { length: 36 }).notNull(),
  mentorId: varchar("mentor_id", { length: 36 }).notNull(),
  rubricJson: json("rubric_json"),
  score: integer("score"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("reviews_sprint_id_idx").on(table.sprintId),
  index("reviews_mentor_id_idx").on(table.mentorId),
]);

export const evidence = pgTable("evidence", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  sprintId: varchar("sprint_id", { length: 36 }),
  submittedBy: varchar("submitted_by", { length: 36 }),
  taskId: varchar("task_id", { length: 36 }),
  type: evidenceTypeEnum("type").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  metaJson: json("meta_json"),
  // Review state lives on the submission, not the task. A task shared by several people gets
  // one row per person, so a reviewer can accept some and ask others for changes — the task's
  // single reviewComment could only ever say one thing to everybody.
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  reviewedBy: varchar("reviewed_by", { length: 36 }),
  reviewedAt: timestamp("reviewed_at"),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("evidence_team_id_idx").on(table.teamId),
  index("evidence_sprint_id_idx").on(table.sprintId),
  index("evidence_task_id_idx").on(table.taskId),
  index("evidence_submitted_by_idx").on(table.submittedBy),
  // Partial: the queue only ever reads PENDING, and this table only grows in the accepted
  // direction, so the index stays small. Mirrors scripts/sql/add-evidence-review.sql.
  index("evidence_pending_review_idx").on(table.taskId).where(sql`status = 'PENDING'`),
]);

export const mous = pgTable("mous", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  cohortId: varchar("cohort_id", { length: 36 }),
  creditMapJson: json("credit_map_json"),
  status: mouStatusEnum("status").notNull().default("DRAFT"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("mous_org_id_idx").on(table.orgId),
  index("mous_cohort_id_idx").on(table.cohortId),
]);

export const creditMaps = pgTable("credit_maps", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  programHours: integer("program_hours").default(0),
  outcomesJson: json("outcomes_json"),
  files: text("files").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("credit_maps_org_id_idx").on(table.orgId),
]);

export const seedFunds = pgTable("seed_funds", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 })
    .notNull()
    .default("1000000"),
  sourcesJson: json("sources_json"),
  disbursedAmount: decimal("disbursed_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("seed_funds_team_id_idx").on(table.teamId),
]);

export const capTableEntries = pgTable("cap_table_entries", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }),
  label: text("label").notNull(),
  percent: decimal("percent", { precision: 5, scale: 2 }).notNull(),
  cashAmount: decimal("cash_amount", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("cap_table_entries_team_id_idx").on(table.teamId),
  index("cap_table_entries_user_id_idx").on(table.userId),
]);

export const stipendRules = pgTable("stipend_rules", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  band: stipendBandEnum("band").notNull().unique(),
  monthlyAmount: decimal("monthly_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamApplicationMembers = pgTable("team_application_members", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  teamApplicationId: varchar("team_application_id", { length: 36 }).notNull(), // references applications.id (type=TEAM)
  memberIndex: integer("member_index").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: roleColumn("role").notNull(), // FOUNDER, COFOUNDER, LEARNER
  cofounderRole: text("cofounder_role"), // CTO | CBO
  internTrack: text("intern_track"), // TECHNICAL | BUSINESS | BOTH
  individualApplicationId: varchar("individual_application_id", { length: 36 }),
  status: teamApplicationMemberStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("team_application_members_team_application_id_idx").on(table.teamApplicationId),
  index("team_application_members_email_idx").on(table.email),
  index("team_application_members_status_idx").on(table.status),
  uniqueIndex("team_application_members_unique_email_idx").on(table.teamApplicationId, table.email),
  uniqueIndex("team_application_members_unique_index_idx").on(table.teamApplicationId, table.memberIndex),
]);

export const teamApplicationInvites = pgTable("team_application_invites", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  memberId: varchar("member_id", { length: 36 }).notNull(), // references team_application_members.id
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at"),
  sentAt: timestamp("sent_at"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("team_application_invites_member_id_idx").on(table.memberId),
]);

export const stipendDisbursements = pgTable("stipend_disbursements", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  month: text("month").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: stipendStatusEnum("status").notNull().default("PENDING"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("stipend_disbursements_team_id_idx").on(table.teamId),
  index("stipend_disbursements_user_id_idx").on(table.userId),
  uniqueIndex("stipend_disbursements_team_user_month_idx").on(table.teamId, table.userId, table.month),
]);

export const invoices = pgTable("invoices", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id", { length: 36 }),
  userId: varchar("user_id", { length: 36 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  purpose: text("purpose").notNull(),
  razorpayOrderId: text("razorpay_order_id"),
  status: invoiceStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("invoices_application_id_idx").on(table.applicationId),
  index("invoices_user_id_idx").on(table.userId),
]);

export const paymentInstallments = pgTable("payment_installments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id", { length: 36 }).notNull(),
  installmentNumber: integer("installment_number").notNull(),
  installmentType: text("installment_type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date").notNull(),
  paidAt: timestamp("paid_at"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("payment_installments_application_id_idx").on(table.applicationId),
  uniqueIndex("payment_installments_app_number_idx").on(table.applicationId, table.installmentNumber),
]);

export const manualPayments = pgTable("manual_payments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id", { length: 36 }).notNull(),
  installmentId: varchar("installment_id", { length: 36 }),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull(), // Cash, Bank Transfer, UPI, Cheque, Demand Draft, POS/Card
  transactionReferenceId: text("transaction_reference_id"),
  notes: text("notes"),
  receivedBy: varchar("received_by", { length: 36 }).notNull(),
  proofAttachmentUrl: text("proof_attachment_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("manual_payments_application_id_idx").on(table.applicationId),
  index("manual_payments_installment_id_idx").on(table.installmentId),
  index("manual_payments_received_by_idx").on(table.receivedBy),
]);

export const certificates = pgTable("certificates", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  teamId: varchar("team_id", { length: 36 }),
  kind: certificateKindEnum("kind").notNull(),
  fileUrl: text("file_url"),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("certificates_user_id_idx").on(table.userId),
  index("certificates_team_id_idx").on(table.teamId),
]);



export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
]);

/**
 * Track catalog.
 *
 * `problem_statements.track` used to be constrained by the `track` pgEnum, so a
 * track that wasn't compiled into the enum could not be stored. This table
 * holds the selectable list instead, and admins can add to it at runtime.
 * `value` is the stable identifier stored on rows; `label` is what users see.
 */
export const tracks = pgTable("tracks", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  value: text("value").notNull().unique(),
  label: text("label").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("tracks_value_idx").on(table.value),
  index("tracks_is_active_idx").on(table.isActive),
]);

export const blogPosts = pgTable("blog_posts", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  authorId: varchar("author_id", { length: 36 }),
  published: boolean("published").default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const faqs = pgTable("faqs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: text("category").default("General"),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyStandups = pgTable("daily_standups", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sprintId: varchar("sprint_id", { length: 36 }).notNull(),
  authorId: varchar("author_id", { length: 36 }).notNull(),
  yesterday: text("yesterday"),
  today: text("today"),
  blockers: text("blockers"),
  mood: standupMoodEnum("mood").default("good"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("daily_standups_sprint_id_idx").on(table.sprintId),
  index("daily_standups_author_id_idx").on(table.authorId),
]);

export const mentorSessions = pgTable("mentor_sessions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  mentorId: varchar("mentor_id", { length: 36 }).notNull(),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  sprintId: varchar("sprint_id", { length: 36 }),
  occurredAt: timestamp("occurred_at").notNull(),
  durationMinutes: integer("duration_minutes").default(60),
  sessionType: text("session_type").default("check-in"),
  notes: text("notes"),
  attendeeIds: text("attendee_ids").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("mentor_sessions_mentor_id_idx").on(table.mentorId),
  index("mentor_sessions_team_id_idx").on(table.teamId),
]);

export const mentorHonorariums = pgTable("mentor_honorariums", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  mentorId: varchar("mentor_id", { length: 36 }).notNull(),
  month: text("month").notNull(),
  sessionsCount: integer("sessions_count").default(0),
  totalHours: decimal("total_hours", { precision: 6, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: honorariumStatusEnum("status").notNull().default("PENDING"),
  exportedAt: timestamp("exported_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("mentor_honorariums_mentor_id_idx").on(table.mentorId),
  uniqueIndex("mentor_honorariums_mentor_month_idx").on(table.mentorId, table.month),
]);

export const milestones = pgTable("milestones", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  cohortId: varchar("cohort_id", { length: 36 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: milestoneStatusEnum("status").default("UPCOMING"),
  order: integer("order").default(1),
  goals: text("goals"),
  deliverables: text("deliverables"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("milestones_cohort_id_idx").on(table.cohortId),
]);

export const assessments = pgTable("assessments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  cohortId: varchar("cohort_id", { length: 36 }),
  durationMinutes: integer("duration_minutes").default(60),
  passingScore: integer("passing_score").default(70),
  isActive: boolean("is_active").default(false),
  createdBy: varchar("created_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("assessments_cohort_id_idx").on(table.cohortId),
  index("assessments_created_by_idx").on(table.createdBy),
]);

export const assessmentQuestions = pgTable("assessment_questions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id", { length: 36 }).notNull(),
  type: questionTypeEnum("type").notNull(),
  prompt: text("prompt").notNull(),
  optionsJson: json("options_json"),
  correctAnswer: text("correct_answer"),
  maxScore: integer("max_score").default(1),
  order: integer("order").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("assessment_questions_assessment_id_idx").on(table.assessmentId),
]);

export const assessmentAttempts = pgTable("assessment_attempts", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  applicationId: varchar("application_id", { length: 36 }),
  status: attemptStatusEnum("status").notNull().default("IN_PROGRESS"),
  score: integer("score"),
  maxScore: integer("max_score"),
  passed: boolean("passed"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
  expiresAt: timestamp("expires_at"),
  resultsPublished: boolean("results_published").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("assessment_attempts_assessment_id_idx").on(table.assessmentId),
  index("assessment_attempts_user_id_idx").on(table.userId),
  index("assessment_attempts_application_id_idx").on(table.applicationId),
]);

export const assessmentAnswers = pgTable("assessment_answers", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  attemptId: varchar("attempt_id", { length: 36 }).notNull(),
  questionId: varchar("question_id", { length: 36 }).notNull(),
  responseJson: json("response_json"),
  awardedScore: integer("awarded_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("assessment_answers_attempt_id_idx").on(table.attemptId),
  index("assessment_answers_question_id_idx").on(table.questionId),
  uniqueIndex("assessment_answers_attempt_question_idx").on(table.attemptId, table.questionId),
]);

export const assessmentAssignments = pgTable("assessment_assignments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  assignedBy: varchar("assigned_by", { length: 36 }),
  publicToken: text("public_token"), // Token for public access without login
  email: text("email"), // Email for public access verification
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("assessment_assignments_assessment_id_idx").on(table.assessmentId),
  index("assessment_assignments_user_id_idx").on(table.userId),
  index("assessment_assignments_public_token_idx").on(table.publicToken),
  uniqueIndex("assessment_assignments_assessment_user_idx").on(table.assessmentId, table.userId),
]);

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(), // User who should receive notification
  type: notificationTypeEnum("type").notNull(),
  status: notificationStatusEnum("status").notNull().default("UNREAD"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  metadataJson: json("metadata_json"), // Additional data (mentorId, candidateId, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_status_idx").on(table.status),
  index("notifications_type_idx").on(table.type),
]);

export const passwordResetOtps = pgTable("password_reset_otps", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  otp: varchar("otp", { length: 6 }).notNull(), // 6-digit OTP
  hashedOtp: text("hashed_otp").notNull(), // Hashed OTP for security
  attempts: integer("attempts").default(0).notNull(), // Number of verification attempts
  expiresAt: timestamp("expires_at").notNull(), // OTP expiry time (10 minutes)
  verified: boolean("verified").default(false).notNull(), // Whether OTP has been verified
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("password_reset_otps_email_idx").on(table.email),
  index("password_reset_otps_expires_at_idx").on(table.expiresAt),
]);

export const jobTypeEnum = pgEnum("job_type", ["ONSITE", "OFFLINE", "HYBRID"]);

export const mentorJobPostings = pgTable("mentor_job_postings", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(), // Main description/about the role
  aboutTheRole: text("about_the_role"), // About the role section
  whatYouWillDo: text("what_you_will_do"), // What will you do section
  whatMightBeAFitIf: text("what_might_be_a_fit_if"), // Requirements/what might be a fit if
  niceToHave: text("nice_to_have"), // Nice to have section
  location: text("location").notNull().default("Bangalore"),
  jobType: jobTypeEnum("job_type").notNull(),
  experienceRequired: text("experience_required"), // e.g., "5-10 years"
  areaOfInterest: text("area_of_interest").array(), // Array of domains
  requiredSkills: text("required_skills").array(), // Array of skills
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by", { length: 36 }), // Admin who created it
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("mentor_job_postings_is_active_idx").on(table.isActive),
  index("mentor_job_postings_location_idx").on(table.location),
]);

export const mentorProfiles = pgTable("mentor_profiles", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().unique(), // Links to users table
  education: text("education"),
  skills: text("skills").array(), // Array of skills
  experience: text("experience"),
  tracksJson: json("tracks_json"), // JSON array of tracks (max 3) - ["GovTech", "EduTech", etc.]
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  description: text("description"),
  aboutMentor: text("about_mentor"),
  cvUrl: text("cv_url"),
  certificationsUrl: text("certifications_url"), // JSON array of URLs
  videoUrl: text("video_url"),
  credentialsShared: boolean("credentials_shared").default(false),
  credentialsApprovedBy: varchar("credentials_approved_by", { length: 36 }), // Admin who approved
  credentialsApprovedAt: timestamp("credentials_approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("mentor_profiles_user_id_idx").on(table.userId),
]);

// Sprint Permissions - Controls who can edit sprints/tasks
export const sprintPermissions = pgTable("sprint_permissions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sprintId: varchar("sprint_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  canEdit: boolean("can_edit").default(false).notNull(),
  grantedBy: varchar("granted_by", { length: 36 }).notNull(), // Founder who granted permission
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
}, (table) => [
  index("sprint_permissions_sprint_id_idx").on(table.sprintId),
  index("sprint_permissions_user_id_idx").on(table.userId),
  uniqueIndex("sprint_permissions_sprint_user_idx").on(table.sprintId, table.userId),
]);

// Sprint Exports - Audit trail for completed-sprint data exports. Each row is
// one bundle of team members' work that left the platform, which matters when
// universities and partners receive it.
export const sprintExports = pgTable("sprint_exports", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sprintId: varchar("sprint_id", { length: 36 }).notNull(),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  exportedBy: varchar("exported_by", { length: 36 }).notNull(),
  format: varchar("format", { length: 20 }).notNull().default("zip"),
  taskCount: integer("task_count").default(0),
  attachmentCount: integer("attachment_count").default(0),
  skippedCount: integer("skipped_count").default(0),
  // Bytes actually written. Null until the stream finishes, so a row with a
  // null size is a download that failed or was cancelled part-way. bigint
  // because a large team's attachments can exceed the ~2.1 GB int4 ceiling.
  byteSize: bigint("byte_size", { mode: "number" }),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("sprint_exports_sprint_id_idx").on(table.sprintId),
  index("sprint_exports_team_id_idx").on(table.teamId),
  index("sprint_exports_exported_by_idx").on(table.exportedBy),
]);

// Files a team uploads against a sprint (reference docs, decks, datasets —
// any type, unlike ticket attachments which are restricted to an allowlist).
// Shown in the sprint's Resources tab and its View Details dialog.
export const sprintResources = pgTable("sprint_resources", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sprintId: varchar("sprint_id", { length: 36 }).notNull(),
  // "file" resources store an uploaded document under objectKey; "link" resources
  // just point at an external url instead — objectKey stays null for those.
  type: text("type").notNull().default("file"), // "file" | "link"
  fileName: text("file_name").notNull(),
  objectKey: text("object_key"),
  url: text("url"),
  contentType: text("content_type"),
  fileSize: integer("file_size"),
  uploadedById: varchar("uploaded_by_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("sprint_resources_sprint_id_idx").on(table.sprintId),
  index("sprint_resources_uploaded_by_id_idx").on(table.uploadedById),
]);

// Cohort Tasks - Tasks created by admin that apply to all teams in a cohort
export const cohortTasks = pgTable("cohort_tasks", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  cohortId: varchar("cohort_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  meetingLink: text("meeting_link"), // Zoom/Google Meet link
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  createdBy: varchar("created_by", { length: 36 }).notNull(), // Admin who created
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("cohort_tasks_cohort_id_idx").on(table.cohortId),
  index("cohort_tasks_created_by_idx").on(table.createdBy),
  index("cohort_tasks_start_time_idx").on(table.startTime),
]);

// Cohort Task Sessions - Multiple sessions for each cohort task with specific active times
export const cohortTaskSessions = pgTable("cohort_task_sessions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  cohortTaskId: varchar("cohort_task_id", { length: 36 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  startTime: text("start_time").notNull(), // Format: HH:MM
  endTime: text("end_time").notNull(), // Format: HH:MM
  meetingLink: text("meeting_link"), // Optional meeting link per session
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("cohort_task_sessions_cohort_task_id_idx").on(table.cohortTaskId),
  index("cohort_task_sessions_start_date_idx").on(table.startDate),
]);

// Team Meetings - Meetings created by founders, co-founders, mentors for team discussions
export const teamMeetings = pgTable("team_meetings", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  title: text("title").notNull(),
  agenda: text("agenda"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").default(30),
  timezone: text("timezone").default("Asia/Kolkata"),
  meetingLink: text("meeting_link"),
  // Where the session happens: GOOGLE_MEET (the portal mints the link) or OTHER (the mentor
  // pastes one). Text with a default rather than a pgEnum, because adding a value to a Postgres
  // enum needs a non-transactional ALTER TYPE. Validated in shared/meetingPlatform.ts.
  //
  // Stored explicitly rather than inferred from "has a Google event": calendar creation is
  // allowed to fail without failing the meeting, so a Meet meeting can legitimately end up with
  // no link and no event id, and would be indistinguishable from an external one.
  meetingPlatform: text("meeting_platform").notNull().default("GOOGLE_MEET"),
  googleEventId: text("google_event_id"),
  attendeeIds: text("attendee_ids").array(),
  sprintId: varchar("sprint_id", { length: 36 }), // Optional: link to sprint
  notes: text("notes"), // Optional: meeting notes
  momTitle: text("mom_title"), // Minutes of Meeting title
  momDate: timestamp("mom_date"), // Minutes of Meeting date
  momDocument: text("mom_document"), // Minutes of Meeting document URL/S3 key
  // Session recording. Only the S3 key is stored; the file itself is uploaded by the browser
  // straight to S3 and streamed back from a signed URL, so no video byte passes through the
  // container. See shared/meetingRecording.ts for the limits and who may upload.
  recordingObjectKey: text("recording_object_key"),
  recordingFileName: text("recording_file_name"),
  // bigint, not integer: int4 tops out at 2147483647 and the 2GB cap is 2147483648 — a file
  // exactly at the limit would pass validation and then fail to insert.
  recordingSizeBytes: bigint("recording_size_bytes", { mode: "number" }),
  recordingContentType: text("recording_content_type"),
  // Read from the file in the browser, so the list can say "1h 04m" without opening the video.
  recordingDurationSeconds: integer("recording_duration_seconds"),
  recordingUploadedBy: varchar("recording_uploaded_by", { length: 36 }),
  recordingUploadedAt: timestamp("recording_uploaded_at"),
  deletedAt: timestamp("deleted_at"), // Soft delete
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("team_meetings_team_id_idx").on(table.teamId),
  index("team_meetings_created_by_idx").on(table.createdBy),
  index("team_meetings_scheduled_at_idx").on(table.scheduledAt),
  index("team_meetings_sprint_id_idx").on(table.sprintId),
  index("team_meetings_deleted_at_idx").on(table.deletedAt),
  // Partial: most meetings never get a recording, so the index only covers the ones that did.
  index("team_meetings_recording_idx")
    .on(table.teamId)
    .where(sql`recording_object_key IS NOT NULL`),
]);



// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  applications: many(applications),
  roleAssignments: many(roleAssignments),
  reviews: many(reviews),
  certificates: many(certificates),
  stipendDisbursements: many(stipendDisbursements),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  mous: many(mous),
  creditMaps: many(creditMaps),
}));

export const cohortsRelations = relations(cohorts, ({ many }) => ({
  applications: many(applications),
  teams: many(teams),
  mous: many(mous),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, {
    fields: [applications.userId],
    references: [users.id],
  }),
  cohort: one(cohorts, {
    fields: [applications.cohortId],
    references: [cohorts.id],
  }),
  paymentInstallments: many(paymentInstallments),
  manualPayments: many(manualPayments),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  cohort: one(cohorts, {
    fields: [teams.cohortId],
    references: [cohorts.id],
  }),
  problemStatement: one(problemStatements, {
    fields: [teams.problemStatementId],
    references: [problemStatements.id],
  }),
  roleAssignments: many(roleAssignments),
  sprints: many(sprints),
  evidence: many(evidence),
  seedFund: one(seedFunds),
  capTableEntries: many(capTableEntries),
  meetings: many(teamMeetings),
}));

export const problemStatementsRelations = relations(problemStatements, ({ one, many }) => ({
  creator: one(users, {
    fields: [problemStatements.createdBy],
    references: [users.id],
  }),
  publisher: one(users, {
    fields: [problemStatements.publishedBy],
    references: [users.id],
  }),
  teams: many(teams),
  applications: many(problemStatementApplications),
}));

export const problemStatementApplicationsRelations = relations(problemStatementApplications, ({ one }) => ({
  problemStatement: one(problemStatements, {
    fields: [problemStatementApplications.problemStatementId],
    references: [problemStatements.id],
  }),
  applicant: one(users, {
    fields: [problemStatementApplications.applicantId],
    references: [users.id],
  }),
}));

export const roleAssignmentsRelations = relations(
  roleAssignments,
  ({ one }) => ({
    team: one(teams, {
      fields: [roleAssignments.teamId],
      references: [teams.id],
    }),
    user: one(users, {
      fields: [roleAssignments.userId],
      references: [users.id],
    }),
  })
);

export const teamMemberApplicationsRelations = relations(
  teamMemberApplications,
  ({ one }) => ({
    founder: one(users, {
      fields: [teamMemberApplications.founderId],
      references: [users.id],
      relationName: "founderApplications",
    }),
    targetUser: one(users, {
      fields: [teamMemberApplications.targetUserId],
      references: [users.id],
      relationName: "receivedApplications",
    }),
  })
);

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  team: one(teams, {
    fields: [sprints.teamId],
    references: [teams.id],
  }),
  tasks: many(tasks),
  permissions: many(sprintPermissions),
  reviews: many(reviews),
  standups: many(dailyStandups),
  evidence: many(evidence),
  meetings: many(teamMeetings),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  sprint: one(sprints, {
    fields: [tasks.sprintId],
    references: [sprints.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  sprint: one(sprints, {
    fields: [reviews.sprintId],
    references: [sprints.id],
  }),
  mentor: one(users, {
    fields: [reviews.mentorId],
    references: [users.id],
  }),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  team: one(teams, {
    fields: [evidence.teamId],
    references: [teams.id],
  }),
  sprint: one(sprints, {
    fields: [evidence.sprintId],
    references: [sprints.id],
  }),
  submitter: one(users, {
    fields: [evidence.submittedBy],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [evidence.taskId],
    references: [tasks.id],
  }),
}));

export const mousRelations = relations(mous, ({ one }) => ({
  organization: one(organizations, {
    fields: [mous.orgId],
    references: [organizations.id],
  }),
  cohort: one(cohorts, {
    fields: [mous.cohortId],
    references: [cohorts.id],
  }),
}));

export const creditMapsRelations = relations(creditMaps, ({ one }) => ({
  organization: one(organizations, {
    fields: [creditMaps.orgId],
    references: [organizations.id],
  }),
}));

export const seedFundsRelations = relations(seedFunds, ({ one }) => ({
  team: one(teams, {
    fields: [seedFunds.teamId],
    references: [teams.id],
  }),
}));

export const capTableEntriesRelations = relations(
  capTableEntries,
  ({ one }) => ({
    team: one(teams, {
      fields: [capTableEntries.teamId],
      references: [teams.id],
    }),
    user: one(users, {
      fields: [capTableEntries.userId],
      references: [users.id],
    }),
  })
);

export const stipendDisbursementsRelations = relations(
  stipendDisbursements,
  ({ one }) => ({
    team: one(teams, {
      fields: [stipendDisbursements.teamId],
      references: [teams.id],
    }),
    user: one(users, {
      fields: [stipendDisbursements.userId],
      references: [users.id],
    }),
  })
);

export const invoicesRelations = relations(invoices, ({ one }) => ({
  application: one(applications, {
    fields: [invoices.applicationId],
    references: [applications.id],
  }),
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, {
    fields: [certificates.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [certificates.teamId],
    references: [teams.id],
  }),
}));



export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(users, {
    fields: [blogPosts.authorId],
    references: [users.id],
  }),
}));

export const dailyStandupsRelations = relations(dailyStandups, ({ one }) => ({
  sprint: one(sprints, {
    fields: [dailyStandups.sprintId],
    references: [sprints.id],
  }),
  author: one(users, {
    fields: [dailyStandups.authorId],
    references: [users.id],
  }),
}));

export const mentorSessionsRelations = relations(mentorSessions, ({ one }) => ({
  mentor: one(users, {
    fields: [mentorSessions.mentorId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [mentorSessions.teamId],
    references: [teams.id],
  }),
  sprint: one(sprints, {
    fields: [mentorSessions.sprintId],
    references: [sprints.id],
  }),
}));

export const mentorHonorariumsRelations = relations(mentorHonorariums, ({ one }) => ({
  mentor: one(users, {
    fields: [mentorHonorariums.mentorId],
    references: [users.id],
  }),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
  cohort: one(cohorts, {
    fields: [milestones.cohortId],
    references: [cohorts.id],
  }),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  cohort: one(cohorts, {
    fields: [assessments.cohortId],
    references: [cohorts.id],
  }),
  creator: one(users, {
    fields: [assessments.createdBy],
    references: [users.id],
  }),
  questions: many(assessmentQuestions),
  attempts: many(assessmentAttempts),
  assignments: many(assessmentAssignments),
}));

export const assessmentQuestionsRelations = relations(assessmentQuestions, ({ one }) => ({
  assessment: one(assessments, {
    fields: [assessmentQuestions.assessmentId],
    references: [assessments.id],
  }),
}));

export const assessmentAttemptsRelations = relations(assessmentAttempts, ({ one, many }) => ({
  assessment: one(assessments, {
    fields: [assessmentAttempts.assessmentId],
    references: [assessments.id],
  }),
  user: one(users, {
    fields: [assessmentAttempts.userId],
    references: [users.id],
  }),
  application: one(applications, {
    fields: [assessmentAttempts.applicationId],
    references: [applications.id],
  }),
  answers: many(assessmentAnswers),
}));

export const assessmentAnswersRelations = relations(assessmentAnswers, ({ one }) => ({
  attempt: one(assessmentAttempts, {
    fields: [assessmentAnswers.attemptId],
    references: [assessmentAttempts.id],
  }),
  question: one(assessmentQuestions, {
    fields: [assessmentAnswers.questionId],
    references: [assessmentQuestions.id],
  }),
}));

export const assessmentAssignmentsRelations = relations(assessmentAssignments, ({ one }) => ({
  assessment: one(assessments, {
    fields: [assessmentAssignments.assessmentId],
    references: [assessments.id],
  }),
  user: one(users, {
    fields: [assessmentAssignments.userId],
    references: [users.id],
  }),
  assignedByUser: one(users, {
    fields: [assessmentAssignments.assignedBy],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const mentorProfilesRelations = relations(mentorProfiles, ({ one }) => ({
  user: one(users, {
    fields: [mentorProfiles.userId],
    references: [users.id],
  }),
}));

// Relations for Sprint Permission tables
export const sprintPermissionsRelations = relations(sprintPermissions, ({ one }) => ({
  sprint: one(sprints, {
    fields: [sprintPermissions.sprintId],
    references: [sprints.id],
  }),
  user: one(users, {
    fields: [sprintPermissions.userId],
    references: [users.id],
  }),
  grantedByUser: one(users, {
    fields: [sprintPermissions.grantedBy],
    references: [users.id],
    relationName: "grantedBy",
  }),
}));

export const teamMeetingsRelations = relations(teamMeetings, ({ one }) => ({
  team: one(teams, {
    fields: [teamMeetings.teamId],
    references: [teams.id],
  }),
  creator: one(users, {
    fields: [teamMeetings.createdBy],
    references: [users.id],
  }),
  sprint: one(sprints, {
    fields: [teamMeetings.sprintId],
    references: [sprints.id],
  }),
}));







// ============================================================================
// Tickets
// ============================================================================

export const ticketPriorityEnum = pgEnum("ticket_priority", ["HOT", "WARM", "COLD"]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "OPEN",
  "CLOSED",
  "REOPENED",
]);

export const ticketCategoryEnum = pgEnum("ticket_category", [
  "TECHNICAL",
  "FINANCE",
  "MENTORSHIP",
  "INFRASTRUCTURE",
  "OTHER",
]);

// Every state change is recorded as one of these, forming the audit trail
export const ticketEventTypeEnum = pgEnum("ticket_event_type", [
  "CREATED",
  "ASSIGNED",
  "ESCALATED",
  "AUTO_ESCALATED",
  "CLOSED",
  "REOPENED",
  "PRIORITY_CHANGED",
  "TAGGED",
  "UNTAGGED",
  "COMMENTED",
  "LINKED",
]);

export const tickets = pgTable("tickets", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  priority: ticketPriorityEnum("priority").notNull().default("WARM"),
  status: ticketStatusEnum("status").notNull().default("OPEN"),
  category: ticketCategoryEnum("category").notNull().default("OTHER"),
  // Null cohortId = system-wide ticket (admin only)
  cohortId: varchar("cohort_id", { length: 36 }),
  raisedById: varchar("raised_by_id", { length: 36 }).notNull(),
  // Single accountable owner; watchers live in ticket_tags
  assigneeId: varchar("assignee_id", { length: 36 }),
  // The industry mentor a learner originally picked, while the ticket is held by
  // the academic mentor for a first look. NULL once forwarded (or never gated).
  forwardToId: varchar("forward_to_id", { length: 36 }),
  // Rank in the escalation hierarchy the ticket currently sits at
  escalationLevel: integer("escalation_level").default(0).notNull(),
  // When the SLA for the current priority expires; drives auto-escalation
  slaDueAt: timestamp("sla_due_at"),
  slaBreached: boolean("sla_breached").default(false).notNull(),
  reopenCount: integer("reopen_count").default(0).notNull(),
  closeReason: text("close_reason"),
  closedById: varchar("closed_by_id", { length: 36 }),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("tickets_cohort_id_idx").on(table.cohortId),
  index("tickets_raised_by_id_idx").on(table.raisedById),
  index("tickets_assignee_id_idx").on(table.assigneeId),
  index("tickets_status_idx").on(table.status),
  index("tickets_priority_idx").on(table.priority),
  index("tickets_sla_due_at_idx").on(table.slaDueAt),
]);

// Watchers on a ticket (the "tag your teammates" list)
export const ticketTags = pgTable("ticket_tags", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  taggedById: varchar("tagged_by_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ticket_tags_ticket_id_idx").on(table.ticketId),
  index("ticket_tags_user_id_idx").on(table.userId),
  uniqueIndex("ticket_tags_ticket_user_idx").on(table.ticketId, table.userId),
]);

export const ticketAttachments = pgTable("ticket_attachments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id", { length: 36 }).notNull(),
  // Attachments can hang off a comment instead of the ticket body
  commentId: varchar("comment_id", { length: 36 }),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type"),
  fileSize: integer("file_size"),
  uploadedById: varchar("uploaded_by_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ticket_attachments_ticket_id_idx").on(table.ticketId),
  index("ticket_attachments_comment_id_idx").on(table.commentId),
]);

export const ticketComments = pgTable("ticket_comments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id", { length: 36 }).notNull(),
  authorId: varchar("author_id", { length: 36 }).notNull(),
  body: text("body").notNull(),
  // User ids @mentioned in the body, so they can be notified
  mentionsJson: json("mentions_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ticket_comments_ticket_id_idx").on(table.ticketId),
]);

// Immutable audit trail — one row per state change
export const ticketEvents = pgTable("ticket_events", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id", { length: 36 }).notNull(),
  // Null actor = the system (auto-escalation)
  actorId: varchar("actor_id", { length: 36 }),
  type: ticketEventTypeEnum("type").notNull(),
  fromValue: text("from_value"),
  toValue: text("to_value"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ticket_events_ticket_id_idx").on(table.ticketId),
]);

export const ticketLinks = pgTable("ticket_links", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id", { length: 36 }).notNull(),
  linkedTicketId: varchar("linked_ticket_id", { length: 36 }).notNull(),
  createdById: varchar("created_by_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ticket_links_ticket_id_idx").on(table.ticketId),
  uniqueIndex("ticket_links_pair_idx").on(table.ticketId, table.linkedTicketId),
]);

/**
 * Admin-configurable SLA deadline (in hours) per ticket priority. One row per
 * priority, seeded with the historical hardcoded defaults (HOT=24, WARM=72,
 * COLD=168 — see shared/tickets.ts SLA_HOURS) so behaviour is unchanged until
 * an admin explicitly edits a value.
 */
export const ticketSlaSettings = pgTable("ticket_sla_settings", {
  priority: ticketPriorityEnum("priority").primaryKey(),
  hours: integer("hours").notNull(),
  updatedById: varchar("updated_by_id", { length: 36 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Team Chat
//
// NOTE: table names are prefixed `team_chat_*` on purpose. The Python chatbot
// owns `chat_leads`, `chat_sessions` and `chat_messages` (see bot/db/migrations.py),
// which drizzle.config.ts explicitly filters out — reusing those names would make
// db:push and the bot fight over the same tables.
// ============================================================================

export const teamChatMessageTypeEnum = pgEnum("team_chat_message_type", [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "FILE",
  "STICKER",
  "SYSTEM",
]);

// One channel per team
export const teamChatChannels = pgTable("team_chat_channels", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  teamId: varchar("team_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("team_chat_channels_team_id_idx").on(table.teamId),
]);

export const teamChatMembers = pgTable("team_chat_members", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  // New members can read the full history, so this only tracks unread counts
  lastReadAt: timestamp("last_read_at"),
  mutedUntil: timestamp("muted_until"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => [
  index("team_chat_members_channel_id_idx").on(table.channelId),
  index("team_chat_members_user_id_idx").on(table.userId),
  uniqueIndex("team_chat_members_channel_user_idx").on(table.channelId, table.userId),
]);

export const teamChatMessages = pgTable("team_chat_messages", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id", { length: 36 }).notNull(),
  senderId: varchar("sender_id", { length: 36 }),
  type: teamChatMessageTypeEnum("type").notNull().default("TEXT"),
  body: text("body"),
  // Reply/quote target
  replyToId: varchar("reply_to_id", { length: 36 }),
  // User ids @mentioned in the body
  mentionsJson: json("mentions_json"),
  editedAt: timestamp("edited_at"),
  // Soft delete so reply chains and history stay intact
  deletedAt: timestamp("deleted_at"),
  deletedForEveryone: boolean("deleted_for_everyone").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // Composite index drives cursor pagination of channel history
  index("team_chat_messages_channel_created_idx").on(table.channelId, table.createdAt),
  index("team_chat_messages_sender_id_idx").on(table.senderId),
  index("team_chat_messages_reply_to_id_idx").on(table.replyToId),
]);

export const teamChatAttachments = pgTable("team_chat_attachments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  messageId: varchar("message_id", { length: 36 }).notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type"),
  fileSize: integer("file_size"),
  // Populated for images and video so the client can lay out without a fetch
  width: integer("width"),
  height: integer("height"),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("team_chat_attachments_message_id_idx").on(table.messageId),
]);

export const teamChatReactions = pgTable("team_chat_reactions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  messageId: varchar("message_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("team_chat_reactions_message_id_idx").on(table.messageId),
  uniqueIndex("team_chat_reactions_unique_idx").on(
    table.messageId,
    table.userId,
    table.emoji
  ),
]);

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertCohortSchema = createInsertSchema(cohorts).omit({
  id: true,
  createdAt: true,
});

export const insertRoleSchema = createInsertSchema(roles)
  .omit({ id: true, createdAt: true })
  .extend({
    // Uppercase A-Z and underscores only: the code is compared against string literals
    // throughout the server, and is what gets stored on every user row.
    code: z
      .string()
      .min(2)
      .max(50)
      .regex(/^[A-Z][A-Z_]*$/, "Use uppercase letters and underscores only, e.g. INVESTOR"),
    label: z.string().min(1).max(60),
  });

export const insertCohortUserSchema = createInsertSchema(cohortUsers).omit({
  id: true,
  createdAt: true,
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  createdAt: true,
});

export const insertProblemStatementSchema = createInsertSchema(
  problemStatements
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProblemStatementApplicationSchema = createInsertSchema(
  problemStatementApplications
).omit({
  id: true,
  createdAt: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});

export const insertRoleAssignmentSchema = createInsertSchema(
  roleAssignments
).omit({
  id: true,
  createdAt: true,
});

export const insertTeamMemberApplicationSchema = createInsertSchema(
  teamMemberApplications
).omit({
  id: true,
  createdAt: true,
});

export const insertSprintSchema = createInsertSchema(sprints).omit({
  id: true,
  createdAt: true,
});

/**
 * Task titles are trimmed and must contain a letter or digit, so "-", "." and "   " are rejected.
 * The rule is shared with the programme-plan importer and the route-level guards; see
 * `isMeaningfulTitle` in @shared/programmePlan for why (issue #258).
 *
 * This closes the schema-level hole. It is not the only guard: the task routes destructure
 * `req.body` and never run this schema, so they call `taskTitleError` directly.
 */
export const insertTaskSchema = createInsertSchema(tasks)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    title: z
      .string()
      .transform((value) => value.trim())
      .refine(isMeaningfulTitle, {
        message: `Task title must be at least ${MIN_TASK_TITLE_LENGTH} characters and include a letter or number`,
      }),
  });

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertEvidenceSchema = createInsertSchema(evidence).omit({
  id: true,
  createdAt: true,
});

export const insertMouSchema = createInsertSchema(mous).omit({
  id: true,
  createdAt: true,
});

export const insertCreditMapSchema = createInsertSchema(creditMaps).omit({
  id: true,
  createdAt: true,
});

export const insertSeedFundSchema = createInsertSchema(seedFunds).omit({
  id: true,
  createdAt: true,
});

export const insertCapTableEntrySchema = createInsertSchema(
  capTableEntries
).omit({
  id: true,
  createdAt: true,
});

export const insertStipendRuleSchema = createInsertSchema(stipendRules).omit({
  id: true,
  createdAt: true,
});

export const insertStipendDisbursementSchema = createInsertSchema(
  stipendDisbursements
).omit({
  id: true,
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
});

export const insertManualPaymentSchema = createInsertSchema(manualPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCertificateSchema = createInsertSchema(certificates).omit({
  id: true,
  createdAt: true,
});



export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export const insertTrackSchema = createInsertSchema(tracks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
});

export const insertFaqSchema = createInsertSchema(faqs).omit({
  id: true,
  createdAt: true,
});

export const insertDailyStandupSchema = createInsertSchema(dailyStandups).omit({
  id: true,
  createdAt: true,
});

export const insertMentorSessionSchema = createInsertSchema(mentorSessions).omit({
  id: true,
  createdAt: true,
});

export const insertMentorHonorariumSchema = createInsertSchema(mentorHonorariums).omit({
  id: true,
  createdAt: true,
});

export const insertMilestoneSchema = createInsertSchema(milestones).omit({
  id: true,
  createdAt: true,
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  createdAt: true,
});

export const insertAssessmentQuestionSchema = createInsertSchema(assessmentQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertAssessmentAttemptSchema = createInsertSchema(assessmentAttempts).omit({
  id: true,
  createdAt: true,
});

export const insertAssessmentAnswerSchema = createInsertSchema(assessmentAnswers).omit({
  id: true,
  createdAt: true,
});

export const insertAssessmentAssignmentSchema = createInsertSchema(assessmentAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertMentorProfileSchema = createInsertSchema(mentorProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPasswordResetOtpSchema = createInsertSchema(passwordResetOtps).omit({
  id: true,
  createdAt: true,
});

export const insertMentorJobPostingSchema = createInsertSchema(mentorJobPostings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCohortTaskSchema = createInsertSchema(cohortTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCohortTaskSessionSchema = createInsertSchema(cohortTaskSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMeetingSchema = createInsertSchema(teamMeetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Review rubric schema for validation
export const reviewRubricSchema = z.object({
  codeQuality: z.number().min(0).max(10),
  reliability: z.number().min(0).max(10),
  ux: z.number().min(0).max(10),
  customerInterviews: z.number().min(0).max(10),
  goToMarket: z.number().min(0).max(10),
  professionalism: z.number().min(0).max(10),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Cohort = typeof cohorts.$inferSelect;
export type InsertCohort = z.infer<typeof insertCohortSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type CohortUser = typeof cohortUsers.$inferSelect;
export type InsertCohortUser = z.infer<typeof insertCohortUserSchema>;

// Tickets
export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTicketTagSchema = createInsertSchema(ticketTags).omit({
  id: true,
  createdAt: true,
});
export const insertTicketAttachmentSchema = createInsertSchema(ticketAttachments).omit({
  id: true,
  createdAt: true,
});
export const insertSprintResourceSchema = createInsertSchema(sprintResources).omit({
  id: true,
  createdAt: true,
});
export const insertTicketCommentSchema = createInsertSchema(ticketComments).omit({
  id: true,
  createdAt: true,
});
export const insertTicketEventSchema = createInsertSchema(ticketEvents).omit({
  id: true,
  createdAt: true,
});
export const insertTicketLinkSchema = createInsertSchema(ticketLinks).omit({
  id: true,
  createdAt: true,
});
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type TicketTag = typeof ticketTags.$inferSelect;
export type InsertTicketTag = z.infer<typeof insertTicketTagSchema>;
export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type InsertTicketAttachment = z.infer<typeof insertTicketAttachmentSchema>;
export type TicketComment = typeof ticketComments.$inferSelect;
export type InsertTicketComment = z.infer<typeof insertTicketCommentSchema>;
export type TicketEvent = typeof ticketEvents.$inferSelect;
export type InsertTicketEvent = z.infer<typeof insertTicketEventSchema>;
export type TicketLink = typeof ticketLinks.$inferSelect;
export type InsertTicketLink = z.infer<typeof insertTicketLinkSchema>;
export type TicketSlaSetting = typeof ticketSlaSettings.$inferSelect;

// Team Chat
export const insertTeamChatChannelSchema = createInsertSchema(teamChatChannels).omit({
  id: true,
  createdAt: true,
});
export const insertTeamChatMemberSchema = createInsertSchema(teamChatMembers).omit({
  id: true,
  joinedAt: true,
});
export const insertTeamChatMessageSchema = createInsertSchema(teamChatMessages).omit({
  id: true,
  createdAt: true,
});
export const insertTeamChatAttachmentSchema = createInsertSchema(teamChatAttachments).omit({
  id: true,
  createdAt: true,
});
export const insertTeamChatReactionSchema = createInsertSchema(teamChatReactions).omit({
  id: true,
  createdAt: true,
});

export type TeamChatChannel = typeof teamChatChannels.$inferSelect;
export type InsertTeamChatChannel = z.infer<typeof insertTeamChatChannelSchema>;
export type TeamChatMember = typeof teamChatMembers.$inferSelect;
export type InsertTeamChatMember = z.infer<typeof insertTeamChatMemberSchema>;
export type TeamChatMessage = typeof teamChatMessages.$inferSelect;
export type InsertTeamChatMessage = z.infer<typeof insertTeamChatMessageSchema>;
export type TeamChatAttachment = typeof teamChatAttachments.$inferSelect;
export type InsertTeamChatAttachment = z.infer<typeof insertTeamChatAttachmentSchema>;
export type TeamChatReaction = typeof teamChatReactions.$inferSelect;
export type InsertTeamChatReaction = z.infer<typeof insertTeamChatReactionSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type ProblemStatement = typeof problemStatements.$inferSelect;
export type InsertProblemStatement = z.infer<
  typeof insertProblemStatementSchema
>;
export type ProblemStatementApplication = typeof problemStatementApplications.$inferSelect;
export type InsertProblemStatementApplication = z.infer<
  typeof insertProblemStatementApplicationSchema
>;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type RoleAssignment = typeof roleAssignments.$inferSelect;
export type InsertRoleAssignment = z.infer<typeof insertRoleAssignmentSchema>;
export type TeamMemberApplication = typeof teamMemberApplications.$inferSelect;
export type InsertTeamMemberApplication = z.infer<typeof insertTeamMemberApplicationSchema>;
export type Sprint = typeof sprints.$inferSelect;
export type InsertSprint = z.infer<typeof insertSprintSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Evidence = typeof evidence.$inferSelect;
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type MoU = typeof mous.$inferSelect;
export type InsertMoU = z.infer<typeof insertMouSchema>;
export type CreditMap = typeof creditMaps.$inferSelect;
export type InsertCreditMap = z.infer<typeof insertCreditMapSchema>;
export type SeedFund = typeof seedFunds.$inferSelect;
export type InsertSeedFund = z.infer<typeof insertSeedFundSchema>;
export type CapTableEntry = typeof capTableEntries.$inferSelect;
export type InsertCapTableEntry = z.infer<typeof insertCapTableEntrySchema>;
export type StipendRule = typeof stipendRules.$inferSelect;
export type InsertStipendRule = z.infer<typeof insertStipendRuleSchema>;
export type StipendDisbursement = typeof stipendDisbursements.$inferSelect;
export type InsertStipendDisbursement = z.infer<
  typeof insertStipendDisbursementSchema
>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type ManualPayment = typeof manualPayments.$inferSelect;
export type InsertManualPayment = z.infer<typeof insertManualPaymentSchema>;
export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Track = typeof tracks.$inferSelect;
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type Faq = typeof faqs.$inferSelect;
export type InsertFaq = z.infer<typeof insertFaqSchema>;
export type DailyStandup = typeof dailyStandups.$inferSelect;
export type SprintPermission = typeof sprintPermissions.$inferSelect;
export type InsertSprintPermission = typeof sprintPermissions.$inferInsert;
export type SprintExport = typeof sprintExports.$inferSelect;
export type InsertSprintExport = typeof sprintExports.$inferInsert;
export type SprintResource = typeof sprintResources.$inferSelect;
export type InsertSprintResource = z.infer<typeof insertSprintResourceSchema>;
export type InsertDailyStandup = z.infer<typeof insertDailyStandupSchema>;
export type MentorSession = typeof mentorSessions.$inferSelect;
export type InsertMentorSession = z.infer<typeof insertMentorSessionSchema>;
export type MentorHonorarium = typeof mentorHonorariums.$inferSelect;
export type InsertMentorHonorarium = z.infer<typeof insertMentorHonorariumSchema>;
export type Milestone = typeof milestones.$inferSelect;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type AssessmentQuestion = typeof assessmentQuestions.$inferSelect;
export type InsertAssessmentQuestion = z.infer<typeof insertAssessmentQuestionSchema>;
export type AssessmentAttempt = typeof assessmentAttempts.$inferSelect;
export type InsertAssessmentAttempt = z.infer<typeof insertAssessmentAttemptSchema>;
export type AssessmentAnswer = typeof assessmentAnswers.$inferSelect;
export type InsertAssessmentAnswer = z.infer<typeof insertAssessmentAnswerSchema>;
export type AssessmentAssignment = typeof assessmentAssignments.$inferSelect;
export type InsertAssessmentAssignment = z.infer<typeof insertAssessmentAssignmentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type MentorProfile = typeof mentorProfiles.$inferSelect;
export type InsertMentorProfile = z.infer<typeof insertMentorProfileSchema>;
export type PasswordResetOtp = typeof passwordResetOtps.$inferSelect;
export type InsertPasswordResetOtp = z.infer<typeof insertPasswordResetOtpSchema>;
export type MentorJobPosting = typeof mentorJobPostings.$inferSelect;
export type InsertMentorJobPosting = z.infer<typeof insertMentorJobPostingSchema>;
export type CohortTask = typeof cohortTasks.$inferSelect;
export type InsertCohortTask = z.infer<typeof insertCohortTaskSchema>;
export type CohortTaskSession = typeof cohortTaskSessions.$inferSelect;
export type InsertCohortTaskSession = z.infer<typeof insertCohortTaskSessionSchema>;
export type TeamMeeting = typeof teamMeetings.$inferSelect;
export type InsertTeamMeeting = z.infer<typeof insertTeamMeetingSchema>;
export type ReviewRubric = z.infer<typeof reviewRubricSchema>;
export type TeamApplicationMember = typeof teamApplicationMembers.$inferSelect;
export type InsertTeamApplicationMember = typeof teamApplicationMembers.$inferInsert;
export type TeamApplicationInvite = typeof teamApplicationInvites.$inferSelect;
export type InsertTeamApplicationInvite = typeof teamApplicationInvites.$inferInsert;

// Form validation schemas
export const learnerApplicationFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  education: z.string().min(1, "Education is required"),
  university: z.string().optional(),
  yearOfStudy: z.string().optional(),
  workExperience: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  githubUrl: z.string().url().optional().or(z.literal("")),
  motivation: z.string().min(50, "Please provide at least 50 characters"),
  // Cohort/Domain selection
  cohortId: z.string().optional(),
  // Tracks are no longer a fixed enum here. The selectable list comes from the
  // `tracks` catalog table, so hardcoding it would reject any track an admin
  // adds — and the previous list was already missing MSME, which the form has
  // always offered. Validated against the catalog server-side on submit.
  preferredTrack: z.string().min(1).optional(),
  preferredTracks: z
    .array(z.string().min(1))
    .max(5, "Select at most 5 tracks")
    .optional(),
  // Additional fields for Founder and Co-Founder applications
  founderQuestion1: z.string().optional(),
  founderQuestion2: z.string().optional(),
  cofounderQuestion1: z.string().optional(),
  cofounderQuestion2: z.string().optional(),
  interestedRole: z.string().optional(),
  // CV file metadata
  cvFileName: z.string().optional(),
  cvFileSize: z.number().optional(),
  cvFileType: z.string().optional(),
  // Intern-specific fields
  technicalSkills: z.array(z.string()).optional(),
  readyForProjects: z.boolean().optional(),
  needsTraining: z.boolean().optional(),
  acceptTerms: z.boolean().refine((v) => v === true, { message: "You must accept the Terms and Conditions." }),
}).catchall(z.any()); // Allow additional fields

export const universityApplicationFormSchema = z.object({
  universityName: z.string().min(2, "University name is required"),
  contactPersonName: z.string().min(2, "Contact person name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  designation: z.string().min(1, "Designation is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  studentCount: z.string().optional(),
  partnershipInterest: z.string().min(20, "Please describe your interest"),
  acceptTerms: z.boolean().refine((v) => v === true, { message: "You must accept the Terms and Conditions." }),
});

// Team application submission schema (public)
export const teamApplicationSubmissionSchema = z.object({
  team_name: z.string().min(1),
  project_description: z.string().min(1),
  team_leader_full_name: z.string().min(1),
  team_leader_email: z.string().email(),
  team_leader_phone: z.string().optional(),
  number_of_members: z.coerce.number().int().min(2).max(10),
  members: z.array(z.object({
    member_full_name: z.string().min(1),
    member_email: z.string().email(),
    member_role: z.enum(["FOUNDER", "COFOUNDER", "LEARNER"]),
    cofounder_role: z.enum(["CTO", "CBO"]).optional(),
    intern_track: z.enum(["TECHNICAL", "BUSINESS", "BOTH"]).optional(),
  })).min(2).max(10),
}).superRefine((data, ctx) => {
  if (data.members.length !== data.number_of_members) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["members"], message: "Members count must match number_of_members" });
  }

  const emails = data.members.map(m => m.member_email.toLowerCase().trim());
  const uniqueEmails = new Set(emails);
  if (uniqueEmails.size !== emails.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["members"], message: "Duplicate member emails are not allowed" });
  }

  data.members.forEach((m, idx) => {
    if (m.member_role === "COFOUNDER" && !m.cofounder_role) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["members", idx, "cofounder_role"], message: "CTO/CBO is required" });
    }
    if (m.member_role === "LEARNER" && !m.intern_track) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["members", idx, "intern_track"], message: "Intern track is required" });
    }
  });
});

export const corporateApplicationFormSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactPersonName: z.string().min(2, "Contact person name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  designation: z.string().min(1, "Designation is required"),
  industry: z.string().min(1, "Industry is required"),
  companySize: z.string().optional(),
  challengeAreas: z.string().min(20, "Please describe challenge areas"),
  partnershipType: z.enum(["challenge", "pilot", "hiring", "other"]),
  acceptTerms: z.boolean().refine((v) => v === true, { message: "You must accept the Terms and Conditions." }),
});

export type LearnerApplicationForm = z.infer<
  typeof learnerApplicationFormSchema
>;
export type UniversityApplicationForm = z.infer<
  typeof universityApplicationFormSchema
>;
export type CorporateApplicationForm = z.infer<
  typeof corporateApplicationFormSchema
>;

export const paymentInstallmentsRelations = relations(paymentInstallments, ({ one }) => ({
  application: one(applications, {
    fields: [paymentInstallments.applicationId],
    references: [applications.id],
  }),
}));

export const manualPaymentsRelations = relations(manualPayments, ({ one }) => ({
  application: one(applications, {
    fields: [manualPayments.applicationId],
    references: [applications.id],
  }),
  installment: one(paymentInstallments, {
    fields: [manualPayments.installmentId],
    references: [paymentInstallments.id],
  }),
  receivedByUser: one(users, {
    fields: [manualPayments.receivedBy],
    references: [users.id],
  }),
}));
