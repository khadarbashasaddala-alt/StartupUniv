import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/site-layout";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "wouter";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MentorApplicationModal } from "@/components/mentor-application-modal";

interface MentorJobPosting {
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

export default function CareersPage() {
  const [selectedJob, setSelectedJob] = useState<MentorJobPosting | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [filters, setFilters] = useState({
    location: "Bangalore",
    preferredIndustries: [] as string[],
    jobType: [] as string[],
    experience: "",
  });

  const { data: jobs = [], isLoading } = useQuery<MentorJobPosting[]>({
    queryKey: ["/careers/jobs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.location) params.append("location", filters.location);
      if (filters.jobType.length > 0) {
        filters.jobType.forEach((type) => params.append("jobType", type));
      }
      if (filters.preferredIndustries.length > 0) {
        filters.preferredIndustries.forEach((industry) => params.append("areaOfInterest", industry));
      }
      if (filters.experience) params.append("experience", filters.experience);
      
      return apiRequest("GET", `/careers/jobs?${params.toString()}`);
    },
  });

  const handleApply = (job: MentorJobPosting) => {
    setSelectedJob(job);
    setShowApplicationModal(true);
  };

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const togglePreferredIndustry = (industry: string) => {
    setFilters((prev) => ({
      ...prev,
      preferredIndustries: prev.preferredIndustries.includes(industry)
        ? prev.preferredIndustries.filter((i) => i !== industry)
        : [...prev.preferredIndustries, industry],
    }));
  };

  const toggleJobType = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      jobType: prev.jobType.includes(type)
        ? prev.jobType.filter((t) => t !== type)
        : [...prev.jobType, type],
    }));
  };

  const clearFilters = () => {
    setFilters({
      location: "Bangalore",
      preferredIndustries: [],
      jobType: [],
      experience: "",
    });
  };

  const locationOptions = useMemo(() => ["All locations", "Bangalore"], []);

  const jobTypeToLabel = (jobType: MentorJobPosting["jobType"]) => {
    return jobType === "ONSITE" ? "Onsite" : jobType === "OFFLINE" ? "Offline" : "Hybrid";
  };

  const filterLabel = useMemo(() => {
    const locationLabel = filters.location ? filters.location : "All locations";
    const industryLabel = filters.preferredIndustries.length > 0 ? `Preferred Industry (${filters.preferredIndustries.length})` : "Preferred Industry";
    const jobTypeLabel = filters.jobType.length > 0 ? `Employment type (${filters.jobType.length})` : "Employment type";
    return { locationLabel, industryLabel, jobTypeLabel };
  }, [filters.location, filters.preferredIndustries.length, filters.jobType.length]);

  const scrollToOpenPositions = () => {
    const el = document.getElementById("open-positions");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <SiteLayout hideCTA className="bg-[#FFFBF8]" mainClassName="bg-[#FFFBF8]">
      <div className="bg-[#FFFBF8] text-[#12333A] font-serif">
        {/* Hero */}
        <section className="pt-10 md:pt-12">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="bg-[#CCCCFF] px-6 sm:px-8 lg:pl-6 lg:pr-16 py-12 md:py-16 lg:py-20 flex flex-col justify-end gap-10 lg:h-[600px]">
                <div className="w-full max-w-xl">
                  <h1 className="font-['Crimson_Pro',serif] font-light text-[44px] leading-[1.15] md:text-[56px] md:leading-[1.2] lg:text-[68px] lg:leading-[86px] tracking-[-2.58px] text-black">
                    Build the Future of Entrepreneurship
                  </h1>
                  <p className="mt-6 font-['Almarai',sans-serif] text-[18px] md:text-[21px] leading-[30px] tracking-[-0.105px] text-black/90 max-w-[569px]">
                    Join a team that&apos;s redefining how the world creates founders. Help us turn ambitious individuals into
                    successful entrepreneurs.
                  </p>

                  <div className="mt-10 flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={scrollToOpenPositions}
                      className="inline-flex items-center justify-center rounded-full bg-[#2F2E7E] px-[36px] py-[24px] text-[#FFFBF8] text-[18px] leading-[23px] font-['Almarai',sans-serif] tracking-[-0.09px] w-[213px]"
                    >
                      Apply Now
                    </button>
                    <Link href="/program">
                      <a className="inline-flex items-center justify-center rounded-full border border-[#2F2E7E] px-[37px] py-[25px] text-[#2F2E7E] text-[18px] leading-[23px] font-['Almarai',sans-serif] tracking-[-0.09px]">
                        Explore Programs
                      </a>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="relative min-h-[320px] h-[420px] sm:h-[520px] lg:h-[600px]">
                <img
                  src="/careers/hero.jpg"
                  alt="StartupUniv team at work"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Open Positions */}
        <section id="open-positions" className="mt-16 md:mt-24 bg-[#F6F1E9]">
          <div className="container mx-auto py-10 md:py-12">
            <h2 className="font-['Crimson_Pro',serif] font-light text-[#12333A] text-[32px] md:text-[40px] lg:text-[48px] uppercase leading-[1.4] tracking-[-0.2px]">
              Open Positions({isLoading ? "..." : jobs.length})
            </h2>

            <div className="mt-10 flex flex-col gap-6">
              <div className="flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-10">
                {/* Location */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full lg:w-[320px] border-b border-[#A7A7A7] px-4 py-4 flex items-center justify-between font-['Almarai',sans-serif] text-[18px] md:text-[24px] tracking-[1px] text-[#606060]"
                      aria-label="Filter by location"
                    >
                      <span>{filterLabel.locationLabel}</span>
                      <ChevronDown className="h-5 w-5 text-[#606060]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[320px] p-3">
                    <div className="space-y-1">
                      {locationOptions.map((option) => {
                        const value = option === "All locations" ? "" : option;
                        const active = filters.location === value;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleFilterChange("location", value)}
                            className={cn(
                              "w-full text-left rounded-md px-3 py-2 text-sm",
                              active ? "bg-[#17646E] text-white" : "hover:bg-gray-100"
                            )}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Preferred Industry */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full lg:w-[320px] border-b border-[#A7A7A7] px-4 py-4 flex items-center justify-between font-['Almarai',sans-serif] text-[18px] md:text-[24px] tracking-[1px] text-[#606060]"
                      aria-label="Filter by preferred industry"
                    >
                      <span>{filterLabel.industryLabel}</span>
                      <ChevronDown className="h-5 w-5 text-[#606060]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[360px] p-3">
                    <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                      {PREFERRED_INDUSTRIES.map((industry) => (
                        <label key={industry} className="flex items-start gap-3 cursor-pointer select-none">
                          <Checkbox
                            checked={filters.preferredIndustries.includes(industry)}
                            onCheckedChange={() => togglePreferredIndustry(industry)}
                            className="mt-0.5 data-[state=checked]:bg-[#17646E] data-[state=checked]:border-[#17646E]"
                          />
                          <span className="text-sm text-[#12333A]">{industry}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Employment type */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full lg:w-[320px] border-b border-[#A7A7A7] px-4 py-4 flex items-center justify-between font-['Almarai',sans-serif] text-[18px] md:text-[24px] tracking-[1px] text-[#606060]"
                      aria-label="Filter by employment type"
                    >
                      <span>{filterLabel.jobTypeLabel}</span>
                      <ChevronDown className="h-5 w-5 text-[#606060]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[320px] p-3">
                    <div className="space-y-2">
                      {JOB_TYPES.map((type) => (
                        <label key={type.value} className="flex items-center gap-3 cursor-pointer select-none">
                          <Checkbox
                            checked={filters.jobType.includes(type.value)}
                            onCheckedChange={() => toggleJobType(type.value)}
                            className="data-[state=checked]:bg-[#17646E] data-[state=checked]:border-[#17646E]"
                          />
                          <span className="text-sm text-[#12333A]">{type.label}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Keep existing experience filter (functional) */}
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="w-full md:max-w-sm">
                  <Input
                    placeholder="Experience (e.g., 3-5 years)"
                    value={filters.experience}
                    onChange={(e) => setFilters((prev) => ({ ...prev, experience: e.target.value }))}
                    className="bg-white border-[#A7A7A7] text-[#12333A] rounded-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-['Almarai',sans-serif] text-[#17646E] hover:underline w-fit"
                >
                  Clear filters
                </button>
              </div>
            </div>

            <div className="mt-10">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#17646E]" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="bg-white p-10 md:p-12">
                  <p className="font-['Almarai',sans-serif] text-[#606060]">No job postings found matching your filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {jobs.map((job) => {
                    const meta = [
                      "Full-time",
                      job.location,
                      job.experienceRequired ? job.experienceRequired : undefined,
                    ].filter(Boolean);

                    const summary = job.description || job.aboutTheRole || job.whatYouWillDo || job.whatMightBeAFitIf || "";

                    return (
                      <div key={job.id} className="bg-white px-6 py-8 flex flex-col gap-6">
                        <div className="flex flex-col gap-4">
                          <div className="font-['Crimson_Pro',serif] font-light tracking-[-0.6px] text-[#12333A]">
                            <h3 className="text-[26px] md:text-[30px] leading-[30px]">{job.title}</h3>
                            <p className="mt-1 text-[18px] md:text-[20px] leading-[30px]">
                              {meta.join(" • ")}{" "}
                              {job.jobType ? `• ${jobTypeToLabel(job.jobType)}` : ""}
                            </p>
                          </div>
                          {summary ? (
                            <p className="font-['Almarai',sans-serif] font-light text-[#2B2B2B] text-[16px] leading-[1.4]">
                              {summary}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApply(job)}
                          className="inline-flex items-center justify-center rounded-full bg-[#17646E] px-9 py-2 text-white text-[18px] leading-[23px] font-['Almarai',sans-serif] tracking-[-0.09px] w-fit"
                        >
                          Apply Now
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {selectedJob && (
          <MentorApplicationModal
            open={showApplicationModal}
            onOpenChange={setShowApplicationModal}
            jobPosting={selectedJob}
          />
        )}
      </div>
    </SiteLayout>
  );
}

