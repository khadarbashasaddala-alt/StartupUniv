// @ts-nocheck
import { useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  Send,
  Upload,
  FileText,
  Check,
  ChevronsUpDown,
  X,
  Info,
} from "lucide-react";
import {
  learnerApplicationFormSchema,
  type LearnerApplicationForm,
} from "@shared/schema";
import { z } from "zod";

import { useTracks } from "@/hooks/use-tracks";

// Track details for info dialog
const TRACK_DETAILS: Record<string, {
  color: string;
  number: string;
  name: string;
  description: string;
  subSectors: string[];
  examples: string[];
}> = {
  "AgriTech": {
    color: "🟢",
    number: "1",
    name: "Agriculture & Natural Resources",
    description: "Producing and managing natural resources",
    subSectors: [
      "Crop farming & precision agriculture",
      "Livestock, dairy & poultry",
      "Fisheries & aquaculture",
      "Forestry & timber",
      "Soil science & fertilizers",
      "Seeds & agri-inputs",
      "Commodity trading (agri)",
      "Water resources & irrigation",
      "Mining & metals",
      "Oil, gas & natural extraction",
    ],
    examples: [
      "Smart irrigation platforms",
      "Crop insurance & yield prediction",
      "Commodity traceability",
      "Farm marketplaces",
    ],
  },
  "Industrial": {
    color: "🟠",
    number: "2",
    name: "Manufacturing & Industrial",
    description: "Converting raw materials into goods",
    subSectors: [
      "Industrial manufacturing",
      "Factory automation",
      "Robotics (industrial)",
      "Automotive & EV manufacturing",
      "Aerospace & defense manufacturing",
      "Electronics & semiconductor manufacturing",
      "Heavy machinery",
      "Packaging & materials",
      "3D printing",
      "Quality control systems",
    ],
    examples: [
      "Smart factories",
      "Robotics assembly lines",
      "EV battery plants",
    ],
  },
  "Climate": {
    color: "🔵",
    number: "3",
    name: "Energy, Climate & Utilities",
    description: "Power, sustainability, and environmental systems",
    subSectors: [
      "Renewable energy (solar, wind, hydro)",
      "Fossil energy",
      "Energy storage (batteries, hydrogen)",
      "Climate tech",
      "Carbon capture & offsets",
      "Smart grids",
      "Utilities (electricity, gas, water)",
      "Waste management & recycling",
      "Environmental monitoring",
    ],
    examples: [
      "Carbon accounting tools",
      "Grid optimization software",
      "Waste-to-energy startups",
    ],
  },
  "PropTech": {
    color: "🟣",
    number: "4",
    name: "Construction, Real Estate & Infrastructure",
    description: "Building and managing physical spaces",
    subSectors: [
      "Residential & commercial real estate",
      "Construction tech (ConTech)",
      "Infrastructure development",
      "Smart cities",
      "Property management",
      "Facility management",
      "Urban planning",
      "Land registry systems",
      "Building materials",
    ],
    examples: [
      "Real estate marketplaces",
      "Construction automation",
      "Digital land records",
    ],
  },
  "Logistics": {
    color: "🟤",
    number: "5",
    name: "Transportation, Logistics & Mobility",
    description: "Movement of people and goods",
    subSectors: [
      "Freight & shipping",
      "Supply chain management",
      "Warehousing & fulfillment",
      "Last-mile delivery",
      "Aviation & aerospace transport",
      "Rail & maritime",
      "Ride-sharing",
      "Fleet management",
      "Autonomous & electric mobility",
      "Drones (logistics)",
    ],
    examples: [
      "Supply chain visibility tools",
      "EV fleet platforms",
      "Delivery apps",
    ],
  },
  "FinTech": {
    color: "🟡",
    number: "6",
    name: "Finance, Insurance & Legal",
    description: "Money, risk, contracts, and compliance",
    subSectors: [
      "Banking & neo-banking",
      "Payments & wallets",
      "Lending & credit",
      "Wealth management",
      "Insurance (InsurTech)",
      "Accounting & tax",
      "LegalTech",
      "Compliance & RegTech",
      "Blockchain finance / DeFi",
      "Embedded finance",
    ],
    examples: [
      "Digital banks",
      "Crop insurance platforms",
      "Smart contract systems",
    ],
  },
  "HealthTech": {
    color: "🔴",
    number: "7",
    name: "Healthcare & Life Sciences",
    description: "Human health and biological systems",
    subSectors: [
      "Hospitals & clinics",
      "HealthTech platforms",
      "Medical devices",
      "Diagnostics",
      "Telemedicine",
      "Pharma & drug discovery",
      "Biotech & genomics",
      "Mental health",
      "Wearables & remote monitoring",
      "Health data systems",
    ],
    examples: [
      "AI diagnostics",
      "Remote patient monitoring",
      "Drug discovery AI",
    ],
  },
  "EdTech": {
    color: "🟠",
    number: "8",
    name: "Education, Work & Human Capital",
    description: "Learning, skills, and workforce productivity",
    subSectors: [
      "Schools & universities",
      "EdTech platforms",
      "Online learning & MOOCs",
      "Corporate training",
      "HRTech",
      "Recruitment & hiring",
      "Freelance & gig platforms",
      "Productivity tools",
      "Skill assessment",
      "Career platforms",
    ],
    examples: [
      "AI tutors",
      "LMS platforms",
      "Hiring automation",
    ],
  },
  "Consumer": {
    color: "🟢",
    number: "9",
    name: "Commerce, Media & Consumer Services",
    description: "Buying, selling, entertainment, and lifestyle",
    subSectors: [
      "E-commerce & marketplaces",
      "Retail & D2C brands",
      "Advertising & AdTech",
      "Media & content platforms",
      "Creator economy",
      "Gaming & esports",
      "Social networks",
      "Travel & hospitality",
      "FoodTech & restaurants",
      "Subscription services",
    ],
    examples: [
      "Online marketplaces",
      "Creator monetization tools",
      "Food delivery apps",
    ],
  },
  "SaaS_B2B": {
    color: "🔵",
    number: "10",
    name: "Software, AI & Data Systems",
    description: "Digital products and intelligence",
    subSectors: [
      "SaaS platforms",
      "AI / ML systems",
      "LLMs & AI agents",
      "Business intelligence",
      "Data analytics",
      "Automation tools",
      "Recommendation engines",
      "Knowledge management",
      "Enterprise software",
      "Low-code / no-code platforms",
    ],
    examples: [
      "AI copilots",
      "Analytics dashboards",
      "Workflow automation",
    ],
  },
  "AI": {
    color: "🟣",
    number: "11",
    name: "Developer, Cloud & Digital Infrastructure",
    description: "Foundations that power software",
    subSectors: [
      "Cloud computing",
      "APIs & SDKs",
      "DevTools",
      "CI/CD",
      "Databases",
      "MLOps platforms",
      "Cybersecurity",
      "Identity & access management",
      "Observability & monitoring",
      "Edge computing",
    ],
    examples: [
      "Cloud platforms",
      "API infrastructure startups",
      "Security tooling",
    ],
  },
  "BioTech": {
    color: "⚫",
    number: "12",
    name: "Emerging, Deep Tech & Hardware",
    description: "Next-generation and physical technologies",
    subSectors: [
      "Blockchain & Web3",
      "Crypto infrastructure",
      "IoT systems",
      "Robotics (non-industrial)",
      "Drones & UAVs",
      "AR / VR / MR",
      "Quantum computing",
      "Semiconductors",
      "SpaceTech",
      "Advanced hardware",
    ],
    examples: [
      "Blockchain protocols",
      "Robotics startups",
      "AR training systems",
    ],
  },
  // Add fallback for other tracks not in the 12 main categories
  "ECommerce": {
    color: "🟢",
    number: "9",
    name: "E-Commerce & D2C",
    description: "Online commerce and direct-to-consumer brands",
    subSectors: [
      "E-commerce platforms",
      "D2C brands",
      "Marketplace platforms",
      "Retail tech",
    ],
    examples: [
      "Online marketplaces",
      "D2C brand platforms",
    ],
  },
  "Media": {
    color: "🟢",
    number: "9",
    name: "Commerce, Media & Consumer Services",
    description: "Buying, selling, entertainment, and lifestyle",
    subSectors: [
      "E-commerce & marketplaces",
      "Retail & D2C brands",
      "Advertising & AdTech",
      "Media & content platforms",
      "Creator economy",
      "Gaming & esports",
      "Social networks",
      "Travel & hospitality",
      "FoodTech & restaurants",
      "Subscription services",
    ],
    examples: [
      "Online marketplaces",
      "Creator monetization tools",
      "Food delivery apps",
    ],
  },
  "GovTech": {
    color: "🔵",
    number: "13",
    name: "GovTech",
    description: "Technology for government and public services",
    subSectors: [
      "Government services",
      "Public sector tech",
      "Civic tech",
      "Digital governance",
    ],
    examples: [
      "Digital government platforms",
      "Citizen services apps",
    ],
  },
  "MSME": {
    color: "🟠",
    number: "14",
    name: "MSME",
    description: "Micro, Small, and Medium Enterprises technology",
    subSectors: [
      "Small business tech",
      "MSME solutions",
      "SMB platforms",
    ],
    examples: [
      "SMB management tools",
      "Small business platforms",
    ],
  },
};

