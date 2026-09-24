import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ObjectUploader } from "@/components/ObjectUploader";
import { FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { TrackSelect } from "@/components/TrackSelect";

type InitialData = {
  id?: string;
  title?: string;
  overview?: string;
  track?: string;
  fileKeys?: string[];
};

export function ProblemStatementForm({ 
  initialData, 
  onSaved,
  isAdminDashboard = false 
}: { 
  initialData?: InitialData | null; 
  onSaved?: () => void;
  isAdminDashboard?: boolean;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const allowedRoles = ["ADMIN", "FOUNDER", "MENTOR"];
  const allowedToSubmit = !!user && allowedRoles.includes((user as any).role);
  const isFounderOrCofounder = !!user && ((user as any).role === "FOUNDER" || (user as any).role === "COFOUNDER");
  const isAdmin = !!user && ((user as any).role === "ADMIN");
  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [track, setTrack] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileKeysRef = useRef<string[]>([]);
  const hasInitializedFromUser = useRef(false);

  // Populate when switching between "edit existing" and "new" problem statement
  useEffect(() => {
    if (initialData) {
      // Editing an existing problem statement
      setTitle(initialData.title || "");
      setOverview(initialData.overview || "");
      setTrack(initialData.track || "");
      fileKeysRef.current = initialData.fileKeys || [];
      setUploadedFiles((initialData.fileKeys || []).map((k) => k));
      setPublishImmediately(false);
      setIsPublishing(false);
      hasInitializedFromUser.current = true;
    } else {
      // Brand‑new form instance (key change in parent)
      setTitle("");
      setOverview("");
      setTrack("");
      setUploadedFiles([]);
      fileKeysRef.current = [];
      setPublishImmediately(false);
      setIsPublishing(false);
      hasInitializedFromUser.current = false;
    }
  }, [initialData]);

  // Prefill track once for new forms from user's preferredTrack (without wiping on auth refresh)
  useEffect(() => {
    if (!initialData && !hasInitializedFromUser.current) {
      const userPreferredTrack = (user as any)?.preferredTrack;
      // Only mark as initialized once user data is actually available.
      // If user is still null/loading, skip and wait for the next run.
      if (user) {
        if (!track && userPreferredTrack) {
          setTrack(userPreferredTrack);
        }
        hasInitializedFromUser.current = true;
      }
    }
  }, [initialData, user]); // intentionally excludes `track` — re-running on track change would overwrite user edits

  const submitMutation = useMutation({
    mutationFn: async (data: { title: string; overview: string; track: string; fileKeys: string[]; publish?: boolean }) => {
      if (initialData && initialData.id) {
        return await apiRequest("PUT", `/api/problem-statements/${initialData.id}`, data);
      }
      return await apiRequest("POST", "/api/problem-statements", data);
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: variables.publish 
          ? "Problem statement uploaded and published successfully" 
          : "Problem statement submitted for review",
      });
      // Reset form
      setTitle("");
      setOverview("");
      setTrack("");
      setUploadedFiles([]);
      setPublishImmediately(false);
      setIsPublishing(false);
      fileKeysRef.current = [];
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements"] });
      if (onSaved) onSaved();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit problem statement",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowedToSubmit) {
      toast({
        title: "Forbidden",
        description: "Only founders, co-founders, and mentors can submit problem statements",
        variant: "destructive",
      });
      return;
    }
    if (!title || !overview || !track) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Require supporting documents for founders and co-founders
    if (isFounderOrCofounder && fileKeysRef.current.length === 0) {
      toast({
        title: "Validation Error",
        description: "Supporting documents are required for founders and co-founders",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate({
      title,
      overview,
      track,
      fileKeys: fileKeysRef.current,
      publish: isAdmin && (publishImmediately || isPublishing),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isAdmin ? "Upload Problem Statement" : "Submit Problem Statement"}</CardTitle>
        <CardDescription>
          {isAdmin 
            ? "Upload and optionally publish a problem statement"
            : "Share a problem statement that you'd like mentors to help with"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a clear, concise title"
              required
              data-tour="ps-title-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="overview">Overview *</Label>
            <Textarea
              id="overview"
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              placeholder="Describe the problem, context, and what you're looking for..."
              rows={6}
              required
              data-tour="ps-overview-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="track">Track *</Label>
            <TrackSelect
              id="track"
              data-tour="ps-track-select"
              value={track}
              onChange={setTrack}
            />
            {user?.role === "ADMIN" && (
              <p className="text-xs text-muted-foreground">
                Not in the list? Type the industry and choose “Add” to create it.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Supporting Documents
              {isFounderOrCofounder && <span className="text-black ml-1">*</span>}
              {!isFounderOrCofounder && <span className="text-muted-foreground ml-1">(Optional)</span>}
            </Label>
            <p className="text-sm text-muted-foreground">
              Upload any relevant documents, diagrams, or research (PDF, images, videos)
            </p>
            <ObjectUploader
              acceptedTypes="application/pdf,image/*,video/*,.doc,.docx"
              onGetUploadParameters={async (file) => {
                const res = await apiRequest("POST", "/api/problem-statements/files/upload-url", {
                  fileName: file.name,
                  fileType: file.type,
                });
                return { method: "PUT", url: res.uploadURL, objectKey: res.objectKey };
              }}
              getViewUrlEndpoint="/api/problem-statements/files/view-url"
              onComplete={(fileUrl, objectKey, fileName) => {
                if (objectKey) {
                  fileKeysRef.current.push(objectKey);
                  setUploadedFiles((prev) => [...prev, fileName || objectKey]);
                }
              }}
            >
              <Button type="button" variant="outline" className="w-full" data-tour="ps-upload-btn">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </ObjectUploader>
            {uploadedFiles.length > 0 ? (
              <div className="mt-2 space-y-1">
                {uploadedFiles.map((fileName, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    {fileName}
                  </div>
                ))}
              </div>
            ) : isFounderOrCofounder ? (
              <p className="text-sm text-red-600 mt-1">At least one supporting document is required</p>
            ) : null}
          </div>

          {isAdmin && isAdminDashboard ? (
            // Admin Dashboard: Show two separate buttons
            <div className="flex gap-3">
              <Button 
                type="button"
                variant="outline"
                className="flex-1" 
                disabled={!allowedToSubmit || submitMutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  setIsPublishing(false);
                  handleSubmit(e);
                }}
              >
                {submitMutation.isPending && !isPublishing
                  ? "Uploading..." 
                  : "Upload"}
              </Button>
              <Button 
                type="button"
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border-0 shadow-lg shadow-red-500/30" 
                disabled={!allowedToSubmit || submitMutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  setIsPublishing(true);
                  handleSubmit(e);
                }}
              >
                {submitMutation.isPending && isPublishing
                  ? "Publishing..." 
                  : "Publish"}
              </Button>
            </div>
          ) : isAdmin && !isAdminDashboard ? (
            // Admin in regular page: Show checkbox
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="publish-immediately"
                  checked={publishImmediately}
                  onCheckedChange={(checked) => setPublishImmediately(checked === true)}
                />
                <Label
                  htmlFor="publish-immediately"
                  className="text-sm font-normal cursor-pointer"
                >
                  Publish immediately
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={!allowedToSubmit || submitMutation.isPending}>
                {submitMutation.isPending 
                  ? (initialData && initialData.id ? "Updating..." : "Uploading...") 
                  : (initialData && initialData.id 
                      ? "Update" 
                      : "Upload Problem Statement")}
              </Button>
            </>
          ) : (
            // Non-admin: Regular submit button
            <Button type="submit" className="w-full" disabled={!allowedToSubmit || submitMutation.isPending} data-tour="ps-submit-btn">
              {submitMutation.isPending 
                ? (initialData && initialData.id ? "Updating..." : "Submitting...") 
                : (initialData && initialData.id ? "Update" : "Submit for Review")}
            </Button>
          )}
          {user && !allowedToSubmit && (
            <p className="text-sm text-destructive mt-2">Only admins, founders, and mentors can submit problem statements.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
