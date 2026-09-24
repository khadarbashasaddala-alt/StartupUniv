import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import {
  Loader2,
  Upload,
  FileText,
  X,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Popular email domains for validation
const popularDomains = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "mail.com",
  "yandex.com",
  "startupvarsity.com",
  "rooman.com",
  "rooman.net",
];

// Email regex: STRICT — only allow the popularDomains exactly (whitelist)
const emailRe = new RegExp(
  `^[A-Za-z0-9._%+-]+@(?:${popularDomains.map((d) => d.replace(/\./g, "\\.")).join("|")})$`
);

// Country code options and phone digit rules
const countryCodeOptions: Array<{ code: string; minDigits: number; maxDigits?: number }> = [
  { code: "+1", minDigits: 10, maxDigits: 10 },
  { code: "+44", minDigits: 10, maxDigits: 10 },
  { code: "+91", minDigits: 10, maxDigits: 10 },
  { code: "+61", minDigits: 9, maxDigits: 9 },
  { code: "+49", minDigits: 10, maxDigits: 11 },
  { code: "+33", minDigits: 9, maxDigits: 9 },
  { code: "+65", minDigits: 8, maxDigits: 8 },
  { code: "+971", minDigits: 9, maxDigits: 9 },
];

// Phone validation helper
function validatePhone(localNumber: string, countryCode: string) {
  const digits = (localNumber || "").replace(/\D/g, "");
  const opt = countryCodeOptions.find((c) => c.code === countryCode);
  if (!opt) return false;
  const min = opt.minDigits;
  const max = opt.maxDigits ?? opt.minDigits;
  const re = new RegExp(`^\\d{${min},${max}}$`);
  return re.test(digits);
}

const mentorApplicationSchema = z.object({
  // Personal Details
  fullName: z.string().min(2, "Full name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  countryCode: z.string().min(1, "Country code is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  email: z.string().refine((email) => emailRe.test(email.trim()), {
    message: "Please use a valid email from supported domains (Gmail, Yahoo, Outlook, etc.)"
  }),
  currentLocation: z.string().min(1, "Current location is required"),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  githubUrl: z.string().url().optional().or(z.literal("")),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
  
  // Educational Background
  highestQualification: z.string().min(1, "Highest qualification is required"),
  institutionName: z.string().min(1, "Institution name is required"),
  yearOfCompletion: z.string().min(1, "Year of completion is required"),
  specialization: z.string().optional(),
  
  // Professional Experience
  totalExperience: z.string().min(1, "Total experience is required"),
  currentCompany: z.string().optional(),
  jobTitle: z.string().optional(),
  keySkills: z.string().min(1, "Key skills are required"),
  
  // Domains
  domains: z.array(z.string()).min(1, "Select at least 1 track").max(5, "Select at most 5 tracks"),
  otherDomain: z.string().optional(),
  
  // Mentorship Experience
  previousMentoringRoles: z.string().optional(),
  batchStudentsGuided: z.string().optional(),
  certificationsRewards: z.string().optional(),
  
  // Motivation
  motivation: z.string().min(50, "Please provide at least 50 characters"),
  
  // Availability
  weeklyAvailableHours: z.string().min(1, "Weekly available hours is required"),
  preferredMode: z.string().min(1, "Preferred mode is required"),
  earliestJoiningDate: z.string().min(1, "Earliest joining date is required"),
  
  // Compliance
  followGuidelines: z.boolean().refine((val) => val === true, "You must agree to follow guidelines"),
  assistAssessments: z.boolean().refine((val) => val === true, "You must agree to assist in assessments"),
  participateReviews: z.boolean().refine((val) => val === true, "You must agree to participate in reviews"),
  
  // Signature
  signatureName: z.string().min(1, "Signature name is required"),
  signatureDate: z.string().min(1, "Signature date is required"),

  acceptTerms: z.boolean().refine((v) => v === true, { message: "You must accept the Terms and Conditions." }),
}).refine((data) => validatePhone(data.contactNumber, data.countryCode), {
  message: "Invalid phone number for selected country code",
  path: ["contactNumber"],
});

type MentorApplicationForm = z.infer<typeof mentorApplicationSchema>;

interface MentorApplicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobPosting: {
    id: string;
    title: string;
  };
}

const AREAS_OF_INTEREST = [
  "SaaS B2B",
  "AI",
  "FinTech",
  "HealthTech",
  "BioTech",
  "EdTech",
  "Consumer",
  "E-Commerce",
  "Logistics",
  "PropTech",
  "AgriTech",
  "Climate",
  "Industrial",
  "Media",
  "GovTech",
];