const EDUCATION_OPTIONS = [
  "BCom – Bachelor of Commerce",
  "BBA – Bachelor of Business Administration",
  "BCA – Bachelor of Computer Applications",
  "B.E / B.Tech – Bachelor of Engineering / Technology",
  "B.Sc – Bachelor of Science",
  "B.A – Bachelor of Arts",
  "B.Pharm – Bachelor of Pharmacy",
  "BDS – Bachelor of Dental Surgery",
  "MBBS – Bachelor of Medicine, Bachelor of Surgery",
  "B.Arch – Bachelor of Architecture",
  "B.Des – Bachelor of Design",
  "B.F.A – Bachelor of Fine Arts",
  "B.Law/LLB – Bachelor of Law",
  "BHM – Bachelor of Hotel Management",
  "B.Ed – Bachelor of Education",
  "MCA – Master of Computer Applications",
  "M.Tech – Master of Technology",
  "MBA – Master of Business Administration",
  "M.Com – Master of Commerce",
  "M.Sc – Master of Science",
  "Diploma",
  "Post Graduate Diploma",
  "Ph.D",
];

const TECHNICAL_SKILLS = {
  "Programming Languages": [
    "JavaScript", "Python", "Java", "C++", "C#", "Ruby", "Go", "PHP", "TypeScript", "Kotlin", "Swift"
  ],
  "Frameworks": [
    "React", "Node.js", "Django", "Flask", "Spring Boot", "Angular", "Vue.js", "Express.js", "Next.js", "FastAPI"
  ],
  "Development Skills": [
    "Frontend Development", "Backend Development", "Full-stack Development", "Mobile Development", 
    "DevOps", "UI/UX Design", "Database Management", "API Development"
  ],
  "Business Skills": [
    "Product Management", "Business Analysis", "Marketing", "Sales", "Operations", "Strategy", "Finance"
  ],
};

const learnerRoles = [
  { value: "TECHNICAL", label: "Technical Role", description: "Software development, product engineering, tech support" },
  { value: "BUSINESS", label: "Business Role", description: "Sales, marketing, business development, operations" },
  { value: "MIXED", label: "Mixed Role", description: "Combination of technical and business responsibilities" },
];

// Extended schema for Founder (with additional questions)
const founderFormSchema = learnerApplicationFormSchema.extend({
  founderQuestion1: z.string().min(50, "Please provide at least 50 characters").optional(),
  founderQuestion2: z.string().min(50, "Please provide at least 50 characters").optional(),
  cvFile: z.instanceof(File).optional(),
});

