import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Briefcase,
  MapPin,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";

interface JobPosting {
  id: string;
  title: string;
  description: string;
  aboutTheRole?: string;
  whatYouWillDo?: string;
  whatMightBeAFitIf?: string;
  niceToHave?: string;
  location: string;
  jobType: "ONSITE" | "OFFLINE" | "HYBRID";
  experienceRequired?: string;
  areaOfInterest?: string[];
  requiredSkills?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const PREFERRED_INDUSTRIES = [
  "Healthcare / HealthTech",
  "Finance / FinTech",
  "Education / EdTech",
  "Technology / IT",
  "Manufacturing",
  "Retail / E-commerce",
  "Real Estate / PropTech",
  "Agriculture / AgriTech",
  "Energy / CleanTech",
  "Transportation / Logistics",
  "Media & Entertainment",
  "Government / GovTech",
  "Food & Beverage",
  "Travel & Hospitality",
  "Telecommunications",
  "Automotive",
  "Aerospace & Defense",
  "Construction",
  "Pharmaceuticals",
  "Consulting",
];

const JOB_TYPES = [
  { value: "ONSITE", label: "Onsite" },
  { value: "OFFLINE", label: "Offline" },
  { value: "HYBRID", label: "Hybrid" },
];

export default function AdminJobPostingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [formData, setFormData] = useState<Partial<JobPosting>>({
    title: "",
    description: "",
    aboutTheRole: "",
    whatYouWillDo: "",
    whatMightBeAFitIf: "",
    niceToHave: "",
    location: "Bangalore",
    jobType: "HYBRID",
    experienceRequired: "",
    areaOfInterest: [],
    requiredSkills: [],
    isActive: true,
  });

