import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/site-layout";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Handshake,
  Layers,
  ListChecks,
  Loader2,
  MessagesSquare,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MentorApplicationModal } from "@/components/mentor-application-modal";

/**
 * Careers runs on the same single brown ground as the home and about pages,
 * #814B28, from the header down to the closing card; only the footer keeps its
 * green.
 *
 * On that ground: white for headings, white/75 for body, white/60 for the
 * small caps labels, sand #F0D8C0 for accents and solid buttons (with #5C3318
 * as the text on them), and white/15 for every rule and card edge.
 *
 * Two things stay light on purpose — the hero art plate and the partner logo
 * chips — because those marks ship with their own white and navy lockups and
 * are illegible directly on brown.
 */

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

/* The hero states who we are as scannable facts before any prose — the same
   four the about page opens with, so the story matches wherever you land. */
const heroFacts = [
  { label: "Founded in 2025", icon: CalendarClock },
  { label: "20,000+ students", icon: Users },
  { label: "40+ startups started", icon: Rocket },
  { label: "9 partner organisations", icon: Handshake },
];

const heroChips = ["Mentors", "Programme delivery", "Engineering", "Partnerships"];

/* One year in, stated as numbers rather than adjectives. */
const milestones = [
  {
    value: "2025",
    label: "The year we started",
    body: "StartupUniv opened its first cohort in 2025 with one question: why does so much good student work stop at the submission?",
    icon: Sparkles,
  },
  {
    value: "20,000+",
    label: "Students we have worked with",
    body: "Across campuses, cohorts and college batches — teams running their own projects and teams placed onto ours.",
    icon: GraduationCap,
  },
  {
    value: "40+",
    label: "Startups started here",
    body: "Companies registered, products launched and first customers won by teams that began with a semester project.",
    icon: Rocket,
  },
  {
    value: "9",
    label: "Academic and industry partners",
    body: "Universities, skilling bodies and technology companies who set briefs, review work and open doors for our teams.",
    icon: Handshake,
  },
];

/* The gaps we were built to close — the reason the job exists at all. */
const gaps = [
  {
    value: "90%+",
    title: "Fail within five years",
    body: "Most startups collapse from poor execution, weak market fit and missing guidance — even when the idea was a good one.",
    icon: Layers,
  },
  {
    value: "<10%",
    title: "Have real mentorship",
    body: "Only a small fraction of founders get structured, consistent review of the decisions that actually decide the outcome.",
    icon: Users,
  },
  {
    value: "70%",
    title: "Fail on execution gaps",
    body: "Teams build without validating a real need, so traction never arrives and the work quietly stops.",
    icon: Target,
  },
];

/* Illustrative examples of what teams have carried out of a cohort — the same
   ventures the about page names, so the two pages tell one story. */
const venturesBuiltHere = [
  {
    name: "Sproutkart",
    sector: "Agri commerce",
    body: "A farm-to-hostel produce marketplace that started as a third-semester project and now supplies eleven campus kitchens.",
  },
  {
    name: "Tarang Mobility",
    sector: "Electric mobility",
    body: "Retrofit EV kits for campus shuttle fleets, taken from prototype all the way to a road-legal pilot.",
  },
  {
    name: "Vaanya Health",
    sector: "Digital health",
    body: "Teleconsultation tooling for tier-three clinics, validated with real doctors before a single feature shipped.",
  },
  {
    name: "Kagaz",
    sector: "Compliance",
    body: "Paperwork and filing automation for small firms, sold to its first twelve customers during the cohort itself.",
  },
  {
    name: "Studyloop",
    sector: "Education",
    body: "A peer tutoring marketplace that went from an idea on a whiteboard to a running product with paying users.",
  },
  {
    name: "Meshworks",
    sector: "IoT",
    body: "Energy and occupancy monitoring for college buildings, maintained under a support desk the team runs themselves.",
  },
];