// Extended schema for Cofounder (with additional questions)
const cofounderFormSchema = learnerApplicationFormSchema.extend({
  cofounderQuestion1: z.string().min(50, "Please provide at least 50 characters").optional(),
  cofounderQuestion2: z.string().min(50, "Please provide at least 50 characters").optional(),
  interestedRole: z.string().min(1, "Please select a role"),
  cvFile: z.instanceof(File).optional(),
});

// Extended schema for Intern (with CV)
const learnerFormSchema = learnerApplicationFormSchema.extend({
  interestedRole: z.string().optional(),
  cvFile: z.instanceof(File).optional(),
});

type PlanBasedApplicationFormProps = {
  planType: "learner" | "founder" | "cofounder";
  tier?: "basic" | "premium" | null;
  teamInviteToken?: string;
};

export function PlanBasedApplicationForm({ planType, tier, teamInviteToken }: PlanBasedApplicationFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string>("");

  const underlineFieldClass =
    "bg-transparent border-0 border-b border-[#DBDEE6] rounded-none px-0 h-[46px] focus-visible:ring-0 focus-visible:ring-offset-0";
  const underlineSelectTriggerClass =
    "bg-transparent border-0 border-b border-[#DBDEE6] rounded-none px-0 h-[46px] focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0";
  const textareaFieldClass =
    "bg-white border border-[#DBDEE6] rounded-sm px-3 py-2 min-h-[120px] focus-visible:ring-0 focus-visible:ring-offset-0";

  // Fetch active cohorts (for interns, founders, and cofounders)
  const { data: openCohorts = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/cohorts/active"],
    enabled: planType === "learner" || planType === "founder" || planType === "cofounder",
  });

  // (problem statements removed)

  // Use appropriate schema based on plan type
  const formSchema = planType === "founder"
    ? founderFormSchema
    : planType === "cofounder"
      ? cofounderFormSchema
      : learnerFormSchema;

  type FormType = z.infer<typeof formSchema>;
  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      countryCode: "+91",
      email: "",
      phone: "",
      education: "",
      university: "",
      yearOfStudy: "",
      workExperience: "",
      linkedinUrl: "",
      githubUrl: "",
      motivation: "",
      cohortId: "",
      preferredTrack: "GovTech",
      preferredTracks: [],
      isStudent: planType === "learner" ? true : false, // Founders and Co-Founders are professionals by default
      technicalSkills: [],
      readyForProjects: false,
      needsTraining: false,
      acceptTerms: false,
    },
  });

  // State for technical skills popover
  const [skillsOpen, setSkillsOpen] = useState(false);
  
  // State for education combobox
  const [educationOpen, setEducationOpen] = useState(false);
  const [educationSearchQuery, setEducationSearchQuery] = useState("");
  
  // State for tracks multi-select popover
  const [tracksOpen, setTracksOpen] = useState(false);

  // Track list comes from the catalog table so tracks an admin adds while
  // creating a problem statement show up here too. Falls back to the seed list.
  const { tracks: trackOptions } = useTracks();

  // Popular domains used for email regex (also allow other well-formed domains)
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

  // Country code options and phone digit rules - Fixed duplicate keys issue - Updated: 2026-01-09
  const countryCodeOptions: Array<{ name: string; iso: string; code: string; minDigits: number; maxDigits?: number }> = [
    { name: "United States", iso: "US", code: "+1", minDigits: 10, maxDigits: 10 },
    { name: "Canada", iso: "CA", code: "+1", minDigits: 10, maxDigits: 10 },
    { name: "United Kingdom", iso: "GB", code: "+44", minDigits: 10, maxDigits: 10 },
    { name: "India", iso: "IN", code: "+91", minDigits: 10, maxDigits: 10 },
    { name: "Australia", iso: "AU", code: "+61", minDigits: 9, maxDigits: 9 },
    { name: "Germany", iso: "DE", code: "+49", minDigits: 10, maxDigits: 11 },
    { name: "France", iso: "FR", code: "+33", minDigits: 9, maxDigits: 9 },
    { name: "Netherlands", iso: "NL", code: "+31", minDigits: 9, maxDigits: 9 },
    { name: "Spain", iso: "ES", code: "+34", minDigits: 9, maxDigits: 9 },
    { name: "Italy", iso: "IT", code: "+39", minDigits: 9, maxDigits: 10 },
    { name: "Singapore", iso: "SG", code: "+65", minDigits: 8, maxDigits: 8 },
    { name: "United Arab Emirates", iso: "AE", code: "+971", minDigits: 9, maxDigits: 9 },
    { name: "Saudi Arabia", iso: "SA", code: "+966", minDigits: 9, maxDigits: 9 },
    { name: "Japan", iso: "JP", code: "+81", minDigits: 10, maxDigits: 10 },
    { name: "South Korea", iso: "KR", code: "+82", minDigits: 9, maxDigits: 10 },
    { name: "Brazil", iso: "BR", code: "+55", minDigits: 10, maxDigits: 11 },
    { name: "Mexico", iso: "MX", code: "+52", minDigits: 10, maxDigits: 10 },
    { name: "South Africa", iso: "ZA", code: "+27", minDigits: 9, maxDigits: 9 },
    { name: "New Zealand", iso: "NZ", code: "+64", minDigits: 8, maxDigits: 9 },
    { name: "Indonesia", iso: "ID", code: "+62", minDigits: 9, maxDigits: 11 },
  ];

  // Email regex: STRICT — only allow the popularDomains exactly (whitelist)
  const emailRe = new RegExp(
    `^[A-Za-z0-9._%+-]+@(?:${popularDomains.map((d) => d.replace(/\./g, "\\.")).join("|")})$`
  );

  // Helper validators
  function validateEmail(email: string) {
    if (!email) return false;
    return emailRe.test(email.trim());
  }

  function validatePhone(localNumber: string, countryCode: string) {
    const digits = (localNumber || "").replace(/\D/g, "");
    const opt = countryCodeOptions.find((c) => c.code === countryCode);
    if (!opt) {
      // Strict mode: unknown country code is invalid
      return false;
    }
    const min = opt.minDigits;
    const max = opt.maxDigits ?? opt.minDigits;
    const re = new RegExp(`^\\d{${min},${max}}$`);
    return re.test(digits);
  }

  const mutation = useMutation({
    mutationFn: async (data: LearnerApplicationForm & { cvFile?: File; founderQuestion1?: string; founderQuestion2?: string; cofounderQuestion1?: string; cofounderQuestion2?: string }) => {
      // Prepare form data
      const submissionType = planType === "founder"
        ? "FOUNDER"
        : planType === "cofounder"
          ? "COFOUNDER"
          : data.isStudent
            ? "LEARNER"
            : "PROFESSIONAL";

      const formData: any = {
        type: submissionType,
        formJson: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          education: data.education,
          university: data.university,
          yearOfStudy: data.yearOfStudy,
          workExperience: data.workExperience,
          linkedinUrl: data.linkedinUrl,
          githubUrl: data.githubUrl,
          motivation: data.motivation,
          isStudent: data.isStudent,
          acceptTerms: data.acceptTerms === true,
        },
      };

      if (teamInviteToken) {
        formData.teamInviteToken = teamInviteToken;
      }

      // Handle track selection based on plan type
      // Founders/Cofounders use single track selection (preferredTrack)
      // Interns use multiple track selection (preferredTracks)
      if (planType === "founder" || planType === "cofounder") {
        formData.formJson.preferredTrack = data.preferredTrack;
      } else {
        // Intern: save multiple tracks selection
        const tracks = Array.isArray((data as any).preferredTracks) ? (data as any).preferredTracks : [];
        if (tracks.length > 0) {
          formData.formJson.preferredTracks = tracks;
        }
      }

      // Add CV file info for all plans
      if (cvFile) {
        // Step 1: Get upload URL
        const { uploadUrl, objectKey } = await apiRequest("POST", "/api/applications/cv/upload-url", {
          fileName: cvFile.name,
          fileType: cvFile.type,
        });

        // Step 2: Upload file to S3
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: cvFile,
          headers: {
            "Content-Type": cvFile.type,
          },
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload CV to S3: ${uploadRes.statusText}`);
        }

        // Step 3: Add S3 key to form data
        formData.formJson.cvFileName = cvFile.name;
        formData.formJson.cvFileSize = cvFile.size;
        formData.formJson.cvFileType = cvFile.type;
        formData.formJson.cvS3Key = objectKey;
      }

      // Add plan-specific data
      if (planType === "founder") {
        if (data.founderQuestion1) formData.formJson.founderQuestion1 = data.founderQuestion1;
        if (data.founderQuestion2) formData.formJson.founderQuestion2 = data.founderQuestion2;
        // Store selected cohort/domain
        if ((data as any).cohortId) {
          formData.formJson.cohortId = (data as any).cohortId;
        }
      } else if (planType === "cofounder") {
        if (data.cofounderQuestion1) formData.formJson.cofounderQuestion1 = data.cofounderQuestion1;
        if (data.cofounderQuestion2) formData.formJson.cofounderQuestion2 = data.cofounderQuestion2;
        if ((data as any).interestedRole) formData.formJson.interestedRole = (data as any).interestedRole;
        // Store selected cohort/domain
        if ((data as any).cohortId) {
          formData.formJson.cohortId = (data as any).cohortId;
        }
      } else if (planType === "learner") {
        if ((data as any).interestedRole) formData.formJson.interestedRole = (data as any).interestedRole;
        // Add intern-specific fields
        if ((data as any).technicalSkills) formData.formJson.technicalSkills = (data as any).technicalSkills;
        if (typeof (data as any).readyForProjects === 'boolean') formData.formJson.readyForProjects = (data as any).readyForProjects;
        if (typeof (data as any).needsTraining === 'boolean') formData.formJson.needsTraining = (data as any).needsTraining;
        // Store plan tier (basic/premium) for interns only
        if (tier === "basic" || tier === "premium") {
          formData.formJson.plan = tier;
        }
        // Store selected cohort/domain
        if ((data as any).cohortId) {
          formData.formJson.cohortId = (data as any).cohortId;
        }
      }

      return apiRequest("POST", "/api/applications", formData);
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted!",
        description: "We'll review your application and get back to you soon.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleCvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCvFile(e.target.files[0]);
      setCvError(""); // Clear error when file is selected
    }
  };

  // Submission wrapper that validates email and phone (with selected country code)
  const handlePlanSubmit = async (data: FormType) => {
    // clear manual errors
    form.clearErrors();
    const countryCode = (form.getValues().countryCode as string) || "+91";

    if (!validateEmail(String(data.email || ""))) {
      form.setError("email", { type: "manual", message: "Invalid email address" });
      return;
    }

    if (!validatePhone(String(data.phone || ""), countryCode)) {
      form.setError("phone", { type: "manual", message: "Invalid phone number for selected country" });
      return;
    }

    // Validate CV file is uploaded (required for all plans)
    if (!cvFile) {
      setCvError("CV/Resume is required");
      toast({
        title: "Validation Error",
        description: "Please upload your CV/Resume. It is a required field.",
        variant: "destructive",
      });
      // Scroll to CV upload section
      setTimeout(() => {
        const cvLabel = document.querySelector('label[for="cv-file"]');
        if (cvLabel) {
          cvLabel.scrollIntoView({ 
            behavior: "smooth", 
            block: "center" 
          });
          // Highlight the CV upload button
          (cvLabel as HTMLElement).style.borderColor = "#ef4444";
          setTimeout(() => {
            (cvLabel as HTMLElement).style.borderColor = "";
          }, 2000);
        }
      }, 100);
      return;
    }
    setCvError(""); // Clear error if CV is present

    // Additional validation for learner plan
    if (planType === "learner") {
      const technicalSkills = (data as any).technicalSkills || [];
      const readyForProjects = (data as any).readyForProjects;
      const needsTraining = (data as any).needsTraining;

      // Validate technical skills
      if (!Array.isArray(technicalSkills) || technicalSkills.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please select at least one technical skill",
          variant: "destructive",
        });
        return;
      }

      // Validate project readiness (at least one must be selected)
      if (!readyForProjects && !needsTraining) {
        toast({
          title: "Validation Error",
          description: "Please select your project readiness preference",
          variant: "destructive",
        });
        return;
      }
    }

    // combine country code with phone for submission
    const phoneWithCode = `${countryCode} ${String(data.phone || "").trim()}`;
    // pre-submit validation: check duplicates per-role
    try {
      const submissionType = planType === "founder"
        ? "FOUNDER"
        : planType === "cofounder"
          ? "COFOUNDER"
          : (data as any).isStudent
            ? "LEARNER"
            : "PROFESSIONAL";

      // Normalize before validation: email lowercase+trim, phone digits-only
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
        form.setError("phone", { type: "manual", message: "An application with this phone number already exists for this role. Please use a different phone number." });
        return;
      }
    } catch (e) {
      console.warn("Contact validation failed, continuing with submission:", e);
      // if validation endpoint fails, continue to submission to avoid blocking users
    }

    mutation.mutate({ 
      ...(data as any), 
      countryCode, 
      phone: phoneWithCode,
    } as any);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handlePlanSubmit)} className="space-y-8 text-gray-900 overflow-x-hidden w-full max-w-full">
        {/* Student toggle - Only for Intern plan */}
        {planType === "learner" ? (
          <FormField
            control={form.control}
            name="isStudent"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">I am currently a student</FormLabel>
                  <FormDescription>
                    Toggle if you're a working professional
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value as boolean}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-[#17646E] data-[state=unchecked]:bg-gray-200 border border-black/10"
                    data-testid="switch-is-student"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        ) : null}

        {/* Cohort selection - For Intern, Founder, and Cofounder plans */}
        {(planType === "learner" || planType === "founder" || planType === "cofounder") ? (
          <FormField
            control={form.control}
            name="cohortId"
            render={({ field }) => (
              <FormItem className="max-w-md">
                <FormLabel>Select Cohort *</FormLabel>
                <FormDescription className="text-sm">
                  Choose the cohort you want to join (this cannot be changed later)
                </FormDescription>
                {openCohorts.length > 0 ? (
                  <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                    <FormControl>
                      <SelectTrigger className={underlineSelectTriggerClass + " w-full"}>
                        <SelectValue placeholder="Select a cohort" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {openCohorts.map((cohort) => (
                        <SelectItem key={cohort.id} value={cohort.id}>
                          {cohort.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-muted-foreground p-2 border border-dashed rounded">
                    No cohorts are currently open for registration. Please contact support.
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 w-full overflow-x-hidden">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input className={underlineFieldClass} placeholder="Your full name" {...field} data-testid="input-fullname" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input className={underlineFieldClass} type="email" placeholder="your@email.com" {...field} data-testid="input-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 w-full overflow-x-hidden">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number *</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <div style={{ minWidth: 140 }}>
                      {(() => {
                        const fallbackIso = countryCodeOptions[0]?.iso ?? "IN";
                        const fallbackCode = countryCodeOptions[0]?.code ?? "+91";
                        const currentCode = String((form as any).getValues().countryCode ?? fallbackCode);
                        const currentIso = countryCodeOptions.find((c) => c.code === currentCode)?.iso ?? fallbackIso;
                        return (
                          <Select
                            onValueChange={(iso) => {
                              const option = countryCodeOptions.find((c) => c.iso === iso);
                              (form as any).setValue("countryCode", option?.code ?? fallbackCode);
                            }}
                            defaultValue={currentIso}
                            value={currentIso}
                          >
                            <SelectTrigger className={underlineSelectTriggerClass} data-testid="select-country-code">
                              <SelectValue placeholder="+91" />
                            </SelectTrigger>
                            <SelectContent>
                              {countryCodeOptions.map((c) => (
                                <SelectItem key={c.iso} value={c.iso}>
                                  {c.name} ({c.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </div>
                    <div className="flex-1">
                      <Input className={underlineFieldClass} placeholder="9876543210" {...field} data-testid="input-phone" />
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="education"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Education Details*</FormLabel>
                <Popover open={educationOpen} onOpenChange={setEducationOpen}>
                  <PopoverTrigger asChild>
                  <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={`w-full justify-between ${underlineSelectTriggerClass} ${!field.value ? "text-muted-foreground" : "text-gray-900"}`}
                        data-testid="select-education"
                      >
                        {field.value || "Select your education or type custom"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                  </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-white border border-gray-300 rounded-md" align="start">
                    <Command className="bg-white [&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-gray-200 [&_[cmdk-input-wrapper]]:focus-within:border-gray-200">
                      <CommandInput 
                        placeholder="Search or type custom education..." 
                        className="bg-white text-gray-900 border-0 focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:outline-none focus:border-0 focus-visible:border-0"
                        value={educationSearchQuery}
                        onValueChange={setEducationSearchQuery}
                      />
                      <CommandEmpty className="p-2">
                        <div className="flex flex-col gap-2">
                          <div className="text-sm text-gray-700">
                            No match found for "{educationSearchQuery}"
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              if (educationSearchQuery.trim()) {
                                field.onChange(educationSearchQuery.trim());
                                setEducationOpen(false);
                                setEducationSearchQuery("");
                              }
                            }}
                          >
                            Use "{educationSearchQuery}" as custom education
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup className="max-h-[300px] overflow-y-auto">
                        {EDUCATION_OPTIONS.filter((option) =>
                          option.toLowerCase().includes(educationSearchQuery.toLowerCase())
                        ).map((option) => {
                          const isSelected = field.value === option;
                          return (
                            <CommandItem
                              key={option}
                              value={option}
                              onSelect={() => {
                                field.onChange(option);
                                setEducationOpen(false);
                                setEducationSearchQuery("");
                              }}
                              className={`text-gray-900 cursor-pointer hover:bg-gray-100 ${
                                isSelected ? "bg-gray-100" : ""
                              }`}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  isSelected ? "opacity-100" : "opacity-0"
                                }`}
                              />
                        {option}
                            </CommandItem>
                          );
                        })}
                        {/* Show option to use custom typed value if it doesn't match any option */}
                        {educationSearchQuery.trim() && !EDUCATION_OPTIONS.some(opt => 
                          opt.toLowerCase().includes(educationSearchQuery.toLowerCase())
                        ) && (
                          <CommandItem
                            value={educationSearchQuery}
                            onSelect={() => {
                              field.onChange(educationSearchQuery.trim());
                              setEducationOpen(false);
                              setEducationSearchQuery("");
                            }}
                            className="text-gray-900 cursor-pointer hover:bg-gray-100 border-t border-gray-200 mt-1 pt-2"
                          >
                            <Check className="mr-2 h-4 w-4 opacity-0" />
                            Use "{educationSearchQuery}" as custom education
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* University/Year fields - Only for Intern plan when student */}
        {planType === "learner" && form.watch("isStudent") === true ? (
          <div className="grid gap-6 md:grid-cols-2 w-full overflow-x-hidden">
            <FormField
              control={form.control}
              name="university"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>University/College</FormLabel>
                  <FormControl>
                    <Input className={underlineFieldClass} placeholder="Your university name" {...field} data-testid="input-university" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="yearOfStudy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year of Study</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={underlineSelectTriggerClass} data-testid="select-year">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1st Year">1st Year</SelectItem>
                      <SelectItem value="2nd Year">2nd Year</SelectItem>
                      <SelectItem value="3rd Year">3rd Year</SelectItem>
                      <SelectItem value="4th Year">4th Year</SelectItem>
                      <SelectItem value="Final Year">Final Year</SelectItem>
                      <SelectItem value="Graduate">Graduate</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}

        {/* Work Experience - For Founder, Co-Founder, or Intern (when professional) */}
        {(planType === "founder" || planType === "cofounder" || (planType === "learner" && !form.watch("isStudent"))) && (
          <FormField
            control={form.control}
            name="workExperience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Experience</FormLabel>
                <FormControl>
                  <Input className={underlineFieldClass} placeholder="e.g., 3 years at Google as Software Engineer" {...field} data-testid="input-experience" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Technical Skills - For Intern plan only */}
        {planType === "learner" && (
          <FormField
            control={form.control}
            name="technicalSkills"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Technical Skills *</FormLabel>
                <FormDescription>
                  Select your technical and business skills
                </FormDescription>
                <Popover open={skillsOpen} onOpenChange={setSkillsOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={`w-full flex items-center justify-between ${underlineSelectTriggerClass} ${
                          (!field.value || (field.value as string[]).length === 0) ? "text-muted-foreground" : ""
                        }`}
                        data-testid="button-technical-skills"
                      >
                        {(!field.value || (field.value as string[]).length === 0)
                          ? "Select skills..."
                          : `${(field.value as string[]).length} skill${(field.value as string[]).length > 1 ? 's' : ''} selected`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-white border border-gray-300 rounded-md" align="start">
                    <Command className="bg-white [&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-gray-200 [&_[cmdk-input-wrapper]]:focus-within:border-gray-200">
                      <CommandInput placeholder="Search skills..." className="bg-white text-gray-900 border-0 focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:outline-none focus:border-0 focus-visible:border-0" />
                      <CommandEmpty className="text-gray-900">No skill found.</CommandEmpty>
                      <div className="max-h-[300px] overflow-y-auto">
                        {Object.entries(TECHNICAL_SKILLS).map(([category, skills]) => (
                          <CommandGroup key={category} heading={category} className="text-gray-900">
                            {skills.map((skill) => {
                              const isSelected = Array.isArray(field.value) && field.value.includes(skill);
                              return (
                                <CommandItem
                                  key={skill}
                                  onSelect={() => {
                                    const currentSkills = Array.isArray(field.value) ? field.value : [];
                                    const newSkills = isSelected
                                      ? currentSkills.filter((s) => s !== skill)
                                      : [...currentSkills, skill];
                                    field.onChange(newSkills);
                                  }}
                                  className="text-gray-900 cursor-pointer hover:bg-gray-100"
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <div className={`h-4 w-4 border rounded-sm flex items-center justify-center ${
                                      isSelected ? "bg-primary border-primary" : "border-input"
                                    }`}>
                                      {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="flex-1">{skill}</span>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        ))}
                      </div>
                    </Command>
                  </PopoverContent>
                </Popover>
                {/* Display selected skills as badges */}
                {field.value && (field.value as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(field.value as string[]).map((skill) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="gap-1"
                      >
                        {skill}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => {
                            const newSkills = (field.value as string[]).filter((s) => s !== skill);
                            field.onChange(newSkills);
                          }}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid gap-4 md:grid-cols-2 w-full overflow-x-hidden">
          <FormField
            control={form.control}
            name="linkedinUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>LinkedIn Profile</FormLabel>
                <FormControl>
                  <Input className={underlineFieldClass} placeholder="https://linkedin.com/in/yourprofile" {...field} data-testid="input-linkedin" />
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
                <FormLabel>GitHub Profile</FormLabel>
                <FormControl>
                  <Input className={underlineFieldClass} placeholder="https://github.com/yourusername" {...field} data-testid="input-github" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Interested Industry - Dropdown for Founder/Cofounder, Multi-select for Intern */}
        {(planType === "founder" || planType === "cofounder") ? (
          <FormField
            control={form.control}
            name="preferredTrack"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interested Industry *</FormLabel>
                <div className="flex items-center gap-2">
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <FormControl>
                      <SelectTrigger className={underlineSelectTriggerClass + " flex-1"} data-testid="select-track">
                      <SelectValue placeholder="Select a track" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {trackOptions.map((track) => (
                      <SelectItem key={track.value} value={track.value}>
                          <div className="flex items-center justify-between w-full group/item">
                            <span className="flex-1 pr-2">{track.label}</span>
                            {TRACK_DETAILS[track.value] && (
                              <HoverCard openDelay={200}>
                                <HoverCardTrigger asChild>
                                  <span
                                    className="ml-2 p-1 rounded hover:bg-gray-100 cursor-pointer flex-shrink-0 opacity-70 group-hover/item:opacity-100 transition-opacity"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                    title="View track details"
                                    role="button"
                                    tabIndex={-1}
                                  >
                                    <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                  </span>
                                </HoverCardTrigger>
                                <HoverCardContent 
                                  className="w-[500px] max-h-[400px] overflow-y-auto z-[99999] bg-white border-2 border-gray-300 shadow-2xl" 
                                  side="right" 
                                  align="start"
                                  sideOffset={8}
                                  style={{ position: 'fixed' }}
                                >
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1">
                                    {TRACK_DETAILS[track.value].subSectors.map((sector, idx) => (
                                      <div key={idx} className="text-xs text-gray-700 leading-relaxed">
                                        • {sector}
                                      </div>
                                    ))}
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            )}
                          </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  {field.value && TRACK_DETAILS[field.value] && (
                    <HoverCard openDelay={200}>
                      <HoverCardTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0 flex-shrink-0"
                          title="View selected track details"
                        >
                          <Info className="h-5 w-5 text-muted-foreground hover:text-primary" />
                        </Button>
                      </HoverCardTrigger>
                      <HoverCardContent 
                        className="w-[500px] max-h-[400px] overflow-y-auto z-[99999] bg-white border-2 border-gray-300 shadow-2xl" 
                        side="right" 
                        align="start"
                        sideOffset={8}
                        style={{ position: 'fixed' }}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1">
                          {TRACK_DETAILS[field.value].subSectors.map((sector, idx) => (
                            <div key={idx} className="text-xs text-gray-700 leading-relaxed">
                              • {sector}
                            </div>
                          ))}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="preferredTracks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interested Industry *</FormLabel>
                <FormDescription>Select 1 to 5 industries that interest you</FormDescription>
                <Popover open={tracksOpen} onOpenChange={setTracksOpen}>
                  <PopoverTrigger asChild>
                      <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={`w-full flex items-center justify-between ${underlineSelectTriggerClass} ${
                          (!field.value || (field.value as string[]).length === 0) ? "text-muted-foreground" : ""
                        }`}
                        data-testid="button-tracks"
                      >
                        {(!field.value || (field.value as string[]).length === 0)
                          ? "Select tracks..."
                          : `${(field.value as string[]).length} track${(field.value as string[]).length > 1 ? 's' : ''} selected`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-white border border-gray-300 rounded-md" align="start">
                    <Command className="bg-white [&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-gray-200 [&_[cmdk-input-wrapper]]:focus-within:border-gray-200">
                      <CommandInput placeholder="Search tracks..." className="bg-white text-gray-900 border-0 focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:outline-none focus:border-0 focus-visible:border-0" />
                      <CommandEmpty className="text-gray-900">No track found.</CommandEmpty>
                      <div className="max-h-[400px] overflow-y-auto">
                        <CommandGroup className="text-gray-900">
                          {trackOptions.map((track) => {
                            const isSelected = Array.isArray(field.value) && field.value.includes(track.value as any);
                            return (
                              <CommandItem
                                key={track.value}
                                value={track.value}
                                onSelect={() => {
                            const current = Array.isArray(field.value) ? field.value : [];
                                  if (isSelected) {
                                    field.onChange(current.filter((v) => v !== track.value));
                                  } else {
                                    if (current.length < 5) {
                                field.onChange([...current, track.value as any]);
                              }
                                  }
                                }}
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-100"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <div className={`h-4 w-4 border rounded-sm flex items-center justify-center mr-2 ${
                                    isSelected ? "bg-red-600 border-red-600 text-white" : "border-input"
                                  }`}>
                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                  </div>
                                  <span className="flex-1">{track.label}</span>
                                </div>
                                {TRACK_DETAILS[track.value] && (
                                  <HoverCard openDelay={200}>
                                    <HoverCardTrigger asChild>
                                      <span
                                        className="ml-2 p-1 rounded hover:bg-gray-200 cursor-pointer flex-shrink-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                        }}
                                        title="View track details"
                                      >
                                        <Info className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                      </span>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-[500px] max-h-[400px] overflow-y-auto z-[9999] bg-white border border-gray-300 shadow-xl" side="right" align="start">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {TRACK_DETAILS[track.value].subSectors.map((sector, idx) => (
                                          <div key={idx} className="text-xs text-gray-700">
                                            • {sector}
                                          </div>
                  ))}
                </div>
                                    </HoverCardContent>
                                  </HoverCard>
                                )}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </div>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="motivation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Why do you want to join StartupUniv? *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about your motivation, any startup ideas you have, and what you hope to achieve..."
                  className={textareaFieldClass + " text-gray-900"}
                  {...field}
                  data-testid="textarea-motivation"
                />
              </FormControl>
              <FormDescription>Minimum 50 characters</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Founder Plan: Additional Questions */}
        {planType === "founder" && (
          <>
            <FormField
              control={form.control}
              name="founderQuestion1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What is your vision for the startup you want to build? *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your long-term vision, goals, and how you plan to make an impact..."
                      className={textareaFieldClass + " text-gray-900"}
                      {...field}
                      data-testid="textarea-founder-q1"
                    />
                  </FormControl>
                  <FormDescription>Minimum 50 characters</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="founderQuestion2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What leadership experience do you bring to the table? *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Share your leadership experience, decision-making abilities, and how you've led teams or projects..."
                      className={textareaFieldClass + " text-gray-900"}
                      {...field}
                      data-testid="textarea-founder-q2"
                    />
                  </FormControl>
                  <FormDescription>Minimum 50 characters</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Cofounder Plan: Role Selection */}
        {planType === "cofounder" && (
          <FormField
            control={form.control}
            name="interestedRole"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Which role are you applying for? *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className={underlineSelectTriggerClass} data-testid="select-cofounder-role">
                      <SelectValue placeholder="Select the co-founder position you want to take in the startup" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CTO">
                      <div className="flex flex-col">
                        <span className="font-semibold">Chief Technology Officer (CTO)</span>
                        <span className="text-xs text-muted-foreground">Lead technology development and technical strategy</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="CBO">
                      <div className="flex flex-col">
                        <span className="font-semibold">Chief Business Officer (CBO)</span>
                        <span className="text-xs text-muted-foreground">Lead business development, sales, and market strategy</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {(planType === "learner" || planType === "cofounder") && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="additional" className="border border-[#E8E4E1] rounded-md px-4">
              <AccordionTrigger className="text-[#17646E]">Additional details</AccordionTrigger>
              <AccordionContent className="pt-4 space-y-6">
                {/* Intern Plan: Role Selection (optional) */}
                {planType === "learner" && (
                  <FormField
                    control={form.control}
                    name="interestedRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Which role are you interested in?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={underlineSelectTriggerClass} data-testid="select-learner-role">
                              <SelectValue placeholder="Select your preferred role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {learnerRoles.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                <div className="flex flex-col">
                                  <span className="font-semibold">{role.label}</span>
                                  <span className="text-xs text-muted-foreground">{role.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose the role that best matches your interests and skills
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Cofounder Additional Questions (optional) */}
                {planType === "cofounder" && (() => {
                  const selectedRole = form.watch("interestedRole");
                  const isCTO = selectedRole === "CTO";
                  const q1Label = isCTO
                    ? "If you were leading the technical team, how would you ensure that the product is developed on time while maintaining quality?"
                    : "If you were responsible for taking the product to market, what would be your first step to reach customers?";
                  const q1Placeholder = isCTO
                    ? "Describe your approach to managing technical development, timelines, and quality assurance..."
                    : "Describe your go-to-market strategy and the first steps you would take to reach your target customers...";
                  const q2Label = isCTO
                    ? "What technology or tool do you think would be most useful for a student-led startup, and why?"
                    : "How would you build trust and collaboration between the team members & get everyone to work to the best of their ability?";
                  const q2Placeholder = isCTO
                    ? "Share your thoughts on the most impactful technology or tool for a student-led startup and your reasoning..."
                    : "Share your approach to building team trust, fostering collaboration, and motivating everyone to perform at their best...";
                  return (
                    <>
                      <FormField
                        control={form.control}
                        name="cofounderQuestion1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{q1Label}</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={q1Placeholder}
                                className={textareaFieldClass + " text-gray-900"}
                                {...field}
                                data-testid="textarea-cofounder-q1"
                              />
                            </FormControl>
                            <FormDescription>Minimum 50 characters</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cofounderQuestion2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{q2Label}</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={q2Placeholder}
                                className={textareaFieldClass + " text-gray-900"}
                                {...field}
                                data-testid="textarea-cofounder-q2"
                              />
                            </FormControl>
                            <FormDescription>Minimum 50 characters</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  );
                })()}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* CV Upload - All Plans */}
        <FormItem>
          <FormLabel>Upload CV *</FormLabel>
          <FormControl>
            <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleCvFileChange}
                className="hidden"
                id="cv-file"
              />
              <label
                htmlFor="cv-file"
                  className={`flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted ${
                    cvError ? "border-red-500" : ""
                  }`}
              >
                <Upload className="h-4 w-4" />
                <span>{cvFile ? cvFile.name : "Upload CV"}</span>
              </label>
              {cvFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{cvFile.name}</span>
                </div>
                )}
              </div>
              {cvError && (
                <p className="text-sm text-red-500 font-medium">{cvError}</p>
              )}
            </div>
          </FormControl>
          <FormDescription>
            Upload your CV/Resume (PDF, DOC, or DOCX)
          </FormDescription>
        </FormItem>

        {/* Problem statement selection removed */}

        {/* Intern Plan: Project Readiness - Simple confirmation at the end */}
        {planType === "learner" && (
          <div className="space-y-4">
            <FormLabel>Project Readiness *</FormLabel>
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="readyForProjects"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value as boolean}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue("needsTraining", false);
                          }
                        }}
                        data-testid="checkbox-ready-for-projects"
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">
                      I am ready to work on projects immediately
                    </FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="needsTraining"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value as boolean}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue("readyForProjects", false);
                          }
                        }}
                        data-testid="checkbox-needs-training"
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">
                      I prefer training before project assignment
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <FormField
            control={form.control}
            name="acceptTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value as boolean}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-accept-terms-plan"
                  />
                </FormControl>
                <FormLabel className="cursor-pointer font-normal">
                  I have read and accepted the <a href="/terms" className="underline text-[#17646E] hover:text-[#121c5b]" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>
                </FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />

        <Button
          type="submit"
          size="lg"
          variant="default"
          className="w-full gap-2 bg-[#17646E] text-white hover:bg-[#121c5b] border-[#17646E]"
          disabled={mutation.isPending}
          data-testid="button-submit-plan-application"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Apply Now
              <Send className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
