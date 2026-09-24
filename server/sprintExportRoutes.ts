import type { Express, Request, Response, RequestHandler } from "express";
import archiver from "archiver";
import { storage } from "./storage";
import { s3Storage } from "./s3";
import { sanitizeFileName } from "@shared/chat";
import type {
  DailyStandup,
  Evidence,
  MentorSession,
  Review,
  Sprint,
  Task,
  Team,
  TeamMeeting,
  User,
} from "@shared/schema";

interface SprintExportRouteDeps {
  requireRole: (...roles: string[]) => RequestHandler;
  /**
   * Team-scoping check shared with the rest of the sprint endpoints. The role
   * middleware only proves *what* someone is, never *whose* data they may read,
   * so every route here needs this as well.
   */
  isTeamMemberOrAdmin: (userId: string, teamId: string) => Promise<boolean>;
}

/**
 * Roles allowed to view and export a completed sprint's record. Cofounders are
 * included because they co-own the team's work; team scoping is still applied
 * separately, so this only decides who may ask.
 */
const EXPORT_ROLES = ["FOUNDER", "COFOUNDER", "MENTOR", "ADMIN"] as const;

/**
 * Total bundle size above which the UI warns before downloading. Not a hard
 * limit — the archive is streamed, so memory is flat regardless of size; this
 * only exists so nobody kicks off a multi-gigabyte download by accident.
 */
export const EXPORT_SIZE_WARN_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

/** How many HeadObject calls the summary endpoint may have open at once. */
const METADATA_CONCURRENCY = 8;

/**
 * One export in flight per user. This is a soft guard held in process memory,
 * not a distributed lock — with more than one node behind a load balancer a
 * user could still start one export per instance. It exists to stop an
 * accidental double-click from building the same archive twice, nothing more.
 */
const exportsInFlight = new Set<string>();

/** Run an async mapper over items with a ceiling on concurrent operations. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

// -----------------------------------------------------------------------------
// Attachment resolution
// -----------------------------------------------------------------------------

interface ResolvedAttachment {
  /** S3 key, or null when the reference points somewhere we don't host. */
  objectKey: string | null;
  /** Original filename as uploaded, when we still know it. */
  fileName: string;
  /**
   * The name exactly as recorded on the evidence row. Retained because the
   * archive builder re-derives fileName once it knows the object's content
   * type, which it cannot know at collection time.
   */
  declaredName: unknown;
  /** The raw reference, kept verbatim for the manifest and the link lists. */
  url: string;
  taskId: string | null;
  evidenceId: string;
}

/**
 * Drop the query string from a presigned S3 URL.
 *
 * Attachment URLs are captured at upload time, so by the time an archive is
 * built they have long expired — the signature is dead weight that would
 * otherwise carry credentials scope and bucket layout into a file handed to
 * universities. Only signature-bearing URLs are touched, so an ordinary link
 * with meaningful query parameters survives intact.
 */
export function stripSignature(url: string): string {
  if (!/[?&]X-Amz-(Signature|Credential)=/i.test(url)) return url;
  return url.split("?")[0];
}

/** Whether a name already carries a usable extension. */
export function needsContentTypeToName(declaredName: unknown): boolean {
  const declared = typeof declaredName === "string" ? sanitizeFileName(declaredName) : "";
  return !declared || !hasExtension(declared);
}

/**
 * Map a stored reference to an S3 key, or null when it is external.
 *
 * normalizeObjectEntityPath only rewrites URLs belonging to our own bucket, so
 * a URL it leaves untouched (a GitHub PR, a Figma link, a YouTube demo) is not
 * ours to download — we record it as a link instead. Plain http is checked the
 * same way as https, because older evidence rows stored our own bucket over
 * http and would otherwise be misread as external links.
 */
export function resolveObjectKey(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = raw.trim();

  if (value.startsWith("https://") || value.startsWith("s3://")) {
    const normalized = s3Storage.normalizeObjectEntityPath(value);
    return normalized !== value ? normalized : null;
  }
  if (value.startsWith("http://")) {
    const asHttps = `https://${value.slice("http://".length)}`;
    const normalized = s3Storage.normalizeObjectEntityPath(asHttps);
    return normalized !== asHttps ? normalized : null;
  }
  // Already a bare key, e.g. "uploads/<uuid>".
  return value;
}

/**
 * Extension guessed from a content type, for attachments whose original name
 * was never recorded. Uploads are stored as an extensionless UUID with content
 * type application/octet-stream, so without this an older attachment lands in
 * the archive as a blob no operating system will open.
 */
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/json": ".json",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "text/markdown": ".md",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "audio/mpeg": ".mp3",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
};

function hasExtension(name: string): boolean {
  return /\.[A-Za-z0-9]{1,8}$/.test(name);
}

export function fileNameFor(
  declaredName: unknown,
  objectKey: string | null,
  contentType: string | null
): string {
  const declared = typeof declaredName === "string" ? sanitizeFileName(declaredName) : "";
  if (declared && hasExtension(declared)) return declared;

  const extension = contentType
    ? EXTENSION_BY_CONTENT_TYPE[contentType.split(";")[0].trim()] ?? ""
    : "";
  if (declared) return `${declared}${extension}`;

  const keyBase = objectKey ? sanitizeFileName(objectKey.split("/").pop() ?? "") : "";
  const base = keyBase || "attachment";
  return hasExtension(base) ? base : `${base}${extension || ".bin"}`;
}