  const { data: jobPostings = [], isLoading, refetch } = useQuery<JobPosting[]>({
    queryKey: ["/api/admin/job-postings"],
    queryFn: async () => {
      return apiRequest("GET", "/admin/job-postings");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<JobPosting>) => {
      return apiRequest("POST", "/admin/job-postings", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Job posting created successfully",
      });
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create job posting",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<JobPosting> }) => {
      return apiRequest("PUT", `/admin/job-postings/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Job posting updated successfully",
      });
      setEditingJob(null);
      resetForm();
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job posting",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/admin/job-postings/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Job posting deleted successfully",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete job posting",
        variant: "destructive",
      });
    },
  });

  const [togglingJobId, setTogglingJobId] = useState<string | null>(null);

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      setTogglingJobId(id);
      return apiRequest("PUT", `/api/admin/job-postings/${id}`, { isActive });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `Job posting marked as ${variables.isActive ? "active" : "inactive"}`,
      });
      setTogglingJobId(null);
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job posting status",
        variant: "destructive",
      });
      setTogglingJobId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      aboutTheRole: "",
      whatYouWillDo: "",
      whatMightBeAFitIf: "",
      niceToHave: "",
      location: "Bangalore",
      jobType: "HYBRID",
      experienceRequired: "",
      areaOfInterest: [],
      requiredSkills: [],
      isActive: true,
    });
  };

  const handleEdit = (job: JobPosting) => {
    setEditingJob(job);
    setFormData({
      title: job.title,
      description: job.description,
      aboutTheRole: job.aboutTheRole || "",
      whatYouWillDo: job.whatYouWillDo || "",
      whatMightBeAFitIf: job.whatMightBeAFitIf || "",
      niceToHave: job.niceToHave || "",
      location: job.location,
      jobType: job.jobType,
      experienceRequired: job.experienceRequired || "",
      areaOfInterest: job.areaOfInterest || [],
      requiredSkills: job.requiredSkills || [],
      isActive: job.isActive,
    });
    setShowCreateDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.description) {
      toast({
        title: "Validation Error",
        description: "Title and description are required",
        variant: "destructive",
      });
      return;
    }

    if (editingJob) {
      updateMutation.mutate({ id: editingJob.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleAreaOfInterest = (area: string) => {
    setFormData((prev) => ({
      ...prev,
      areaOfInterest: prev.areaOfInterest?.includes(area)
        ? prev.areaOfInterest.filter((a) => a !== area)
        : [...(prev.areaOfInterest || []), area],
    }));
  };

  const handleSkillsChange = (value: string) => {
    const skills = value.split(",").map((s) => s.trim()).filter(Boolean);
    setFormData((prev) => ({ ...prev, requiredSkills: skills }));
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Job Postings</h1>
            <p className="text-muted-foreground mt-1">Manage mentor and other job postings</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setEditingJob(null);
              setShowCreateDialog(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Job Posting
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : jobPostings.length === 0 ? (
          <Card className="bg-white border-border">
            <CardContent className="p-12 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No job postings found. Create your first one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobPostings.map((job) => (
              <Card key={job.id} className="bg-white border-border hover:border-primary/50 transition-colors">
                <CardHeader className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg text-foreground pr-2">{job.title}</CardTitle>
                      <CardDescription className="mt-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{job.location}</span>
                          <Clock className="h-4 w-4 ml-2" />
                          <span>
                            {job.jobType === "ONSITE" ? "Onsite" : job.jobType === "OFFLINE" ? "Offline" : "Hybrid"}
                          </span>
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {togglingJobId === job.id ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          checked={job.isActive}
                          onCheckedChange={(checked) => {
                            toggleActiveMutation.mutate({ id: job.id, isActive: checked });
                          }}
                          disabled={togglingJobId !== null}
                          className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-muted-foreground/30"
                        />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{job.description}</p>
                  {job.areaOfInterest && job.areaOfInterest.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-1">Preferred Industries:</p>
                      <div className="flex flex-wrap gap-1">
                        {job.areaOfInterest.slice(0, 3).map((industry) => (
                          <Badge key={industry} variant="outline" className="text-xs border-border">
                            {industry}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(job)}
                      className="flex-1 border-border text-foreground hover:bg-red-50"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this job posting?")) {
                          deleteMutation.mutate(job.id);
                        }
                      }}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Created: {format(new Date(job.createdAt), "MMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-foreground">
                {editingJob ? "Edit Job Posting" : "Create Job Posting"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingJob ? "Update the job posting details" : "Fill in all the details to create a new job posting"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Information */}
              <div className="space-y-4 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-foreground">Basic Information</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-foreground">Job Title / Role *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Mentor - AI/ML"
                      className="bg-white border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground">Location *</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="Bangalore"
                      className="bg-white border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground">Job Type *</Label>
                    <Select
                      value={formData.jobType}
                      onValueChange={(value: "ONSITE" | "OFFLINE" | "HYBRID") =>
                        setFormData((prev) => ({ ...prev, jobType: value }))
                      }
                    >
                      <SelectTrigger className="bg-white border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-foreground">Experience Required</Label>
                    <Input
                      value={formData.experienceRequired}
                      onChange={(e) => setFormData((prev) => ({ ...prev, experienceRequired: e.target.value }))}
                      placeholder="e.g., 5-10 years"
                      className="bg-white border-border"
                    />
                  </div>
                </div>
              </div>

              {/* About the Role */}
              <div className="space-y-4 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-foreground">About the Role</h3>
                <div>
                  <Label className="text-foreground">About the Role *</Label>
                  <Textarea
                    value={formData.aboutTheRole}
                    onChange={(e) => setFormData((prev) => ({ ...prev, aboutTheRole: e.target.value }))}
                    placeholder="Describe the role, its purpose, and what makes it unique..."
                    rows={4}
                    className="bg-white border-border"
                  />
                </div>
              </div>

              {/* What You Will Do */}
              <div className="space-y-4 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-foreground">What You Will Do</h3>
                <div>
                  <Label className="text-foreground">Responsibilities & Activities *</Label>
                  <Textarea
                    value={formData.whatYouWillDo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, whatYouWillDo: e.target.value }))}
                    placeholder="List the key responsibilities, activities, and tasks for this role..."
                    rows={5}
                    className="bg-white border-border"
                  />
                </div>
              </div>

              {/* What Might Be A Fit If */}
              <div className="space-y-4 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-foreground">Requirements</h3>
                <div>
                  <Label className="text-foreground">What Might Be A Fit If (Requirements) *</Label>
                  <Textarea
                    value={formData.whatMightBeAFitIf}
                    onChange={(e) => setFormData((prev) => ({ ...prev, whatMightBeAFitIf: e.target.value }))}
                    placeholder="Describe the qualifications, experience, and skills required for this role..."
                    rows={5}
                    className="bg-white border-border"
                  />
                </div>
              </div>

              {/* Nice to Have */}
              <div className="space-y-4 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-foreground">Nice to Have</h3>
                <div>
                  <Label className="text-foreground">Nice to Have (Optional)</Label>
                  <Textarea
                    value={formData.niceToHave}
                    onChange={(e) => setFormData((prev) => ({ ...prev, niceToHave: e.target.value }))}
                    placeholder="List any additional skills, experiences, or qualifications that would be beneficial but not required..."
                    rows={4}
                    className="bg-white border-border"
                  />
                </div>
              </div>

              {/* Description (About) */}
              <div className="space-y-4 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-foreground">About / Description</h3>
                <div>
                  <Label className="text-foreground">Full Description *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Provide a comprehensive description of the role, company culture, benefits, and any other relevant information..."
                    rows={6}
                    className="bg-white border-border"
                  />
                </div>
              </div>

              {/* Preferred Industries */}
              <div className="space-y-4 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-foreground">Preferred Industries</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {PREFERRED_INDUSTRIES.map((industry) => (
                    <div key={industry} className="flex items-center space-x-2">
                      <Checkbox
                        id={`industry-${industry}`}
                        checked={formData.areaOfInterest?.includes(industry) || false}
                        onCheckedChange={() => toggleAreaOfInterest(industry)}
                        className="border-border data-[state=checked]:bg-primary"
                      />
                      <label
                        htmlFor={`industry-${industry}`}
                        className="text-sm text-foreground cursor-pointer flex-1"
                      >
                        {industry}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required Skills */}
              <div className="space-y-4 border-b border-border pb-4">
                <h3 className="text-lg font-bold text-foreground">Required Skills</h3>
                <div>
                  <Label className="text-foreground">Skills (comma-separated)</Label>
                  <Input
                    value={formData.requiredSkills?.join(", ") || ""}
                    onChange={(e) => handleSkillsChange(e.target.value)}
                    placeholder="e.g., React, Node.js, AWS, Docker"
                    className="bg-white border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Separate multiple skills with commas</p>
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked as boolean }))
                  }
                  className="border-border data-[state=checked]:bg-primary"
                />
                <label htmlFor="isActive" className="text-sm text-foreground cursor-pointer">
                  Active (visible on careers page)
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                  setEditingJob(null);
                }}
                className="border-border"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingJob ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  editingJob ? "Update Job Posting" : "Create Job Posting"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

