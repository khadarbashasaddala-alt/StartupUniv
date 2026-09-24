import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import { Readable } from "stream";
import type { Server } from "http";

// ---------------------------------------------------------------------------
// Fakes. The route module reaches for ./storage and ./s3 at import time, so
// both are mocked before it loads.
// ---------------------------------------------------------------------------

const PASSED_SPRINT = {
  id: "sprint-1",
  teamId: "team-a",
  index: 1,
  name: "Sprint One",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-14"),
  goals: "Ship the thing",
  objectives: null,
  deliverables: null,
  passed: true,
  passedAt: new Date("2026-01-15"),
  demoUrl: null,
  demoNotes: null,
  createdAt: new Date("2026-01-01"),
};

const OPEN_SPRINT = { ...PASSED_SPRINT, id: "sprint-open", passed: null, passedAt: null };
const OTHER_TEAM_SPRINT = { ...PASSED_SPRINT, id: "sprint-other", teamId: "team-b" };

/** Attachments: one with a name, one without (exercises content-type naming). */
const EVIDENCE = [
  {
    id: "ev-1",
    teamId: "team-a",
    sprintId: "sprint-1",
    taskId: "task-1",
    submittedBy: "user-1",
    type: "FILE",
    url: "https://github.com/acme/repo/pull/7",
    title: "PR",
    metaJson: {
      attachments: [
        { url: "https://bucket.s3.x.amazonaws.com/uploads/k1?X-Amz-Signature=deadbeef", objectKey: "uploads/k1", name: "design.png" },
        { url: "https://bucket.s3.x.amazonaws.com/uploads/k2", objectKey: "uploads/k2" },
      ],
    },
    createdAt: new Date("2026-01-05"),
  },
];

const storageMock = {
  getSprint: vi.fn(async (id: string) =>
    id === "sprint-1" ? PASSED_SPRINT
      : id === "sprint-open" ? OPEN_SPRINT
      : id === "sprint-other" ? OTHER_TEAM_SPRINT
      : undefined
  ),
  getTeam: vi.fn(async (id: string) => ({ id, name: "Team A", cohortId: "cohort-1" })),
  getTasksBySprint: vi.fn(async () => [
    {
      id: "task-1", sprintId: "sprint-1", teamId: "team-a", assigneeId: "user-1",
      assigneeIds: ["user-1"], assignedBy: "user-9", reviewerId: null, reviewComment: null,
      title: "Build login", description: null, objectives: null, deliverables: null,
      status: "DONE", priority: "HIGH", points: 3, startDate: null, endDate: null,
      dependencies: null, createdAt: new Date("2026-01-02"),
    },
  ]),
  getEvidenceBySprint: vi.fn(async () => EVIDENCE),
  getReviewsBySprint: vi.fn(async () => []),
  getDailyStandupsBySprint: vi.fn(async () => []),
  getTeamMeetingsByTeam: vi.fn(async () => []),
  getMentorSessionsByTeam: vi.fn(async () => []),
  getMentorSessionsByMentor: vi.fn(async () => []),
  getRoleAssignmentsByTeam: vi.fn(async () => [
    { id: "ra-1", teamId: "team-a", userId: "user-1", role: "Founder", stipendBand: "A" },
  ]),
  getUsersByIds: vi.fn(async (ids: string[]) =>
    ids.map((id) => ({ id, name: `User ${id}`, email: `${id}@example.com`, role: "FOUNDER" }))
  ),
  createSprintExport: vi.fn(async (row: any) => ({ ...row, id: "audit-1" })),
  completeSprintExport: vi.fn(async () => undefined),
  getSprintExportsBySprint: vi.fn(async () => [
    {
      id: "audit-0", sprintId: "sprint-1", teamId: "team-a", exportedBy: "user-1",
      format: "zip", taskCount: 1, attachmentCount: 2, skippedCount: 0,
      byteSize: 2048, completedAt: new Date("2026-02-01"), createdAt: new Date("2026-02-01"),
    },
  ]),
};

/** Emits `size` bytes in small chunks with a tick between, so a test can abort mid-stream. */
function slowStream(size: number): Readable {
  let sent = 0;
  return new Readable({
    read() {
      if (sent >= size) {
        this.push(null);
        return;
      }
      const chunk = Buffer.alloc(Math.min(16 * 1024, size - sent), 7);
      sent += chunk.length;
      setTimeout(() => this.push(chunk), 5);
    },
  });
}

const s3Mock = {
  normalizeObjectEntityPath: (raw: string) => raw,
  getObjectMetadata: vi.fn(async () => ({ size: 1024, contentType: "application/pdf" })),
  getObjectStream: vi.fn(async () => ({
    stream: slowStream(1024),
    size: 1024,
    contentType: "application/pdf",
  })),
};

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./s3", () => ({ s3Storage: s3Mock }));

const { registerSprintExportRoutes } = await import("./sprintExportRoutes");

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;
/** Swapped per test to change who is calling. */
let actor: any;
/** Swapped per test to control team entitlement. */
let entitled: boolean;