export function MentorApplicationModal({
  open,
  onOpenChange,
  jobPosting,
}: MentorApplicationModalProps) {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<{
    resume?: string;
    resumeObjectKey?: string; // Store S3 object key for resume
    certificates?: Array<{ url: string; objectKey: string; fileName: string }>; // Store certificates with S3 keys
    portfolio?: string;
    idProof?: { url: string; objectKey: string; fileName: string }; // Store ID proof with S3 key
  }>({});

  const form = useForm<MentorApplicationForm>({
    resolver: zodResolver(mentorApplicationSchema),
    defaultValues: {
      fullName: "",
      dateOfBirth: "",
      gender: "",
      countryCode: "+91",
      contactNumber: "",
      email: "",
      currentLocation: "",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: "",
      highestQualification: "",
      institutionName: "",
      yearOfCompletion: "",
      specialization: "",
      totalExperience: "",
      currentCompany: "",
      jobTitle: "",
      keySkills: "",
      domains: [],
      otherDomain: "",
      previousMentoringRoles: "",
      batchStudentsGuided: "",
      certificationsRewards: "",
      motivation: "",
      weeklyAvailableHours: "",
      preferredMode: "",
      earliestJoiningDate: "",
      followGuidelines: false,
      assistAssessments: false,
      participateReviews: false,
      signatureName: "",
      signatureDate: new Date().toISOString().split("T")[0],
      acceptTerms: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: MentorApplicationForm) => {
      const formData = {
        jobPostingId: jobPosting.id,
        formData: {
          ...data,
          attachments: uploadedFiles,
        },
      };
      return apiRequest("POST", "/api/careers/apply", formData);
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted!",
        description: "Your mentor application has been submitted successfully. We'll review it and get back to you soon.",
      });
      form.reset();
      setUploadedFiles({});
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: MentorApplicationForm) => {
    // clear manual errors
    form.clearErrors();

    const phoneWithCode = `${data.countryCode} ${data.contactNumber}`;

    try {
      const normalizedEmail = String(data.email || "").trim().toLowerCase();
      const normalizedPhoneDigits = (phoneWithCode || "").replace(/\D/g, "");
      const dup = await apiRequest("POST", "/api/applications/validate-contact", {
        email: normalizedEmail,
        phone: normalizedPhoneDigits,
      });

      if (dup?.emailExists) {
        form.setError("email", { type: "manual", message: "An application with this email already exists for this role. Please use a different email." });
        return;
      }
      if (dup?.phoneExists) {
        form.setError("contactNumber", { type: "manual", message: "An application with this phone number already exists for this role. Please use a different phone number." });
        return;
      }
    } catch (e) {
      console.warn("Contact validation failed (mentor), continuing with submission:", e);
      // proceed with submission if validation endpoint fails
    }

    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Mentor Application - {jobPosting.title}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Please fill out all the required fields to apply for this mentor position.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            {/* 1. Personal Details */}
            <div className="space-y-4 border-b border-[#E3D9CC] pb-6">
              <h3 className="text-lg font-bold text-gray-900">1️⃣ Personal Details</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Full Name *</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Date of Birth *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Gender *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white border-[#E3D9CC]">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <FormField
                    control={form.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900">Code *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white border-[#E3D9CC]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="+1">🇺🇸 +1</SelectItem>
                            <SelectItem value="+44">🇬🇧 +44</SelectItem>
                            <SelectItem value="+91">🇮🇳 +91</SelectItem>
                            <SelectItem value="+61">🇦🇺 +61</SelectItem>
                            <SelectItem value="+49">🇩🇪 +49</SelectItem>
                            <SelectItem value="+33">🇫🇷 +33</SelectItem>
                            <SelectItem value="+65">🇸🇬 +65</SelectItem>
                            <SelectItem value="+971">🇦🇪 +971</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactNumber"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-gray-900">Contact Number *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="10 digits" className="bg-white border-[#E3D9CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Email ID *</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currentLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Current Location *</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">LinkedIn (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://linkedin.com/in/..." className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="githubUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">GitHub (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://github.com/..." className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="portfolioUrl"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-gray-900">Portfolio URL (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://yourportfolio.com" className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 2. Educational Background */}
            <div className="space-y-4 border-b border-[#E3D9CC] pb-6">
              <h3 className="text-lg font-bold text-gray-900">2️⃣ Educational Background</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="highestQualification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Highest Qualification *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., B.Tech, M.Tech, Ph.D." className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="institutionName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Institution Name *</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="yearOfCompletion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Year of Completion *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 2020" className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specialization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Specialization/Branch</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Computer Science" className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 3. Professional Experience */}
            <div className="space-y-4 border-b border-[#E3D9CC] pb-6">
              <h3 className="text-lg font-bold text-gray-900">3️⃣ Professional Experience</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-900 mb-2 block">Resume *</Label>
                  <ObjectUploader
                    acceptedTypes=".pdf,.doc,.docx,application/pdf"
                    maxFileSize={10 * 1024 * 1024}
                    onGetUploadParameters={async (file) => {
                      const response = await apiRequest("POST", "/api/applications/cv/upload-url", {
                        fileName: file.name,
                        fileType: file.type,
                      });
                      // Handle both uploadURL and uploadUrl (API returns uploadUrl)
                      const uploadUrl = response.uploadURL || response.uploadUrl;
                      if (!uploadUrl) {
                        throw new Error("No upload URL received from server");
                      }
                      return {
                        method: "PUT" as const,
                        url: uploadUrl,
                        objectKey: response.objectKey,
                      };
                    }}
                    onComplete={(fileUrl, objectKey) => {
                      if (!fileUrl) {
                        console.error("No file URL received from upload");
                        return;
                      }
                      setUploadedFiles((prev) => ({ 
                        ...prev, 
                        resume: fileUrl,
                        resumeObjectKey: objectKey || undefined,
                      }));
                    }}
                    title="Upload Resume"
                    description="Upload your resume (PDF, DOC, or DOCX, max 10MB)"
                  >
                    <Button type="button" variant="outline" className="border-[#E3D9CC]">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Resume
                    </Button>
                  </ObjectUploader>
                  {uploadedFiles.resume && (
                    <p className="text-sm text-green-600 mt-2">✓ Resume uploaded</p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="totalExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900">Total Experience *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 5 years" className="bg-white border-[#E3D9CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currentCompany"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900">Current/Last Company</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-white border-[#E3D9CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900">Job Title/Role</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-white border-[#E3D9CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="keySkills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Key Skills & Expertise *</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="List your key skills" className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 4. Domains */}
            <div className="space-y-4 border-b border-[#E3D9CC] pb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">4️⃣ Select 1 to 5 tracks that interest you *</h3>
                <p className="text-sm text-gray-600 mt-1">You can select between 1 and 5 tracks</p>
              </div>
              <FormField
                control={form.control}
                name="domains"
                render={() => (
                  <FormItem>
                    <div className="grid gap-3 md:grid-cols-2">
                      {AREAS_OF_INTEREST.map((area) => (
                        <FormField
                          key={area}
                          control={form.control}
                          name="domains"
                          render={({ field }) => {
                            return (
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(area)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        // Limit to 5 selections
                                        if (field.value && field.value.length >= 5) {
                                          toast({
                                            title: "Maximum selections reached",
                                            description: "You can select up to 5 tracks only",
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        field.onChange([...field.value, area]);
                                      } else {
                                        field.onChange(
                                          field.value?.filter((value) => value !== area)
                                        );
                                      }
                                    }}
                                    className="border-[#E3D9CC] data-[state=checked]:bg-red-600"
                                  />
                                </FormControl>
                                <FormLabel className="text-gray-900 font-normal cursor-pointer">
                                  {area}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="otherDomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-900">Other domains:</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Specify other domains" className="bg-white border-[#E3D9CC]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 5. Mentorship Experience */}
            <div className="space-y-4 border-b border-[#E3D9CC] pb-6">
              <h3 className="text-lg font-bold text-gray-900">5️⃣ Mentorship Experience (if any)</h3>
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="previousMentoringRoles"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Previous Mentoring Roles</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Describe your previous mentoring experience" className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="batchStudentsGuided"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Batch/Students Guided</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 3 batches, 50+ students" className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="certificationsRewards"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Any Certifications/Rewards</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="List any relevant certifications or awards" className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 6. Motivation */}
            <div className="space-y-4 border-b border-[#E3D9CC] pb-6">
              <h3 className="text-lg font-bold text-gray-900">6️⃣ Motivation to Mentor *</h3>
              <FormField
                control={form.control}
                name="motivation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-900">
                      Why do you want to mentor students in StartupUniv? *
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Please provide a detailed answer (minimum 50 characters)"
                        rows={5}
                        className="bg-white border-[#E3D9CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 7. Availability */}
            <div className="space-y-4 border-b border-[#E3D9CC] pb-6">
              <h3 className="text-lg font-bold text-gray-900">7️⃣ Availability</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="weeklyAvailableHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Weekly Available Hours *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 10-15 hours" className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preferredMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Preferred Mode *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white border-[#E3D9CC]">
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Online">Online</SelectItem>
                          <SelectItem value="On-Campus">On-Campus</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="earliestJoiningDate"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-gray-900">Earliest Joining Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 8. Compliance & Agreement */}
            <div className="space-y-4 border-b border-[#E3D9CC] pb-6">
              <h3 className="text-lg font-bold text-gray-900">8️⃣ Compliance & Agreement</h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="followGuidelines"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-[#E3D9CC] data-[state=checked]:bg-red-600"
                          />
                        </FormControl>
                        <FormLabel className="text-gray-900 font-normal cursor-pointer">
                          Will you follow the mentorship guidelines & code of conduct? *
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assistAssessments"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-[#E3D9CC] data-[state=checked]:bg-red-600"
                          />
                        </FormControl>
                        <FormLabel className="text-gray-900 font-normal cursor-pointer">
                          Willing to assist in assessments/interviews when required? *
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="participateReviews"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-[#E3D9CC] data-[state=checked]:bg-red-600"
                          />
                        </FormControl>
                        <FormLabel className="text-gray-900 font-normal cursor-pointer">
                          Willing to participate in founder-matching and project reviews? *
                        </FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Additional Attachments */}
            <div className="space-y-4 border-b border-[#E3D9CC] pb-6">
              <h3 className="text-lg font-bold text-gray-900">📌 Additional Attachments (Optional)</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-gray-900 mb-2 block">Certificates</Label>
                  <ObjectUploader
                    acceptedTypes=".pdf,.doc,.docx,image/*"
                    maxFileSize={10 * 1024 * 1024}
                    onGetUploadParameters={async (file) => {
                      const response = await apiRequest("POST", "/api/applications/cv/upload-url", {
                        fileName: file.name,
                        fileType: file.type,
                      });
                      // Handle both uploadURL and uploadUrl (API returns uploadUrl)
                      const uploadUrl = response.uploadURL || response.uploadUrl;
                      if (!uploadUrl) {
                        throw new Error("No upload URL received from server");
                      }
                      return {
                        method: "PUT" as const,
                        url: uploadUrl,
                        objectKey: response.objectKey,
                      };
                    }}
                    onComplete={(fileUrl, objectKey, fileName) => {
                      if (!fileUrl || !objectKey) {
                        console.error("No file URL or object key received from upload");
                        return;
                      }
                      setUploadedFiles((prev) => ({
                        ...prev,
                        certificates: [
                          ...(prev.certificates || []),
                          { url: fileUrl, objectKey: objectKey, fileName: fileName || "certificate.pdf" }
                        ],
                      }));
                    }}
                    title="Upload Certificate"
                    description="Upload your file (max 10MB)"
                  >
                    <Button type="button" variant="outline" size="sm" className="border-[#E3D9CC]">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </ObjectUploader>
                  {uploadedFiles.certificates && uploadedFiles.certificates.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {uploadedFiles.certificates.map((cert, idx) => (
                        <p key={idx} className="text-sm text-green-600">
                          ✓ {cert.fileName} uploaded
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-gray-900 mb-2 block">ID Proof</Label>
                  <ObjectUploader
                    acceptedTypes=".pdf,image/*"
                    maxFileSize={5 * 1024 * 1024}
                    onGetUploadParameters={async (file) => {
                      const response = await apiRequest("POST", "/api/applications/cv/upload-url", {
                        fileName: file.name,
                        fileType: file.type,
                      });
                      // Handle both uploadURL and uploadUrl (API returns uploadUrl)
                      const uploadUrl = response.uploadURL || response.uploadUrl;
                      if (!uploadUrl) {
                        throw new Error("No upload URL received from server");
                      }
                      return {
                        method: "PUT" as const,
                        url: uploadUrl,
                        objectKey: response.objectKey,
                      };
                    }}
                    onComplete={(fileUrl, objectKey, fileName) => {
                      if (!fileUrl || !objectKey) {
                        console.error("No file URL or object key received from upload");
                        return;
                      }
                      setUploadedFiles((prev) => ({
                        ...prev,
                        idProof: { url: fileUrl, objectKey: objectKey, fileName: fileName || "id-proof.pdf" }
                      }));
                    }}
                    title="Upload ID Proof"
                    description="Upload your file (max 5MB)"
                  >
                    <Button type="button" variant="outline" size="sm" className="border-[#E3D9CC]">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </ObjectUploader>
                  {uploadedFiles.idProof && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ {uploadedFiles.idProof.fileName} uploaded
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Signature */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Signature</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="signatureName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Name *</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="signatureDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="bg-white border-[#E3D9CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value as boolean}
                      onCheckedChange={field.onChange}
                      className="border-[#E3D9CC]"
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer font-normal text-gray-900">
                    I have read and accepted the <a href="/terms" className="underline text-red-600 hover:text-red-700" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 border-[#E3D9CC]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

