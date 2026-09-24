import { describe, expect, it, vi } from "vitest";

// s3Storage constructs an S3 client and throws without AWS_S3_BUCKET_NAME, so
// stub the module before importing anything that pulls it in transitively.
vi.mock("./s3", () => ({
  s3Storage: {
    normalizeObjectEntityPath: (raw: string) => {
      // Mirrors the real implementation for a bucket named "test-bucket".
      if (!raw.startsWith("https://") && !raw.startsWith("s3://")) return raw;
      if (raw.startsWith("https://test-bucket.s3.")) {
        return new URL(raw).pathname.slice(1);
      }
      if (raw.startsWith("s3://")) return raw.replace("s3://test-bucket/", "");
      return raw;
    },
  },
}));

vi.mock("./storage", () => ({ storage: {} }));

const {
  csvCell,
  fileNameFor,
  formatBytes,
  resolveObjectKey,
  slugify,
  toCsv,
  uniqueName,
} = await import("./sprintExportRoutes");

describe("uniqueName", () => {
  it("keeps the first occurrence untouched", () => {
    const taken = new Set<string>();
    expect(uniqueName("screenshot.png", taken)).toBe("screenshot.png");
  });

  it("suffixes collisions so two members' uploads coexist", () => {
    const taken = new Set<string>();
    expect(uniqueName("screenshot.png", taken)).toBe("screenshot.png");
    expect(uniqueName("screenshot.png", taken)).toBe("screenshot (2).png");
    expect(uniqueName("screenshot.png", taken)).toBe("screenshot (3).png");
  });

  it("keeps the suffix before the extension, not after", () => {
    const taken = new Set(["report.pdf"]);
    expect(uniqueName("report.pdf", taken)).toBe("report (2).pdf");
  });

  it("handles names with no extension", () => {
    const taken = new Set(["README"]);
    expect(uniqueName("README", taken)).toBe("README (2)");
  });

  it("skips over a suffix that is itself already taken", () => {
    const taken = new Set(["a.txt", "a (2).txt"]);
    expect(uniqueName("a.txt", taken)).toBe("a (3).txt");
  });
});

describe("fileNameFor", () => {
  it("prefers the recorded original name", () => {
    expect(fileNameFor("Design Doc.pdf", "uploads/abc", null)).toBe("Design Doc.pdf");
  });

  it("infers an extension from content type when the name has none", () => {
    expect(fileNameFor("diagram", "uploads/abc", "image/png")).toBe("diagram.png");
  });

  it("ignores content-type parameters", () => {
    expect(fileNameFor("notes", "uploads/abc", "text/plain; charset=utf-8")).toBe("notes.txt");
  });

  it("falls back to the key basename plus inferred extension", () => {
    expect(fileNameFor(undefined, "uploads/report", "application/pdf")).toBe("report.pdf");
  });

  it("produces a .bin fallback rather than an extensionless blob", () => {
    // Uploads are stored as an extensionless UUID with an octet-stream content
    // type, so this is the realistic worst case for an older attachment.
    expect(fileNameFor(undefined, "uploads/9f8e7d6c", "application/octet-stream")).toBe(
      "9f8e7d6c.bin"
    );
  });

  it("strips path traversal out of a declared name", () => {
    expect(fileNameFor("../../etc/passwd", "uploads/abc", null)).toBe("passwd");
  });

  it("never returns an empty name", () => {
    expect(fileNameFor("", null, null)).toBe("attachment.bin");
  });
});

describe("resolveObjectKey", () => {
  it("returns a bare key unchanged", () => {
    expect(resolveObjectKey("uploads/abc-123")).toBe("uploads/abc-123");
  });

  it("extracts the key from our own https URL", () => {
    expect(resolveObjectKey("https://test-bucket.s3.ap-south-1.amazonaws.com/uploads/abc")).toBe(
      "uploads/abc"
    );
  });

  it("extracts the key from an s3:// URL", () => {
    expect(resolveObjectKey("s3://test-bucket/uploads/abc")).toBe("uploads/abc");
  });

  it("recognises our bucket over plain http", () => {
    // Older evidence rows stored our own bucket over http; treating those as
    // external would silently drop the file from the archive.
    expect(resolveObjectKey("http://test-bucket.s3.ap-south-1.amazonaws.com/uploads/abc")).toBe(
      "uploads/abc"
    );
  });

  it("treats a third-party URL as external", () => {
    expect(resolveObjectKey("https://github.com/acme/repo/pull/12")).toBeNull();
    expect(resolveObjectKey("http://example.com/thing.png")).toBeNull();
  });

  it("rejects empty and non-string input", () => {
    expect(resolveObjectKey("")).toBeNull();
    expect(resolveObjectKey("   ")).toBeNull();
    expect(resolveObjectKey(undefined)).toBeNull();
    expect(resolveObjectKey(null)).toBeNull();
    expect(resolveObjectKey(42)).toBeNull();
  });
});

describe("csvCell", () => {
  it("passes plain values through", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell(7)).toBe("7");
  });

  it("renders null and undefined as empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes values containing a comma", () => {
    expect(csvCell("Fix login, then deploy")).toBe('"Fix login, then deploy"');
  });

  it("doubles embedded quotes", () => {
    expect(csvCell('He said "ship it"')).toBe('"He said ""ship it"""');
  });

  it("quotes values containing newlines so rows cannot be broken", () => {
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("line one\r\nline two")).toBe('"line one\r\nline two"');
  });

  it("serialises dates as ISO", () => {
    expect(csvCell(new Date("2026-03-04T05:06:07.000Z"))).toBe("2026-03-04T05:06:07.000Z");
  });
});

describe("toCsv", () => {
  it("emits a BOM, CRLF rows and a trailing newline", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿a,b\r\n1,2\r\n");
  });

  it("escapes cells inside rows", () => {
    expect(toCsv(["title"], [['a,b "c"']])).toBe('﻿title\r\n"a,b ""c"""\r\n');
  });

  it("handles an empty row set", () => {
    expect(toCsv(["a"], [])).toBe("﻿a\r\n");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Build Login Page")).toBe("build-login-page");
  });

  it("collapses runs of punctuation and trims edges", () => {
    expect(slugify("  Fix: the API!! (again) ")).toBe("fix-the-api-again");
  });

  it("falls back to 'task' when nothing survives", () => {
    expect(slugify("!!!")).toBe("task");
    expect(slugify("")).toBe("task");
  });

  it("caps length so folder names stay sane", () => {
    expect(slugify("a".repeat(200)).length).toBe(60);
  });
});

describe("formatBytes", () => {
  it("reports bytes below 1 KB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("scales through the units", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });

  it("drops the decimal once the number is large", () => {
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
  });
});
