import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, Play, Trash2, Upload, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import {
  RECORDING_CONTENT_TYPES,
  RECORDING_MAX_BYTES,
  canDeleteRecording,
  canUploadRecording,
  canViewRecording,
  formatBytes,
  formatDuration,
  recordingFileError,
  uploadPercent,
} from "@shared/meetingRecording";

export interface RecordingFields {
  recordingObjectKey?: string | null;
  recordingFileName?: string | null;
  recordingSizeBytes?: number | string | null;
  recordingContentType?: string | null;
  recordingDurationSeconds?: number | null;
  recordingUploadedBy?: string | null;
  recordingUploadedAt?: string | null;
}

interface MeetingRecordingProps {
  teamId: string;
  meetingId: string;
  meetingTitle: string;
  meeting: RecordingFields;
  /** True when the signed-in user holds a role assignment on this meeting's team. */
  isTeamMember?: boolean;
  /** Called after an upload or removal, so the parent can refetch its meeting list. */
  onChanged?: () => void;
}

/** Long enough for a large local file, short enough not to look like a stall. */
const DURATION_PROBE_TIMEOUT_MS = 5000;

/**
 * What a browser made of the file when asked to open it.
 *
 * "playable" means loadedmetadata fired: the browser parsed the container, found the tracks, and
 * can decode them. "unplayable" means it raised error instead — a definite answer that this file
 * will not play. "unknown" means neither happened, or object URLs are unavailable, so nothing was
 * learned either way.
 */
type ProbeResult =
  | { verdict: "playable"; durationSeconds: number | null }
  | { verdict: "unplayable" }
  | { verdict: "unknown" };

/**
 * Opens the file in a detached <video> to find out whether this browser can actually play it, and
 * how long it runs.
 *
 * The extension and MIME allowlist cannot answer the real question. Both describe the container,
 * and playability depends on the codecs inside it: an .mp4 holding H.265, or a .webm holding
 * something other than VP8/VP9, passes every name check and then will not play. The only reliable
 * test is to ask a decoder, and there is one on the page.
 *
 * The timeout is not defensive padding. This resolves nothing at all if neither loadedmetadata nor
 * error fires, and the upload awaits it — so a file that leaves the probe silent would hang the
 * upload before it started, with the bar stuck on "Preparing…". An inconclusive probe must never
 * block an upload: it proves nothing, and refusing on it would reject good files.
 */
function probePlayability(file: File): Promise<ProbeResult> {
  return new Promise((resolve) => {
    if (typeof URL.createObjectURL !== "function") return resolve({ verdict: "unknown" });

    let settled = false;
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    const done = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timer = setTimeout(() => done({ verdict: "unknown" }), DURATION_PROBE_TIMEOUT_MS);

    probe.preload = "metadata";
    probe.onloadedmetadata = () =>
      done({
        verdict: "playable",
        durationSeconds:
          Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : null,
      });
    probe.onerror = () => done({ verdict: "unplayable" });
    probe.src = url;
  });
}

/**
 * XMLHttpRequest, not fetch, and that is the whole reason this helper exists: fetch cannot
 * report upload progress. Every other upload in this codebase uses it, which is fine for a
 * 200KB CV and wrong for a 500MB recording — seven minutes at 10 Mbps with a dead screen, after
 * which a mentor reasonably concludes the page has hung and closes the tab.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  registerAbort: (abort: () => void) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    registerAbort(() => xhr.abort());
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(uploadPercent(event.loaded, event.total));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`S3 rejected the upload (${xhr.status})`));
    // A dropped connection lands here. A single PUT cannot resume, so a retry starts from the
    // beginning — said plainly rather than leaving the mentor to work it out.
    xhr.onerror = () =>
      reject(new Error("The connection dropped during upload. The whole file has to go again."));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
}

/** Guards the refresh-on-expiry loop below from spinning when the object is simply gone. */
const MAX_URL_REFRESHES = 2;

