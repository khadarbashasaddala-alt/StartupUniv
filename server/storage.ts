import { eq, and, or, desc, sql, like, inArray, lte, ne, lt, gt } from "drizzle-orm";
import { isPreferredReviewer } from "@shared/evidenceReview";
import type { TicketPriority } from "@shared/tickets";
import { db } from "./db";
import {
  planTeamChanges,
  type ProgrammePlan,
  type TeamPlanDiff,
} from "@shared/programmePlan";
import {
  users,
  organizations,
  cohorts,
  cohortRoleCounts,
  roles,
  cohortUsers,
  applications,
  problemStatements,
  teams,
  roleAssignments,
  teamMemberApplications,
  teamApplicationMembers,
  teamApplicationInvites,
  problemStatementApplications,
  sprints,
  tasks,
  reviews,
  evidence,
  mous,
  creditMaps,
  seedFunds,
  capTableEntries,
  stipendRules,
  stipendDisbursements,
  invoices,
  certificates,
  sessions,
  blogPosts,
  faqs,
  dailyStandups,
  mentorSessions,
  mentorHonorariums,
  teamMeetings,
  milestones,
  assessments,
  assessmentQuestions,
  assessmentAttempts,
  assessmentAnswers,
  assessmentAssignments,
  type User,
  type InsertUser,
  type Organization,
  type InsertOrganization,
  type Cohort,
  type InsertCohort,
  type Role,
  type InsertRole,
  type CohortUser,
  type InsertCohortUser,
  type Application,
  type InsertApplication,
  type ProblemStatement,
  type InsertProblemStatement,
  type ProblemStatementApplication,
  type InsertProblemStatementApplication,
  type Team,
  type InsertTeam,
  type RoleAssignment,
  type InsertRoleAssignment,
  type TeamMemberApplication,
  type InsertTeamMemberApplication,
  type TeamApplicationMember,
  type InsertTeamApplicationMember,
  type TeamApplicationInvite,
  type InsertTeamApplicationInvite,
  type Sprint,
  type InsertSprint,
  type Task,
  type InsertTask,
  type Review,
  type InsertReview,
  type Evidence,
  type InsertEvidence,
  type MoU,
  type InsertMoU,
  type CreditMap,
  type InsertCreditMap,
  type SeedFund,
  type InsertSeedFund,
  type CapTableEntry,
  type InsertCapTableEntry,
  type StipendRule,
  type InsertStipendRule,
  type StipendDisbursement,
  type InsertStipendDisbursement,
  type Invoice,
  type InsertInvoice,
  type Certificate,
  type InsertCertificate,
  type Session,
  type InsertSession,
  tracks,
  type Track,
  type InsertTrack,
  type BlogPost,
  type InsertBlogPost,
  type Faq,
  type InsertFaq,
  type DailyStandup,
  type InsertDailyStandup,
  type MentorSession,
  type InsertMentorSession,
  type MentorHonorarium,
  type InsertMentorHonorarium,
  type TeamMeeting,
  type InsertTeamMeeting,
  type Milestone,
  type InsertMilestone,
  type Assessment,
  type InsertAssessment,
  type AssessmentQuestion,
  type InsertAssessmentQuestion,
  type AssessmentAttempt,
  type InsertAssessmentAttempt,
  type AssessmentAnswer,
  type InsertAssessmentAnswer,
  type AssessmentAssignment,
  type InsertAssessmentAssignment,
  type Notification,
  type InsertNotification,
  type MentorProfile,
  type InsertMentorProfile,
  type PasswordResetOtp,
  type InsertPasswordResetOtp,
  type MentorJobPosting,
  type InsertMentorJobPosting,
  notifications,
  mentorProfiles,
  sprintPermissions,
  sprintExports,
  sprintResources,
  passwordResetOtps,
  mentorJobPostings,
  cohortTasks,
  cohortTaskSessions,
  type SprintPermission,
  type InsertSprintPermission,
  type SprintExport,
  type InsertSprintExport,
  type SprintResource,
  type InsertSprintResource,
  type CohortTask,
  type InsertCohortTask,
  type CohortTaskSession,
  type InsertCohortTaskSession,
  tickets,
  ticketTags,
  ticketComments,
  ticketAttachments,
  ticketEvents,
  ticketLinks,
  ticketSlaSettings,
  type Ticket,
  type InsertTicket,
  type TicketTag,
  type InsertTicketTag,
  type TicketComment,
  type InsertTicketComment,
  type TicketAttachment,
  type InsertTicketAttachment,
  type TicketEvent,
  type InsertTicketEvent,
  type TicketLink,
  type InsertTicketLink,
  type TicketSlaSetting,
  teamChatChannels,
  teamChatMembers,
  teamChatMessages,
  teamChatAttachments,
  teamChatReactions,
  type TeamChatChannel,
  type InsertTeamChatChannel,
  type TeamChatMember,
  type InsertTeamChatMember,
  type TeamChatMessage,
  type InsertTeamChatMessage,
  type TeamChatAttachment,
  type InsertTeamChatAttachment,
  type TeamChatReaction,
  type InsertTeamChatReaction,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByKeycloakId(keycloakId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUsersByIds(ids: string[]): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  getUsersByOrg(orgId: string): Promise<User[]>;

  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization | undefined>;
  getOrganizations(): Promise<Organization[]>;
  getOrganizationsByType(type: string): Promise<Organization[]>;

  // Roles (admin-managed; see shared/schema.ts `roles`)
  getRoles(): Promise<Role[]>;
  getRoleByCode(code: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  deleteRole(code: string): Promise<boolean>;
  countUsersWithRole(code: string): Promise<number>;

  // Cohorts
  getCohort(id: string): Promise<Cohort | undefined>;
  createCohort(cohort: InsertCohort): Promise<Cohort>;
  updateCohort(id: string, data: Partial<InsertCohort>): Promise<Cohort | undefined>;
  deleteCohort(id: string): Promise<boolean>;
  getCohorts(): Promise<Cohort[]>;
  getActiveCohorts(): Promise<Cohort[]>;
  getCohortsOpenForRegistration(): Promise<Cohort[]>;

  // Cohort composition (planned headcount per role)
  getCohortComposition(cohortId: string): Promise<Record<string, number>>;
  getCohortCompositions(cohortIds: string[]): Promise<Record<string, Record<string, number>>>;
  setCohortComposition(cohortId: string, counts: Record<string, number>): Promise<void>;

  // Cohort Users (direct user-to-cohort assignment)
  getCohortUser(userId: string): Promise<CohortUser | undefined>;
  getCohortUsersByCohort(cohortId: string): Promise<CohortUser[]>;
  createCohortUser(data: InsertCohortUser): Promise<CohortUser>;
  deleteCohortUser(userId: string): Promise<boolean>;
  deleteCohortUsersByCohort(cohortId: string): Promise<boolean>;

  // Applications
  getApplication(id: string): Promise<Application | undefined>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: string, data: Partial<InsertApplication>): Promise<Application | undefined>;
  getApplications(): Promise<Application[]>;
  getApplicationsByUser(userId: string): Promise<Application[]>;
  getApplicationsByCohort(cohortId: string): Promise<Application[]>;
  getApplicationsByStatus(status: string): Promise<Application[]>;

  // Team Applications (type=TEAM) - roster + invites
  createTeamApplicationMember(member: InsertTeamApplicationMember): Promise<TeamApplicationMember>;
  getTeamApplicationMember(id: string): Promise<TeamApplicationMember | undefined>;
  getTeamApplicationMembers(teamApplicationId: string): Promise<TeamApplicationMember[]>;
  updateTeamApplicationMember(id: string, data: Partial<InsertTeamApplicationMember>): Promise<TeamApplicationMember | undefined>;
  createTeamApplicationInvite(invite: InsertTeamApplicationInvite): Promise<TeamApplicationInvite>;
  getTeamApplicationInviteByTokenHash(tokenHash: string): Promise<TeamApplicationInvite | undefined>;
  getTeamApplicationInviteByMemberId(memberId: string): Promise<TeamApplicationInvite | undefined>;
  updateTeamApplicationInvite(id: string, data: Partial<InsertTeamApplicationInvite>): Promise<TeamApplicationInvite | undefined>;

  // Problem Statements
  getProblemStatement(id: string): Promise<ProblemStatement | undefined>;
  getProblemStatementByTeamId(teamId: string): Promise<ProblemStatement | undefined>;
  createProblemStatement(ps: InsertProblemStatement): Promise<ProblemStatement>;
  updateProblemStatement(id: string, data: Partial<InsertProblemStatement>): Promise<ProblemStatement | undefined>;
  getProblemStatements(): Promise<ProblemStatement[]>;
  getProblemStatementsByTrack(track: string): Promise<ProblemStatement[]>;

  // Teams
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, data: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<void>;
  getTeams(): Promise<Team[]>;
  getTeamsByCohort(cohortId: string): Promise<Team[]>;

  // Role Assignments
  getRoleAssignment(id: string): Promise<RoleAssignment | undefined>;
  createRoleAssignment(ra: InsertRoleAssignment): Promise<RoleAssignment>;
  updateRoleAssignment(id: string, data: Partial<InsertRoleAssignment>): Promise<RoleAssignment | undefined>;
  deleteRoleAssignment(id: string): Promise<boolean>;
  getRoleAssignmentsByTeam(teamId: string): Promise<RoleAssignment[]>;
  getRoleAssignmentsByUser(userId: string): Promise<RoleAssignment[]>;

  // Team Member Applications
  createTeamMemberApplication(app: InsertTeamMemberApplication): Promise<TeamMemberApplication>;
  getTeamMemberApplicationsByFounder(founderId: string): Promise<TeamMemberApplication[]>;
  getTeamMemberApplicationsByTargetUser(targetUserId: string): Promise<TeamMemberApplication[]>;
  getTeamMemberApplication(founderId: string, targetUserId: string): Promise<TeamMemberApplication | undefined>;
  getTeamMemberApplicationById(id: string): Promise<TeamMemberApplication | undefined>;
  updateTeamMemberApplication(id: string, data: Partial<InsertTeamMemberApplication>): Promise<TeamMemberApplication | undefined>;
  deleteTeamMemberApplication(id: string): Promise<boolean>;

  // Auto-close applications when user joins a team
  closeAllApplicationsForUser(userId: string): Promise<{
    teamMemberAppsClosed: number;
    problemStatementAppsClosed: number;
  }>;

  // Sprints
  getSprint(id: string): Promise<Sprint | undefined>;
  createSprint(sprint: InsertSprint): Promise<Sprint>;
  updateSprint(id: string, data: Partial<InsertSprint>): Promise<Sprint | undefined>;
  deleteSprint(id: string): Promise<boolean>;
  getSprintsByTeam(teamId: string): Promise<Sprint[]>;

  // Programme plan import (issue #258)
  diffProgrammePlan(teamId: string, plan: ProgrammePlan, cohortStart: Date): Promise<TeamPlanDiff>;
  applyProgrammePlan(teamId: string, plan: ProgrammePlan, cohortStart: Date): Promise<TeamPlanDiff>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  getTasksBySprint(sprintId: string): Promise<Task[]>;
  getTasksByAssignee(userId: string): Promise<Task[]>;

  // Evidence review (see shared/evidenceReview.ts)
  reviewEvidence(
    id: string,
    review: { status: string; feedback?: string | null; reviewedBy: string }
  ): Promise<Evidence | undefined>;
  getEvidencePendingReviewFor(userId: string): Promise<any[]>;
  getEvidenceByTasks(taskIds: string[]): Promise<Evidence[]>;
  getTasksByTeam(teamId: string): Promise<Task[]>;

  // Password Reset OTP
  createPasswordResetOtp(otpData: InsertPasswordResetOtp): Promise<PasswordResetOtp>;
  getPasswordResetOtpByEmail(email: string): Promise<PasswordResetOtp | undefined>;
  updatePasswordResetOtp(id: string, data: Partial<InsertPasswordResetOtp>): Promise<PasswordResetOtp | undefined>;
  deleteExpiredOtps(): Promise<void>;

  // Mentor Job Postings
  getMentorJobPosting(id: string): Promise<MentorJobPosting | undefined>;
  getMentorJobPostings(filters?: {
    location?: string;
    jobType?: string[];
    areaOfInterest?: string[];
    experience?: string;
    isActive?: boolean;
  }): Promise<MentorJobPosting[]>;
  createMentorJobPosting(posting: InsertMentorJobPosting): Promise<MentorJobPosting>;
  updateMentorJobPosting(id: string, data: Partial<InsertMentorJobPosting>): Promise<MentorJobPosting | undefined>;
  deleteMentorJobPosting(id: string): Promise<boolean>;

  // Cohort Tasks
  getCohortTask(id: string): Promise<CohortTask | undefined>;
  getCohortTasks(): Promise<CohortTask[]>;
  getCohortTasksByCohort(cohortId: string): Promise<CohortTask[]>;
  getCohortTasksForUser(userId: string): Promise<CohortTask[]>;
  createCohortTask(task: InsertCohortTask): Promise<CohortTask>;
  updateCohortTask(id: string, data: Partial<InsertCohortTask>): Promise<CohortTask | undefined>;
  deleteCohortTask(id: string): Promise<boolean>;

  // Cohort Task Sessions
  getCohortTaskSessions(cohortTaskId: string): Promise<CohortTaskSession[]>;
  createCohortTaskSession(session: InsertCohortTaskSession): Promise<CohortTaskSession>;
  deleteCohortTaskSessionsByTaskId(cohortTaskId: string): Promise<boolean>;

  // Reviews
  getReview(id: string): Promise<Review | undefined>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, data: Partial<InsertReview>): Promise<Review | undefined>;
  getReviewsBySprint(sprintId: string): Promise<Review[]>;
  getReviewsByMentor(mentorId: string): Promise<Review[]>;

  // Evidence
  getEvidence(id: string): Promise<Evidence | undefined>;
  createEvidence(ev: InsertEvidence): Promise<Evidence>;
  updateEvidence(id: string, data: Partial<InsertEvidence>): Promise<Evidence | undefined>;
  deleteEvidence(id: string): Promise<boolean>;
  getEvidenceByTeam(teamId: string): Promise<Evidence[]>;

  // MOUs
  getMou(id: string): Promise<MoU | undefined>;
  createMou(mou: InsertMoU): Promise<MoU>;
  updateMou(id: string, data: Partial<InsertMoU>): Promise<MoU | undefined>;
  getMousByOrg(orgId: string): Promise<MoU[]>;

  // Credit Maps
  getCreditMap(id: string): Promise<CreditMap | undefined>;
  createCreditMap(cm: InsertCreditMap): Promise<CreditMap>;
  updateCreditMap(id: string, data: Partial<InsertCreditMap>): Promise<CreditMap | undefined>;
  getCreditMapsByOrg(orgId: string): Promise<CreditMap[]>;

  // Seed Funds
  getSeedFund(id: string): Promise<SeedFund | undefined>;
  createSeedFund(sf: InsertSeedFund): Promise<SeedFund>;
  updateSeedFund(id: string, data: Partial<InsertSeedFund>): Promise<SeedFund | undefined>;
  getSeedFundByTeam(teamId: string): Promise<SeedFund | undefined>;

  // Cap Table Entries
  getCapTableEntry(id: string): Promise<CapTableEntry | undefined>;
  createCapTableEntry(cte: InsertCapTableEntry): Promise<CapTableEntry>;
  updateCapTableEntry(id: string, data: Partial<InsertCapTableEntry>): Promise<CapTableEntry | undefined>;
  getCapTableByTeam(teamId: string): Promise<CapTableEntry[]>;

  // Stipend Rules
  getStipendRule(id: string): Promise<StipendRule | undefined>;
  createStipendRule(sr: InsertStipendRule): Promise<StipendRule>;
  updateStipendRule(id: string, data: Partial<InsertStipendRule>): Promise<StipendRule | undefined>;
  getStipendRules(): Promise<StipendRule[]>;
  getStipendRuleByBand(band: string): Promise<StipendRule | undefined>;

  // Stipend Disbursements
  getStipendDisbursement(id: string): Promise<StipendDisbursement | undefined>;
  createStipendDisbursement(sd: InsertStipendDisbursement): Promise<StipendDisbursement>;
  updateStipendDisbursement(id: string, data: Partial<InsertStipendDisbursement>): Promise<StipendDisbursement | undefined>;
  getStipendDisbursementsByTeam(teamId: string): Promise<StipendDisbursement[]>;
  getStipendDisbursementsByUser(userId: string): Promise<StipendDisbursement[]>;

  // Invoices
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(inv: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  getInvoices(): Promise<Invoice[]>;
  getInvoicesByUser(userId: string): Promise<Invoice[]>;

  // Certificates
  getCertificate(id: string): Promise<Certificate | undefined>;
  createCertificate(cert: InsertCertificate): Promise<Certificate>;
  getCertificatesByUser(userId: string): Promise<Certificate[]>;

  // Sessions
  getSession(id: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  deleteSessionsByUser(userId: string): Promise<void>;

  // Tracks (admin-managed catalog backing problem_statements.track)
  getTracks(includeInactive?: boolean): Promise<Track[]>;
  getTrackByValue(value: string): Promise<Track | undefined>;
  createTrack(track: InsertTrack): Promise<Track>;
  updateTrack(id: string, data: Partial<InsertTrack>): Promise<Track | undefined>;

  // Blog Posts
  getBlogPost(id: string): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: string, data: Partial<InsertBlogPost>): Promise<BlogPost | undefined>;
  getBlogPosts(): Promise<BlogPost[]>;
  getPublishedBlogPosts(): Promise<BlogPost[]>;

  // FAQs
  getFaq(id: string): Promise<Faq | undefined>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  updateFaq(id: string, data: Partial<InsertFaq>): Promise<Faq | undefined>;
  deleteFaq(id: string): Promise<void>;
  getFaqs(): Promise<Faq[]>;

  // Daily Standups
  getDailyStandup(id: string): Promise<DailyStandup | undefined>;
  createDailyStandup(standup: InsertDailyStandup): Promise<DailyStandup>;
  getDailyStandupsBySprint(sprintId: string): Promise<DailyStandup[]>;
  getDailyStandupsByAuthor(authorId: string): Promise<DailyStandup[]>;

  // Mentor Sessions
  getMentorSession(id: string): Promise<MentorSession | undefined>;
  createMentorSession(session: InsertMentorSession): Promise<MentorSession>;
  updateMentorSession(id: string, data: Partial<InsertMentorSession>): Promise<MentorSession | undefined>;
  deleteMentorSession(id: string): Promise<void>;
  getMentorSessionsByMentor(mentorId: string): Promise<MentorSession[]>;
  getMentorSessionsByTeam(teamId: string): Promise<MentorSession[]>;

  // Mentor Honorariums
  getMentorHonorarium(id: string): Promise<MentorHonorarium | undefined>;
  createMentorHonorarium(honorarium: InsertMentorHonorarium): Promise<MentorHonorarium>;
  updateMentorHonorarium(id: string, data: Partial<InsertMentorHonorarium>): Promise<MentorHonorarium | undefined>;
  getMentorHonorariumsByMentor(mentorId: string): Promise<MentorHonorarium[]>;
  getMentorHonorariumsByMonth(month: string): Promise<MentorHonorarium[]>;

  // Evidence by Sprint
  getEvidenceBySprint(sprintId: string): Promise<Evidence[]>;

  // Milestones
  getMilestone(id: string): Promise<Milestone | undefined>;
  createMilestone(milestone: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, data: Partial<InsertMilestone>): Promise<Milestone | undefined>;
  deleteMilestone(id: string): Promise<boolean>;
  getMilestones(): Promise<Milestone[]>;
  getMilestonesByCohort(cohortId: string): Promise<Milestone[]>;

  // Assessments
  getAssessment(id: string): Promise<Assessment | undefined>;
  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  updateAssessment(id: string, data: Partial<InsertAssessment>): Promise<Assessment | undefined>;
  deleteAssessment(id: string): Promise<boolean>;
  getAssessments(): Promise<Assessment[]>;
  getAssessmentsByCohort(cohortId: string): Promise<Assessment[]>;
  getActiveAssessments(): Promise<Assessment[]>;

  // Assessment Questions
  getAssessmentQuestion(id: string): Promise<AssessmentQuestion | undefined>;
  createAssessmentQuestion(question: InsertAssessmentQuestion): Promise<AssessmentQuestion>;
  updateAssessmentQuestion(id: string, data: Partial<InsertAssessmentQuestion>): Promise<AssessmentQuestion | undefined>;
  deleteAssessmentQuestion(id: string): Promise<boolean>;
  getQuestionsByAssessment(assessmentId: string): Promise<AssessmentQuestion[]>;

  // Assessment Attempts
  getAssessmentAttempt(id: string): Promise<AssessmentAttempt | undefined>;
  createAssessmentAttempt(attempt: InsertAssessmentAttempt): Promise<AssessmentAttempt>;
  updateAssessmentAttempt(id: string, data: Partial<InsertAssessmentAttempt>): Promise<AssessmentAttempt | undefined>;
  getAttemptsByAssessment(assessmentId: string): Promise<AssessmentAttempt[]>;
  getAttemptByUserAndAssessment(userId: string, assessmentId: string): Promise<AssessmentAttempt | undefined>;

  // Assessment Answers
  getAssessmentAnswer(id: string): Promise<AssessmentAnswer | undefined>;
  createAssessmentAnswer(answer: InsertAssessmentAnswer): Promise<AssessmentAnswer>;
  updateAssessmentAnswer(id: string, data: Partial<InsertAssessmentAnswer>): Promise<AssessmentAnswer | undefined>;
  getAnswersByAttempt(attemptId: string): Promise<AssessmentAnswer[]>;

  // Assessment Assignments
  createAssessmentAssignment(assignment: InsertAssessmentAssignment): Promise<AssessmentAssignment>;
  updateAssessmentAssignment(id: string, data: Partial<InsertAssessmentAssignment>): Promise<AssessmentAssignment | undefined>;
  deleteAssessmentAssignment(assessmentId: string, userId: string): Promise<boolean>;
  getAssignmentsByUser(userId: string): Promise<AssessmentAssignment[]>;
  getAssignmentsByAssessment(assessmentId: string): Promise<AssessmentAssignment[]>;
  getAssignmentsByAssessmentWithUsers(assessmentId: string): Promise<(AssessmentAssignment & { user: User | null })[]>;
  getAssignmentByPublicToken(token: string): Promise<AssessmentAssignment | undefined>;
  getAssignmentByEmailAndAssessment(email: string, assessmentId: string): Promise<AssessmentAssignment | undefined>;

  // Notifications
  getNotification(id: string): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: string, data: Partial<InsertNotification>): Promise<Notification | undefined>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  getUnreadNotificationsByUser(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // Mentor Profiles
  getMentorProfile(id: string): Promise<MentorProfile | undefined>;
  getMentorProfileByUserId(userId: string): Promise<MentorProfile | undefined>;
  createMentorProfile(profile: InsertMentorProfile): Promise<MentorProfile>;
  updateMentorProfile(id: string, data: Partial<InsertMentorProfile>): Promise<MentorProfile | undefined>;
  getMentorProfiles(): Promise<MentorProfile[]>;
  getMentorProfilesByTrack(track: string): Promise<MentorProfile[]>;

  // Sprint Permissions
  getSprintPermission(sprintId: string, userId: string): Promise<SprintPermission | undefined>;
  createSprintPermission(permission: InsertSprintPermission): Promise<SprintPermission>;
  updateSprintPermission(id: string, data: Partial<InsertSprintPermission>): Promise<SprintPermission | undefined>;
  getSprintPermissionsBySprint(sprintId: string): Promise<SprintPermission[]>;
  getSprintPermissionsByUser(userId: string): Promise<SprintPermission[]>;
  revokeSprintPermission(sprintId: string, userId: string): Promise<boolean>;
  hasSprintEditPermission(sprintId: string, userId: string): Promise<boolean>;

  // Sprint Exports (audit trail for completed-sprint data exports)
  createSprintExport(record: InsertSprintExport): Promise<SprintExport>;
  completeSprintExport(id: string, data: Partial<InsertSprintExport>): Promise<SprintExport | undefined>;
  getSprintExportsBySprint(sprintId: string): Promise<SprintExport[]>;

  // Sprint Resources (files uploaded against a sprint — Resources tab / View Details)
  getSprintResources(sprintId: string): Promise<SprintResource[]>;
  getSprintResourceByObjectKey(objectKey: string): Promise<SprintResource | undefined>;
  createSprintResource(resource: InsertSprintResource): Promise<SprintResource>;
  deleteSprintResource(id: string): Promise<boolean>;

  // Team Meetings
  getTeamMeeting(id: string): Promise<TeamMeeting | undefined>;
  createTeamMeeting(meeting: InsertTeamMeeting): Promise<TeamMeeting>;
  updateTeamMeeting(id: string, data: Partial<InsertTeamMeeting>): Promise<TeamMeeting | undefined>;
  deleteTeamMeeting(id: string): Promise<boolean>; // Soft delete
  getTeamMeetingsByTeam(teamId: string): Promise<TeamMeeting[]>;
  getTeamMeetingsByUser(userId: string): Promise<TeamMeeting[]>; // All meetings for user's teams
  getUpcomingTeamMeetings(teamId: string, limit?: number): Promise<TeamMeeting[]>;

  // Tickets
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, data: Partial<InsertTicket>): Promise<Ticket | undefined>;
  deleteTicket(id: string): Promise<boolean>;
  getTickets(): Promise<Ticket[]>;
  getTicketsByCohort(cohortId: string): Promise<Ticket[]>;
  getTicketsVisibleToUser(userId: string): Promise<Ticket[]>;
  getOverdueTickets(now: Date): Promise<Ticket[]>;

  // Ticket tags (watchers)
  getTicketTags(ticketId: string): Promise<TicketTag[]>;
  addTicketTag(tag: InsertTicketTag): Promise<TicketTag>;
  removeTicketTag(ticketId: string, userId: string): Promise<boolean>;
  getTicketTagsByUser(userId: string): Promise<TicketTag[]>;

  // Ticket comments
  getTicketComments(ticketId: string): Promise<TicketComment[]>;
  createTicketComment(comment: InsertTicketComment): Promise<TicketComment>;

  // Ticket attachments
  getTicketAttachments(ticketId: string): Promise<TicketAttachment[]>;
  getTicketAttachmentByObjectKey(objectKey: string): Promise<TicketAttachment | undefined>;
  createTicketAttachment(attachment: InsertTicketAttachment): Promise<TicketAttachment>;
  deleteTicketAttachment(id: string): Promise<boolean>;

  // Ticket events (audit trail)
  getTicketEvents(ticketId: string): Promise<TicketEvent[]>;
  createTicketEvent(event: InsertTicketEvent): Promise<TicketEvent>;

  // Ticket links
  getTicketLinks(ticketId: string): Promise<TicketLink[]>;
  createTicketLink(link: InsertTicketLink): Promise<TicketLink>;
  deleteTicketLink(id: string): Promise<boolean>;

  // Ticket SLA settings (admin-configurable hours per priority)
  getTicketSlaSettings(): Promise<TicketSlaSetting[]>;
  upsertTicketSlaSettings(
    entries: Array<{ priority: TicketPriority; hours: number }>,
    updatedById: string | null
  ): Promise<TicketSlaSetting[]>;

  // Team chat channels
  getTeamChatChannel(id: string): Promise<TeamChatChannel | undefined>;
  getTeamChatChannelByTeam(teamId: string): Promise<TeamChatChannel | undefined>;
  createTeamChatChannel(channel: InsertTeamChatChannel): Promise<TeamChatChannel>;
  updateTeamChatChannel(id: string, data: Partial<InsertTeamChatChannel>): Promise<TeamChatChannel | undefined>;
  getTeamChatChannels(): Promise<TeamChatChannel[]>;

  // Team chat membership
  getTeamChatMembers(channelId: string): Promise<TeamChatMember[]>;
  getTeamChatMember(channelId: string, userId: string): Promise<TeamChatMember | undefined>;
  getTeamChatMembershipsByUser(userId: string): Promise<TeamChatMember[]>;
  addTeamChatMember(member: InsertTeamChatMember): Promise<TeamChatMember>;
  updateTeamChatMember(channelId: string, userId: string, data: Partial<InsertTeamChatMember>): Promise<TeamChatMember | undefined>;
  removeTeamChatMember(channelId: string, userId: string): Promise<boolean>;

  // Team chat messages
  getTeamChatMessage(id: string): Promise<TeamChatMessage | undefined>;
  getTeamChatMessages(channelId: string, options?: { before?: Date; limit?: number }): Promise<TeamChatMessage[]>;
  getTeamChatMessagesByIds(ids: string[]): Promise<TeamChatMessage[]>;
  createTeamChatMessage(message: InsertTeamChatMessage): Promise<TeamChatMessage>;
  updateTeamChatMessage(id: string, data: Partial<InsertTeamChatMessage>): Promise<TeamChatMessage | undefined>;
  getTeamChatUnreadCount(channelId: string, since: Date | null): Promise<number>;
  getLastTeamChatMessage(channelId: string): Promise<TeamChatMessage | undefined>;

  // Team chat attachments
  createTeamChatAttachment(attachment: InsertTeamChatAttachment): Promise<TeamChatAttachment>;
  getTeamChatAttachmentsByMessages(messageIds: string[]): Promise<TeamChatAttachment[]>;
  getTeamChatAttachment(id: string): Promise<TeamChatAttachment | undefined>;

  // Team chat reactions
  addTeamChatReaction(reaction: InsertTeamChatReaction): Promise<TeamChatReaction | undefined>;
  removeTeamChatReaction(messageId: string, userId: string, emoji: string): Promise<boolean>;
  getTeamChatReactionsByMessages(messageIds: string[]): Promise<TeamChatReaction[]>;
}