beforeEach(async () => {
  vi.clearAllMocks();
  actor = { id: "user-1", name: "Founder One", email: "f@example.com", role: "FOUNDER" };
  entitled = true;

  const app = express();
  registerSprintExportRoutes(app, {
    // Stand-in for the real middleware: role admission only, exactly as in
    // production — the team check is the route's own job.
    requireRole: (...roles: string[]) => (req, res, next) => {
      if (!roles.includes(actor.role)) return res.status(403).json({ message: "Forbidden" });
      (req as any).user = actor;
      next();
    },
    isTeamMemberOrAdmin: async () => entitled,
  });

  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const summaryUrl = (id = "sprint-1") => `${baseUrl}/api/sprints/${id}/export/summary`;
const zipUrl = (id = "sprint-1") => `${baseUrl}/api/sprints/${id}/export/zip`;
const historyUrl = (id = "sprint-1") => `${baseUrl}/api/sprints/${id}/export/history`;

// ---------------------------------------------------------------------------

describe("team scoping", () => {
  it("refuses a founder who is not on the sprint's team", async () => {
    entitled = false;
    for (const url of [summaryUrl("sprint-other"), zipUrl("sprint-other"), historyUrl("sprint-other")]) {
      const res = await fetch(url);
      expect(res.status, url).toBe(403);
    }
  });

  it("does not leak any sprint data in the refusal body", async () => {
    entitled = false;
    const body = await (await fetch(summaryUrl("sprint-other"))).text();
    expect(body).not.toContain("Ship the thing");
    expect(body).not.toContain("Team A");
    expect(body).not.toContain("example.com");
  });

  it("allows an entitled team member", async () => {
    const res = await fetch(summaryUrl());
    expect(res.status).toBe(200);
  });

  it("allows a mentor who has run a session with the team", async () => {
    entitled = false; // mentors have no role_assignments row
    actor = { id: "mentor-3", name: "M3", email: "m3@example.com", role: "MENTOR" };
    storageMock.getMentorSessionsByMentor.mockResolvedValueOnce([{ teamId: "team-a" }] as any);
    const res = await fetch(summaryUrl());
    expect(res.status).toBe(200);
  });

  it("refuses a mentor with no session for this team, cohort notwithstanding", async () => {
    // Mentor access is deliberately session-scoped, not cohort-scoped: sharing a
    // cohort must not hand over another team's members, emails and attachments.
    entitled = false;
    actor = { id: "mentor-2", name: "M2", email: "m2@example.com", role: "MENTOR" };
    storageMock.getMentorSessionsByMentor.mockResolvedValueOnce([{ teamId: "team-z" }] as any);
    expect((await fetch(summaryUrl())).status).toBe(403);
    expect((await fetch(zipUrl())).status).toBe(403);
  });

  it("allows a cofounder on the team", async () => {
    actor = { id: "cofounder-1", name: "C", email: "c@example.com", role: "COFOUNDER" };
    expect((await fetch(summaryUrl())).status).toBe(200);
  });

  it("refuses a cofounder from another team", async () => {
    entitled = false;
    actor = { id: "cofounder-2", name: "C2", email: "c2@example.com", role: "COFOUNDER" };
    expect((await fetch(summaryUrl())).status).toBe(403);
  });

  it("rejects a role that is not permitted at all", async () => {
    actor = { id: "learner-1", name: "L", email: "l@example.com", role: "LEARNER" };
    expect((await fetch(summaryUrl())).status).toBe(403);
    expect((await fetch(zipUrl())).status).toBe(403);
  });
});

describe("passed-sprint gate", () => {
  it("returns 409 for a sprint that has not been passed", async () => {
    expect((await fetch(summaryUrl("sprint-open"))).status).toBe(409);
    expect((await fetch(zipUrl("sprint-open"))).status).toBe(409);
  });

  it("does not write an audit row for a refused export", async () => {
    await fetch(zipUrl("sprint-open"));
    expect(storageMock.createSprintExport).not.toHaveBeenCalled();
  });

  it("returns 404 for a sprint that does not exist", async () => {
    expect((await fetch(summaryUrl("nope"))).status).toBe(404);
    expect((await fetch(zipUrl("nope"))).status).toBe(404);
  });
});

describe("summary payload", () => {
  it("omits member email addresses", async () => {
    const body = await (await fetch(summaryUrl())).json();
    expect(body.contributions.length).toBeGreaterThan(0);
    for (const row of body.contributions) expect(row).not.toHaveProperty("email");
  });

  it("reports the audit table as unavailable rather than failing", async () => {
    storageMock.getSprintExportsBySprint.mockRejectedValueOnce(
      Object.assign(new Error('relation "sprint_exports" does not exist'), { code: "42P01" })
    );
    const res = await fetch(summaryUrl());
    expect(res.status).toBe(200);
    expect((await res.json()).auditReady).toBe(false);
  });
});

describe("archive contents", () => {
  it("streams a zip containing everything the README promises", async () => {
    const res = await fetch(zipUrl());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain(".zip");

    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.subarray(0, 2).toString()).toBe("PK"); // zip magic
    // Entry names appear in the local file headers, uncompressed.
    const text = buffer.toString("latin1");
    for (const name of [
      "README.md",
      "manifest.json",
      "data/tasks.csv",
      "data/contributions.csv",
      "data/evidence.csv",
      "data/standups.csv",
      "data/reviews.csv",
      "data/meetings.csv",
    ]) {
      expect(text, `missing ${name}`).toContain(name);
    }
  });

  it("names an attachment with no recorded name from its content type", async () => {
    const buffer = Buffer.from(await (await fetch(zipUrl())).arrayBuffer());
    const text = buffer.toString("latin1");
    expect(text).toContain("design.png"); // declared name preserved
    expect(text).toContain("k2.pdf"); // derived from content type, not left extensionless
    expect(text).not.toContain("k2.bin");
  });

  it("records the export as complete once the response finishes", async () => {
    await (await fetch(zipUrl())).arrayBuffer();
    await new Promise((r) => setTimeout(r, 50));
    expect(storageMock.completeSprintExport).toHaveBeenCalledTimes(1);
    const [, patch] = storageMock.completeSprintExport.mock.calls[0] as any[];
    expect(patch.completedAt).toBeInstanceOf(Date);
    expect(patch.byteSize).toBeGreaterThan(0);
    expect(patch.attachmentCount).toBe(2);
  });

  it("returns 503 naming the migration when the audit table is missing", async () => {
    storageMock.createSprintExport.mockRejectedValueOnce(
      Object.assign(new Error('relation "sprint_exports" does not exist'), { code: "42P01" })
    );
    const res = await fetch(zipUrl());
    expect(res.status).toBe(503);
    expect((await res.json()).message).toContain("db:add-sprint-exports");
  });

  it("skips an unreadable attachment instead of failing the whole export", async () => {
    s3Mock.getObjectStream
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { name: "ObjectNotFoundError" }))
      .mockResolvedValueOnce({ stream: slowStream(512), size: 512, contentType: "application/pdf" } as any);
    const res = await fetch(zipUrl());
    expect(res.status).toBe(200);
    const text = Buffer.from(await res.arrayBuffer()).toString("latin1");
    expect(text).toContain("SKIPPED.txt");
  });
});

