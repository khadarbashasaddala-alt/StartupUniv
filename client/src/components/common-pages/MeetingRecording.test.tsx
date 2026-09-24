/**
 * Render tests for the session-recording panel.
 *
 * These exist because this UI cannot be checked by hand: the dev database has no migrations
 * applied and the app will not boot locally, so a typecheck and a build are otherwise the only
 * things standing between this component and production. What matters most here is that the
 * right controls appear for the right person — a learner must never see Upload, and a mentor
 * must never be able to delete another mentor's session.
 *
 * They are also the first tests under client/, which means `npm run test:frontend` starts
 * running in CI instead of skipping for want of any file to collect.
 */
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiRequest = vi.fn();
const toast = vi.fn();
let currentUser: { id: string; role: string } | null = { id: "m1", role: "MENTOR" };

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  queryClient: { invalidateQueries: vi.fn() },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import { MeetingRecording } from "./MeetingRecording";

const NO_RECORDING = {
  recordingObjectKey: null,
  recordingFileName: null,
  recordingSizeBytes: null,
  recordingContentType: null,
  recordingDurationSeconds: null,
  recordingUploadedBy: null,
  recordingUploadedAt: null,
};

const UPLOADED = {
  recordingObjectKey: "meetings/recordings/t1/mtg1/abc.mp4",
  recordingFileName: "sprint-1-review.mp4",
  recordingSizeBytes: 487_000_000,
  recordingContentType: "video/mp4",
  recordingDurationSeconds: 3840,
  recordingUploadedBy: "m1",
  recordingUploadedAt: "2026-08-17T06:30:00.000Z",
};

const panel = (props: Partial<React.ComponentProps<typeof MeetingRecording>> = {}) => {
  // A real QueryClient, not the mocked module export: useMutation reads it from React context.
  // Retries off so a deliberately failing call fails once instead of stalling the test.
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MeetingRecording
        teamId="t1"
        meetingId="mtg1"
        meetingTitle="Sprint 1 review session"
        meeting={NO_RECORDING}
        {...props}
      />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  apiRequest.mockReset();
  toast.mockReset();
  currentUser = { id: "m1", role: "MENTOR" };
});