/* What the job is actually like, in our own working vocabulary. */
const howWeWork = [
  {
    title: "Your work has an owner too",
    body: "We run ourselves the way we ask our teams to run: sprints with goals, tasks with one named owner, and a demo at the end.",
    icon: ListChecks,
  },
  {
    title: "Reviews, not verdicts",
    body: "Work is scored against a rubric with written feedback. You will always know what good looks like and how to get there.",
    icon: ClipboardCheck,
  },
  {
    title: "Standups that clear blockers",
    body: "Yesterday, today, anything in the way. Two minutes each, and obstacles get cleared the same day they come up.",
    icon: CalendarClock,
  },
  {
    title: "Progress you can point at",
    body: "Team metrics roll up across sprints, so contribution is visible rather than argued about at appraisal time.",
    icon: BarChart3,
  },
  {
    title: "Decisions stay with the work",
    body: "Channels, attachments and minutes sit beside the sprint board, so nobody has to reconstruct why a call was made.",
    icon: MessagesSquare,
  },
  {
    title: "Room to shape the thing",
    body: "We are one year old. Most of what you touch will not have an owner yet — bring a view and you will get to act on it.",
    icon: Compass,
  },
];

/* Who we keep hiring. */
const whoWeHire = [
  "Practitioners who have shipped something, not only taught it",
  "Mentors who can review honestly and still leave a team motivated",
  "Programme people who can hold a cohort, a calendar and a rubric together",
  "Engineers who would rather finish one thing properly than start three",
  "Partnership people who can open a door and then keep it open",
];

/* How hiring actually runs here. */
const hiringSteps = [
  {
    step: "01",
    title: "Apply to a role",
    body: "Pick the opening that fits and send us your application. One form, no login, no portal to chase.",
  },
  {
    step: "02",
    title: "A short conversation",
    body: "Thirty minutes on what you have built, what you want to build next, and whether this is that.",
  },
  {
    step: "03",
    title: "A real piece of work",
    body: "A sprint plan, a rubric, a review, a spec — whatever the role actually does, sized to a couple of hours.",
  },
  {
    step: "04",
    title: "Meet the team",
    body: "You talk to the people you would work beside every day, and you get to ask them anything.",
  },
  {
    step: "05",
    title: "Offer and start",
    body: "A clear offer with the scope written down, and a first sprint waiting with goals already on it.",
  },
];

const universityPartners = [
  { src: "/landing/home/partner-vtu.png", alt: "VTU" },
  { src: "/landing/home/partner-jain.png", alt: "Jain University" },
  { src: "/landing/home/partner-nsdc.png", alt: "NSDC" },
];

const industryPartners = [
  { src: "/landing/home/partner-aws.png", alt: "AWS" },
  { src: "/landing/home/partner-ibm.png", alt: "IBM" },
  { src: "/landing/home/partner-cisco.png", alt: "Cisco" },
  { src: "/landing/home/partner-redhat.svg", alt: "Red Hat" },
  { src: "/landing/home/partner-nasscom.png", alt: "NASSCOM" },
];

// Academic and industry logos ride one band together.
const allPartners = [...universityPartners, ...industryPartners];

// The marquee shifts its track by exactly half, so the number of copies must be
// even, and one half has to stay wider than the band at any viewport.
const partnerTrack = Array.from({ length: 4 }, () => allPartners).flat();

/**
 * One row of the filter panel: a header that always shows what the group is
 * currently set to, and the controls underneath only once it is opened.
 *
 * Declared at module level rather than inside the page so React keeps the same
 * element between renders — nesting it would remount the group, and the
 * industry list would lose its scroll position on every keystroke elsewhere.
 */
