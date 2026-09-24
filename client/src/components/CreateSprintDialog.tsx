import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { File, Loader2, Paperclip, X } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import { apiRequest } from "@/lib/queryClient";

export interface CreateSprintValues {
  name: string;
  startDate: string;
  endDate: string;
  goals: string;
  objectives: string;
  deliverables: string;
}

export const emptySprintValues: CreateSprintValues = {
  name: "",
  startDate: "",
  endDate: "",
  goals: "",
  objectives: "",
  deliverables: "",
};

/**
 * A file staged in the Create Sprint dialog before the sprint exists. The
 * bytes are already in object storage (via the same generic upload endpoint
 * Evidence/Demo use) by the time this is created — only the sprint-side
 * record is still pending, since there's no sprint id to attach it to until
 * "Create Sprint" is submitted.
 */
export interface PendingSprintResource {
  fileName: string;
  objectKey: string;
  contentType?: string;
  fileSize?: number;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Name and both dates are required; the three prose fields are optional. */
export function canSubmitSprint(values: CreateSprintValues): boolean {
  return Boolean(values.name.trim() && values.startDate && values.endDate);
}

/**
 * Create Sprint, with the same fields the Edit Sprint dialog has.
 *
 * Objectives and Deliverables used to be missing here, so a sprint could only get them by
 * being created and then immediately reopened in Edit — the server has always accepted both
 * on `POST /api/teams/:teamId/sprints`, it was only the form that never sent them.
 *
 * One component rather than markup repeated per render branch: the sprint board renders a
 * create dialog both in its no-active-sprint state and on the board itself, and those two
 * copies had already drifted to differing element ids. A change made to one of them and not
 * the other is the failure this prevents.
 *
 * Sprint Number is deliberately absent. The server assigns it (`index`), unlike Edit where it
 * can be corrected by hand.
 */
export function CreateSprintDialog({
  open,
  onOpenChange,
  values,
  onChange,
  onSubmit,
  isPending = false,
  idPrefix = "sprint",
  resources = [],
  onResourcesChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: CreateSprintValues;
  onChange: (values: CreateSprintValues) => void;
  onSubmit: () => void;
  isPending?: boolean;
  /** Keeps input ids unique if two of these are ever mounted at once. */
  idPrefix?: string;
  /** Files staged for upload; attached to the sprint once it's created. */
  resources?: PendingSprintResource[];
  onResourcesChange?: (resources: PendingSprintResource[]) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const set = <K extends keyof CreateSprintValues>(key: K, value: CreateSprintValues[K]) =>
    onChange({ ...values, [key]: value });
  const id = (suffix: string) => `${idPrefix}-${suffix}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Six fields including three textareas: the body scrolls and the footer stays put,
          rather than the Create button being pushed off a short viewport. */}
      <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-6">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>Create New Sprint</DialogTitle>
          <DialogDescription>Add a new sprint for your team</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div>
            <Label htmlFor={id("name")}>Sprint Name *</Label>
            <Input
              id={id("name")}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Research & problem framing"
              maxLength={120}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Shown as the sprint heading. Keep it short — put the detail in Goals below.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor={id("start")}>Start Date *</Label>
              <Input
                id={id("start")}
                type="date"
                min={today}
                value={values.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={id("end")}>End Date *</Label>
              <Input
                id={id("end")}
                type="date"
                min={values.startDate || today}
                value={values.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor={id("goals")}>Sprint Goals (Optional)</Label>
            <Textarea
              id={id("goals")}
              value={values.goals}
              onChange={(e) => set("goals", e.target.value)}
              placeholder="What should be achieved in this sprint?"
              className="min-h-[90px]"
            />
          </div>

          <div>
            <Label htmlFor={id("objectives")}>Objectives (Optional)</Label>
            <Textarea
              id={id("objectives")}
              value={values.objectives}
              onChange={(e) => set("objectives", e.target.value)}
              placeholder="Specific measurable objectives..."
              className="min-h-[90px]"
            />
          </div>

          <div>
            <Label htmlFor={id("deliverables")}>Deliverables (Optional)</Label>
            <Textarea
              id={id("deliverables")}
              value={values.deliverables}
              onChange={(e) => set("deliverables", e.target.value)}
              placeholder="Expected outputs and deliverables..."
              className="min-h-[90px]"
            />
          </div>

          <div>
            <Label>Resources (Optional)</Label>
            <p className="mt-1 mb-2 text-xs text-muted-foreground">
              Attach docs, decks, datasets, or any other file the team should have for this
              sprint. Uploaded now or later from the sprint's Resources tab.
            </p>

            {resources.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {resources.map((file, idx) => (
                  <li
                    key={`${file.objectKey}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-sm"
                    data-testid={`pending-resource-${idx}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{file.fileName}</span>
                      {file.fileSize ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatFileSize(file.fileSize)}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() =>
                        onResourcesChange?.(resources.filter((_, i) => i !== idx))
                      }
                      data-testid={`button-remove-pending-resource-${idx}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <ObjectUploader
              acceptedTypes=""
              title="Upload Resource"
              fileTypeLabel="file"
              maxFileSize={104857600}
              onGetUploadParameters={async () => {
                const resp = await apiRequest("POST", "/api/objects/upload", {});
                return { method: "PUT" as const, url: resp.uploadURL, objectKey: resp.objectKey };
              }}
              getViewUrlEndpoint="/api/objects/view-url"
              onComplete={(_fileUrl, objectKey, fileName, fileSize, contentType) => {
                if (!objectKey || !fileName) return;
                onResourcesChange?.([
                  ...resources,
                  { fileName, objectKey, fileSize, contentType },
                ]);
              }}
            >
              <Button
                type="button"
                variant="outline"
                className="w-full"
                data-testid={id("upload-resource")}
              >
                <Paperclip className="mr-2 h-4 w-4" />
                Upload Resource
              </Button>
            </ObjectUploader>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmitSprint(values) || isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-create-sprint-submit"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Sprint"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSprintDialog;