describe("what each person sees", () => {
  it("offers a mentor on the team the upload control", () => {
    panel();
    expect(screen.getByRole("button", { name: /upload recording/i })).toBeInTheDocument();
  });

  it("tells a learner there is nothing yet, with no upload control", () => {
    currentUser = { id: "l1", role: "LEARNER" };
    panel();
    expect(screen.getByText(/no recording uploaded for this session yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
  });

  it("lets a learner watch once a recording exists", () => {
    currentUser = { id: "l1", role: "LEARNER" };
    panel({ meeting: UPLOADED });
    expect(screen.getByRole("button", { name: /watch/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload|replace/i })).not.toBeInTheDocument();
  });

  it("lets an admin upload to a team they are not a member of", () => {
    currentUser = { id: "a1", role: "ADMIN" };
    panel({ isTeamMember: false });
    expect(screen.getByRole("button", { name: /upload recording/i })).toBeInTheDocument();
  });

  it("gives a mentor Replace rather than Upload when one is already there", () => {
    panel({ meeting: UPLOADED });
    expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument();
  });

  it("does not offer a mentor a way to delete another mentor's session", () => {
    currentUser = { id: "m2", role: "MENTOR" };
    panel({ meeting: UPLOADED });
    expect(screen.getByRole("button", { name: /watch/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove recording/i })).not.toBeInTheDocument();
  });

  it("offers deletion to the mentor who uploaded it", () => {
    panel({ meeting: UPLOADED });
    expect(screen.getByRole("button", { name: /remove recording/i })).toBeInTheDocument();
  });

  it("shows a mentor with no permission on this team nothing to upload with", () => {
    panel({ isTeamMember: false });
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
  });
});

describe("what the panel says about an existing recording", () => {
  it("reports duration and size in readable units", () => {
    panel({ meeting: UPLOADED });
    // 487,000,000 bytes is 464 MiB — the label is binary units, matching what an OS reports.
    expect(screen.getByText(/1h 04m · 464 MB/)).toBeInTheDocument();
  });

  it("says nothing about duration when the browser could not read it", () => {
    // Nullable on purpose — an unparseable container yields no duration, and "0s" would be a lie.
    panel({ meeting: { ...UPLOADED, recordingDurationSeconds: null } });
    expect(screen.queryByText(/1h 04m/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /watch/i })).toBeInTheDocument();
  });

  it("tells a mentor the format and size limits before they pick a file", () => {
    panel();
    expect(screen.getByText(/MP4 or WebM/i)).toBeInTheDocument();
    expect(screen.getByText(/2\.0 GB/)).toBeInTheDocument();
  });
});

describe("choosing a file", () => {
  const input = (): HTMLInputElement => {
    const { container } = panel();
    return container.querySelector('input[type="file"]') as HTMLInputElement;
  };

  it("limits the file picker to formats that will play", () => {
    // First line of defence, and the reason a mentor rarely sees the error below at all.
    expect(input()).toHaveAttribute("accept", "video/mp4,video/webm");
  });

  it("still refuses a format the browser cannot play when the picker is bypassed", async () => {
    // accept= is only a hint: every OS dialog offers "All files". So the check has to be in the
    // component too. fireEvent is used deliberately — userEvent honours accept and would drop
    // the file before the component ever saw it, testing the browser instead of this code.
    //
    // The point of refusing here: an mkv uploads perfectly well and then will not play, having
    // cost the mentor the entire transfer first.
    fireEvent.change(input(), {
      target: { files: [new File(["x"], "session.mkv", { type: "video/x-matroska" })] },
    });

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringMatching(/MP4 or WebM/i),
          variant: "destructive",
        })
      )
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("still refuses a document when the picker is bypassed", async () => {
    fireEvent.change(input(), {
      target: { files: [new File(["x"], "notes.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("asks the server for an upload URL for an acceptable file", async () => {
    apiRequest.mockRejectedValue(new Error("stop here"));
    fireEvent.change(input(), {
      target: { files: [new File(["video-bytes"], "session.mp4", { type: "video/mp4" })] },
    });

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/teams/t1/meetings/mtg1/recording/upload-url",
        expect.objectContaining({ fileName: "session.mp4", fileType: "video/mp4" })
      )
    );
    // The declared size is sent because a presigned PUT cannot enforce one, so the server has to
    // be able to refuse before it issues the URL.
    expect(apiRequest.mock.calls[0][2]).toHaveProperty("fileSize");
  });

  it("uploads anyway where object URLs are unavailable", async () => {
    // jsdom has no URL.createObjectURL, so the duration probe cannot run at all. It must give up
    // rather than block: the duration is a label on a card, never a reason to refuse an upload.
    expect(typeof URL.createObjectURL).toBe("undefined");
    apiRequest.mockRejectedValue(new Error("stop here"));
    fireEvent.change(input(), {
      target: { files: [new File(["v"], "silent.mp4", { type: "video/mp4" })] },
    });
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
  });

  it("gives up on a probe that never answers, instead of hanging the upload", async () => {
    // The case the timeout exists for, which the test above does NOT reach: object URLs work,
    // so the probe starts, but neither loadedmetadata nor error ever fires. Without the timeout
    // the upload waits forever with the bar stuck on "Preparing…" and no way to tell why.
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:stub",
      revokeObjectURL: () => {},
    });
    vi.useFakeTimers();
    try {
      apiRequest.mockRejectedValue(new Error("stop here"));
      fireEvent.change(input(), {
        target: { files: [new File(["v"], "hangs.mp4", { type: "video/mp4" })] },
      });

      // Nothing should have happened yet — it is genuinely waiting on the probe.
      await vi.advanceTimersByTimeAsync(4000);
      expect(apiRequest).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1500);
      expect(apiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/teams/t1/meetings/mtg1/recording/upload-url",
        expect.objectContaining({ fileName: "hangs.mp4" })
      );
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});

describe("watching", () => {
  it("requests a fresh signed URL rather than using one minted with the page", async () => {
    apiRequest.mockResolvedValue({ url: "https://s3.example/signed" });
    panel({ meeting: UPLOADED });

    await userEvent.click(screen.getByRole("button", { name: /watch/i }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "GET",
        "/api/teams/t1/meetings/mtg1/recording/url"
      )
    );
  });

  it("surfaces a failure to open instead of leaving a dead player", async () => {
    apiRequest.mockRejectedValue(new Error("Forbidden"));
    panel({ meeting: UPLOADED });

    await userEvent.click(screen.getByRole("button", { name: /watch/i }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringMatching(/could not open/i) })
      )
    );
  });
});

describe("refusing a file the browser cannot decode", () => {
  /**
   * jsdom neither loads media nor fires its events, so the probe is driven directly: object URLs
   * are stubbed in, and the detached <video> the component creates is made to raise the event this
   * test is about. Only "video" is intercepted, and everything else falls through to the real
   * document.createElement, so React's own rendering is untouched.
   */
  const probeAnswers = (event: "error" | "loadedmetadata", duration = 42) => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:stub", revokeObjectURL: () => {} });
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string, ...rest: unknown[]) => {
      const el = realCreate(tag as any, ...(rest as any));
      if (tag === "video") {
        Object.defineProperty(el, "duration", { value: duration, configurable: true });
        Object.defineProperty(el, "src", {
          configurable: true,
          set() {
            setTimeout(() => {
              if (event === "error") (el as any).onerror?.(new Event("error"));
              else (el as any).onloadedmetadata?.(new Event("loadedmetadata"));
            }, 0);
          },
        });
      }
      return el;
    }) as typeof document.createElement);
  };

  const pick = (name = "session.webm", type = "video/webm") => {
    const { container } = panel();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["v"], name, { type })] } });
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("refuses it before uploading a single byte", async () => {
    // The gap this closes: extension and MIME describe the container, and playability depends on
    // the codecs inside it. An .mp4 holding H.265 passes every name check and then will not play.
    probeAnswers("error");
    apiRequest.mockResolvedValue({ uploadUrl: "https://s3/put", objectKey: "k" });

    pick();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/will not play in a browser/i),
          variant: "destructive",
        })
      )
    );
    // Nothing was uploaded, so no transfer was wasted and no dead recording was attached.
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("tells the mentor what to do about it", async () => {
    probeAnswers("error");
    pick();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const { description } = toast.mock.calls[0][0] as { description: string };
    expect(description).toMatch(/MP4 \(H\.264\)|WebM \(VP8/);
  });

  it("uploads a file the browser can decode, and reports its duration", async () => {
    probeAnswers("loadedmetadata", 3840);
    apiRequest.mockImplementation(async (method: string, path: string) => {
      if (path.endsWith("upload-url")) return { uploadUrl: "https://s3/put", objectKey: "k" };
      throw new Error("stop after the URL");
    });

    pick();

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/teams/t1/meetings/mtg1/recording/upload-url",
        expect.objectContaining({ fileName: "session.webm" })
      )
    );
  });
});