describe("in-flight guard", () => {
  it("rejects a second concurrent export from the same user", async () => {
    // Large attachments so the first export is still streaming.
    s3Mock.getObjectStream.mockImplementation(async () => ({
      stream: slowStream(2 * 1024 * 1024),
      size: 2 * 1024 * 1024,
      contentType: "application/pdf",
    }) as any);

    const first = fetch(zipUrl());
    await new Promise((r) => setTimeout(r, 60));
    const second = await fetch(zipUrl());
    expect(second.status).toBe(429);

    await (await first).arrayBuffer();
  });

  /**
   * Regression test. archive.destroy() emits only 'close', never 'error', so an
   * append already being awaited used to never settle: the handler hung, its
   * finally never ran, and the user's in-flight slot leaked — every later export
   * returned 429 until the process restarted.
   */
  it("releases the in-flight slot when the client aborts mid-download", async () => {
    s3Mock.getObjectStream.mockImplementation(async () => ({
      stream: slowStream(8 * 1024 * 1024),
      size: 8 * 1024 * 1024,
      contentType: "application/pdf",
    }) as any);

    const controller = new AbortController();
    const aborted = fetch(zipUrl(), { signal: controller.signal });

    // Wait until bytes are actually flowing, then cut the connection.
    const response = await aborted;
    const reader = response.body!.getReader();
    await reader.read();
    controller.abort();
    await expect(response.arrayBuffer().catch((e) => Promise.reject(e))).rejects.toBeTruthy();

    // Give the server a moment to run its teardown.
    await new Promise((r) => setTimeout(r, 300));

    // The slot must be free: a fresh export may start.
    s3Mock.getObjectStream.mockImplementation(async () => ({
      stream: slowStream(1024),
      size: 1024,
      contentType: "application/pdf",
    }) as any);
    const retry = await fetch(zipUrl());
    expect(retry.status).not.toBe(429);
    expect(retry.status).toBe(200);
    await retry.arrayBuffer();
  });

  it("does not mark an aborted export as complete", async () => {
    s3Mock.getObjectStream.mockImplementation(async () => ({
      stream: slowStream(8 * 1024 * 1024),
      size: 8 * 1024 * 1024,
      contentType: "application/pdf",
    }) as any);

    const controller = new AbortController();
    const response = await fetch(zipUrl(), { signal: controller.signal });
    const reader = response.body!.getReader();
    await reader.read();
    controller.abort();
    await new Promise((r) => setTimeout(r, 300));

    expect(storageMock.completeSprintExport).not.toHaveBeenCalled();
  });
});

describe("history", () => {
  it("returns records with a formatted size and exporter name", async () => {
    const body = await (await fetch(historyUrl())).json();
    expect(body).toHaveLength(1);
    expect(body[0].exportedByName).toBe("User user-1");
    expect(body[0].byteSizeLabel).toBe("2.0 KB");
  });

  it("404s for an unknown sprint rather than returning rows for an arbitrary id", async () => {
    expect((await fetch(historyUrl("nope"))).status).toBe(404);
  });
});