// User columns that exist without password_changed_at migration — use everywhere so main DB works
const userColumns = {
  id: users.id,
  email: users.email,
  password: users.password,
  name: users.name,
  phone: users.phone,
  role: users.role,
  isAdmin: users.isAdmin,
  orgId: users.orgId,
  avatarUrl: users.avatarUrl,
  keycloakId: users.keycloakId,
  customTag: users.customTag,
  createdAt: users.createdAt,
};

function toUser(row: typeof userColumns extends { [k: string]: infer V } ? Record<string, V> : never): User {
  return { ...row, passwordChangedAt: null } as User;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [row] = await db.select(userColumns).from(users).where(eq(users.id, id));
    return row ? toUser(row as any) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalizedEmail = email.toLowerCase().trim();
    const [row] = await db
      .select(userColumns)
      .from(users)
      .where(sql`LOWER(TRIM(${users.email})) = LOWER(${normalizedEmail})`);
    return row ? toUser(row as any) : undefined;
  }

  async getUserByKeycloakId(keycloakId: string): Promise<User | undefined> {
    const [row] = await db.select(userColumns).from(users).where(eq(users.keycloakId, keycloakId));
    return row ? toUser(row as any) : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getUsers(): Promise<User[]> {
    const rows = await db.select(userColumns).from(users).orderBy(desc(users.createdAt));
    return rows.map((r) => toUser(r as any));
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const rows = await db.select(userColumns).from(users).where(inArray(users.id, ids));
    return rows.map((r) => toUser(r as any));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    const rows = await db.select(userColumns).from(users).where(eq(users.role, role as any)).orderBy(desc(users.createdAt));
    return rows.map((r) => toUser(r as any));
  }

  async getUsersByOrg(orgId: string): Promise<User[]> {
    const rows = await db.select(userColumns).from(users).where(eq(users.orgId, orgId)).orderBy(desc(users.createdAt));
    return rows.map((r) => toUser(r as any));
  }

  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
  }

  async updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await db.update(organizations).set(data).where(eq(organizations.id, id)).returning();
    return updated;
  }

  async getOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }

  async getOrganizationsByType(type: string): Promise<Organization[]> {
    return db.select().from(organizations).where(eq(organizations.type, type as any)).orderBy(desc(organizations.createdAt));
  }

  // Cohorts
  async getCohort(id: string): Promise<Cohort | undefined> {
    const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, id));
    return cohort;
  }

  // Roles
  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(roles.sortOrder, roles.code);
  }

  async getRoleByCode(code: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.code, code));
    return role;
  }

  async createRole(role: InsertRole): Promise<Role> {
    const [created] = await db.insert(roles).values(role).returning();
    return created;
  }

  async deleteRole(code: string): Promise<boolean> {
    // Composition rows cascade; users holding the role are protected by the users.role
    // foreign key, so callers must reassign them first.
    const deleted = await db.delete(roles).where(eq(roles.code, code)).returning();
    return deleted.length > 0;
  }

  async countUsersWithRole(code: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, code));
    return row?.count ?? 0;
  }

  async createCohort(cohort: InsertCohort): Promise<Cohort> {
    const [created] = await db.insert(cohorts).values(cohort).returning();
    return created;
  }

  async updateCohort(id: string, data: Partial<InsertCohort>): Promise<Cohort | undefined> {
    const [updated] = await db.update(cohorts).set(data).where(eq(cohorts.id, id)).returning();
    return updated;
  }

  async getCohorts(): Promise<Cohort[]> {
    return await db.select().from(cohorts).orderBy(desc(cohorts.startDate));
  }

  async getActiveCohorts(): Promise<Cohort[]> {
    return await db.select().from(cohorts).where(eq(cohorts.isActive, true)).orderBy(desc(cohorts.startDate));
  }

  async getCohortsOpenForRegistration(): Promise<Cohort[]> {
    return await db.select().from(cohorts)
      .where(and(eq(cohorts.isActive, true), eq(cohorts.isOpenForRegistration, true)))
      .orderBy(cohorts.name);
  }

  // Cohort composition (planned headcount per role)
  async getCohortComposition(cohortId: string): Promise<Record<string, number>> {
    const rows = await db
      .select()
      .from(cohortRoleCounts)
      .where(eq(cohortRoleCounts.cohortId, cohortId));
    return Object.fromEntries(rows.map((row) => [row.roleCode, row.count]));
  }

  async getCohortCompositions(
    cohortIds: string[]
  ): Promise<Record<string, Record<string, number>>> {
    if (cohortIds.length === 0) return {};

    const rows = await db
      .select()
      .from(cohortRoleCounts)
      .where(inArray(cohortRoleCounts.cohortId, cohortIds));

    // Every requested cohort gets an entry, so callers can index without a null check
    const byCohort: Record<string, Record<string, number>> = Object.fromEntries(
      cohortIds.map((id) => [id, {}])
    );
    for (const row of rows) {
      byCohort[row.cohortId][row.roleCode] = row.count;
    }
    return byCohort;
  }

  async setCohortComposition(
    cohortId: string,
    counts: Record<string, number>
  ): Promise<void> {
    const rows = Object.entries(counts)
      // A role dropped from the form means "no longer planned", which is the absence of a
      // row rather than a zero, keeping the table free of noise.
      .filter(([, count]) => Number.isFinite(count) && count > 0)
      .map(([roleCode, count]) => ({ cohortId, roleCode, count: Math.trunc(count) }));

    // Replace-in-place must be atomic: without the transaction, a failing insert would
    // leave the cohort with no composition at all rather than its previous one.
    await db.transaction(async (tx) => {
      await tx.delete(cohortRoleCounts).where(eq(cohortRoleCounts.cohortId, cohortId));
      if (rows.length > 0) {
        await tx.insert(cohortRoleCounts).values(rows);
      }
    });
  }

  async deleteCohort(id: string): Promise<boolean> {
    // Delete associated cohort_users first
    await db.delete(cohortUsers).where(eq(cohortUsers.cohortId, id));
    // cohort_role_counts cascades on the cohort_id foreign key
    // Delete associated cohort_tasks and their sessions
    const tasksToDelete = await db.select().from(cohortTasks).where(eq(cohortTasks.cohortId, id));
    for (const task of tasksToDelete) {
      await db.delete(cohortTaskSessions).where(eq(cohortTaskSessions.cohortTaskId, task.id));
    }
    await db.delete(cohortTasks).where(eq(cohortTasks.cohortId, id));
    // Delete the cohort
    await db.delete(cohorts).where(eq(cohorts.id, id));
    return true;
  }

  // Cohort Users (direct user-to-cohort assignment)
  async getCohortUser(userId: string): Promise<CohortUser | undefined> {
    const [cohortUser] = await db.select().from(cohortUsers).where(eq(cohortUsers.userId, userId));
    return cohortUser;
  }

  async getCohortUsersByCohort(cohortId: string): Promise<CohortUser[]> {
    return await db.select().from(cohortUsers).where(eq(cohortUsers.cohortId, cohortId));
  }

  async createCohortUser(data: InsertCohortUser): Promise<CohortUser> {
    // First check if user already has a cohort assignment
    const existing = await this.getCohortUser(data.userId);
    if (existing) {
      throw new Error("User is already assigned to a cohort");
    }
    const [created] = await db.insert(cohortUsers).values(data).returning();
    return created;
  }

  async deleteCohortUser(userId: string): Promise<boolean> {
    await db.delete(cohortUsers).where(eq(cohortUsers.userId, userId));
    return true;
  }

  async deleteCohortUsersByCohort(cohortId: string): Promise<boolean> {
    await db.delete(cohortUsers).where(eq(cohortUsers.cohortId, cohortId));
    return true;
  }

  // Applications
  async getApplication(id: string): Promise<Application | undefined> {
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    return app;
  }

  async createApplication(app: InsertApplication): Promise<Application> {
    const [created] = await db.insert(applications).values(app).returning();
    return created;
  }

  async updateApplication(id: string, data: Partial<InsertApplication>): Promise<Application | undefined> {
    const [updated] = await db.update(applications).set(data).where(eq(applications.id, id)).returning();
    return updated;
  }

  async getApplications(): Promise<Application[]> {
    return db.select().from(applications).orderBy(desc(applications.createdAt));
  }

  async getApplicationsByUser(userId: string): Promise<Application[]> {
    return db.select().from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.createdAt));
  }

  async getApplicationsByCohort(cohortId: string): Promise<Application[]> {
    return db.select().from(applications).where(eq(applications.cohortId, cohortId)).orderBy(desc(applications.createdAt));
  }

  async getApplicationsByStatus(status: string): Promise<Application[]> {
    return db.select().from(applications).where(eq(applications.status, status as any)).orderBy(desc(applications.createdAt));
  }

  // Team Applications (type=TEAM) - roster + invites
  async createTeamApplicationMember(member: InsertTeamApplicationMember): Promise<TeamApplicationMember> {
    const [created] = await db.insert(teamApplicationMembers).values(member).returning();
    return created;
  }

  async getTeamApplicationMember(id: string): Promise<TeamApplicationMember | undefined> {
    const [member] = await db.select().from(teamApplicationMembers).where(eq(teamApplicationMembers.id, id));
    return member;
  }

  async getTeamApplicationMembers(teamApplicationId: string): Promise<TeamApplicationMember[]> {
    return db
      .select()
      .from(teamApplicationMembers)
      .where(eq(teamApplicationMembers.teamApplicationId, teamApplicationId))
      .orderBy(teamApplicationMembers.memberIndex);
  }

  async updateTeamApplicationMember(id: string, data: Partial<InsertTeamApplicationMember>): Promise<TeamApplicationMember | undefined> {
    const [updated] = await db
      .update(teamApplicationMembers)
      .set(data)
      .where(eq(teamApplicationMembers.id, id))
      .returning();
    return updated;
  }

  async createTeamApplicationInvite(invite: InsertTeamApplicationInvite): Promise<TeamApplicationInvite> {
    const [created] = await db.insert(teamApplicationInvites).values(invite).returning();
    return created;
  }

  async getTeamApplicationInviteByTokenHash(tokenHash: string): Promise<TeamApplicationInvite | undefined> {
    const [invite] = await db.select().from(teamApplicationInvites).where(eq(teamApplicationInvites.tokenHash, tokenHash));
    return invite;
  }

  async getTeamApplicationInviteByMemberId(memberId: string): Promise<TeamApplicationInvite | undefined> {
    const [invite] = await db.select().from(teamApplicationInvites).where(eq(teamApplicationInvites.memberId, memberId));
    return invite;
  }

  async updateTeamApplicationInvite(id: string, data: Partial<InsertTeamApplicationInvite>): Promise<TeamApplicationInvite | undefined> {
    const [updated] = await db.update(teamApplicationInvites).set(data).where(eq(teamApplicationInvites.id, id)).returning();
    return updated;
  }

  // Problem Statements
  async getProblemStatement(id: string): Promise<ProblemStatement | undefined> {
    const [ps] = await db.select().from(problemStatements).where(eq(problemStatements.id, id));
    return ps;
  }

  /** Find a published problem statement linked to this team (by team_id). Used when team.problemStatementId is missing. */
  async getProblemStatementByTeamId(teamId: string): Promise<ProblemStatement | undefined> {
    const [ps] = await db
      .select()
      .from(problemStatements)
      .where(and(eq(problemStatements.teamId, teamId), eq(problemStatements.status, "PUBLISHED")))
      .limit(1);
    return ps;
  }

  async getProblemStatementsByTrack(track: string): Promise<ProblemStatement[]> {
    return db.select().from(problemStatements).where(eq(problemStatements.track, track as any));
  }

  // Teams
  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(team).returning();
    return created;
  }

  async updateTeam(id: string, data: Partial<InsertTeam>): Promise<Team | undefined> {
    const [updated] = await db.update(teams).set(data).where(eq(teams.id, id)).returning();
    return updated;
  }

  async deleteTeam(id: string): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(desc(teams.createdAt));
  }

  async getTeamsByCohort(cohortId: string): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.cohortId, cohortId)).orderBy(teams.name);
  }

  // Role Assignments
  async getRoleAssignment(id: string): Promise<RoleAssignment | undefined> {
    const [ra] = await db.select().from(roleAssignments).where(eq(roleAssignments.id, id));
    return ra;
  }

  async createRoleAssignment(ra: InsertRoleAssignment): Promise<RoleAssignment> {
    const [created] = await db.insert(roleAssignments).values(ra).returning();
    return created;
  }

  async updateRoleAssignment(id: string, data: Partial<InsertRoleAssignment>): Promise<RoleAssignment | undefined> {
    const [updated] = await db.update(roleAssignments).set(data).where(eq(roleAssignments.id, id)).returning();
    return updated;
  }

  async deleteRoleAssignment(id: string): Promise<boolean> {
    const result = await db.delete(roleAssignments).where(eq(roleAssignments.id, id));
    return true;
  }

  async getRoleAssignmentsByTeam(teamId: string): Promise<RoleAssignment[]> {
    return await db.select().from(roleAssignments).where(eq(roleAssignments.teamId, teamId));
  }

  async getRoleAssignmentsByUser(userId: string): Promise<RoleAssignment[]> {
    // Ordered newest-first, deliberately. Callers such as GET /api/my-team take
    // assignments[0], and without an ORDER BY postgres returns rows in whatever
    // order it likes — so a user on more than one team could be shown an
    // arbitrary team, and with it the wrong problem statement (or none).
    return db
      .select()
      .from(roleAssignments)
      .where(eq(roleAssignments.userId, userId))
      .orderBy(desc(roleAssignments.createdAt));
  }

  // Team Member Applications
  async createTeamMemberApplication(app: InsertTeamMemberApplication): Promise<TeamMemberApplication> {
    const [created] = await db.insert(teamMemberApplications).values(app).returning();
    return created;
  }

  async getTeamMemberApplicationsByFounder(founderId: string): Promise<TeamMemberApplication[]> {
    return db.select().from(teamMemberApplications).where(eq(teamMemberApplications.founderId, founderId));
  }

  async getTeamMemberApplicationsByTargetUser(targetUserId: string): Promise<TeamMemberApplication[]> {
    return db.select().from(teamMemberApplications).where(eq(teamMemberApplications.targetUserId, targetUserId));
  }

  async getTeamMemberApplication(founderId: string, targetUserId: string): Promise<TeamMemberApplication | undefined> {
    const [app] = await db.select().from(teamMemberApplications).where(
      and(
        eq(teamMemberApplications.founderId, founderId),
        eq(teamMemberApplications.targetUserId, targetUserId)
      )
    );
    return app;
  }

  async getTeamMemberApplicationById(id: string): Promise<TeamMemberApplication | undefined> {
    const [app] = await db.select().from(teamMemberApplications).where(eq(teamMemberApplications.id, id));
    return app;
  }

  async updateTeamMemberApplication(id: string, data: Partial<InsertTeamMemberApplication>): Promise<TeamMemberApplication | undefined> {
    const [updated] = await db.update(teamMemberApplications).set(data).where(eq(teamMemberApplications.id, id)).returning();
    return updated;
  }

  async deleteTeamMemberApplication(id: string): Promise<boolean> {
    const result = await db.delete(teamMemberApplications).where(eq(teamMemberApplications.id, id)).returning();
    return result.length > 0;
  }

  // Auto-close all applications for a user when they join a team
  async closeAllApplicationsForUser(userId: string): Promise<{
    teamMemberAppsClosed: number;
    problemStatementAppsClosed: number;
  }> {
    console.log(`🔒 closeAllApplicationsForUser called for userId: ${userId}`);
    
    // 1. Close team member applications SENT by user (reject them - CANCELLED not in enum)
    const sentClosed = await db.update(teamMemberApplications)
      .set({ status: 'REJECTED' as any })
      .where(and(
        eq(teamMemberApplications.founderId, userId),
        eq(teamMemberApplications.status, 'PENDING')
      ))
      .returning();
    console.log(`   - Sent applications closed: ${sentClosed.length}`);

    // 2. Close team member applications RECEIVED by user (reject them)
    const receivedClosed = await db.update(teamMemberApplications)
      .set({ status: 'REJECTED' as any })
      .where(and(
        eq(teamMemberApplications.targetUserId, userId),
        eq(teamMemberApplications.status, 'PENDING')
      ))
      .returning();
    console.log(`   - Received applications closed: ${receivedClosed.length}`);

    // 3. Close problem statement applications by user (reject them)
    const psClosed = await db.update(problemStatementApplications)
      .set({ status: 'REJECTED' as any })
      .where(and(
        eq(problemStatementApplications.applicantId, userId),
        eq(problemStatementApplications.status, 'PENDING')
      ))
      .returning();
    console.log(`   - Problem statement applications closed: ${psClosed.length}`);

    return {
      teamMemberAppsClosed: sentClosed.length + receivedClosed.length,
      problemStatementAppsClosed: psClosed.length,
    };
  }

  // Sprints
  async getSprint(id: string): Promise<Sprint | undefined> {
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, id));
    return sprint;
  }

  async createSprint(sprint: InsertSprint): Promise<Sprint> {
    const [created] = await db.insert(sprints).values(sprint).returning();
    return created;
  }

  async updateSprint(id: string, data: Partial<InsertSprint>): Promise<Sprint | undefined> {
    const [updated] = await db.update(sprints).set(data).where(eq(sprints.id, id)).returning();
    return updated;
  }

  async deleteSprint(id: string): Promise<boolean> {
    // Delete all child records first to avoid FK constraint violations
    await db.delete(sprintPermissions).where(eq(sprintPermissions.sprintId, id));
    await db.delete(dailyStandups).where(eq(dailyStandups.sprintId, id));
    await db.delete(mentorSessions).where(eq(mentorSessions.sprintId, id));
    await db.delete(reviews).where(eq(reviews.sprintId, id));
    await db.delete(evidence).where(eq(evidence.sprintId, id));
    await db.delete(tasks).where(eq(tasks.sprintId, id));
    // Unlink meetings that reference this sprint (don't delete the meeting itself)
    await db.update(teamMeetings).set({ sprintId: null }).where(eq(teamMeetings.sprintId, id));
    const result = await db.delete(sprints).where(eq(sprints.id, id)).returning();
    return result.length > 0;
  }

  async getSprintsByTeam(teamId: string): Promise<Sprint[]> {
    return db.select().from(sprints).where(eq(sprints.teamId, teamId)).orderBy(sprints.index);
  }

  // Programme plan import (issue #258) ---------------------------------------------------------

  /**
   * Reads a team's current sprints and tasks into the shape `planTeamChanges` diffs against.
   *
   * Only the columns the diff actually compares, so a change to either side is a compile error
   * rather than a silently ignored field.
   */
  private async programmePlanState(teamId: string) {
    const existingSprints = await this.getSprintsByTeam(teamId);

    // Fetched by sprint id rather than via getTasksByTeam, which filters on the NULLABLE
    // tasks.team_id. A task whose team_id was never backfilled would be invisible to the diff, and
    // the import would then try to insert a source_key that already exists — failing the whole
    // transaction on the unique index. sprint_id is the authoritative link for a sprint's tasks.
    const sprintIds = existingSprints.map((s) => s.id);
    const existingTasks =
      sprintIds.length === 0
        ? []
        : await db.select().from(tasks).where(inArray(tasks.sprintId, sprintIds));

    return {
      sprints: existingSprints.map((s) => ({
        id: s.id,
        index: s.index,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        goals: s.goals,
        objectives: s.objectives,
        deliverables: s.deliverables,
      })),
      tasks: existingTasks.map((t) => ({
        id: t.id,
        sprintId: t.sprintId,
        sourceKey: t.sourceKey,
        title: t.title,
        description: t.description,
        objectives: t.objectives,
        deliverables: t.deliverables,
        priority: t.priority,
        points: t.points,
        status: t.status as string,
      })),
    };
  }

  /** What applying this plan would do. Reads only — nothing is written. */
  async diffProgrammePlan(
    teamId: string,
    plan: ProgrammePlan,
    cohortStart: Date
  ): Promise<TeamPlanDiff> {
    const state = await this.programmePlanState(teamId);
    return planTeamChanges(plan, cohortStart, state.sprints, state.tasks);
  }

  /**
   * Applies a programme plan to one team, in a single transaction.
   *
   * Atomicity is the point: without it a failure part-way through leaves a half-built board —
   * some sprints created, their tasks missing — which an admin then has to unpick by hand. Either
   * the whole plan lands or nothing does.
   *
   * The diff is recomputed here from current database state rather than taken from the caller's
   * earlier dry-run, so a client cannot hand back a doctored preview. Note it is computed just
   * *before* the transaction opens, not inside it: that leaves a narrow read-then-write window in
   * which a learner could move a task from TODO to IN_PROGRESS, after the diff has already decided
   * to update it. So the task update carries its own `status = 'TODO'` guard, which makes it
   * physically unable to land on a task somebody has started — the window can be lost, but the
   * "never rewrite work in progress" rule cannot. When the guard bites, the returned diff is
   * corrected to say the task was skipped, so the caller is not told about an update that did not
   * happen.
   */
  async applyProgrammePlan(
    teamId: string,
    plan: ProgrammePlan,
    cohortStart: Date
  ): Promise<TeamPlanDiff> {
    const state = await this.programmePlanState(teamId);
    const diff = planTeamChanges(plan, cohortStart, state.sprints, state.tasks);

    await db.transaction(async (tx) => {
      for (const sprintChange of diff.sprints) {
        let sprintId = sprintChange.existingSprintId;

        if (sprintChange.action === "create") {
          const [created] = await tx
            .insert(sprints)
            .values({
              teamId,
              index: sprintChange.index,
              name: sprintChange.name,
              startDate: sprintChange.startDate,
              endDate: sprintChange.endDate,
              goals: sprintChange.goals,
              objectives: sprintChange.objectives,
              deliverables: sprintChange.deliverables,
            })
            .returning();
          sprintId = created.id;
        } else if (sprintChange.action === "update" && sprintId) {
          await tx
            .update(sprints)
            .set({
              name: sprintChange.name,
              startDate: sprintChange.startDate,
              endDate: sprintChange.endDate,
              goals: sprintChange.goals,
              objectives: sprintChange.objectives,
              deliverables: sprintChange.deliverables,
            })
            .where(eq(sprints.id, sprintId));
        }

        if (!sprintId) continue; // unreachable: create returns an id, update/unchanged already have one

        for (const taskChange of sprintChange.tasks) {
          // "skipped" means somebody has started it, and "unchanged" means there is nothing to do.
          if (taskChange.action === "skipped" || taskChange.action === "unchanged") continue;

          const values = {
            title: taskChange.title,
            description: taskChange.description,
            objectives: taskChange.objectives,
            deliverables: taskChange.deliverables,
            priority: taskChange.priority,
            points: taskChange.points,
          };

          if (taskChange.action === "create") {
            await tx.insert(tasks).values({
              sprintId,
              teamId,
              sourceKey: taskChange.sourceKey,
              // Left unassigned on purpose: the issue keeps assignment manual, and an admin or
              // mentor assigns from the board afterwards.
              status: "TODO",
              ...values,
            });
          } else if (taskChange.existingTaskId) {
            // Two things load-bearing here:
            //
            // `status` is absent from `values`, so a task the plan still owns keeps whatever state
            // the board has it in.
            //
            // The `status = 'TODO'` predicate closes the read-then-write window described above: if
            // the task was started after the diff was computed, this matches no rows and the task is
            // left exactly as it is, rather than being silently stamped over.
            const applied = await tx
              .update(tasks)
              .set(values)
              .where(and(eq(tasks.id, taskChange.existingTaskId), eq(tasks.status, "TODO")))
              .returning({ id: tasks.id });

            if (applied.length === 0) {
              // Lost the race. Correct the diff so the caller is not told about an update that
              // never happened.
              taskChange.action = "skipped";
              taskChange.reason = "started while the import was running — left as it is";
              diff.summary.tasksUpdated -= 1;
              diff.summary.tasksSkipped += 1;
            }
          }
        }
      }
    });

    return diff;
  }

  // Tasks
  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getTasksBySprint(sprintId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.sprintId, sprintId));
  }

  async getTasksByAssignee(userId: string): Promise<Task[]> {
    console.log(`[getTasksByAssignee] Fetching tasks for userId: ${userId}`);
    const result = await db.select().from(tasks).where(
      or(
        eq(tasks.assigneeId, userId),
        sql`coalesce(
          case
            when jsonb_typeof(${tasks.assigneeIds}::jsonb) = 'string'
              then (${tasks.assigneeIds}::jsonb #>> '{}')::jsonb
            else ${tasks.assigneeIds}::jsonb
          end,
          '[]'::jsonb
        ) @> to_jsonb(${userId}::text)`,
        eq(tasks.reviewerId, userId) // Also return tasks where user is the reviewer
      )
    );
    console.log(`[getTasksByAssignee] Found ${result.length} tasks for userId: ${userId}`);
    return result;
  }

  async getTasksByTeam(teamId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.teamId, teamId));
  }

  // Password Reset OTP
  async createPasswordResetOtp(otpData: InsertPasswordResetOtp): Promise<PasswordResetOtp> {
    const [created] = await db.insert(passwordResetOtps).values(otpData).returning();
    return created;
  }

  async getPasswordResetOtpByEmail(email: string): Promise<PasswordResetOtp | undefined> {
    const [otp] = await db
      .select()
      .from(passwordResetOtps)
      .where(and(eq(passwordResetOtps.email, email), eq(passwordResetOtps.verified, false)))
      .orderBy(desc(passwordResetOtps.createdAt))
      .limit(1);
    return otp;
  }

  async updatePasswordResetOtp(id: string, data: Partial<InsertPasswordResetOtp>): Promise<PasswordResetOtp | undefined> {
    const [updated] = await db.update(passwordResetOtps).set(data).where(eq(passwordResetOtps.id, id)).returning();
    return updated;
  }

  async deleteExpiredOtps(): Promise<void> {
    await db.delete(passwordResetOtps).where(sql`expires_at < NOW()`);
  }

  // Mentor Job Postings
  async getMentorJobPosting(id: string): Promise<MentorJobPosting | undefined> {
    const [posting] = await db.select().from(mentorJobPostings).where(eq(mentorJobPostings.id, id));
    return posting;
  }

  async getMentorJobPostings(filters?: {
    location?: string;
    jobType?: string[];
    areaOfInterest?: string[];
    experience?: string;
    isActive?: boolean;
  }): Promise<MentorJobPosting[]> {
    let query = db.select().from(mentorJobPostings);
    const conditions = [];
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(mentorJobPostings.isActive, filters.isActive));
      console.log(`📋 Filtering by isActive: ${filters.isActive}`);
    }
    if (filters?.location) {
      conditions.push(eq(mentorJobPostings.location, filters.location));
    }
    if (filters?.jobType && filters.jobType.length > 0) {
      // Use IN operator for job type - check if jobType is in the array
      conditions.push(sql`${mentorJobPostings.jobType}::text = ANY(${sql.raw(`ARRAY[${filters.jobType.map(t => `'${t}'`).join(',')}]`)}::text[])`);
    }
    if (filters?.areaOfInterest && filters.areaOfInterest.length > 0) {
      // Check if any area of interest overlaps using array overlap operator
      const escapedAreas = filters.areaOfInterest.map(a => `'${a.replace(/'/g, "''")}'`).join(',');
      conditions.push(sql`${mentorJobPostings.areaOfInterest} && ARRAY[${sql.raw(escapedAreas)}]::text[]`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(mentorJobPostings.createdAt));
    console.log(`📊 getMentorJobPostings: Found ${results.length} jobs with filters:`, filters);
    return results;
  }

  async createMentorJobPosting(posting: InsertMentorJobPosting): Promise<MentorJobPosting> {
    const [created] = await db.insert(mentorJobPostings).values(posting).returning();
    return created;
  }

  async updateMentorJobPosting(id: string, data: Partial<InsertMentorJobPosting>): Promise<MentorJobPosting | undefined> {
    console.log(`🔄 Updating mentor job posting ${id}:`, data);
    const [updated] = await db
      .update(mentorJobPostings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mentorJobPostings.id, id))
      .returning();
    if (updated) {
      console.log(`✅ Job posting ${id} updated successfully. isActive: ${updated.isActive}`);
    } else {
      console.log(`❌ Job posting ${id} not found for update`);
    }
    return updated;
  }

  async deleteMentorJobPosting(id: string): Promise<boolean> {
    await db.delete(mentorJobPostings).where(eq(mentorJobPostings.id, id));
    return true;
  }

  // Cohort Tasks
  async getCohortTask(id: string): Promise<CohortTask | undefined> {
    const [task] = await db.select().from(cohortTasks).where(eq(cohortTasks.id, id));
    return task;
  }

  async getCohortTasks(): Promise<CohortTask[]> {
    return await db.select().from(cohortTasks).orderBy(desc(cohortTasks.startTime));
  }

  async getCohortTasksByCohort(cohortId: string): Promise<CohortTask[]> {
    return await db
      .select()
      .from(cohortTasks)
      .where(and(eq(cohortTasks.cohortId, cohortId), eq(cohortTasks.isActive, true)))
      .orderBy(cohortTasks.startTime);
  }

  async getCohortTasksForUser(userId: string): Promise<CohortTask[]> {
    // Collect cohort IDs from two sources:
    // 1. User's team assignments (team -> cohort)
    // 2. Direct user-to-cohort assignment (cohort_users table)
    
    const cohortIdSet = new Set<string>();
    
    // Source 1: Check direct cohort_users assignment
    const directCohortAssignment = await this.getCohortUser(userId);
    if (directCohortAssignment) {
      cohortIdSet.add(directCohortAssignment.cohortId);
      console.log(`[getCohortTasksForUser] User ${userId} directly assigned to cohort ${directCohortAssignment.cohortId}`);
    }
    
    // Source 2: Check team assignments
    const userAssignments = await db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId));
    if (userAssignments.length > 0) {
      const teamIds = userAssignments.map(a => a.teamId).filter(id => id !== null);
      console.log(`[getCohortTasksForUser] User ${userId} has team IDs:`, teamIds);
      
      if (teamIds.length > 0) {
        const teamIdsArray = sql.raw(`ARRAY[${teamIds.map(id => `'${id}'`).join(',')}]::text[]`);
        const userTeams = await db.select().from(teams).where(sql`${teams.id}::text = ANY(${teamIdsArray})`);
        console.log(`[getCohortTasksForUser] User teams:`, userTeams.map(t => ({ id: t.id, name: t.name, cohortId: t.cohortId })));
        
        userTeams.forEach(t => {
          if (t.cohortId) cohortIdSet.add(t.cohortId);
        });
      }
    }
    
    const cohortIds = [...cohortIdSet];
    console.log(`[getCohortTasksForUser] Combined Cohort IDs:`, cohortIds);
    
    if (cohortIds.length === 0) {
      console.log(`[getCohortTasksForUser] No cohorts found for user ${userId}`);
      return [];
    }

    // Get all active cohort tasks for user's cohorts
    const cohortIdsArray = sql.raw(`ARRAY[${cohortIds.map(id => `'${id}'`).join(',')}]::text[]`);
    const tasks = await db
      .select()
      .from(cohortTasks)
      .where(and(
        sql`${cohortTasks.cohortId}::text = ANY(${cohortIdsArray})`,
        eq(cohortTasks.isActive, true)
      ))
      .orderBy(cohortTasks.startTime);
    
    console.log(`[getCohortTasksForUser] Found ${tasks.length} cohort tasks for user`);
    return tasks;
  }

  async createCohortTask(task: InsertCohortTask): Promise<CohortTask> {
    const [created] = await db.insert(cohortTasks).values(task).returning();
    return created;
  }

  async updateCohortTask(id: string, data: Partial<InsertCohortTask>): Promise<CohortTask | undefined> {
    const [updated] = await db
      .update(cohortTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cohortTasks.id, id))
      .returning();
    return updated;
  }

  async deleteCohortTask(id: string): Promise<boolean> {
    // First delete associated sessions
    await db.delete(cohortTaskSessions).where(eq(cohortTaskSessions.cohortTaskId, id));
    await db.delete(cohortTasks).where(eq(cohortTasks.id, id));
    return true;
  }

  // Cohort Task Sessions
  async getCohortTaskSessions(cohortTaskId: string): Promise<CohortTaskSession[]> {
    return db.select().from(cohortTaskSessions).where(eq(cohortTaskSessions.cohortTaskId, cohortTaskId));
  }

  async createCohortTaskSession(session: InsertCohortTaskSession): Promise<CohortTaskSession> {
    const [created] = await db.insert(cohortTaskSessions).values(session).returning();
    return created;
  }

  async deleteCohortTaskSessionsByTaskId(cohortTaskId: string): Promise<boolean> {
    await db.delete(cohortTaskSessions).where(eq(cohortTaskSessions.cohortTaskId, cohortTaskId));
    return true;
  }

  // Reviews
  async getReview(id: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review;
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }

  async updateReview(id: string, data: Partial<InsertReview>): Promise<Review | undefined> {
    const [updated] = await db.update(reviews).set(data).where(eq(reviews.id, id)).returning();
    return updated;
  }

  async getReviewsBySprint(sprintId: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.sprintId, sprintId));
  }

  async getReviewsByMentor(mentorId: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.mentorId, mentorId));
  }

  // Evidence
  async getEvidence(id: string): Promise<Evidence | undefined> {
    const [ev] = await db.select().from(evidence).where(eq(evidence.id, id));
    return ev;
  }

  async createEvidence(ev: InsertEvidence): Promise<Evidence> {
    const [created] = await db.insert(evidence).values(ev).returning();
    return created;
  }

  async updateEvidence(id: string, data: Partial<InsertEvidence>): Promise<Evidence | undefined> {
    const [updated] = await db.update(evidence).set(data).where(eq(evidence.id, id)).returning();
    return updated;
  }

  async deleteEvidence(id: string): Promise<boolean> {
    const result = await db.delete(evidence).where(eq(evidence.id, id));
    return true;
  }

  async getEvidenceByTeam(teamId: string): Promise<Evidence[]> {
    return db.select().from(evidence).where(eq(evidence.teamId, teamId)).orderBy(desc(evidence.createdAt));
  }

  async getEvidenceByTask(taskId: string): Promise<Evidence[]> {
    return db.select().from(evidence).where(eq(evidence.taskId, taskId)).orderBy(desc(evidence.createdAt));
  }

  /**
   * Evidence for many tasks in one round trip, for anything that summarises a whole sprint.
   * One query per task turned a 17-task sprint into 17 queries.
   */
  async getEvidenceByTasks(taskIds: string[]): Promise<Evidence[]> {
    if (taskIds.length === 0) return [];
    return await db.select().from(evidence).where(inArray(evidence.taskId, taskIds));
  }

  async reviewEvidence(
    id: string,
    review: { status: string; feedback?: string | null; reviewedBy: string }
  ): Promise<Evidence | undefined> {
    const [updated] = await db
      .update(evidence)
      .set({
        status: review.status,
        // Cleared on acceptance so a stale "fix the axis labels" does not sit under an
        // approved submission.
        feedback: review.status === "ACCEPTED" ? null : review.feedback ?? null,
        reviewedBy: review.reviewedBy,
        reviewedAt: new Date(),
      })
      .where(eq(evidence.id, id))
      .returning();
    return updated;
  }

  /**
   * Submissions this user is expected to review, newest first.
   *
   * Scoped by the teams they belong to, not by a reviewer id: mentors span several teams and
   * no task names a reviewer up front, so "everything on my teams awaiting review" is the only
   * definition that matches how people actually work. Admins see everything.
   *
   * Where a task names the kind of mentor it needs, a mentor only sees it if their membership
   * carries that kind. Founders, co-founders and admins are not filtered that way — they are
   * the fallback when no mentor of the right kind exists.
   */
  async getEvidencePendingReviewFor(userId: string): Promise<any[]> {
    const user = await this.getUser(userId);
    if (!user) return [];

    const assignments = user.role === "ADMIN" ? [] : await this.getRoleAssignmentsByUser(userId);
    const teamIds = assignments.map((a) => a.teamId);
    if (user.role !== "ADMIN" && teamIds.length === 0) return [];

    const rows = await db
      .select({
        evidence,
        task: tasks,
        team: teams,
      })
      .from(evidence)
      .innerJoin(tasks, eq(tasks.id, evidence.taskId))
      .innerJoin(teams, eq(teams.id, evidence.teamId))
      .where(
        user.role === "ADMIN"
          ? eq(evidence.status, "PENDING")
          : and(eq(evidence.status, "PENDING"), inArray(evidence.teamId, teamIds))
      )
      .orderBy(desc(evidence.createdAt));

    const kindByTeam = new Map(assignments.map((a) => [a.teamId, a.mentorKind ?? null]));

    // Nothing is filtered out. Every submission on a team you can review stays visible,
    // including tasks that name a different kind of mentor — `preferredForMe` marks the ones
    // meant for you so the UI can lead with them.
    return Promise.all(
      rows.map(async ({ evidence: ev, task, team }) => {
        const submitter = ev.submittedBy ? await this.getUser(ev.submittedBy) : null;
        return {
          ...ev,
          submitterName: submitter?.name ?? "Unknown",
          taskTitle: task.title,
          taskId: task.id,
          requiresReviewFrom: task.requiresReviewFrom ?? null,
          preferredForMe: isPreferredReviewer(
            task.requiresReviewFrom,
            kindByTeam.get(ev.teamId) ?? null
          ),
          teamName: team.name,
        };
      })
    );
  }

  // MOUs
  async getMou(id: string): Promise<MoU | undefined> {
    const [mou] = await db.select().from(mous).where(eq(mous.id, id));
    return mou;
  }

  async createMou(mou: InsertMoU): Promise<MoU> {
    const [created] = await db.insert(mous).values(mou).returning();
    return created;
  }

  async updateMou(id: string, data: Partial<InsertMoU>): Promise<MoU | undefined> {
    const [updated] = await db.update(mous).set(data).where(eq(mous.id, id)).returning();
    return updated;
  }

  async getMousByOrg(orgId: string): Promise<MoU[]> {
    return db.select().from(mous).where(eq(mous.orgId, orgId));
  }

  // Credit Maps
  async getCreditMap(id: string): Promise<CreditMap | undefined> {
    const [cm] = await db.select().from(creditMaps).where(eq(creditMaps.id, id));
    return cm;
  }

  async createCreditMap(cm: InsertCreditMap): Promise<CreditMap> {
    const [created] = await db.insert(creditMaps).values(cm).returning();
    return created;
  }

  async updateCreditMap(id: string, data: Partial<InsertCreditMap>): Promise<CreditMap | undefined> {
    const [updated] = await db.update(creditMaps).set(data).where(eq(creditMaps.id, id)).returning();
    return updated;
  }

  async getCreditMapsByOrg(orgId: string): Promise<CreditMap[]> {
    return db.select().from(creditMaps).where(eq(creditMaps.orgId, orgId));
  }

  // Seed Funds
  async getSeedFund(id: string): Promise<SeedFund | undefined> {
    const [sf] = await db.select().from(seedFunds).where(eq(seedFunds.id, id));
    return sf;
  }

  async createSeedFund(sf: InsertSeedFund): Promise<SeedFund> {
    const [created] = await db.insert(seedFunds).values(sf).returning();
    return created;
  }

  async updateSeedFund(id: string, data: Partial<InsertSeedFund>): Promise<SeedFund | undefined> {
    const [updated] = await db.update(seedFunds).set(data).where(eq(seedFunds.id, id)).returning();
    return updated;
  }

  async getSeedFundByTeam(teamId: string): Promise<SeedFund | undefined> {
    const [sf] = await db.select().from(seedFunds).where(eq(seedFunds.teamId, teamId));
    return sf;
  }

  // Cap Table Entries
  async getCapTableEntry(id: string): Promise<CapTableEntry | undefined> {
    const [cte] = await db.select().from(capTableEntries).where(eq(capTableEntries.id, id));
    return cte;
  }

  async createCapTableEntry(cte: InsertCapTableEntry): Promise<CapTableEntry> {
    const [created] = await db.insert(capTableEntries).values(cte).returning();
    return created;
  }

  async updateCapTableEntry(id: string, data: Partial<InsertCapTableEntry>): Promise<CapTableEntry | undefined> {
    const [updated] = await db.update(capTableEntries).set(data).where(eq(capTableEntries.id, id)).returning();
    return updated;
  }

  async getCapTableByTeam(teamId: string): Promise<CapTableEntry[]> {
    return db.select().from(capTableEntries).where(eq(capTableEntries.teamId, teamId));
  }

  // Stipend Rules
  async getStipendRule(id: string): Promise<StipendRule | undefined> {
    const [sr] = await db.select().from(stipendRules).where(eq(stipendRules.id, id));
    return sr;
  }

  async createStipendRule(sr: InsertStipendRule): Promise<StipendRule> {
    const [created] = await db.insert(stipendRules).values(sr).returning();
    return created;
  }

  async updateStipendRule(id: string, data: Partial<InsertStipendRule>): Promise<StipendRule | undefined> {
    const [updated] = await db.update(stipendRules).set(data).where(eq(stipendRules.id, id)).returning();
    return updated;
  }

  async getStipendRules(): Promise<StipendRule[]> {
    return db.select().from(stipendRules);
  }

  async getStipendRuleByBand(band: string): Promise<StipendRule | undefined> {
    const [sr] = await db.select().from(stipendRules).where(eq(stipendRules.band, band as any));
    return sr;
  }

  // Stipend Disbursements
  async getStipendDisbursement(id: string): Promise<StipendDisbursement | undefined> {
    const [sd] = await db.select().from(stipendDisbursements).where(eq(stipendDisbursements.id, id));
    return sd;
  }

  async createStipendDisbursement(sd: InsertStipendDisbursement): Promise<StipendDisbursement> {
    const [created] = await db.insert(stipendDisbursements).values(sd).returning();
    return created;
  }

  async updateStipendDisbursement(id: string, data: Partial<InsertStipendDisbursement>): Promise<StipendDisbursement | undefined> {
    const [updated] = await db.update(stipendDisbursements).set(data).where(eq(stipendDisbursements.id, id)).returning();
    return updated;
  }

  async getStipendDisbursementsByTeam(teamId: string): Promise<StipendDisbursement[]> {
    return db.select().from(stipendDisbursements).where(eq(stipendDisbursements.teamId, teamId)).orderBy(desc(stipendDisbursements.createdAt));
  }

  async getStipendDisbursementsByUser(userId: string): Promise<StipendDisbursement[]> {
    return db.select().from(stipendDisbursements).where(eq(stipendDisbursements.userId, userId)).orderBy(desc(stipendDisbursements.createdAt));
  }

  // Invoices
  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
    return inv;
  }

  async createInvoice(inv: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(inv).returning();
    return created;
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return updated;
  }

  async getInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoicesByUser(userId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
  }

  // Certificates
  async getCertificate(id: string): Promise<Certificate | undefined> {
    const [cert] = await db.select().from(certificates).where(eq(certificates.id, id));
    return cert;
  }

  async createCertificate(cert: InsertCertificate): Promise<Certificate> {
    const [created] = await db.insert(certificates).values(cert).returning();
    return created;
  }

  async getCertificatesByUser(userId: string): Promise<Certificate[]> {
    return db.select().from(certificates).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt));
  }

  // Sessions
  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async createSession(session: InsertSession): Promise<Session> {
    const [created] = await db.insert(sessions).values(session).returning();
    return created;
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteSessionsByUser(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  // Tracks
  async getTracks(includeInactive = false): Promise<Track[]> {
    const query = db.select().from(tracks);
    const rows = includeInactive
      ? await query.orderBy(tracks.label)
      : await query.where(eq(tracks.isActive, true)).orderBy(tracks.label);
    return rows;
  }

  /** Case-insensitive so "fintech" and "FinTech" resolve to the same row. */
  async getTrackByValue(value: string): Promise<Track | undefined> {
    const [track] = await db
      .select()
      .from(tracks)
      .where(sql`lower(${tracks.value}) = lower(${value})`);
    return track;
  }

  async createTrack(track: InsertTrack): Promise<Track> {
    const [created] = await db.insert(tracks).values(track).returning();
    return created;
  }

  async updateTrack(id: string, data: Partial<InsertTrack>): Promise<Track | undefined> {
    const [updated] = await db
      .update(tracks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tracks.id, id))
      .returning();
    return updated;
  }

  // Blog Posts
  async getBlogPost(id: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [created] = await db.insert(blogPosts).values(post).returning();
    return created;
  }

  async updateBlogPost(id: string, data: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    const [updated] = await db.update(blogPosts).set(data).where(eq(blogPosts.id, id)).returning();
    return updated;
  }

  async getBlogPosts(): Promise<BlogPost[]> {
    return db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  }

  async getPublishedBlogPosts(): Promise<BlogPost[]> {
    return db.select().from(blogPosts).where(eq(blogPosts.published, true)).orderBy(desc(blogPosts.publishedAt));
  }

  // FAQs
  async getFaq(id: string): Promise<Faq | undefined> {
    const [faq] = await db.select().from(faqs).where(eq(faqs.id, id));
    return faq;
  }

  async createFaq(faq: InsertFaq): Promise<Faq> {
    const [created] = await db.insert(faqs).values(faq).returning();
    return created;
  }

  async updateFaq(id: string, data: Partial<InsertFaq>): Promise<Faq | undefined> {
    const [updated] = await db.update(faqs).set(data).where(eq(faqs.id, id)).returning();
    return updated;
  }

  async deleteFaq(id: string): Promise<void> {
    await db.delete(faqs).where(eq(faqs.id, id));
  }

  async getFaqs(): Promise<Faq[]> {
    return db.select().from(faqs).orderBy(faqs.order);
  }

  // Daily Standups
  async getDailyStandup(id: string): Promise<DailyStandup | undefined> {
    const [standup] = await db.select().from(dailyStandups).where(eq(dailyStandups.id, id));
    return standup;
  }

  async createDailyStandup(standup: InsertDailyStandup): Promise<DailyStandup> {
    const [created] = await db.insert(dailyStandups).values(standup).returning();
    return created;
  }

  async getDailyStandupsBySprint(sprintId: string): Promise<DailyStandup[]> {
    return db.select().from(dailyStandups).where(eq(dailyStandups.sprintId, sprintId)).orderBy(desc(dailyStandups.createdAt));
  }

  async getDailyStandupsByAuthor(authorId: string): Promise<DailyStandup[]> {
    return db.select().from(dailyStandups).where(eq(dailyStandups.authorId, authorId)).orderBy(desc(dailyStandups.createdAt));
  }

  // Mentor Sessions
  async getMentorSession(id: string): Promise<MentorSession | undefined> {
    const [session] = await db.select().from(mentorSessions).where(eq(mentorSessions.id, id));
    return session;
  }

  async createMentorSession(session: InsertMentorSession): Promise<MentorSession> {
    const [created] = await db.insert(mentorSessions).values(session).returning();
    return created;
  }

  async updateMentorSession(id: string, data: Partial<InsertMentorSession>): Promise<MentorSession | undefined> {
    const [updated] = await db.update(mentorSessions).set(data).where(eq(mentorSessions.id, id)).returning();
    return updated;
  }

  async deleteMentorSession(id: string): Promise<void> {
    await db.delete(mentorSessions).where(eq(mentorSessions.id, id));
  }

  async getMentorSessionsByMentor(mentorId: string): Promise<MentorSession[]> {
    return db.select().from(mentorSessions).where(eq(mentorSessions.mentorId, mentorId)).orderBy(desc(mentorSessions.occurredAt));
  }

  async getMentorSessionsByTeam(teamId: string): Promise<MentorSession[]> {
    return db.select().from(mentorSessions).where(eq(mentorSessions.teamId, teamId)).orderBy(desc(mentorSessions.occurredAt));
  }

  // Mentor Honorariums
  async getMentorHonorarium(id: string): Promise<MentorHonorarium | undefined> {
    const [honorarium] = await db.select().from(mentorHonorariums).where(eq(mentorHonorariums.id, id));
    return honorarium;
  }

  async createMentorHonorarium(honorarium: InsertMentorHonorarium): Promise<MentorHonorarium> {
    const [created] = await db.insert(mentorHonorariums).values(honorarium).returning();
    return created;
  }

  async updateMentorHonorarium(id: string, data: Partial<InsertMentorHonorarium>): Promise<MentorHonorarium | undefined> {
    const [updated] = await db.update(mentorHonorariums).set(data).where(eq(mentorHonorariums.id, id)).returning();
    return updated;
  }

  async getMentorHonorariumsByMentor(mentorId: string): Promise<MentorHonorarium[]> {
    return db.select().from(mentorHonorariums).where(eq(mentorHonorariums.mentorId, mentorId)).orderBy(desc(mentorHonorariums.createdAt));
  }

  async getMentorHonorariumsByMonth(month: string): Promise<MentorHonorarium[]> {
    return db.select().from(mentorHonorariums).where(eq(mentorHonorariums.month, month)).orderBy(desc(mentorHonorariums.createdAt));
  }

  // Evidence by Sprint
  async getEvidenceBySprint(sprintId: string): Promise<Evidence[]> {
    return db.select().from(evidence).where(eq(evidence.sprintId, sprintId)).orderBy(desc(evidence.createdAt));
  }

  // Milestones
  async getMilestone(id: string): Promise<Milestone | undefined> {
    const [milestone] = await db.select().from(milestones).where(eq(milestones.id, id));
    return milestone;
  }

  async createMilestone(milestone: InsertMilestone): Promise<Milestone> {
    const [created] = await db.insert(milestones).values(milestone).returning();
    return created;
  }

  async updateMilestone(id: string, data: Partial<InsertMilestone>): Promise<Milestone | undefined> {
    const [updated] = await db.update(milestones).set(data).where(eq(milestones.id, id)).returning();
    return updated;
  }

  async deleteMilestone(id: string): Promise<boolean> {
    const result = await db.delete(milestones).where(eq(milestones.id, id));
    return true;
  }

  async getMilestones(): Promise<Milestone[]> {
    return db.select().from(milestones).orderBy(milestones.order, milestones.createdAt);
  }

  async getMilestonesByCohort(cohortId: string): Promise<Milestone[]> {
    return db.select().from(milestones).where(eq(milestones.cohortId, cohortId)).orderBy(milestones.order, milestones.createdAt);
  }

  // Assessments
  async getAssessment(id: string): Promise<Assessment | undefined> {
    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, id));
    return assessment;
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const [created] = await db.insert(assessments).values(assessment).returning();
    return created;
  }

  async updateAssessment(id: string, data: Partial<InsertAssessment>): Promise<Assessment | undefined> {
    const [updated] = await db.update(assessments).set(data).where(eq(assessments.id, id)).returning();
    return updated;
  }

  async deleteAssessment(id: string): Promise<boolean> {
    await db.delete(assessments).where(eq(assessments.id, id));
    return true;
  }

  async getAssessments(): Promise<Assessment[]> {
    return db.select().from(assessments).orderBy(desc(assessments.createdAt));
  }

  async getAssessmentsByCohort(cohortId: string): Promise<Assessment[]> {
    return db.select().from(assessments).where(eq(assessments.cohortId, cohortId)).orderBy(desc(assessments.createdAt));
  }

  async getActiveAssessments(): Promise<Assessment[]> {
    return db.select().from(assessments).where(eq(assessments.isActive, true)).orderBy(desc(assessments.createdAt));
  }

  // Assessment Questions
  async getAssessmentQuestion(id: string): Promise<AssessmentQuestion | undefined> {
    const [question] = await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.id, id));
    return question;
  }

  async createAssessmentQuestion(question: InsertAssessmentQuestion): Promise<AssessmentQuestion> {
    const [created] = await db.insert(assessmentQuestions).values(question).returning();
    return created;
  }

  async updateAssessmentQuestion(id: string, data: Partial<InsertAssessmentQuestion>): Promise<AssessmentQuestion | undefined> {
    const [updated] = await db.update(assessmentQuestions).set(data).where(eq(assessmentQuestions.id, id)).returning();
    return updated;
  }

  async deleteAssessmentQuestion(id: string): Promise<boolean> {
    await db.delete(assessmentQuestions).where(eq(assessmentQuestions.id, id));
    return true;
  }

  async getQuestionsByAssessment(assessmentId: string): Promise<AssessmentQuestion[]> {
    return db.select().from(assessmentQuestions).where(eq(assessmentQuestions.assessmentId, assessmentId)).orderBy(assessmentQuestions.order, assessmentQuestions.createdAt);
  }

  // Assessment Attempts
  async getAssessmentAttempt(id: string): Promise<AssessmentAttempt | undefined> {
    const [attempt] = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, id));
    return attempt;
  }

  async createAssessmentAttempt(attempt: InsertAssessmentAttempt): Promise<AssessmentAttempt> {
    const [created] = await db.insert(assessmentAttempts).values(attempt).returning();
    return created;
  }

  async updateAssessmentAttempt(id: string, data: Partial<InsertAssessmentAttempt>): Promise<AssessmentAttempt | undefined> {
    const [updated] = await db.update(assessmentAttempts).set(data).where(eq(assessmentAttempts.id, id)).returning();
    return updated;
  }

  async getAttemptsByAssessment(assessmentId: string): Promise<AssessmentAttempt[]> {
    return db.select().from(assessmentAttempts).where(eq(assessmentAttempts.assessmentId, assessmentId)).orderBy(desc(assessmentAttempts.createdAt));
  }

  async getAttemptByUserAndAssessment(userId: string, assessmentId: string): Promise<AssessmentAttempt | undefined> {
    const [attempt] = await db.select().from(assessmentAttempts).where(
      and(
        eq(assessmentAttempts.userId, userId),
        eq(assessmentAttempts.assessmentId, assessmentId)
      )
    ).orderBy(desc(assessmentAttempts.createdAt)).limit(1);
    return attempt;
  }

  // Assessment Answers
  async getAssessmentAnswer(id: string): Promise<AssessmentAnswer | undefined> {
    const [answer] = await db.select().from(assessmentAnswers).where(eq(assessmentAnswers.id, id));
    return answer;
  }

  async createAssessmentAnswer(answer: InsertAssessmentAnswer): Promise<AssessmentAnswer> {
    const [created] = await db.insert(assessmentAnswers).values(answer).returning();
    return created;
  }

  async updateAssessmentAnswer(id: string, data: Partial<InsertAssessmentAnswer>): Promise<AssessmentAnswer | undefined> {
    const [updated] = await db.update(assessmentAnswers).set(data).where(eq(assessmentAnswers.id, id)).returning();
    return updated;
  }

  async getAnswersByAttempt(attemptId: string): Promise<AssessmentAnswer[]> {
    return db.select().from(assessmentAnswers).where(eq(assessmentAnswers.attemptId, attemptId));
  }

  // Assessment Assignments
  async createAssessmentAssignment(assignment: InsertAssessmentAssignment): Promise<AssessmentAssignment> {
    const [created] = await db.insert(assessmentAssignments).values(assignment).returning();
    return created;
  }

  async updateAssessmentAssignment(id: string, data: Partial<InsertAssessmentAssignment>): Promise<AssessmentAssignment | undefined> {
    const [updated] = await db.update(assessmentAssignments)
      .set(data)
      .where(eq(assessmentAssignments.id, id))
      .returning();
    return updated;
  }

  async deleteAssessmentAssignment(assessmentId: string, userId: string): Promise<boolean> {
    await db.delete(assessmentAssignments).where(
      and(
        eq(assessmentAssignments.assessmentId, assessmentId),
        eq(assessmentAssignments.userId, userId)
      )
    );
    return true;
  }

  async getAssignmentsByUser(userId: string): Promise<AssessmentAssignment[]> {
    return db.select().from(assessmentAssignments).where(eq(assessmentAssignments.userId, userId));
  }

  async getAssignmentsByAssessment(assessmentId: string): Promise<AssessmentAssignment[]> {
    return db.select().from(assessmentAssignments).where(eq(assessmentAssignments.assessmentId, assessmentId));
  }

  async getAssignmentsByAssessmentWithUsers(assessmentId: string): Promise<(AssessmentAssignment & { user: User | null })[]> {
    const assignments = await this.getAssignmentsByAssessment(assessmentId);
    return Promise.all(assignments.map(async (assignment) => {
      const user = assignment.userId ? await this.getUser(assignment.userId) : null;
      return { ...assignment, user: user ? { ...user, password: null } : null };
    }));
  }

  async getAssignmentByPublicToken(token: string): Promise<AssessmentAssignment | undefined> {
    try {
      const [assignment] = await db.select().from(assessmentAssignments).where(eq(assessmentAssignments.publicToken, token)).limit(1);
      return assignment;
    } catch (error: any) {
      // If column doesn't exist, return undefined
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
        console.error("❌ public_token column may not exist. Please run migration: npm run db:add-assessment-fields");
        return undefined;
      }
      throw error;
    }
  }

  async getAssignmentByEmailAndAssessment(email: string, assessmentId: string): Promise<AssessmentAssignment | undefined> {
    const [assignment] = await db.select().from(assessmentAssignments)
      .where(and(
        eq(assessmentAssignments.email, email),
        eq(assessmentAssignments.assessmentId, assessmentId)
      )).limit(1);
    return assignment;
  }

  // Notifications
  async getNotification(id: string): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async updateNotification(id: string, data: Partial<InsertNotification>): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications).set(data).where(eq(notifications.id, id)).returning();
    return updated;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.status, "UNREAD")
      ))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ status: "READ", readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ status: "READ", readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.status, "UNREAD")));
  }

  // Mentor Profiles
  async getMentorProfile(id: string): Promise<MentorProfile | undefined> {
    const [profile] = await db.select().from(mentorProfiles).where(eq(mentorProfiles.id, id));
    return profile;
  }

  async getMentorProfileByUserId(userId: string): Promise<MentorProfile | undefined> {
    const [profile] = await db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, userId));
    return profile;
  }

  async createMentorProfile(profile: InsertMentorProfile): Promise<MentorProfile> {
    const [created] = await db.insert(mentorProfiles).values(profile).returning();
    return created;
  }

  async updateMentorProfile(id: string, data: Partial<InsertMentorProfile>): Promise<MentorProfile | undefined> {
    const [updated] = await db.update(mentorProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mentorProfiles.id, id))
      .returning();
    return updated;
  }

  async getMentorProfiles(): Promise<MentorProfile[]> {
    return db.select().from(mentorProfiles).orderBy(desc(mentorProfiles.createdAt));
  }

  async getMentorProfilesByTrack(track: string): Promise<MentorProfile[]> {
    // Filter mentors whose tracksJson array contains the specified track
    const allProfiles = await this.getMentorProfiles();
    return allProfiles.filter(profile => {
      const tracks = profile.tracksJson as string[] | null;
      return tracks && tracks.includes(track);
    });
  }

  // Problem Statements
  async createProblemStatement(data: InsertProblemStatement): Promise<ProblemStatement> {
    const [created] = await db.insert(problemStatements).values(data).returning();
    return created;
  }

  async getProblemStatementById(id: string): Promise<ProblemStatement | undefined> {
    const [statement] = await db.select().from(problemStatements).where(eq(problemStatements.id, id));
    return statement;
  }

  async getProblemStatements(filters?: { status?: string; createdBy?: string; track?: string }): Promise<ProblemStatement[]> {
    let query = db.select().from(problemStatements);
    
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(problemStatements.status, filters.status as any));
    }
    if (filters?.createdBy) {
      conditions.push(eq(problemStatements.createdBy, filters.createdBy));
    }
    if (filters?.track) {
      conditions.push(eq(problemStatements.track, filters.track as any));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query.orderBy(desc(problemStatements.createdAt));
  }

  async updateProblemStatement(id: string, data: Partial<InsertProblemStatement>): Promise<ProblemStatement | undefined> {
    const [updated] = await db.update(problemStatements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(problemStatements.id, id))
      .returning();
    return updated;
  }

  async publishProblemStatement(id: string, publishedBy: string): Promise<ProblemStatement | undefined> {
    const [updated] = await db.update(problemStatements)
      .set({ 
        status: 'PUBLISHED' as any,
        publishedAt: new Date(),
        publishedBy,
        updatedAt: new Date()
      })
      .where(eq(problemStatements.id, id))
      .returning();
    return updated;
  }

  // Sprint Permissions Implementation
  async getSprintPermission(sprintId: string, userId: string): Promise<SprintPermission | undefined> {
    const [permission] = await db.select()
      .from(sprintPermissions)
      .where(and(
        eq(sprintPermissions.sprintId, sprintId),
        eq(sprintPermissions.userId, userId)
      ));
    return permission;
  }

  async createSprintPermission(permission: InsertSprintPermission): Promise<SprintPermission> {
    const [created] = await db.insert(sprintPermissions).values(permission).returning();
    return created;
  }

  async updateSprintPermission(id: string, data: Partial<InsertSprintPermission>): Promise<SprintPermission | undefined> {
    const [updated] = await db.update(sprintPermissions)
      .set(data)
      .where(eq(sprintPermissions.id, id))
      .returning();
    return updated;
  }

  async createSprintExport(record: InsertSprintExport): Promise<SprintExport> {
    const [created] = await db.insert(sprintExports).values(record).returning();
    return created;
  }

  async completeSprintExport(id: string, data: Partial<InsertSprintExport>): Promise<SprintExport | undefined> {
    const [updated] = await db.update(sprintExports)
      .set(data)
      .where(eq(sprintExports.id, id))
      .returning();
    return updated;
  }

  async getSprintExportsBySprint(sprintId: string): Promise<SprintExport[]> {
    return await db.select()
      .from(sprintExports)
      .where(eq(sprintExports.sprintId, sprintId))
      .orderBy(desc(sprintExports.createdAt));
  }

  async getSprintResources(sprintId: string): Promise<SprintResource[]> {
    return await db.select()
      .from(sprintResources)
      .where(eq(sprintResources.sprintId, sprintId))
      .orderBy(desc(sprintResources.createdAt));
  }

  // Used to reject an objectKey already claimed by another sprint's resource,
  // so a key can't be lifted from one sprint and resubmitted against another.
  async getSprintResourceByObjectKey(objectKey: string): Promise<SprintResource | undefined> {
    const [row] = await db.select().from(sprintResources)
      .where(eq(sprintResources.objectKey, objectKey))
      .limit(1);
    return row;
  }

  async createSprintResource(resource: InsertSprintResource): Promise<SprintResource> {
    const [created] = await db.insert(sprintResources).values(resource).returning();
    return created;
  }

  async deleteSprintResource(id: string): Promise<boolean> {
    const result = await db.delete(sprintResources)
      .where(eq(sprintResources.id, id))
      .returning();
    return result.length > 0;
  }

  async getSprintPermissionsBySprint(sprintId: string): Promise<SprintPermission[]> {
    return await db.select()
      .from(sprintPermissions)
      .where(eq(sprintPermissions.sprintId, sprintId))
      .orderBy(desc(sprintPermissions.grantedAt));
  }

  async getSprintPermissionsByUser(userId: string): Promise<SprintPermission[]> {
    return await db.select()
      .from(sprintPermissions)
      .where(eq(sprintPermissions.userId, userId));
  }

  async revokeSprintPermission(sprintId: string, userId: string): Promise<boolean> {
    const [updated] = await db.update(sprintPermissions)
      .set({ revokedAt: new Date(), canEdit: false })
      .where(and(
        eq(sprintPermissions.sprintId, sprintId),
        eq(sprintPermissions.userId, userId)
      ))
      .returning();
    return !!updated;
  }

  async hasSprintEditPermission(sprintId: string, userId: string): Promise<boolean> {
    // Check sprint and team exist
    const sprint = await this.getSprint(sprintId);
    if (!sprint) return false;

    const team = await this.getTeam(sprint.teamId);
    if (!team) return false;

    // Get role assignments for this team
    const assignments = await this.getRoleAssignmentsByTeam(team.id);
    const userAssignment = assignments.find(a => a.userId === userId);
    
    // Founders: allow edit permission. Previously this required a role assignment
    // to exist on the team; in practice a user with global FOUNDER role should
    // be able to manage sprints/tasks, so allow it here.
    const user = await this.getUser(userId);

    // Admins can create sprints for any team (see POST /api/teams/:teamId/sprints),
    // so they must be able to add tasks to them too. Without this an admin got a
    // 403 from the board's own "Add Task" button, which is shown to them.
    if (user?.role === "ADMIN") {
      return true;
    }

    if (user?.role === "FOUNDER") {
      return true;
    }

    // Mentors: if they are assigned to the team as a Mentor, allow edit permission
    // by default (permission can still be explicitly revoked using sprint permissions).
    // Note: `user.role` uses `user_role` enum (e.g. 'MENTOR') while assignment.role
    // uses `team_role` enum (e.g. 'Mentor'). Accept either case when applicable.
    if (userAssignment && (user?.role === "MENTOR" || userAssignment.role === "Mentor")) {
      const permission = await this.getSprintPermission(sprintId, userId);
      if (permission?.revokedAt) return false;
      return !permission || permission.canEdit;
    }

    // Co-founders no longer receive default sprint edit permission.
    // They must be explicitly granted via a sprint permission record.

    // For mentors and others, check explicit permission
    const permission = await this.getSprintPermission(sprintId, userId);
    return permission?.canEdit === true && !permission.revokedAt;
  }

  // Team Meetings Implementation
  async getTeamMeeting(id: string): Promise<TeamMeeting | undefined> {
    const [meeting] = await db.select()
      .from(teamMeetings)
      .where(and(
        eq(teamMeetings.id, id),
        sql`${teamMeetings.deletedAt} IS NULL`
      ));
    return meeting;
  }

  async createTeamMeeting(meeting: InsertTeamMeeting): Promise<TeamMeeting> {
    const [created] = await db.insert(teamMeetings).values(meeting).returning();
    return created;
  }

  async updateTeamMeeting(id: string, data: Partial<InsertTeamMeeting>): Promise<TeamMeeting | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(teamMeetings)
      .set(updateData)
      .where(and(
        eq(teamMeetings.id, id),
        sql`${teamMeetings.deletedAt} IS NULL`
      ))
      .returning();
    return updated;
  }

  async deleteTeamMeeting(id: string): Promise<boolean> {
    // Soft delete
    const [updated] = await db.update(teamMeetings)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(teamMeetings.id, id))
      .returning();
    return !!updated;
  }

  async getTeamMeetingsByTeam(teamId: string): Promise<TeamMeeting[]> {
    return db.select()
      .from(teamMeetings)
      .where(and(
        eq(teamMeetings.teamId, teamId),
        sql`${teamMeetings.deletedAt} IS NULL`
      ))
      .orderBy(desc(teamMeetings.scheduledAt));
  }

  async getTeamMeetingsByUser(userId: string): Promise<TeamMeeting[]> {
    // Get all teams user is member of
    const userAssignments = await this.getRoleAssignmentsByUser(userId);
    const teamIds = Array.from(new Set(userAssignments.map(a => a.teamId)));

    if (teamIds.length === 0) {
      return [];
    }

    // Get all meetings for those teams
    return db.select()
      .from(teamMeetings)
      .where(and(
        inArray(teamMeetings.teamId, teamIds),
        sql`${teamMeetings.deletedAt} IS NULL`
      ))
      .orderBy(desc(teamMeetings.scheduledAt));
  }

  async getUpcomingTeamMeetings(teamId: string, limit: number = 5): Promise<TeamMeeting[]> {
    const now = new Date();
    return db.select()
      .from(teamMeetings)
      .where(and(
        eq(teamMeetings.teamId, teamId),
        sql`${teamMeetings.scheduledAt} >= ${now}`,
        sql`${teamMeetings.deletedAt} IS NULL`
      ))
      .orderBy(teamMeetings.scheduledAt)
      .limit(limit);
  }

  // Problem Statement Applications Implementation
  async createProblemStatementApplication(app: InsertProblemStatementApplication): Promise<ProblemStatementApplication> {
    const [created] = await db.insert(problemStatementApplications).values(app).returning();
    return created;
  }

  async getProblemStatementApplication(problemStatementId: string, applicantId: string): Promise<ProblemStatementApplication | undefined> {
    const [app] = await db.select()
      .from(problemStatementApplications)
      .where(and(
        eq(problemStatementApplications.problemStatementId, problemStatementId),
        eq(problemStatementApplications.applicantId, applicantId)
      ));
    return app;
  }

  async getProblemStatementApplicationById(id: string): Promise<ProblemStatementApplication | undefined> {
    const [app] = await db.select()
      .from(problemStatementApplications)
      .where(eq(problemStatementApplications.id, id));
    return app;
  }

  async getProblemStatementApplications(problemStatementId: string): Promise<ProblemStatementApplication[]> {
    return await db.select()
      .from(problemStatementApplications)
      .where(eq(problemStatementApplications.problemStatementId, problemStatementId))
      .orderBy(desc(problemStatementApplications.createdAt));
  }

  async getProblemStatementApplicationsByApplicant(applicantId: string): Promise<ProblemStatementApplication[]> {
    return await db.select()
      .from(problemStatementApplications)
      .where(eq(problemStatementApplications.applicantId, applicantId))
      .orderBy(desc(problemStatementApplications.createdAt));
  }

  async updateProblemStatementApplicationStatus(id: string, status: "PENDING" | "ACCEPTED" | "REJECTED"): Promise<ProblemStatementApplication | undefined> {
    const [updated] = await db.update(problemStatementApplications)
      .set({ status })
      .where(eq(problemStatementApplications.id, id))
      .returning();
    return updated;
  }

  async getLearnerApplicationCount(problemStatementId: string): Promise<number> {
    const apps = await db.select()
      .from(problemStatementApplications)
      .where(and(
        eq(problemStatementApplications.problemStatementId, problemStatementId),
        eq(problemStatementApplications.applicantRole, "LEARNER")
      ));
    return apps.length;
  }

  async getCofounderApplicationCount(problemStatementId: string): Promise<number> {
    const apps = await db.select()
      .from(problemStatementApplications)
      .where(and(
        eq(problemStatementApplications.problemStatementId, problemStatementId),
        eq(problemStatementApplications.applicantRole, "COFOUNDER")
      ));
    return apps.length;
  }

  // ==========================================================================
  // Tickets
  // ==========================================================================

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket;
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const [created] = await db.insert(tickets).values(ticket).returning();
    return created;
  }

  async updateTicket(id: string, data: Partial<InsertTicket>): Promise<Ticket | undefined> {
    const [updated] = await db.update(tickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning();
    return updated;
  }

  async deleteTicket(id: string): Promise<boolean> {
    // Remove children first — these tables have no FK cascade
    await db.delete(ticketTags).where(eq(ticketTags.ticketId, id));
    await db.delete(ticketComments).where(eq(ticketComments.ticketId, id));
    await db.delete(ticketAttachments).where(eq(ticketAttachments.ticketId, id));
    await db.delete(ticketEvents).where(eq(ticketEvents.ticketId, id));
    await db.delete(ticketLinks).where(
      or(eq(ticketLinks.ticketId, id), eq(ticketLinks.linkedTicketId, id))
    );
    const result = await db.delete(tickets).where(eq(tickets.id, id)).returning();
    return result.length > 0;
  }

  async getTickets(): Promise<Ticket[]> {
    return db.select().from(tickets).orderBy(desc(tickets.createdAt));
  }

  async getTicketsByCohort(cohortId: string): Promise<Ticket[]> {
    return db.select().from(tickets)
      .where(eq(tickets.cohortId, cohortId))
      .orderBy(desc(tickets.createdAt));
  }

  /**
   * Tickets this user raised or is assigned to. Tickets they are only tagged
   * on are merged in by the caller.
   */
  async getTicketsVisibleToUser(userId: string): Promise<Ticket[]> {
    return db.select().from(tickets)
      .where(or(eq(tickets.raisedById, userId), eq(tickets.assigneeId, userId)))
      .orderBy(desc(tickets.createdAt));
  }

  /** Open tickets whose SLA has expired and which have not been flagged yet. */
  async getOverdueTickets(now: Date): Promise<Ticket[]> {
    return db.select().from(tickets)
      .where(and(
        ne(tickets.status, "CLOSED"),
        eq(tickets.slaBreached, false),
        lte(tickets.slaDueAt, now)
      ))
      .orderBy(desc(tickets.createdAt));
  }

  async getTicketTags(ticketId: string): Promise<TicketTag[]> {
    return db.select().from(ticketTags).where(eq(ticketTags.ticketId, ticketId));
  }

  async addTicketTag(tag: InsertTicketTag): Promise<TicketTag> {
    const [created] = await db.insert(ticketTags).values(tag)
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    // Already tagged — return the existing row so callers get a consistent shape
    const [existing] = await db.select().from(ticketTags)
      .where(and(
        eq(ticketTags.ticketId, tag.ticketId),
        eq(ticketTags.userId, tag.userId)
      ));
    return existing;
  }

  async removeTicketTag(ticketId: string, userId: string): Promise<boolean> {
    const result = await db.delete(ticketTags)
      .where(and(eq(ticketTags.ticketId, ticketId), eq(ticketTags.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getTicketTagsByUser(userId: string): Promise<TicketTag[]> {
    return db.select().from(ticketTags).where(eq(ticketTags.userId, userId));
  }

  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    return db.select().from(ticketComments)
      .where(eq(ticketComments.ticketId, ticketId))
      .orderBy(ticketComments.createdAt);
  }

  async createTicketComment(comment: InsertTicketComment): Promise<TicketComment> {
    const [created] = await db.insert(ticketComments).values(comment).returning();
    return created;
  }

  async getTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
    return db.select().from(ticketAttachments)
      .where(eq(ticketAttachments.ticketId, ticketId))
      .orderBy(ticketAttachments.createdAt);
  }

  // Used to reject an objectKey already claimed by another ticket's
  // attachment, so a key can't be lifted from one ticket and resubmitted
  // against a different one.
  async getTicketAttachmentByObjectKey(objectKey: string): Promise<TicketAttachment | undefined> {
    const [row] = await db.select().from(ticketAttachments)
      .where(eq(ticketAttachments.objectKey, objectKey))
      .limit(1);
    return row;
  }

  async createTicketAttachment(attachment: InsertTicketAttachment): Promise<TicketAttachment> {
    const [created] = await db.insert(ticketAttachments).values(attachment).returning();
    return created;
  }

  async deleteTicketAttachment(id: string): Promise<boolean> {
    const result = await db.delete(ticketAttachments)
      .where(eq(ticketAttachments.id, id))
      .returning();
    return result.length > 0;
  }

  async getTicketEvents(ticketId: string): Promise<TicketEvent[]> {
    return db.select().from(ticketEvents)
      .where(eq(ticketEvents.ticketId, ticketId))
      .orderBy(desc(ticketEvents.createdAt));
  }

  async createTicketEvent(event: InsertTicketEvent): Promise<TicketEvent> {
    const [created] = await db.insert(ticketEvents).values(event).returning();
    return created;
  }

  async getTicketLinks(ticketId: string): Promise<TicketLink[]> {
    return db.select().from(ticketLinks)
      .where(or(
        eq(ticketLinks.ticketId, ticketId),
        eq(ticketLinks.linkedTicketId, ticketId)
      ));
  }

  async createTicketLink(link: InsertTicketLink): Promise<TicketLink> {
    const [created] = await db.insert(ticketLinks).values(link)
      .onConflictDoNothing()
      .returning();
    return created;
  }

  async deleteTicketLink(id: string): Promise<boolean> {
    const result = await db.delete(ticketLinks)
      .where(eq(ticketLinks.id, id))
      .returning();
    return result.length > 0;
  }

  async getTicketSlaSettings(): Promise<TicketSlaSetting[]> {
    return db.select().from(ticketSlaSettings);
  }

  // Applies every priority's new hours in one transaction. Without this, a
  // failure partway through the loop (e.g. the second of three upserts)
  // would leave the first priority already updated and the rest untouched,
  // and still return a 500 — a half-applied write masquerading as a clean
  // failure.
  async upsertTicketSlaSettings(
    entries: Array<{ priority: TicketPriority; hours: number }>,
    updatedById: string | null
  ): Promise<TicketSlaSetting[]> {
    return db.transaction(async (tx) => {
      const rows: TicketSlaSetting[] = [];
      for (const { priority, hours } of entries) {
        const [row] = await tx.insert(ticketSlaSettings)
          .values({ priority, hours, updatedById, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: ticketSlaSettings.priority,
            set: { hours, updatedById, updatedAt: new Date() },
          })
          .returning();
        rows.push(row);
      }
      return rows;
    });
  }

  // ==========================================================================
  // Team Chat
  // ==========================================================================

  async getTeamChatChannel(id: string): Promise<TeamChatChannel | undefined> {
    const [channel] = await db.select().from(teamChatChannels)
      .where(eq(teamChatChannels.id, id));
    return channel;
  }

  async getTeamChatChannelByTeam(teamId: string): Promise<TeamChatChannel | undefined> {
    const [channel] = await db.select().from(teamChatChannels)
      .where(eq(teamChatChannels.teamId, teamId));
    return channel;
  }

  async createTeamChatChannel(channel: InsertTeamChatChannel): Promise<TeamChatChannel> {
    const [created] = await db.insert(teamChatChannels).values(channel)
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    // Lost a race with a concurrent create — return the existing channel
    const existing = await this.getTeamChatChannelByTeam(channel.teamId);
    return existing!;
  }

  async updateTeamChatChannel(
    id: string,
    data: Partial<InsertTeamChatChannel>
  ): Promise<TeamChatChannel | undefined> {
    const [updated] = await db.update(teamChatChannels).set(data)
      .where(eq(teamChatChannels.id, id))
      .returning();
    return updated;
  }

  async getTeamChatChannels(): Promise<TeamChatChannel[]> {
    return db.select().from(teamChatChannels);
  }

  async getTeamChatMembers(channelId: string): Promise<TeamChatMember[]> {
    return db.select().from(teamChatMembers)
      .where(eq(teamChatMembers.channelId, channelId));
  }

  async getTeamChatMember(channelId: string, userId: string): Promise<TeamChatMember | undefined> {
    const [member] = await db.select().from(teamChatMembers)
      .where(and(
        eq(teamChatMembers.channelId, channelId),
        eq(teamChatMembers.userId, userId)
      ));
    return member;
  }

  async getTeamChatMembershipsByUser(userId: string): Promise<TeamChatMember[]> {
    return db.select().from(teamChatMembers)
      .where(eq(teamChatMembers.userId, userId));
  }

  async addTeamChatMember(member: InsertTeamChatMember): Promise<TeamChatMember> {
    const [created] = await db.insert(teamChatMembers).values(member)
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const existing = await this.getTeamChatMember(member.channelId, member.userId);
    return existing!;
  }

  async updateTeamChatMember(
    channelId: string,
    userId: string,
    data: Partial<InsertTeamChatMember>
  ): Promise<TeamChatMember | undefined> {
    const [updated] = await db.update(teamChatMembers).set(data)
      .where(and(
        eq(teamChatMembers.channelId, channelId),
        eq(teamChatMembers.userId, userId)
      ))
      .returning();
    return updated;
  }

  async removeTeamChatMember(channelId: string, userId: string): Promise<boolean> {
    const result = await db.delete(teamChatMembers)
      .where(and(
        eq(teamChatMembers.channelId, channelId),
        eq(teamChatMembers.userId, userId)
      ))
      .returning();
    return result.length > 0;
  }

  async getTeamChatMessage(id: string): Promise<TeamChatMessage | undefined> {
    const [message] = await db.select().from(teamChatMessages)
      .where(eq(teamChatMessages.id, id));
    return message;
  }

  /**
   * Newest-first page of a channel's history. `before` is the cursor: pass the
   * createdAt of the oldest message you already have to fetch the next page.
   */
  async getTeamChatMessages(
    channelId: string,
    options: { before?: Date; limit?: number } = {}
  ): Promise<TeamChatMessage[]> {
    const limit = options.limit ?? 50;
    const conditions = [eq(teamChatMessages.channelId, channelId)];
    if (options.before) {
      conditions.push(lt(teamChatMessages.createdAt, options.before));
    }
    return db.select().from(teamChatMessages)
      .where(and(...conditions))
      .orderBy(desc(teamChatMessages.createdAt))
      .limit(limit);
  }

  async getTeamChatMessagesByIds(ids: string[]): Promise<TeamChatMessage[]> {
    if (ids.length === 0) return [];
    return db.select().from(teamChatMessages)
      .where(inArray(teamChatMessages.id, ids));
  }

  async createTeamChatMessage(message: InsertTeamChatMessage): Promise<TeamChatMessage> {
    const [created] = await db.insert(teamChatMessages).values(message).returning();
    return created;
  }

  async updateTeamChatMessage(
    id: string,
    data: Partial<InsertTeamChatMessage>
  ): Promise<TeamChatMessage | undefined> {
    const [updated] = await db.update(teamChatMessages).set(data)
      .where(eq(teamChatMessages.id, id))
      .returning();
    return updated;
  }

  async getTeamChatUnreadCount(channelId: string, since: Date | null): Promise<number> {
    const conditions = [eq(teamChatMessages.channelId, channelId)];
    if (since) {
      conditions.push(gt(teamChatMessages.createdAt, since));
    }
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamChatMessages)
      .where(and(...conditions));
    return row?.count ?? 0;
  }

  async getLastTeamChatMessage(channelId: string): Promise<TeamChatMessage | undefined> {
    const [message] = await db.select().from(teamChatMessages)
      .where(eq(teamChatMessages.channelId, channelId))
      .orderBy(desc(teamChatMessages.createdAt))
      .limit(1);
    return message;
  }

  async createTeamChatAttachment(
    attachment: InsertTeamChatAttachment
  ): Promise<TeamChatAttachment> {
    const [created] = await db.insert(teamChatAttachments).values(attachment).returning();
    return created;
  }

  async getTeamChatAttachmentsByMessages(messageIds: string[]): Promise<TeamChatAttachment[]> {
    if (messageIds.length === 0) return [];
    return db.select().from(teamChatAttachments)
      .where(inArray(teamChatAttachments.messageId, messageIds));
  }

  async getTeamChatAttachment(id: string): Promise<TeamChatAttachment | undefined> {
    const [attachment] = await db.select().from(teamChatAttachments)
      .where(eq(teamChatAttachments.id, id));
    return attachment;
  }

  async addTeamChatReaction(
    reaction: InsertTeamChatReaction
  ): Promise<TeamChatReaction | undefined> {
    const [created] = await db.insert(teamChatReactions).values(reaction)
      .onConflictDoNothing()
      .returning();
    return created;
  }

  async removeTeamChatReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<boolean> {
    const result = await db.delete(teamChatReactions)
      .where(and(
        eq(teamChatReactions.messageId, messageId),
        eq(teamChatReactions.userId, userId),
        eq(teamChatReactions.emoji, emoji)
      ))
      .returning();
    return result.length > 0;
  }

  async getTeamChatReactionsByMessages(messageIds: string[]): Promise<TeamChatReaction[]> {
    if (messageIds.length === 0) return [];
    return db.select().from(teamChatReactions)
      .where(inArray(teamChatReactions.messageId, messageIds));
  }
}

export const storage = new DatabaseStorage();

