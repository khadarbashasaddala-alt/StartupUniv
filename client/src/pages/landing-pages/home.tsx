import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/layout/site-layout";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  Layers,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessagesSquare,
  Milestone,
  Presentation,
  Rocket,
  ShieldCheck,
  Target,
  Ticket,
  Timer,
  TrendingUp,
  Users,
  Video,
  Wrench,
} from "lucide-react";

/**
 * Two audiences, two visual worlds, one platform.
 *
 * The whole page is one brown ground, #814B28, from the header down to the
 * closing card; only the footer keeps its green. Nothing alternates, so the
 * two audiences are told apart by wording and order rather than by colour.
 *
 * On that ground: white for headings, white/75 for body, white/60 for the
 * small caps labels, sand #F0D8C0 for accents and solid buttons (with #5C3318
 * as the text on them), and white/15 for every rule and card edge.
 *
 * Two things stay light on purpose -- the hero art plate and the partner logo
 * chips -- because those marks ship with their own white and navy lockups and
 * are illegible directly on brown.
 */

const studentFlow = [
  {
    step: "01",
    title: "Plan the sprint",
    body: "Goals, objectives and deliverables are written down before any work starts, so the team agrees what done means.",
    icon: Target,
  },
  {
    step: "02",
    title: "Every task gets an owner",
    body: "Tasks carry one named owner, a priority, points, start and end dates, and the tasks they build on. Everyone knows exactly what is theirs.",
    icon: ListChecks,
  },
  {
    step: "03",
    title: "Stand up every day",
    body: "Yesterday, today, anything in the way. Two minutes each, and the team clears obstacles together the same day they come up.",
    icon: CalendarClock,
  },
  {
    step: "04",
    title: "Show the work",
    body: "A repository link, a document, a running build. Evidence attaches to the task it proves and goes straight to review.",
    icon: ClipboardCheck,
  },
  {
    step: "05",
    title: "A mentor reviews it",
    body: "Scored against a clear rubric with written feedback, so every team knows what good looks like and how to get there.",
    icon: BookOpen,
  },
  {
    step: "06",
    title: "Demo and move on",
    body: "The sprint is demoed, recorded and signed off. The next one opens with that feedback already in hand.",
    icon: Presentation,
  },
];

const studentOutcomes = [
  {
    title: "A project that reaches production",
    body: "Work is carried all the way to something that runs, gets used, and can be handed to someone else with confidence.",
    icon: Rocket,
  },
  {
    title: "Collaboration you can actually evidence",
    body: "Reviews, standups and dependencies leave a clear record of who built what — valuable long after the marks are in.",
    icon: Users,
  },
  {
    title: "Deadlines that hold",
    body: "Dates live on the task where everyone can see them, along with the work that depends on each one.",
    icon: Timer,
  },
  {
    title: "Academic credit where your college maps it",
    body: "Programme hours and outcomes can be mapped to your institution's credit structure, with certificates on completion.",
    icon: GraduationCap,
  },
];

const startupPillars = [
  {
    label: "Build",
    body: "Sprints with goals and deliverables, tasks with owners and dependencies, evidence against every claim, and a demo at the end of each one.",
    icon: Wrench,
  },
  {
    label: "Sell",
    body: "Real briefs from partner organisations, and introductions that put your product in front of people ready to buy.",
    icon: TrendingUp,
  },
  {
    label: "Market",
    body: "Positioning, launch and demo day worked on as deliverables with deadlines and mentor review, the same as everything else.",
    icon: Megaphone,
  },
  {
    label: "Maintain",
    body: "A support desk with priority, category, response targets and escalation paths, so what you launch keeps running and keeps improving.",
    icon: LifeBuoy,
  },
];