export function MeetingRecording({
  teamId,
  meetingId,
  meetingTitle,
  meeting,
  isTeamMember = true,
  onChanged,
}: MeetingRecordingProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeAtRef = useRef(0);
  const refreshCountRef = useRef(0);

  const [percent, setPercent] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const [playing, setPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const viewer = { userId: user?.id, role: user?.role, isTeamMember };
  const canUpload = canUploadRecording(viewer);
  const canWatch = canViewRecording(viewer);
  const canRemove = canDeleteRecording(viewer, meeting);
  const present = Boolean(meeting.recordingObjectKey);

  /**
   * Fetched on demand rather than with the meeting list: a signed URL is short-lived, and one
   * minted when the page loaded would already be stale by the time anyone pressed Watch.
   */
  const loadUrl = useCallback(async () => {
    const data = await apiRequest(
      "GET",
      `/api/teams/${teamId}/meetings/${meetingId}/recording/url`
    );
    setVideoUrl(data.url as string);
  }, [teamId, meetingId]);

  useEffect(() => {
    if (!playing) return;
    refreshCountRef.current = 0;
    resumeAtRef.current = 0;
    loadUrl().catch((error: any) => {
      toast({
        title: "Could not open the recording",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setPlaying(false);
    });
  }, [playing, loadUrl, toast]);

  /**
   * A signed URL can run out part-way through a long session — watching 90 minutes, or scrubbing
   * after a pause, can outlive it, and S3 then answers AccessDenied mid-video. Fetch a fresh one
   * and carry on from where it stopped instead of leaving a dead player.
   */
  const handlePlaybackError = () => {
    if (refreshCountRef.current >= MAX_URL_REFRESHES) {
      toast({
        title: "Playback stopped",
        description: "The recording could not be loaded. It may have been removed.",
        variant: "destructive",
      });
      setPlaying(false);
      return;
    }
    refreshCountRef.current += 1;
    resumeAtRef.current = videoRef.current?.currentTime ?? 0;
    loadUrl().catch(() => {
      toast({
        title: "Playback stopped",
        description: "The link expired and could not be renewed. Press Watch again.",
        variant: "destructive",
      });
      setPlaying(false);
    });
  };

  const upload = async (file: File) => {
    const problem = recordingFileError(file.name, file.type, file.size);
    if (problem) {
      toast({ title: "That file cannot be used", description: problem, variant: "destructive" });
      return;
    }

    setPercent(0);
    setStage("Checking the file…");
    try {
      // Asked before a byte is sent. Uploading a file the browser cannot decode wastes the whole
      // transfer and then presents the team with a player that will not start — the failure is
      // identical to a broken feature from where they are sitting.
      const probe = await probePlayability(file);
      if (probe.verdict === "unplayable") {
        toast({
          title: "That video will not play in a browser",
          description:
            "The file is a format this browser cannot decode, so nobody on the team would be able to watch it. Re-export it as MP4 (H.264) or WebM (VP8/VP9) and try again.",
          variant: "destructive",
        });
        return;
      }

      const durationSeconds = probe.verdict === "playable" ? probe.durationSeconds : null;

      const { uploadUrl, objectKey } = await apiRequest(
        "POST",
        `/api/teams/${teamId}/meetings/${meetingId}/recording/upload-url`,
        { fileName: file.name, fileType: file.type, fileSize: file.size }
      );

      setStage(`Uploading ${formatBytes(file.size)}…`);
      await putWithProgress(uploadUrl, file, setPercent, (abort) => {
        abortRef.current = abort;
      });

      setStage("Finishing…");
      await apiRequest("PUT", `/api/teams/${teamId}/meetings/${meetingId}/recording`, {
        objectKey,
        fileName: file.name,
        contentType: file.type,
        durationSeconds,
      });

      toast({
        title: "Recording uploaded",
        description: `Your team can now watch the recording of "${meetingTitle}".`,
      });
      onChanged?.();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      abortRef.current = null;
      setPercent(null);
      setStage("");
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removeMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/teams/${teamId}/meetings/${meetingId}/recording`),
    onSuccess: () => {
      toast({ title: "Recording removed" });
      setConfirmDelete(false);
      setPlaying(false);
      setVideoUrl(null);
      onChanged?.();
    },
    onError: (error: any) => {
      toast({
        title: "Could not remove the recording",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Nothing uploaded and no permission to upload: say so in one line rather than render an
  // empty panel. A learner should be able to tell that there is no recording yet, not wonder
  // whether the page failed to load.
  if (!present && !canUpload) {
    return (
      <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Video className="h-3.5 w-3.5" />
        No recording uploaded for this session yet
      </p>
    );
  }

  const uploading = percent !== null;
  const details = [formatDuration(meeting.recordingDurationSeconds), formatBytes(meeting.recordingSizeBytes)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Video
            className={`h-4 w-4 shrink-0 ${present ? "text-primary" : "text-muted-foreground"}`}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {present ? "Session recording" : "No session recording"}
            </p>
            {present && (
              <p className="truncate text-xs text-muted-foreground">
                {details}
                {meeting.recordingUploadedAt && (
                  <> · uploaded {format(new Date(meeting.recordingUploadedAt), "d MMM yyyy")}</>
                )}
              </p>
            )}
          </div>
        </div>

        {!uploading && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {present && canWatch && (
              <Button
                size="sm"
                variant={playing ? "secondary" : "default"}
                onClick={() => setPlaying((p) => !p)}
              >
                <Play className="mr-1 h-4 w-4" />
                {playing ? "Hide" : "Watch"}
              </Button>
            )}
            {canUpload && (
              <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload className="mr-1 h-4 w-4" />
                {present ? "Replace" : "Upload recording"}
              </Button>
            )}
            {present && canRemove && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                aria-label="Remove recording"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {canUpload && !present && !uploading && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            MP4 or WebM, up to {formatBytes(RECORDING_MAX_BYTES)}. Other formats upload but will
            not play in a browser. Recording at 720p keeps an hour under about 500&nbsp;MB.
          </span>
        </p>
      )}

      {uploading && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{stage}</span>
            <span className="font-medium tabular-nums">{percent}%</span>
          </div>
          <Progress value={percent ?? 0} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Keep this tab open until it finishes — the upload cannot resume.
            </p>
            <Button size="sm" variant="ghost" onClick={() => abortRef.current?.()}>
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {playing && (
        <div className="mt-3">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              controlsList="nodownload"
              className="max-h-[70vh] w-full rounded-lg bg-black"
              onError={handlePlaybackError}
              // Restore the position a renewed URL should resume from, once the new source has
              // enough metadata to seek.
              onLoadedMetadata={() => {
                if (resumeAtRef.current > 0 && videoRef.current) {
                  videoRef.current.currentTime = resumeAtRef.current;
                  resumeAtRef.current = 0;
                }
              }}
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
              Opening recording…
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        accept={RECORDING_CONTENT_TYPES.join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this recording?</AlertDialogTitle>
            <AlertDialogDescription>
              The video file is deleted permanently and cannot be recovered. Your team will no
              longer be able to watch the session &ldquo;{meetingTitle}&rdquo;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Removing…" : "Remove recording"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