function FilterSection({
  id,
  label,
  summary,
  openGroup,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  summary: string;
  openGroup: string | null;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  const open = openGroup === id;
  const panelId = `filter-panel-${id}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-[#F0D8C0]"
      >
        <span className="text-[15px] font-semibold text-white">{label}</span>
        <span className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm text-white/60">{summary}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[#F0D8C0] transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </span>
      </button>

      {open ? (
        <div id={panelId} className="pb-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* Checkboxes sit on brown here, so the teal default would disappear. */
const checkboxClass =
  "border-white/45 focus-visible:ring-[#F0D8C0] focus-visible:ring-offset-[#814B28] data-[state=checked]:border-[#F0D8C0] data-[state=checked]:bg-[#F0D8C0] data-[state=checked]:text-[#5C3318]";

export default function CareersPage() {
  const [selectedJob, setSelectedJob] = useState<MentorJobPosting | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
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

  /* What each collapsed group reports about itself in its header. */
  const groupSummary = useMemo(
    () => ({
      location: filters.location || "All locations",
      industry:
        filters.preferredIndustries.length > 0
          ? `${filters.preferredIndustries.length} selected`
          : "Any industry",
      jobType:
        filters.jobType.length > 0 ? `${filters.jobType.length} selected` : "Any employment type",
      experience: filters.experience || "Any experience",
    }),
    [filters.location, filters.preferredIndustries, filters.jobType, filters.experience]
  );

  /* Everything currently narrowing the list, as chips that stay visible while
     the panel is collapsed — each one removes just itself. */
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; remove: () => void }[] = [];

    if (filters.location) {
      chips.push({
        key: `location:${filters.location}`,
        label: filters.location,
        remove: () => handleFilterChange("location", ""),
      });
    }
    filters.preferredIndustries.forEach((industry) =>
      chips.push({
        key: `industry:${industry}`,
        label: industry,
        remove: () => togglePreferredIndustry(industry),
      })
    );
    filters.jobType.forEach((type) =>
      chips.push({
        key: `type:${type}`,
        label: JOB_TYPES.find((t) => t.value === type)?.label ?? type,
        remove: () => toggleJobType(type),
      })
    );
    if (filters.experience) {
      chips.push({
        key: "experience",
        label: filters.experience,
        remove: () => handleFilterChange("experience", ""),
      });
    }

    return chips;
  }, [filters]);

  const scrollToOpenPositions = () => {
    const el = document.getElementById("open-positions");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleGroup = (id: string) => setOpenGroup((current) => (current === id ? null : id));

  return (
    <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — why the job exists, stated as facts before any prose       */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-[#814B28] pb-14 pt-12 text-white md:pb-20 md:pt-16">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#F0D8C0]/35 bg-[#F0D8C0]/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
                <Briefcase className="h-3.5 w-3.5" />
                Careers at StartupUniv
              </span>

              <h1 className="mt-6 text-fluid-h1 font-light tracking-tight text-white">
                Come build the company that—
                <span className="font-semibold">builds founders.</span>
              </h1>

              <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">
                StartupUniv was developed to effectively bridge these gaps.
              </p>

              <p className="mt-4 max-w-xl text-fluid-body text-white/80">
                We started in 2025. In one year we have worked with more than 20,000 students,
                partnered with universities, skilling bodies and technology companies, and watched
                teams carry semester projects out of the classroom and into registered companies.
                We are hiring the people who make the next year of that happen.
              </p>

              <ul className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
                {heroFacts.map((fact) => (
                  <li key={fact.label} className="flex items-center gap-2 text-sm text-white/90">
                    <fact.icon className="h-[18px] w-[18px] shrink-0 text-[#DCB48C]" />
                    {fact.label}
                  </li>
                ))}
              </ul>

              <ul className="mt-6 flex flex-wrap gap-3">
                {heroChips.map((chip) => (
                  <li
                    key={chip}
                    className="rounded-full border border-[#DCB48C]/45 px-4 py-2 text-sm text-white/90"
                  >
                    {chip}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={scrollToOpenPositions}
                  className="group inline-flex items-center gap-3 rounded-xl bg-[#F0D8C0] px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#5C3318] transition-colors hover:bg-[#F6EFE6]"
                >
                  See open roles
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                <Link
                  href="/program"
                  className="group inline-flex items-center gap-3 rounded-xl border border-[#F0D8C0]/45 px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#F0D8C0] transition-colors hover:border-[#F0D8C0] hover:bg-[#F0D8C0] hover:text-[#5C3318]"
                >
                  Explore programmes
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Shown whole on the same light plate the home and about heroes
                use, so all three pages open with the same object. */}
            <div className="overflow-hidden rounded-[20px] border border-[#F0D8C0]/20 bg-[#F6F1E9] shadow-2xl">
              <img
                src="/landing/home/build-legal-finance.png"
                alt="A StartupUniv team working through a problem together"
                className="block h-full max-h-[560px] w-full object-cover object-center"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Proof — academic and industry partners in one scrolling band      */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-white/15 py-12 text-white md:py-16">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
            The partners you would be working alongside
          </p>
          <div className="marquee-mask overflow-hidden">
            <div className="animate-marquee-rtl flex w-max items-center gap-x-5 md:gap-x-6">
              {partnerTrack.map((p, i) => {
                const isFirstPass = i < allPartners.length;
                return (
                  <div
                    key={`${p.alt}-${i}`}
                    className="flex h-[88px] w-[170px] shrink-0 items-center justify-center rounded-xl bg-[#F6F1E9] px-5 md:h-24 md:w-[190px]"
                  >
                    <img
                      src={p.src}
                      /* Only the first pass is announced; the repeats are decorative. */
                      alt={isFirstPass ? p.alt : ""}
                      aria-hidden={!isFirstPass}
                      className="h-10 w-auto max-w-full object-contain md:h-12"
                      loading="eager"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* One year in — the numbers you would be joining                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              One year old, and already this far.
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              We are early enough that what you do still moves the numbers, and far enough along
              that the work is real. Here is where a year of it has got us.
            </p>
          </div>

          <div className="mt-11 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {milestones.map((m) => (
              <div
                key={m.value}
                className="rounded-2xl border-t-2 border-[#F0D8C0]/50 bg-white/[0.07] p-6"
              >
                <m.icon className="h-5 w-5 text-[#F0D8C0]" />
                <p className="mt-4 font-serif text-4xl font-normal text-white">{m.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                  {m.label}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/75">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The gaps — the reason the role exists                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-white/15 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
                <Target className="h-3.5 w-3.5" />
                Why the work matters
              </span>
              <h2 className="mt-6 font-serif text-fluid-h1 font-normal tracking-tight text-white">
                Good ideas keep stopping. We are here to fix that.
              </h2>
              <p className="mt-5 text-fluid-body text-white/75">
                Most ventures do not fail on the idea. They fail on execution, on validation and on
                the absence of anyone senior reviewing the decisions that decide the outcome.
                StartupUniv was developed to effectively bridge these gaps — and every role here
                exists to close one of them.
              </p>
              <div className="mt-8 overflow-hidden rounded-2xl border border-white/15">
                <img
                  src="/landing/home/build-team-mentorship.png"
                  alt="A mentor reviewing work with a student team"
                  className="h-full max-h-[420px] w-full object-cover object-center"
                  loading="lazy"
                />
              </div>
            </div>

            <div>
              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
                What we are up against
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {gaps.map((g) => (
                  <div key={g.title} className="rounded-2xl border border-white/15 bg-white/[0.07] p-6">
                    <g.icon className="h-5 w-5 text-[#F0D8C0]" />
                    <p className="mt-4 font-serif text-3xl font-normal text-white">{g.value}</p>
                    <h3 className="mt-1 font-semibold leading-snug text-white">{g.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/75">{g.body}</p>
                  </div>
                ))}

                <div className="rounded-2xl border border-[#F0D8C0]/40 bg-[#F0D8C0]/10 p-6">
                  <Sparkles className="h-5 w-5 text-[#F0D8C0]" />
                  <h3 className="mt-4 font-serif text-2xl font-normal text-white">
                    So we built the other way round
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/80">
                    Owned tasks, real deadlines, mentor review and evidence behind every claim —
                    for the teams we teach, and for the team that teaches them.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Started here — what teams carried out of a cohort                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-white/15 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Startups that started here
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              Forty-odd companies have come out of our cohorts so far. These are a few of them —
              and the kind of outcome your work here would be measured against.
            </p>
          </div>

          <div className="mt-11 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {venturesBuiltHere.map((v) => (
              <div key={v.name} className="border-t border-white/15 pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-serif text-2xl font-normal text-white">{v.name}</h3>
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-[#F0D8C0]">
                    {v.sector}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How we work — the job, in our own working vocabulary              */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-white/15 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              We run ourselves the way we ask teams to run
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              No separate rulebook for staff. The sprint board, the standup and the review are the
              same ones our cohorts use — which is the fastest way to find out whether they work.
            </p>
          </div>

          <div className="mt-11 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {howWeWork.map((w) => (
              <div key={w.title} className="border-t border-white/15 pt-4">
                <div className="flex items-center gap-2">
                  <w.icon className="h-4 w-4 shrink-0 text-[#F0D8C0]" />
                  <h3 className="font-semibold text-white">{w.title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-white/75">{w.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
            <div>
              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
                Who we keep hiring
              </p>
              <ul className="space-y-3.5">
                {whoWeHire.map((who) => (
                  <li key={who} className="flex gap-3 text-[15px] leading-relaxed text-white/80">
                    <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#F0D8C0]" />
                    {who}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
                How hiring runs
              </p>
              <ol className="relative space-y-6 border-l border-white/15 pl-7">
                {hiringSteps.map((s) => (
                  <li key={s.step} className="relative">
                    <span className="absolute -left-[38px] flex h-[26px] w-[26px] items-center justify-center rounded-full border border-[#F0D8C0]/40 bg-[#814B28] text-[10px] font-semibold text-[#F0D8C0]">
                      {s.step}
                    </span>
                    <h3 className="font-semibold text-white">{s.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Open positions — the live listing, on the same brown ground       */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="open-positions"
        className="scroll-mt-20 border-t border-white/15 py-16 text-white md:py-24"
      >
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
              Open positions
            </p>
            <h2 className="mt-4 font-serif text-fluid-h1 font-normal tracking-tight text-white">
              {isLoading ? "Roles open right now" : `${jobs.length} roles open right now`}
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              Filter by where you are, what you know and how you want to work. Nothing here is a
              placeholder — every opening has a team waiting for it.
            </p>
          </div>

          {/* Filters — one collapsible panel. It opens closed so the roles sit
              near the top of the fold; whatever is active stays on show as
              chips underneath the toggle even while the panel is shut. */}
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07]">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="job-filters"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left md:px-7 md:py-5"
            >
              <span className="flex items-center gap-3">
                <SlidersHorizontal className="h-[18px] w-[18px] shrink-0 text-[#F0D8C0]" />
                <span className="text-[15px] font-semibold text-white">Filter roles</span>
                {activeFilters.length > 0 ? (
                  <span className="rounded-full bg-[#F0D8C0] px-2.5 py-0.5 text-xs font-semibold text-[#5C3318]">
                    {activeFilters.length}
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-3 text-sm text-white/60">
                <span className="hidden sm:inline">{filtersOpen ? "Hide" : "Show"}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[#F0D8C0] transition-transform duration-200",
                    filtersOpen && "rotate-180"
                  )}
                />
              </span>
            </button>

            {activeFilters.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-5 py-4 md:px-7">
                {activeFilters.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.remove}
                    className="inline-flex items-center gap-2 rounded-full border border-[#DCB48C]/45 py-1 pl-3 pr-2.5 text-xs text-white/85 transition-colors hover:border-[#F0D8C0] hover:bg-[#F0D8C0]/10"
                  >
                    {chip.label}
                    <X className="h-3 w-3 shrink-0 text-[#F0D8C0]" />
                    <span className="sr-only">Remove filter</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-1 text-xs font-semibold text-[#F0D8C0] underline-offset-4 hover:underline"
                >
                  Clear all
                </button>
              </div>
            ) : null}

            {filtersOpen ? (
              <div
                id="job-filters"
                className="divide-y divide-white/10 border-t border-white/10 px-5 md:px-7"
              >
                <FilterSection
                  id="location"
                  label="Location"
                  summary={groupSummary.location}
                  openGroup={openGroup}
                  onToggle={toggleGroup}
                >
                  <div className="flex flex-wrap gap-2">
                    {locationOptions.map((option) => {
                      const value = option === "All locations" ? "" : option;
                      const active = filters.location === value;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleFilterChange("location", value)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm transition-colors",
                            active
                              ? "border-[#F0D8C0] bg-[#F0D8C0] text-[#5C3318]"
                              : "border-white/25 text-white/85 hover:border-[#F0D8C0]/60 hover:bg-white/10"
                          )}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </FilterSection>

                <FilterSection
                  id="industry"
                  label="Preferred industry"
                  summary={groupSummary.industry}
                  openGroup={openGroup}
                  onToggle={toggleGroup}
                >
                  <div className="grid max-h-72 gap-x-8 gap-y-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                    {PREFERRED_INDUSTRIES.map((industry) => (
                      <label
                        key={industry}
                        className="flex cursor-pointer select-none items-start gap-3"
                      >
                        <Checkbox
                          checked={filters.preferredIndustries.includes(industry)}
                          onCheckedChange={() => togglePreferredIndustry(industry)}
                          className={cn("mt-0.5", checkboxClass)}
                        />
                        <span className="text-sm leading-snug text-white/85">{industry}</span>
                      </label>
                    ))}
                  </div>
                </FilterSection>

                <FilterSection
                  id="jobType"
                  label="Employment type"
                  summary={groupSummary.jobType}
                  openGroup={openGroup}
                  onToggle={toggleGroup}
                >
                  <div className="flex flex-wrap gap-x-8 gap-y-3">
                    {JOB_TYPES.map((type) => (
                      <label
                        key={type.value}
                        className="flex cursor-pointer select-none items-center gap-3"
                      >
                        <Checkbox
                          checked={filters.jobType.includes(type.value)}
                          onCheckedChange={() => toggleJobType(type.value)}
                          className={checkboxClass}
                        />
                        <span className="text-sm text-white/85">{type.label}</span>
                      </label>
                    ))}
                  </div>
                </FilterSection>

                <FilterSection
                  id="experience"
                  label="Experience"
                  summary={groupSummary.experience}
                  openGroup={openGroup}
                  onToggle={toggleGroup}
                >
                  <Input
                    placeholder="e.g., 3-5 years"
                    value={filters.experience}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, experience: e.target.value }))
                    }
                    className="max-w-sm rounded-xl border-white/20 bg-white/[0.07] text-white placeholder:text-white/50 focus-visible:ring-[#F0D8C0]"
                  />
                </FilterSection>
              </div>
            ) : null}
          </div>

          <div className="mt-10">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#F0D8C0]" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-10 md:p-12">
                <h3 className="font-serif text-2xl font-normal text-white">
                  Nothing open on those filters
                </h3>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/75">
                  Clear them to see everything, or write to us anyway — we keep good applications on
                  file and open roles faster than we post them.
                </p>
                <div className="mt-7">
                  <Link
                    href="/contact"
                    className="group inline-flex items-center gap-3 rounded-xl bg-[#F0D8C0] px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#5C3318] transition-colors hover:bg-[#F6EFE6]"
                  >
                    Write to us
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {jobs.map((job) => {
                  const meta = [
                    "Full-time",
                    job.location,
                    job.experienceRequired ? job.experienceRequired : undefined,
                    job.jobType ? jobTypeToLabel(job.jobType) : undefined,
                  ].filter(Boolean) as string[];

                  const summary =
                    job.description || job.aboutTheRole || job.whatYouWillDo || job.whatMightBeAFitIf || "";

                  return (
                    <div
                      key={job.id}
                      className="flex flex-col rounded-2xl border-t-2 border-[#F0D8C0]/50 bg-white/[0.07] p-7"
                    >
                      <h3 className="font-serif text-2xl font-normal leading-snug text-white">
                        {job.title}
                      </h3>

                      <ul className="mt-4 flex flex-wrap gap-2">
                        {meta.map((m) => (
                          <li
                            key={m}
                            className="rounded-full border border-[#DCB48C]/45 px-3 py-1 text-xs text-white/85"
                          >
                            {m}
                          </li>
                        ))}
                      </ul>

                      {summary ? (
                        <p className="mt-4 flex-1 text-[15px] leading-relaxed text-white/75">
                          {summary}
                        </p>
                      ) : (
                        <div className="flex-1" />
                      )}

                      <div className="mt-7">
                        <button
                          type="button"
                          onClick={() => handleApply(job)}
                          className="group inline-flex items-center gap-3 rounded-xl bg-[#F0D8C0] px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-[#5C3318] transition-colors hover:bg-[#F6EFE6]"
                        >
                          Apply now
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Close                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.07]">
            <div className="grid items-stretch gap-8 p-8 md:grid-cols-[1fr_1fr] md:gap-10 md:p-12">
              <div>
                <h2 className="font-serif text-fluid-h2 font-normal tracking-tight text-white">
                  Didn&apos;t find your role? Tell us what you&apos;d build.
                </h2>
                <p className="mt-4 max-w-xl text-fluid-body text-white/75">
                  We are one year in and still writing the job descriptions. If you can see a gap we
                  have not posted yet, that is usually the most interesting conversation we have all
                  week.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={scrollToOpenPositions}
                    className="group inline-flex items-center gap-3 rounded-xl bg-[#F0D8C0] px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#5C3318] transition-colors hover:bg-[#F6EFE6]"
                  >
                    See open roles
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                  <Link
                    href="/contact"
                    className="group inline-flex items-center gap-3 rounded-xl border border-white/40 px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-white hover:text-[#814B28]"
                  >
                    Talk to us first
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
              {/* items-stretch above plus h-full here is what makes the art
                  finish level with the copy instead of floating in the card. */}
              <div className="overflow-hidden rounded-2xl border border-white/15 md:min-h-[320px]">
                <img
                  src="/landing/home/what-is-image.png"
                  alt="A StartupUniv team at work"
                  className="aspect-[2/1] h-full w-full object-cover object-center md:aspect-auto"
                  loading="lazy"
                />
              </div>
            </div>
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
    </SiteLayout>
  );
}