const startupSystem = [
  {
    title: "Milestones with deadlines and resources",
    body: "Each milestone carries its goals, deliverables, start and end dates, ordering and status — and the reference material attached to it.",
    icon: Milestone,
  },
  {
    title: "Progress and team health at a glance",
    body: "Team metrics roll up across sprints so you can see throughput, where the momentum is, and who could use a hand.",
    icon: BarChart3,
  },
  {
    title: "Standups, demos and evidence",
    body: "A daily written pulse, a demo per sprint, and reviewed evidence behind each deliverable. Progress you can see at a glance.",
    icon: ClipboardCheck,
  },
  {
    title: "Support desk with SLA",
    body: "Raise it, route it, escalate it. Response targets are tracked and the full history stays on the ticket, so nothing needs chasing twice.",
    icon: Ticket,
  },
  {
    title: "Team chat where the work is",
    body: "Channels, attachments and reactions sitting right beside the sprint board, so decisions stay with the work they belong to.",
    icon: MessagesSquare,
  },
  {
    title: "Meetings that leave a record",
    body: "Agenda, calendar invite, attendees, minutes and the recording — all kept with the sprint and easy to find later.",
    icon: Video,
  },
];

const sharedPlatform = [
  { title: "Sprint board", body: "Plan, assign, track and export a sprint end to end.", icon: Layers },
  { title: "Task ownership", body: "One owner, a reviewer, dates, points and dependencies.", icon: ListChecks },
  { title: "Daily standups", body: "Yesterday, today, blockers — written and kept.", icon: CalendarClock },
  { title: "Evidence and review", body: "Submit proof, get scored against a rubric, get feedback.", icon: ClipboardCheck },
  { title: "Mentor sessions", body: "Booked, logged and attributed to the sprint they served.", icon: BookOpen },
  { title: "Meetings and minutes", body: "Calendar sync, attendees, MoM documents, recordings.", icon: Video },
  { title: "Tickets and SLA", body: "Priority, escalation, due times, breach flags, reopens.", icon: Ticket },
  { title: "Team chat", body: "Channels with attachments and reactions, beside the board.", icon: MessagesSquare },
  { title: "Analytics", body: "Team, cohort and programme level progress reporting.", icon: BarChart3 },
  { title: "Assessments", body: "Timed, scored and mapped to a passing threshold.", icon: ShieldCheck },
  { title: "Learning hub", body: "Resources attached to the sprint that needs them.", icon: BookOpen },
  { title: "Certificates", body: "Issued on completion, with outcomes recorded.", icon: GraduationCap },
];

/* The hero states the offer as scannable facts before any prose. Both lists are
   the old hero paragraphs, broken into the units a reader actually scans. */
const heroFacts = [
  { label: "College teams", icon: GraduationCap },
  { label: "Startup builders", icon: Rocket },
  { label: "Clear ownership", icon: ListChecks },
  { label: "Meaningful deadlines", icon: CalendarClock },
  { label: "Visible progress", icon: BarChart3 },
];

const heroChips = ["Owned tasks", "Daily standups", "Mentor reviews", "Evidence of the work"];

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