/** Append " (2)", " (3)", ... so two members' screenshot.png can coexist. */
export function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let counter = 2;
  let candidate = `${stem} (${counter})${extension}`;
  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${stem} (${counter})${extension}`;
  }
  taken.add(candidate);
  return candidate;
}

function attachmentsOf(row: Evidence): ResolvedAttachment[] {
  const meta = row.metaJson as { attachments?: unknown } | null;
  const list = Array.isArray(meta?.attachments) ? meta!.attachments : [];
  const resolved: ResolvedAttachment[] = [];

  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as { url?: unknown; objectKey?: unknown; name?: unknown };
    const objectKey = resolveObjectKey(item.objectKey) ?? resolveObjectKey(item.url);
    if (!objectKey && typeof item.url === "string" && item.url.trim() !== "") {
      // A reference we cannot map to a key is recorded as a link. Flag it: if
      // uploads ever move behind a CDN, normalizeObjectEntityPath stops matching
      // and real attachments would quietly become dead manifest entries.
      if (/^https?:\/\//.test(item.url) && !/^https?:\/\/(github|gitlab|figma|youtu|docs\.google|drive\.google)/i.test(item.url)) {
        console.warn(
          `Sprint export: attachment on evidence ${row.id} has no resolvable object key, treating as external link: ${item.url.split("?")[0]}`
        );
      }
    }
    resolved.push({
      objectKey,
      fileName: fileNameFor(item.name, objectKey, null),
      declaredName: item.name,
      url: typeof item.url === "string" ? item.url : "",
      taskId: row.taskId ?? null,
      evidenceId: row.id,
    });
  }

  return resolved;
}

// -----------------------------------------------------------------------------
// Collection
// -----------------------------------------------------------------------------

interface TaskRecord {
  task: Task;
  assignees: User[];
  assignedBy: User | null;
  reviewer: User | null;
  evidence: Array<{ row: Evidence; attachments: ResolvedAttachment[] }>;
  /** Folder this task's attachments live under, e.g. "01-build-login-page". */
  folder: string;
}

interface Contribution {
  userId: string;
  name: string;
  email: string;
  teamRole: string;
  tasksAssigned: number;
  tasksDone: number;
  points: number;
  weightedPoints: number;
  evidenceSubmitted: number;
  attachmentsUploaded: number;
  standupsFiled: number;
}

interface SprintExportData {
  sprint: Sprint;
  team: Team | null;
  tasks: TaskRecord[];
  reviews: Array<{ row: Review; mentor: User | null }>;
  standups: Array<{ row: DailyStandup; author: User | null }>;
  meetings: TeamMeeting[];
  mentorSessions: Array<{ row: MentorSession; mentor: User | null }>;
  contributions: Contribution[];
  /** Downloadable files, de-duplicated by S3 key. */
  files: ResolvedAttachment[];
  /** References we cannot download — external links, or files with no key. */
  links: Array<{ label: string; url: string; taskTitle: string }>;
}

/** Mirrors getPriorityWeight in team-health-calculator so the numbers in an
 * export agree with the numbers on the dashboard. */
function priorityWeight(priority: string | null): number {
  switch (priority?.toUpperCase()) {
    case "HIGH": return 3;
    case "LOW": return 1;
    case "MEDIUM": return 2;
    default: return 2;
  }
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "task";
}

function assigneeIdsOf(task: Task): string[] {
  const ids = new Set<string>();
  if (task.assigneeId) ids.add(task.assigneeId);
  if (Array.isArray(task.assigneeIds)) {
    for (const id of task.assigneeIds) {
      if (typeof id === "string" && id) ids.add(id);
    }
  }
  return Array.from(ids);
}

function displayName(user: User | null | undefined): string {
  if (!user) return "Unassigned";
  return user.name || user.email || user.id;
}

async function collectSprintExport(sprint: Sprint): Promise<SprintExportData> {
  const [team, rawTasks, evidenceRows, reviewRows, standupRows, allMeetings, allSessions, members] =
    await Promise.all([
      storage.getTeam(sprint.teamId),
      storage.getTasksBySprint(sprint.id),
      storage.getEvidenceBySprint(sprint.id),
      storage.getReviewsBySprint(sprint.id),
      storage.getDailyStandupsBySprint(sprint.id),
      storage.getTeamMeetingsByTeam(sprint.teamId),
      storage.getMentorSessionsByTeam(sprint.teamId),
      storage.getRoleAssignmentsByTeam(sprint.teamId),
    ]);

  const meetings = allMeetings.filter((m) => m.sprintId === sprint.id && !m.deletedAt);
  const mentorSessions = allSessions.filter((s) => s.sprintId === sprint.id);

  // Resolve attachments once per evidence row and reuse everywhere below.
  const attachmentsByEvidenceId = new Map<string, ResolvedAttachment[]>();
  for (const row of evidenceRows) {
    attachmentsByEvidenceId.set(row.id, attachmentsOf(row));
  }

  // Every user referenced anywhere in the bundle, fetched in one query.
  const userIds = new Set<string>();
  for (const task of rawTasks) {
    assigneeIdsOf(task).forEach((id) => userIds.add(id));
    if (task.assignedBy) userIds.add(task.assignedBy);
    if (task.reviewerId) userIds.add(task.reviewerId);
  }
  for (const row of reviewRows) userIds.add(row.mentorId);
  for (const row of standupRows) userIds.add(row.authorId);
  for (const row of mentorSessions) userIds.add(row.mentorId);
  for (const member of members) userIds.add(member.userId);
  for (const row of evidenceRows) if (row.submittedBy) userIds.add(row.submittedBy);

  const usersById = new Map<string, User>();
  for (const user of await storage.getUsersByIds(Array.from(userIds))) {
    usersById.set(user.id, user);
  }

  const evidenceByTask = new Map<string, Evidence[]>();
  const orphanEvidence: Evidence[] = [];
  for (const row of evidenceRows) {
    if (row.taskId) {
      const bucket = evidenceByTask.get(row.taskId) ?? [];
      bucket.push(row);
      evidenceByTask.set(row.taskId, bucket);
    } else {
      orphanEvidence.push(row);
    }
  }

  const orderedTasks = [...rawTasks].sort((a, b) => {
    const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return left - right;
  });

  const folderNames = new Set<string>();
  const tasks: TaskRecord[] = orderedTasks.map((task, position) => {
    const rows = evidenceByTask.get(task.id) ?? [];
    const prefix = String(position + 1).padStart(2, "0");
    return {
      task,
      assignees: assigneeIdsOf(task)
        .map((id) => usersById.get(id))
        .filter((user): user is User => Boolean(user)),
      assignedBy: task.assignedBy ? usersById.get(task.assignedBy) ?? null : null,
      reviewer: task.reviewerId ? usersById.get(task.reviewerId) ?? null : null,
      evidence: rows.map((row) => ({
        row,
        attachments: attachmentsByEvidenceId.get(row.id) ?? [],
      })),
      folder: uniqueName(`${prefix}-${slugify(task.title)}`, folderNames),
    };
  });

  // De-duplicate downloadable files by S3 key: the same upload cited by two
  // evidence rows should be fetched and stored once.
  const files: ResolvedAttachment[] = [];
  const seenKeys = new Set<string>();
  const links: SprintExportData["links"] = [];

  const registerEvidence = (
    entries: Array<{ row: Evidence; attachments: ResolvedAttachment[] }>,
    taskTitle: string
  ) => {
    for (const { row, attachments } of entries) {
      if (row.url) {
        links.push({ label: row.title || row.type, url: stripSignature(row.url), taskTitle });
      }
      for (const attachment of attachments) {
        if (!attachment.objectKey) {
          if (attachment.url) {
            links.push({
              label: attachment.fileName,
              url: stripSignature(attachment.url),
              taskTitle,
            });
          }
          continue;
        }
        if (seenKeys.has(attachment.objectKey)) continue;
        seenKeys.add(attachment.objectKey);
        files.push(attachment);
      }
    }
  };

  for (const record of tasks) {
    registerEvidence(record.evidence, record.task.title);
  }
  registerEvidence(
    orphanEvidence.map((row) => ({
      row,
      attachments: attachmentsByEvidenceId.get(row.id) ?? [],
    })),
    "(not linked to a task)"
  );

  // Per-member contribution, weighted the same way team health is.
  const standupsByAuthor = new Map<string, number>();
  standupRows.forEach((row) => {
    standupsByAuthor.set(row.authorId, (standupsByAuthor.get(row.authorId) ?? 0) + 1);
  });

  const evidenceBySubmitter = new Map<string, number>();
  const attachmentsBySubmitter = new Map<string, number>();
  for (const row of evidenceRows) {
    if (!row.submittedBy) continue;
    evidenceBySubmitter.set(row.submittedBy, (evidenceBySubmitter.get(row.submittedBy) ?? 0) + 1);
    attachmentsBySubmitter.set(
      row.submittedBy,
      (attachmentsBySubmitter.get(row.submittedBy) ?? 0) +
        (attachmentsByEvidenceId.get(row.id)?.length ?? 0)
    );
  }

  const contributions: Contribution[] = members.map((member) => {
    const user = usersById.get(member.userId) ?? null;
    const assigned = tasks.filter((record) =>
      assigneeIdsOf(record.task).includes(member.userId)
    );
    const done = assigned.filter((record) => record.task.status === "DONE");
    return {
      userId: member.userId,
      name: displayName(user),
      email: user?.email ?? "",
      teamRole: member.role,
      tasksAssigned: assigned.length,
      tasksDone: done.length,
      points: done.reduce((sum, record) => sum + (record.task.points ?? 1), 0),
      weightedPoints: done.reduce(
        (sum, record) => sum + priorityWeight(record.task.priority) * (record.task.points ?? 1),
        0
      ),
      evidenceSubmitted: evidenceBySubmitter.get(member.userId) ?? 0,
      attachmentsUploaded: attachmentsBySubmitter.get(member.userId) ?? 0,
      standupsFiled: standupsByAuthor.get(member.userId) ?? 0,
    };
  });

  return {
    sprint,
    team: team ?? null,
    tasks,
    reviews: reviewRows.map((row) => ({ row, mentor: usersById.get(row.mentorId) ?? null })),
    standups: standupRows.map((row) => ({ row, author: usersById.get(row.authorId) ?? null })),
    meetings,
    mentorSessions: mentorSessions.map((row) => ({
      row,
      mentor: usersById.get(row.mentorId) ?? null,
    })),
    contributions,
    files,
    links,
  };
}

/**
 * Fill in extensions for attachments whose recorded name lacks one, using the
 * object's content type from S3.
 *
 * Uploads are stored as an extensionless UUID with content type
 * application/octet-stream, and the original name lives only on the evidence
 * row — so for any attachment saved without a name, this HEAD is the only thing
 * standing between the recipient and a file their OS refuses to open. Mutates
 * fileName in place; only files that need it are fetched.
 */
async function resolveNamesFromContentType(files: ResolvedAttachment[]): Promise<void> {
  const needing = files.filter(
    (file) => file.objectKey && needsContentTypeToName(file.declaredName)
  );
  if (needing.length === 0) return;

  await mapWithConcurrency(needing, METADATA_CONCURRENCY, async (file) => {
    const meta = await s3Storage.getObjectMetadata(file.objectKey!);
    if (!meta?.contentType) return;
    file.fileName = fileNameFor(file.declaredName, file.objectKey, meta.contentType);
  });
}

/**
 * Where each downloadable file lives inside the archive, keyed by S3 key.
 *
 * Files are de-duplicated globally, so a file cited by two tasks is written
 * once, under the first citing task's folder. Every renderer must therefore
 * look the path up here rather than composing it from the task it is currently
 * rendering, or the second task's links would point at a path that was never
 * written.
 */
function planArchivePaths(data: SprintExportData): Map<string, string> {
  const paths = new Map<string, string>();
  const takenPerFolder = new Map<string, Set<string>>();

  const place = (attachment: ResolvedAttachment, folder: string) => {
    if (!attachment.objectKey || paths.has(attachment.objectKey)) return;
    const taken = takenPerFolder.get(folder) ?? new Set<string>();
    takenPerFolder.set(folder, taken);
    paths.set(
      attachment.objectKey,
      `attachments/${folder}/${uniqueName(attachment.fileName, taken)}`
    );
  };

  for (const record of data.tasks) {
    for (const { attachments } of record.evidence) {
      for (const attachment of attachments) place(attachment, record.folder);
    }
  }
  // Attachments on evidence not tied to any task.
  for (const file of data.files) place(file, "unlinked-evidence");

  return paths;
}

// -----------------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------------

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // BOM so Excel opens UTF-8 names correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function sprintLabel(sprint: Sprint): string {
  return sprint.name?.trim() || sprint.goals?.trim()?.slice(0, 60) || `Sprint ${sprint.index}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function renderReadme(
  data: SprintExportData,
  exportedBy: User,
  generatedAt: Date,
  archivePaths: Map<string, string>
): string {
  const { sprint, team, tasks, contributions } = data;
  const lines: string[] = [];

  lines.push(`# ${sprintLabel(sprint)} — sprint record`);
  lines.push("");
  lines.push(`**Team:** ${team?.name ?? sprint.teamId}`);
  lines.push(`**Sprint:** ${sprint.index} — ${sprintLabel(sprint)}`);
  lines.push(`**Dates:** ${formatDate(sprint.startDate)} to ${formatDate(sprint.endDate)}`);
  lines.push(`**Passed:** ${sprint.passedAt ? formatDate(sprint.passedAt) : "yes"}`);
  lines.push(`**Exported by:** ${displayName(exportedBy)} on ${generatedAt.toISOString()}`);
  lines.push("");

  if (sprint.goals) lines.push(`## Goals\n\n${sprint.goals}\n`);
  if (sprint.objectives) lines.push(`## Objectives\n\n${sprint.objectives}\n`);
  if (sprint.deliverables) lines.push(`## Deliverables\n\n${sprint.deliverables}\n`);
  if (sprint.demoUrl || sprint.demoNotes) {
    lines.push("## Demo\n");
    if (sprint.demoUrl) lines.push(`- Link: ${sprint.demoUrl}`);
    if (sprint.demoNotes) lines.push(`- Notes: ${sprint.demoNotes}`);
    lines.push("");
  }

  lines.push("## What's in this archive\n");
  lines.push("| Path | Contents |");
  lines.push("| --- | --- |");
  lines.push("| `manifest.json` | Every record in this export, machine-readable |");
  lines.push("| `data/tasks.csv` | One row per task, with assignees and review outcome |");
  lines.push("| `data/contributions.csv` | Per-member breakdown of the work |");
  lines.push("| `data/evidence.csv` | Every evidence item and where its file landed |");
  lines.push("| `data/standups.csv` | Daily standups filed during the sprint |");
  lines.push("| `data/reviews.csv` | Mentor reviews of the sprint |");
  lines.push("| `data/meetings.csv` | Team meetings and mentor sessions |");
  lines.push("| `attachments/` | Uploaded files, one folder per task |");
  lines.push("");
  lines.push(
    "_A file referenced by more than one task is stored once, under the first task that cited it._"
  );
  lines.push("");

  lines.push("## Contributions\n");
  if (contributions.length === 0) {
    lines.push("_No team members recorded._\n");
  } else {
    lines.push("| Member | Role | Tasks done | Points | Weighted | Evidence | Standups |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const row of [...contributions].sort((a, b) => b.weightedPoints - a.weightedPoints)) {
      lines.push(
        `| ${row.name} | ${row.teamRole} | ${row.tasksDone}/${row.tasksAssigned} | ${row.points} | ${row.weightedPoints} | ${row.evidenceSubmitted} | ${row.standupsFiled} |`
      );
    }
    lines.push("");
    lines.push(
      "_Weighted points multiply story points by task priority (HIGH 3, MEDIUM 2, LOW 1) — the same weighting the team health score uses._"
    );
    lines.push("");
  }

  lines.push("## Tasks\n");
  if (tasks.length === 0) {
    lines.push("_This sprint has no tasks._\n");
  } else {
    for (const record of tasks) {
      const { task } = record;
      lines.push(`### ${task.title}`);
      lines.push("");
      lines.push(`- **Status:** ${task.status}`);
      lines.push(`- **Priority:** ${task.priority ?? "MEDIUM"} · **Points:** ${task.points ?? 1}`);
      lines.push(
        `- **Assignees:** ${record.assignees.length ? record.assignees.map(displayName).join(", ") : "Unassigned"}`
      );
      if (record.assignedBy) lines.push(`- **Assigned by:** ${displayName(record.assignedBy)}`);
      if (task.startDate || task.endDate) {
        lines.push(`- **Dates:** ${formatDate(task.startDate)} to ${formatDate(task.endDate)}`);
      }
      if (record.reviewer) lines.push(`- **Reviewer:** ${displayName(record.reviewer)}`);
      if (task.reviewComment) lines.push(`- **Review comment:** ${task.reviewComment}`);
      if (task.description) lines.push(`- **Description:** ${task.description}`);
      if (task.objectives) lines.push(`- **Objectives:** ${task.objectives}`);
      if (task.deliverables) lines.push(`- **Deliverables:** ${task.deliverables}`);

      const stored = record.evidence.flatMap(({ attachments }) =>
        attachments
          .map((a) => (a.objectKey ? archivePaths.get(a.objectKey) : undefined))
          .filter((path): path is string => Boolean(path))
      );
      if (stored.length) {
        lines.push(`- **Files:**`);
        stored.forEach((path) => lines.push(`  - \`${path}\``));
      }

      const externals = record.evidence.filter(({ row }) => row.url);
      if (externals.length) {
        lines.push(`- **Links:**`);
        externals.forEach(({ row }) => lines.push(`  - ${row.title || row.type}: ${row.url}`));
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function buildCsvFiles(data: SprintExportData, archivePaths: Map<string, string>) {
  const tasksCsv = toCsv(
    [
      "Task ID", "Title", "Status", "Priority", "Points", "Assignees", "Assigned by",
      "Reviewer", "Review comment", "Start date", "End date", "Description",
      "Objectives", "Deliverables", "Attachment folder",
    ],
    data.tasks.map((record) => [
      record.task.id,
      record.task.title,
      record.task.status,
      record.task.priority ?? "MEDIUM",
      record.task.points ?? 1,
      record.assignees.map(displayName).join("; "),
      record.assignedBy ? displayName(record.assignedBy) : "",
      record.reviewer ? displayName(record.reviewer) : "",
      record.task.reviewComment ?? "",
      formatDate(record.task.startDate),
      formatDate(record.task.endDate),
      record.task.description ?? "",
      record.task.objectives ?? "",
      record.task.deliverables ?? "",
      `attachments/${record.folder}/`,
    ])
  );

  const contributionsCsv = toCsv(
    [
      "Member", "Email", "Team role", "Tasks assigned", "Tasks done", "Points",
      "Weighted points", "Evidence submitted", "Attachments uploaded", "Standups filed",
    ],
    data.contributions.map((row) => [
      row.name, row.email, row.teamRole, row.tasksAssigned, row.tasksDone,
      row.points, row.weightedPoints, row.evidenceSubmitted, row.attachmentsUploaded,
      row.standupsFiled,
    ])
  );

  const evidenceRows: unknown[][] = [];
  for (const record of data.tasks) {
    for (const { row, attachments } of record.evidence) {
      const stored = attachments
        .map((a) => (a.objectKey ? archivePaths.get(a.objectKey) : undefined))
        .filter((path): path is string => Boolean(path));
      evidenceRows.push([
        row.id,
        record.task.title,
        row.type,
        row.title ?? "",
        row.url,
        stored.join("; "),
        formatDate(row.createdAt),
      ]);
    }
  }
  const evidenceCsv = toCsv(
    ["Evidence ID", "Task", "Type", "Title", "URL", "Files in archive", "Submitted"],
    evidenceRows
  );

  const standupsCsv = toCsv(
    ["Date", "Author", "Yesterday", "Today", "Blockers", "Mood"],
    data.standups.map(({ row, author }) => [
      formatDate(row.createdAt), displayName(author), row.yesterday ?? "",
      row.today ?? "", row.blockers ?? "", row.mood ?? "",
    ])
  );

  const reviewsCsv = toCsv(
    ["Review ID", "Mentor", "Score", "Notes", "Date"],
    data.reviews.map(({ row, mentor }) => [
      row.id, displayName(mentor), row.score ?? "", row.notes ?? "", formatDate(row.createdAt),
    ])
  );

  const meetingsCsv = toCsv(
    ["Kind", "Title", "When", "Duration (min)", "Host", "Notes", "Link"],
    [
      ...data.meetings.map((meeting) => [
        "Team meeting",
        meeting.title,
        formatDate(meeting.scheduledAt),
        meeting.durationMinutes ?? "",
        "",
        meeting.notes ?? "",
        meeting.meetingLink ?? "",
      ]),
      ...data.mentorSessions.map(({ row, mentor }) => [
        "Mentor session",
        row.sessionType ?? "check-in",
        formatDate(row.occurredAt),
        row.durationMinutes ?? "",
        displayName(mentor),
        row.notes ?? "",
        "",
      ]),
    ]
  );

  return { tasksCsv, contributionsCsv, evidenceCsv, standupsCsv, reviewsCsv, meetingsCsv };
}

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

export function registerSprintExportRoutes(app: Express, deps: SprintExportRouteDeps) {
  const { requireRole, isTeamMemberOrAdmin } = deps;

  /**
   * Whether this actor may read the given team's sprint data.
   *
   * Team members (founders and cofounders alike, via their role assignment) and
   * admins go through the shared check. Mentors need a branch of their own
   * because they have no role_assignments row for a team, so the shared check
   * would lock every mentor out.
   *
   * A mentor is entitled only to teams they have actually run a session with —
   * deliberately narrower than cohort membership. This bundle carries member
   * names, emails and every uploaded file off the platform, so mere presence in
   * the same cohort is not enough.
   */
  async function canAccessTeam(actor: User, teamId: string): Promise<boolean> {
    if (await isTeamMemberOrAdmin(actor.id, teamId)) return true;
    if (actor.role !== "MENTOR") return false;

    const sessions = await storage.getMentorSessionsByMentor(actor.id);
    return sessions.some((session) => session.teamId === teamId);
  }

  /**
   * Load a sprint for export: it must exist, the actor must be entitled to that
   * team's data, and it must have been passed. Role membership alone is not
   * enough — without the team check any founder could read any other team's
   * sprint by id.
   */
  async function loadExportableSprint(req: Request, res: Response): Promise<Sprint | null> {
    const actor = (req as any).user as User;
    const sprint = await storage.getSprint(req.params.id);
    if (!sprint) {
      res.status(404).json({ message: "Sprint not found" });
      return null;
    }
    if (!(await canAccessTeam(actor, sprint.teamId))) {
      res.status(403).json({ message: "You do not have access to this team's sprints" });
      return null;
    }
    if (sprint.passed !== true) {
      res.status(409).json({
        message: "This sprint has not been marked as passed yet, so there is nothing to export.",
      });
      return null;
    }
    return sprint;
  }

  // What the export will contain, so the dialog can preview it and show a size
  // before anyone commits to a download.
  app.get(
    "/api/sprints/:id/export/summary",
    requireRole(...EXPORT_ROLES),
    async (req: Request, res: Response) => {
      try {
        const sprint = await loadExportableSprint(req, res);
        if (!sprint) return;

        const data = await collectSprintExport(sprint);

        // Size the attachments up front, with a ceiling on concurrent HeadObject
        // calls so a sprint with hundreds of files cannot exhaust the SDK's
        // socket pool. A missing object is reported here rather than surfacing
        // mid-download.
        const sized = await mapWithConcurrency(data.files, METADATA_CONCURRENCY, async (file) => ({
          file,
          meta: file.objectKey ? await s3Storage.getObjectMetadata(file.objectKey) : null,
        }));
        const available = sized.filter((entry) => entry.meta !== null);
        const totalBytes = available.reduce((sum, entry) => sum + (entry.meta?.size ?? 0), 0);

        // The preview does not need the audit table, but the download writes to
        // it. Probe it here so a missing migration shows up before the user
        // clicks Download rather than as a failure afterwards.
        let auditReady = true;
        try {
          await storage.getSprintExportsBySprint(sprint.id);
        } catch (error: any) {
          auditReady = false;
          console.error("sprint_exports table is unavailable:", error?.code ?? error);
        }

        res.json({
          sprint: {
            id: sprint.id,
            index: sprint.index,
            name: sprintLabel(sprint),
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            passedAt: sprint.passedAt,
            goals: sprint.goals,
            objectives: sprint.objectives,
            deliverables: sprint.deliverables,
            demoUrl: sprint.demoUrl,
            demoNotes: sprint.demoNotes,
          },
          team: data.team ? { id: data.team.id, name: data.team.name } : null,
          counts: {
            tasks: data.tasks.length,
            tasksDone: data.tasks.filter((r) => r.task.status === "DONE").length,
            attachments: available.length,
            missingAttachments: sized.length - available.length,
            links: data.links.length,
            standups: data.standups.length,
            reviews: data.reviews.length,
            meetings: data.meetings.length,
            mentorSessions: data.mentorSessions.length,
            members: data.contributions.length,
          },
          totalBytes,
          totalBytesLabel: formatBytes(totalBytes),
          oversized: totalBytes > EXPORT_SIZE_WARN_BYTES,
          isEmpty: data.tasks.length === 0,
          auditReady,
          // Email is deliberately omitted: the preview only needs display names,
          // and it ends up in the downloaded CSV anyway, which is access-checked.
          contributions: data.contributions.map(({ email, ...rest }) => rest),
          tasks: data.tasks.map((record) => ({
            id: record.task.id,
            title: record.task.title,
            status: record.task.status,
            priority: record.task.priority,
            points: record.task.points,
            assignees: record.assignees.map(displayName),
            attachmentCount: record.evidence.reduce(
              (sum, entry) => sum + entry.attachments.length,
              0
            ),
          })),
        });
      } catch (error) {
        console.error("Error building sprint export summary:", error);
        res.status(500).json({ message: "Failed to build sprint export summary" });
      }
    }
  );

  // The archive itself. Streamed, so memory stays flat no matter how large the
  // team's attachments are.
  app.get(
    "/api/sprints/:id/export/zip",
    requireRole(...EXPORT_ROLES),
    async (req: Request, res: Response) => {
      const actor = (req as any).user as User;

      if (exportsInFlight.has(actor.id)) {
        return res.status(429).json({
          message: "An export is already running. Wait for it to finish before starting another.",
        });
      }

      exportsInFlight.add(actor.id);
      try {
        const sprint = await loadExportableSprint(req, res);
        if (!sprint) return;

        const data = await collectSprintExport(sprint);
        const generatedAt = new Date();

        // Attachments whose recorded name has no extension get one from the
        // object's content type. This has to happen before paths are planned,
        // and it is the only reason those files do not land in the archive as
        // extensionless blobs. Only the files that need it are HEADed.
        await resolveNamesFromContentType(data.files);

        // Decided before anything is written, so README, CSVs and manifest all
        // cite the one path each file is actually stored at.
        const archivePaths = planArchivePaths(data);

        const label = `sprint-${sprint.index}-${slugify(data.team?.name ?? "team")}`;
        const fileName = `${label}-export.zip`;

        // The audit row is written before a single byte is streamed, so this is
        // where a missing migration surfaces. Without a specific message the
        // failure reads as a generic 500 while the preview above works fine —
        // a confusing state to debug on a fresh deploy.
        let audit;
        try {
          audit = await storage.createSprintExport({
            sprintId: sprint.id,
            teamId: sprint.teamId,
            exportedBy: actor.id,
            format: "zip",
            taskCount: data.tasks.length,
            attachmentCount: data.files.length,
          });
        } catch (error: any) {
          const missingTable = error?.code === "42P01";
          console.error("Failed to record sprint export audit row:", error);
          return res.status(missingTable ? 503 : 500).json({
            message: missingTable
              ? "Sprint export is not fully installed on this environment: the sprint_exports table is missing. Run `npm run db:add-sprint-exports`."
              : "Could not record this export, so it was not started.",
          });
        }

        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        res.setHeader("Cache-Control", "no-store");

        // level 1: attachments are overwhelmingly already-compressed formats
        // (png/jpg/pdf/mp4), so heavy deflate costs CPU and saves almost nothing.
        const archive = archiver("zip", { zlib: { level: 1 } });
        const skipped: string[] = [];
        let attachmentsWritten = 0;
        /**
         * Set once this export can no longer produce a usable archive, either
         * because archiver failed or because the client went away. Because
         * appends are awaited one at a time, this flag is what stops the loop:
         * without it a post-error append would attach its listeners after the
         * error had already fired and wait for an event that never comes,
         * hanging the request and leaking this user's in-flight slot forever.
         */
        let fatal: Error | null = null;
        /** Settles the append currently being awaited, if any. */
        let abortPendingAppend: ((error: Error) => void) | null = null;
        /** The S3 body stream currently being piped, so teardown can free it. */
        let currentObjectStream: { destroy: () => void } | null = null;

        archive.on("warning", (error: Error) => {
          console.warn("Sprint export archive warning:", error);
        });
        archive.on("error", (error: Error) => {
          console.error("Sprint export archive error:", error);
          fatal = error;
          // Headers are already sent by this point; destroying the socket is
          // what signals a truncated download to the client.
          res.destroy(error);
        });

        // Registered before any writing so an abort at any point is recorded.
        // res.writableFinished distinguishes a completed response from one the
        // client cut short — an audit trail must not mark those as complete.
        res.on("close", () => {
          if (!res.writableFinished) {
            console.warn(`Sprint export ${audit.id} aborted before completion`);
            // Stop the loop and tear the archive down; otherwise we keep
            // pulling attachments out of S3 for a client that has gone.
            fatal = fatal ?? new Error("Client aborted the download");
            archive.destroy();
            // archive.destroy() emits only 'close', never 'error', so an append
            // already awaiting would otherwise never settle — pinning this
            // handler, leaking the user's in-flight slot and holding an S3
            // socket open. Settle it explicitly.
            abortPendingAppend?.(fatal);
            currentObjectStream?.destroy();
            return;
          }
          storage
            .completeSprintExport(audit.id, {
              attachmentCount: attachmentsWritten,
              skippedCount: skipped.length,
              byteSize: archive.pointer(),
              completedAt: new Date(),
            })
            .catch((error) => console.error("Failed to record sprint export completion:", error));
        });

        archive.pipe(res);

        /**
         * Append one entry and wait for the archive to finish writing it.
         *
         * archive.append() only queues, so appending in a loop would open every
         * S3 body stream up front and hand archiver a pile of paused streams —
         * exhausting the SDK socket pool and letting early streams sit idle
         * until S3 times them out, mid-archive. Waiting for the matching 'entry'
         * event keeps exactly one object stream open at a time and lets
         * backpressure from a slow client propagate all the way to S3.
         */
        const appendAndWait = (source: any, name: string): Promise<void> =>
          new Promise<void>((resolve, reject) => {
            // Fail fast rather than waiting on an archive that is already dead.
            if (fatal) {
              reject(fatal);
              return;
            }
            const cleanup = () => {
              archive.removeListener("entry", onEntry);
              archive.removeListener("error", onError);
              archive.removeListener("close", onClose);
              abortPendingAppend = null;
            };
            const onEntry = (entry: { name?: string }) => {
              if (entry?.name !== name) return;
              cleanup();
              resolve();
            };
            const onError = (error: Error) => {
              cleanup();
              reject(error);
            };
            // A destroyed archive emits 'close' with no 'error', so this is the
            // only signal that the archive went away mid-entry.
            const onClose = () => {
              cleanup();
              reject(fatal ?? new Error("Archive closed before the entry was written"));
            };
            archive.on("entry", onEntry);
            archive.on("error", onError);
            archive.once("close", onClose);
            // Lets the response teardown settle this promise directly, for the
            // case where neither 'entry', 'error' nor 'close' will arrive.
            abortPendingAppend = (error: Error) => {
              cleanup();
              reject(error);
            };
            archive.append(source, { name });
          });

        const csvFiles = buildCsvFiles(data, archivePaths);
        await appendAndWait(renderReadme(data, actor, generatedAt, archivePaths), "README.md");
        await appendAndWait(csvFiles.tasksCsv, "data/tasks.csv");
        await appendAndWait(csvFiles.contributionsCsv, "data/contributions.csv");
        await appendAndWait(csvFiles.evidenceCsv, "data/evidence.csv");
        await appendAndWait(csvFiles.standupsCsv, "data/standups.csv");
        await appendAndWait(csvFiles.reviewsCsv, "data/reviews.csv");
        await appendAndWait(csvFiles.meetingsCsv, "data/meetings.csv");

        await appendAndWait(
          JSON.stringify(
            {
              exportedAt: generatedAt.toISOString(),
              exportedBy: { id: actor.id, name: displayName(actor), email: actor.email },
              sprint: data.sprint,
              team: data.team,
              tasks: data.tasks.map((record) => ({
                ...record.task,
                assignees: record.assignees.map((user) => ({
                  id: user.id, name: displayName(user), email: user.email,
                })),
                assignedBy: record.assignedBy
                  ? { id: record.assignedBy.id, name: displayName(record.assignedBy) }
                  : null,
                reviewer: record.reviewer
                  ? { id: record.reviewer.id, name: displayName(record.reviewer) }
                  : null,
                attachmentFolder: `attachments/${record.folder}/`,
                evidence: record.evidence.map(({ row, attachments }) => ({
                  ...row,
                  attachments: attachments.map((attachment) => ({
                    fileName: attachment.fileName,
                    url: stripSignature(attachment.url),
                    archivePath: attachment.objectKey
                      ? archivePaths.get(attachment.objectKey) ?? null
                      : null,
                  })),
                })),
              })),
              contributions: data.contributions,
              reviews: data.reviews.map(({ row, mentor }) => ({
                ...row, mentorName: displayName(mentor),
              })),
              standups: data.standups.map(({ row, author }) => ({
                ...row, authorName: displayName(author),
              })),
              meetings: data.meetings,
              mentorSessions: data.mentorSessions.map(({ row, mentor }) => ({
                ...row, mentorName: displayName(mentor),
              })),
              externalLinks: data.links,
            },
            null,
            2
          ),
          "manifest.json"
        );

        for (const file of data.files) {
          // The archive died or the client left: nothing further can be
          // delivered, so stop fetching from S3.
          if (fatal) break;
          if (!file.objectKey) continue;
          const archivePath = archivePaths.get(file.objectKey);
          if (!archivePath) continue;
          let object: Awaited<ReturnType<typeof s3Storage.getObjectStream>> | null = null;
          try {
            object = await s3Storage.getObjectStream(file.objectKey);
            currentObjectStream = object.stream;
            await appendAndWait(object.stream, archivePath);
            // Incremented only once the entry is actually in the archive, so
            // the audit count reflects writes rather than queued intentions.
            attachmentsWritten += 1;
          } catch (error: any) {
            // Free the socket: an append that failed leaves the body stream
            // unconsumed, and a leaked stream holds an S3 connection from the
            // pool shared with uploads, view URLs and chat attachments.
            object?.stream.destroy();
            // A missing object is a per-file problem worth carrying on past. An
            // archive-level failure is not, and is labelled as such — the flag
            // check at the top of the next iteration ends the loop.
            skipped.push(
              fatal
                ? `${archivePath} (${file.objectKey}): not written — export ended early (${error?.message ?? "unknown"})`
                : `${archivePath} (${file.objectKey}): could not be read from storage (${error?.name ?? "error"})`
            );
          } finally {
            currentObjectStream = null;
          }
        }

        if (fatal) {
          // Nothing left to do — the response is already destroyed, and the
          // close handler has recorded the incomplete export.
          return;
        }

        if (skipped.length) {
          await appendAndWait(
            [
              "These attachments could not be included, most likely because the",
              "stored file is missing from object storage.",
              "",
              ...skipped.map((entry) => `- ${entry}`),
              "",
            ].join("\n"),
            "SKIPPED.txt"
          );
        }

        await archive.finalize();
      } catch (error) {
        console.error("Error exporting sprint:", error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to export sprint" });
        } else {
          res.end();
        }
      } finally {
        exportsInFlight.delete(actor.id);
      }
    }
  );

  // Who has exported this sprint before. Scoped exactly like the export itself,
  // since the history reveals who holds a copy of the team's data.
  app.get(
    "/api/sprints/:id/export/history",
    requireRole(...EXPORT_ROLES),
    async (req: Request, res: Response) => {
      try {
        const actor = (req as any).user as User;
        const sprint = await storage.getSprint(req.params.id);
        if (!sprint) {
          return res.status(404).json({ message: "Sprint not found" });
        }
        if (!(await canAccessTeam(actor, sprint.teamId))) {
          return res.status(403).json({ message: "You do not have access to this team's sprints" });
        }

        const records = await storage.getSprintExportsBySprint(sprint.id);
        const exporters = await storage.getUsersByIds(
          Array.from(new Set(records.map((record) => record.exportedBy)))
        );
        const namesById = new Map(exporters.map((user) => [user.id, displayName(user)]));

        res.json(
          records.map((record) => ({
            id: record.id,
            format: record.format,
            taskCount: record.taskCount,
            attachmentCount: record.attachmentCount,
            skippedCount: record.skippedCount,
            byteSize: record.byteSize,
            byteSizeLabel: record.byteSize != null ? formatBytes(record.byteSize) : null,
            completedAt: record.completedAt,
            createdAt: record.createdAt,
            exportedByName: namesById.get(record.exportedBy) ?? "Unknown",
          }))
        );
      } catch (error) {
        console.error("Error loading sprint export history:", error);
        res.status(500).json({ message: "Failed to load export history" });
      }
    }
  );
}
