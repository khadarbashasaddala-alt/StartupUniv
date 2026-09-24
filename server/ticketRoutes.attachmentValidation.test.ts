import { describe, expect, it, vi, beforeEach } from "vitest";

const getTicketAttachmentByObjectKey = vi.fn();

vi.mock("./storage", () => ({
  storage: {
    getTicketAttachmentByObjectKey: (...args: unknown[]) =>
      getTicketAttachmentByObjectKey(...args),
  },
}));
vi.mock("./ticketSlaSettings", () => ({
  getSlaHours: vi.fn(),
  slaDueDateFromSettings: vi.fn(),
}));

const { isTicketAttachmentObjectKey, validateAttachmentsInput, assertAttachmentsUnclaimed } =
  await import("./ticketRoutes");

beforeEach(() => {
  getTicketAttachmentByObjectKey.mockReset();
});

describe("isTicketAttachmentObjectKey", () => {
  it("accepts a key under the expected prefix", () => {
    expect(isTicketAttachmentObjectKey("tickets/attachments/123/report.pdf")).toBe(true);
  });

  it("rejects a key pointing elsewhere in the bucket", () => {
    expect(isTicketAttachmentObjectKey("uploads/some-other-feature/file.pdf")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isTicketAttachmentObjectKey(undefined)).toBe(false);
    expect(isTicketAttachmentObjectKey(42)).toBe(false);
  });
});

describe("validateAttachmentsInput", () => {
  it("passes when attachments is absent or not an array", () => {
    expect(validateAttachmentsInput(undefined)).toBeNull();
    expect(validateAttachmentsInput(null)).toBeNull();
    expect(validateAttachmentsInput("nope")).toBeNull();
  });

  it("passes a well-formed attachment list", () => {
    expect(
      validateAttachmentsInput([
        { objectKey: "tickets/attachments/1/a.pdf", fileName: "a.pdf", contentType: "application/pdf" },
      ])
    ).toBeNull();
  });

  it("rejects an entry missing fileName or objectKey", () => {
    expect(validateAttachmentsInput([{ fileName: "a.pdf" }])).toBe(
      "Each attachment needs a fileName and objectKey"
    );
    expect(validateAttachmentsInput([{ objectKey: "tickets/attachments/1/a.pdf" }])).toBe(
      "Each attachment needs a fileName and objectKey"
    );
  });

  it("rejects an objectKey outside the ticket-attachments prefix", () => {
    expect(
      validateAttachmentsInput([{ objectKey: "uploads/elsewhere/a.pdf", fileName: "a.pdf" }])
    ).toBe("Invalid attachment reference");
  });

  it("rejects a disallowed file type, naming the offending file", () => {
    expect(
      validateAttachmentsInput([
        { objectKey: "tickets/attachments/1/virus.exe", fileName: "virus.exe" },
      ])
    ).toBe("virus.exe is not an allowed file type");
  });

  it("stops at the first invalid entry rather than checking the rest", () => {
    expect(
      validateAttachmentsInput([
        { objectKey: "tickets/attachments/1/a.pdf", fileName: "a.pdf" },
        { fileName: "b.pdf" },
      ])
    ).toBe("Each attachment needs a fileName and objectKey");
  });
});

describe("assertAttachmentsUnclaimed", () => {
  it("passes when attachments is absent or not an array", async () => {
    expect(await assertAttachmentsUnclaimed(undefined, "ticket-1")).toBeNull();
    expect(await assertAttachmentsUnclaimed(null, "ticket-1")).toBeNull();
  });

  it("passes when the objectKey has never been registered", async () => {
    getTicketAttachmentByObjectKey.mockResolvedValue(undefined);
    const result = await assertAttachmentsUnclaimed(
      [{ objectKey: "tickets/attachments/1/a.pdf" }],
      "ticket-1"
    );
    expect(result).toBeNull();
  });

  it("passes when the key is already registered to the SAME ticket", async () => {
    // e.g. re-submitting a close/reopen payload that references an
    // attachment this same ticket already has.
    getTicketAttachmentByObjectKey.mockResolvedValue({ ticketId: "ticket-1" });
    const result = await assertAttachmentsUnclaimed(
      [{ objectKey: "tickets/attachments/1/a.pdf" }],
      "ticket-1"
    );
    expect(result).toBeNull();
  });

  it("rejects when the key is already registered to a DIFFERENT ticket", async () => {
    // The scenario the reviewer flagged: a key lifted from a ticket the
    // user can view and resubmitted against a ticket of their own.
    getTicketAttachmentByObjectKey.mockResolvedValue({ ticketId: "some-other-ticket" });
    const result = await assertAttachmentsUnclaimed(
      [{ objectKey: "tickets/attachments/1/a.pdf" }],
      "ticket-1"
    );
    expect(result).toBe("One or more attachments could not be verified");
  });

  it("rejects when the key is already claimed and this is a brand-new ticket (currentTicketId null)", async () => {
    getTicketAttachmentByObjectKey.mockResolvedValue({ ticketId: "some-other-ticket" });
    const result = await assertAttachmentsUnclaimed(
      [{ objectKey: "tickets/attachments/1/a.pdf" }],
      null
    );
    expect(result).toBe("One or more attachments could not be verified");
  });
});