export default function HomePage() {
  return (
    <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — warm sandstone stage: the claim left, the work right        */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-[#814B28] pb-14 pt-12 text-white md:pb-20 md:pt-16">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div>
              <h1 className="text-fluid-h1 font-light tracking-tight text-white">
                Don't let your best work end with a submission—
                <span className="font-semibold">or your startup stall after launch.</span>
              </h1>

              <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">
                Turn ideas into things that keep growing.
              </p>

              <p className="mt-4 max-w-xl text-fluid-body text-white/80">
                StartupUniv gives teams the structure to turn ideas into outcomes.
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
                <a
                  href="#college-teams"
                  className="group inline-flex items-center gap-3 rounded-xl bg-[#F0D8C0] px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#5C3318] transition-colors hover:bg-[#F6EFE6]"
                >
                  I'm on a college team
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
                <a
                  href="#startup-builders"
                  className="group inline-flex items-center gap-3 rounded-xl border border-[#F0D8C0]/45 px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#F0D8C0] transition-colors hover:border-[#F0D8C0] hover:bg-[#F0D8C0] hover:text-[#5C3318]"
                >
                  I'm building a startup
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>

            {/* The art is a composed graphic with a caption baked into it, so it
                is shown whole at its own ratio — cropping it loses the caption. */}
            <div className="overflow-hidden rounded-[20px] border border-[#F0D8C0]/20 bg-[#F6F1E9] shadow-2xl">
              <img
                src="/landing/home-hero.png"
                alt="A StartupUniv team working together"
                className="block h-auto w-full"
                width={1307}
                height={1203}
                loading="eager"
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
            Academic and industry partners
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
      {/* Track one — college teams (ochre, on paper)                       */}
      {/* ---------------------------------------------------------------- */}
      <section id="college-teams" className="scroll-mt-20 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#F0D8C0]/35 bg-[#F0D8C0]/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
                <GraduationCap className="h-3.5 w-3.5" />
                For college teams
              </span>
              <h2 className="mt-6 font-serif text-fluid-h1 font-normal tracking-tight text-white">
                Bring your own project. Finish it properly.
              </h2>
              <p className="mt-5 text-fluid-body text-white/75">
                Your team, your idea, your coursework. What you get from us is the part colleges
                rarely teach: how to break work into tasks somebody actually owns, how to hold a
                deadline, how to review each other's work, and how to carry a project past the demo
                into something that runs.
              </p>
              <div className="mt-8 overflow-hidden rounded-2xl border border-white/15">
                <img
                  src="/landing/home/build-team-mentorship.png"
                  alt="A mentor reviewing work with a student team"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Dropped on lg so the timeline starts level with the copy rather
                than the eyebrow, and runs down past the photo beside it. */}
            <div className="lg:pt-28">
              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
                One sprint, start to finish
              </p>
              <ol className="relative space-y-7 border-l border-white/15 pl-7">
                {studentFlow.map((s) => (
                  <li key={s.step} className="relative">
                    <span className="absolute -left-[38px] flex h-[26px] w-[26px] items-center justify-center rounded-full border border-[#F0D8C0]/40 bg-[#814B28] text-[10px] font-semibold text-[#F0D8C0]">
                      {s.step}
                    </span>
                    <div className="flex items-center gap-2">
                      <s.icon className="h-4 w-4 shrink-0 text-[#F0D8C0]" />
                      <h3 className="font-semibold text-white">{s.title}</h3>
                    </div>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {studentOutcomes.map((o) => (
              <div
                key={o.title}
                className="rounded-2xl border-t-2 border-[#F0D8C0]/50 bg-white/[0.07] p-5"
              >
                <o.icon className="h-5 w-5 text-[#F0D8C0]" />
                <h3 className="mt-3 font-semibold leading-snug text-white">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{o.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/for-students">
              <Button className="rounded-full bg-[#F0D8C0] px-7 py-6 text-base font-medium text-[#5C3318] hover:bg-[#F6EFE6]">
                For college teams
              </Button>
            </Link>
            <Link href="/apply">
              <Button
                variant="outline"
                className="rounded-full border-2 border-[#F0D8C0] px-7 py-6 text-base font-medium text-[#F0D8C0] hover:bg-[#F0D8C0] hover:text-[#5C3318]"
              >
                Start a project
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Track two — startup builders (teal, on deep petrol)               */}
      {/* ---------------------------------------------------------------- */}
      <section id="startup-builders" className="scroll-mt-20 bg-[#814B28] py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
              <Rocket className="h-3.5 w-3.5" />
              For startup builders
            </span>
            <h2 className="mt-6 font-serif text-fluid-h1 font-normal tracking-tight text-white">
              A company is more than the product.
            </h2>
            <p className="mt-5 text-fluid-body text-white/75">
              Building is the part most founders already know how to do. Selling it, marketing it and
              keeping it alive afterwards is where things quietly fall apart. Every one of those is
              run here as work with an owner, a deadline and a review.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
            {startupPillars.map((p) => (
              <div key={p.label} className="bg-[#814B28] p-6">
                <p.icon className="h-6 w-6 text-[#F0D8C0]" />
                <h3 className="mt-4 font-serif text-2xl font-normal text-white">{p.label}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-white/70">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
            <div>
              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/50">
                How it is actually run
              </p>
              <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
                {startupSystem.map((f) => (
                  <div key={f.title}>
                    <div className="flex items-center gap-2">
                      <f.icon className="h-4 w-4 shrink-0 text-[#F0D8C0]" />
                      <h3 className="font-semibold text-white">{f.title}</h3>
                    </div>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">{f.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/15">
              <img
                src="/landing/home/build-market-access.png"
                alt="A founding team reviewing milestone progress"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link href="/for-professionals">
              <Button className="rounded-full bg-[#F0D8C0] px-7 py-6 text-base font-medium text-[#5C3318] hover:bg-[#F6EFE6]">
                For startup builders
              </Button>
            </Link>
            <Link href="/plans">
              <Button
                variant="outline"
                className="rounded-full border-2 border-white/40 bg-transparent px-7 py-6 text-base font-medium text-white hover:bg-white hover:text-[#814B28]"
              >
                See the plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Two ways in — the routes are genuinely different, so say so       */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Two ways in
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              They are not the same thing, and it matters which one you want.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-7">
              <div className="flex items-center gap-2 text-white">
                <Building2 className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">The programme</p>
              </div>
              <h3 className="mt-4 font-serif text-2xl font-normal text-white">
                Join a cohort and get placed on a team
              </h3>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-white/75">
                Selective. You apply, take an assessment, and if you are accepted you are placed into
                a cohort with a team, a mentor and a real brief to work against. Structure,
                mentorship and the partner network come with it.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-white/75">
                <li className="flex gap-2">
                  <Timer className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                  Apply, assess, then placed in a cohort
                </li>
                <li className="flex gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                  Team, mentor and brief assigned to you
                </li>
              </ul>
              <div className="mt-7">
                <Link href="/apply">
                  <Button className="rounded-full bg-[#F0D8C0] px-7 py-6 text-base font-medium text-[#5C3318] hover:bg-[#F6EFE6]">
                    Apply to a cohort
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-7">
              <div className="flex items-center gap-2 text-[#F0D8C0]">
                <Layers className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">Bring your own</p>
              </div>
              <h3 className="mt-4 font-serif text-2xl font-normal text-white">
                Run a project or startup you already have
              </h3>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-white/75">
                You already have the team and the idea — a capstone project, a side product, an
                early company. You use the platform and the mentoring to run it properly. Talk to us
                about setting your team up.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-white/75">
                <li className="flex gap-2">
                  <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[#F0D8C0]" />
                  Your own project, your own team
                </li>
                <li className="flex gap-2">
                  <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-[#F0D8C0]" />
                  Colleges can set this up for a whole batch
                </li>
              </ul>
              <div className="mt-7">
                <Link href="/contact">
                  <Button
                    variant="outline"
                    className="rounded-full border-2 border-white/40 px-7 py-6 text-base font-medium text-white hover:bg-white hover:text-[#814B28]"
                  >
                    Talk to us
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Shared platform — the thing both tracks actually run on           */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-white/15 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              One platform underneath both
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              A semester project and an early company need the same things: work that is owned,
              deadlines that are visible, and proof that something was finished. This is what both
              tracks run on.
            </p>
          </div>

          <div className="mt-11 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {sharedPlatform.map((f) => (
              <div key={f.title} className="border-t border-white/15 pt-4">
                <div className="flex items-center gap-2">
                  <f.icon className="h-4 w-4 shrink-0 text-white" />
                  <h3 className="font-semibold text-white">{f.title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-white/75">{f.body}</p>
              </div>
            ))}
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
                  Wherever you are starting, we help you finish.
                </h2>
                <p className="mt-4 max-w-xl text-fluid-body text-white/75">
                  Start with a project or start with a company. Either way you get owned tasks, real
                  deadlines, a mentor who reviews the work, and a clear record of everything you shipped.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href="/apply">
                    <Button className="rounded-full bg-[#F0D8C0] px-7 py-6 text-base font-medium text-[#5C3318] hover:bg-[#F6EFE6]">
                      Apply now
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button
                      variant="outline"
                      className="rounded-full border-2 border-white/40 px-7 py-6 text-base font-medium text-white hover:bg-white hover:text-[#814B28]"
                    >
                      Talk to us first
                    </Button>
                  </Link>
                </div>
              </div>
              {/* The art carries a caption baked into it, so it is shown whole at
                  its own 2:1 ratio and centred beside the copy -- cropping it to
                  fill the column height would cut the caption off. */}
              <div className="self-center overflow-hidden rounded-2xl border border-white/15">
                <img
                  src="/landing/home/what-is-image.png"
                  alt="A StartupUniv team at work"
                  className="block h-auto w-full"
                  width={1600}
                  height={800}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
