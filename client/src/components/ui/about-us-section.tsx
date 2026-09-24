"use client";

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Handshake,
  Layers,
  LifeBuoy,
  ListChecks,
  Megaphone,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

/**
 * About runs on the same single brown ground as the home page, #814B28, from
 * the header down to the closing card; only the footer keeps its green.
 *
 * On that ground: white for headings, white/75 for body, white/60 for the
 * small caps labels, sand #F0D8C0 for accents and solid buttons (with #5C3318
 * as the text on them), and white/15 for every rule and card edge.
 *
 * The one thing that stays light on purpose is the partner logo band, because
 * those marks ship with their own white and navy lockups and are illegible
 * directly on brown.
 */

/* The hero states who we are as scannable facts before any prose. */
const heroFacts = [
  { label: "Founded in 2025", icon: CalendarClock },
  { label: "20,000+ students", icon: Users },
  { label: "40+ startups started", icon: Rocket },
  { label: "9 partner organisations", icon: Handshake },
];

const heroChips = ["Owned tasks", "Daily standups", "Mentor reviews", "Evidence of the work"];

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

/* Illustrative examples of what teams have carried out of a cohort. */
const venturesBuiltHere = [
  {
    name: "Sproutkart",
    sector: "Agri commerce",
    body: "A farm-to-hostel produce marketplace that started as a third-semester project and now supplies eleven campus kitchens.",
  },
  {
    name: "Tarang Mobility",
    sector: "Electric mobility",
    body: "Retrofit EV kits for campus shuttle fleets, built by a team that took their prototype all the way to a road-legal pilot.",
  },
  {
    name: "Vaanya Health",
    sector: "Digital health",
    body: "Teleconsultation tooling for tier-three clinics, validated with real doctors before a single feature was shipped.",
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
    body: "Energy and occupancy monitoring for college buildings, now maintained under a support desk the team runs themselves.",
  },
];

/* The gaps we were built to close. */
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

const howWeWork = [
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
    body: "A support desk with priority, category, response targets and escalation paths, so what you launch keeps running.",
    icon: LifeBuoy,
  },
];

const whatWeCarry = [
  {
    title: "Ideas validated, not assumed",
    body: "Every idea is tested against customer feedback and data before a team is allowed to scale it.",
    icon: ClipboardCheck,
  },
  {
    title: "Startups that actually launch",
    body: "Registered companies, live products and first customers — not slide decks and simulations.",
    icon: Rocket,
  },
  {
    title: "Founders ready to execute",
    body: "People who can break work down, own it, hold a deadline and review someone else's work honestly.",
    icon: ListChecks,
  },
  {
    title: "Growth built to last",
    body: "Support desks, maintenance and reporting from day one, so what gets launched survives the year after.",
    icon: BarChart3,
  },
];

const whoItIsFor = [
  "Students building a startup while they study",
  "College teams carrying a capstone through to production",
  "First-time founders who want structure, not slogans",
  "Working professionals moving into entrepreneurship",
  "Early-stage teams looking to validate and scale",
];

const whatMakesUsDifferent = [
  "Execution outcomes are the point — certificates are the by-product",
  "Programmes designed by practitioners who have shipped, not only taught",
  "Backed by institutions with decades of delivery behind them",
  "Education, mentoring and incubation in one place, not three",
  "Frameworks built around why startups actually fail",
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

export default function AboutUsSection() {
  return (
    <section className="w-full bg-[#814B28] text-white">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — who we are, stated as facts before any prose               */}
      {/* ---------------------------------------------------------------- */}
      <div className="bg-[#814B28] pb-14 pt-12 md:pb-20 md:pt-16">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div>
              <h1 className="text-fluid-h1 font-light tracking-tight text-white">
                We started in 2025 because good work kept stopping—
                <span className="font-semibold">at the submission.</span>
              </h1>

              <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">
                StartupUniv was developed to effectively bridge these gaps.
              </p>

              <p className="mt-4 max-w-xl text-fluid-body text-white/80">
                In one year we have worked with more than 20,000 students, partnered with
                universities, skilling bodies and technology companies, and watched teams carry
                semester projects out of the classroom and into registered companies.
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
                <Link
                  href="/plans"
                  className="group inline-flex items-center gap-3 rounded-xl bg-[#F0D8C0] px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#5C3318] transition-colors hover:bg-[#F6EFE6]"
                >
                  Apply now
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/program"
                  className="group inline-flex items-center gap-3 rounded-xl border border-[#F0D8C0]/45 px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#F0D8C0] transition-colors hover:border-[#F0D8C0] hover:bg-[#F0D8C0] hover:text-[#5C3318]"
                >
                  Explore programmes
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Shown whole at its own ratio, on the same light plate the home
                hero uses, so the two pages open with the same object. */}
            <div className="overflow-hidden rounded-[20px] border border-[#F0D8C0]/20 bg-[#F6F1E9] shadow-2xl">
              <img
                src="/plans/about_pic.jpeg"
                alt="A StartupUniv cohort at work"
                className="block h-auto w-full"
                width={1536}
                height={1024}
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Proof — academic and industry partners in one scrolling band      */}
      {/* ---------------------------------------------------------------- */}
      <div className="border-y border-white/15 py-12 md:py-16">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
            Partnered with academia and industry
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
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* One year in — the numbers, stated plainly                         */}
      {/* ---------------------------------------------------------------- */}
      <div className="py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              One year in
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              We are young, and we would rather say so than pretend otherwise. Here is exactly what
              has happened since we opened.
            </p>
          </div>

          <div className="mt-11 grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
            {milestones.map((m) => (
              <div key={m.label} className="bg-[#814B28] p-6">
                <m.icon className="h-6 w-6 text-[#F0D8C0]" />
                <p className="mt-4 font-serif text-4xl font-normal text-[#F0D8C0] lining-nums">
                  {m.value}
                </p>
                <h3 className="mt-2 font-semibold leading-snug text-white">{m.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Why we exist — the gaps, then the sentence that answers them      */}
      {/* ---------------------------------------------------------------- */}
      <div className="border-t border-white/15 py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
                <Compass className="h-3.5 w-3.5" />
                Why we exist
              </span>
              <h2 className="mt-6 font-serif text-fluid-h1 font-normal tracking-tight text-white">
                StartupUniv was developed to effectively bridge these gaps.
              </h2>
              <p className="mt-5 text-fluid-body text-white/75 lining-nums">
                India sees over 100,000 startup registrations a year. Ideas are not what is missing.
                What is missing is the part in between — someone owning the work, a deadline that
                holds, and a person who reviews it honestly before it goes out.
              </p>
              <div className="mt-8 overflow-hidden rounded-2xl border border-white/15">
                <img
                  src="/landing/home/build-team-mentorship.png"
                  alt="A mentor reviewing work with a founding team"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            <div>
              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
                What goes wrong, and how often
              </p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                {gaps.map((g) => (
                  <div
                    key={g.title}
                    className="rounded-2xl border-t-2 border-[#F0D8C0]/50 bg-white/[0.07] p-6"
                  >
                    <div className="flex items-center gap-3">
                      <g.icon className="h-5 w-5 shrink-0 text-[#F0D8C0]" />
                      <p className="font-serif text-3xl font-normal text-[#F0D8C0] lining-nums">
                        {g.value}
                      </p>
                    </div>
                    <h3 className="mt-3 font-semibold text-white">{g.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-white/75">{g.body}</p>
                  </div>
                ))}
              </div>
              <p className="mt-7 text-fluid-body font-medium text-[#F0D8C0]">
                We were built to close these three, systematically, on every team we take on.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* How we work — the four things a company has to do                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="border-t border-white/15 py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
              <Wrench className="h-3.5 w-3.5" />
              How we work
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
            {howWeWork.map((p) => (
              <div key={p.label} className="bg-[#814B28] p-6">
                <p.icon className="h-6 w-6 text-[#F0D8C0]" />
                <h3 className="mt-4 font-serif text-2xl font-normal text-white">{p.label}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-white/70">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-10 lg:grid-cols-[0.85fr_1fr] lg:gap-16">
            <div className="overflow-hidden rounded-2xl border border-white/15">
              <img
                src="/landing/home/build-market-access.png"
                alt="A founding team reviewing milestone progress"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div>
              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
                What our teams walk out with
              </p>
              <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
                {whatWeCarry.map((f) => (
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
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Started here — the companies that came out of a cohort            */}
      {/* ---------------------------------------------------------------- */}
      <div className="border-t border-white/15 py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Started here
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              Forty-odd companies have come out of our cohorts so far. A few of them, and where they
              began.
            </p>
          </div>

          <div className="mt-11 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {venturesBuiltHere.map((v) => (
              <div key={v.name} className="border-t border-white/15 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                  {v.sector}
                </p>
                <h3 className="mt-2 font-serif text-2xl font-normal text-white">{v.name}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/75">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Who stands behind us                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="border-t border-white/15 py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Young company, long roots
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              We are two years old at most. The institutions behind us are not, and that is the
              whole point — we get to start fast without starting from nothing.
            </p>
          </div>

          <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="flex flex-col gap-6 rounded-2xl border border-white/15 bg-white/[0.07] p-7">
              <div className="overflow-hidden rounded-xl border border-white/15">
                <img
                  src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop"
                  alt="Rooman Technologies"
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60 lining-nums">
                  Since 1999
                </p>
                <h3 className="mt-2 font-serif text-3xl font-normal text-white">
                  Rooman Technologies
                </h3>
                <div className="mt-5 space-y-5">
                  <div>
                    <h4 className="font-semibold text-white lining-nums">
                      Twenty-five years of skilling
                    </h4>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">
                      Two and a half decades in technology and employability-focused skilling,
                      shaping India's workforce for the work that actually exists.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white lining-nums">Impact at national scale</h4>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">
                      Over a million learners trained across IT, emerging technologies and
                      professional skills — one of India's largest industry-focused skilling
                      ecosystems.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Industry-aligned by design</h4>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">
                      Partnerships with universities, enterprises and government programmes, and a
                      long record of outcome-driven curricula that hold up in the field.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 rounded-2xl border border-white/15 bg-white/[0.07] p-7">
              <div className="overflow-hidden rounded-xl border border-white/15">
                <img
                  src="https://images.unsplash.com/photo-1562774053-701939374585?w=800&h=600&fit=crop"
                  alt="Jain Group of Institutions campus"
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60 lining-nums">
                  Since 1990
                </p>
                <h3 className="mt-2 font-serif text-3xl font-normal text-white">
                  Jain Group of Institutions
                </h3>
                <div className="mt-5 space-y-5">
                  <div>
                    <h4 className="font-semibold text-white lining-nums">
                      Three decades of academics
                    </h4>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">
                      Headquartered in Bengaluru, with a long-standing focus on innovation and
                      entrepreneurship alongside academic depth.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white lining-nums">Education at scale</h4>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">
                      Seventy-plus institutions across India, reaching thousands of learners a year
                      through academic, innovation and venture-driven programmes.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Incubation that has a record</h4>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/75">
                      A strong presence in startup incubation and mentoring, with a proven history of
                      turning academic work into real entrepreneurial outcomes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Who it is for, and what makes us different                        */}
      {/* ---------------------------------------------------------------- */}
      <div className="border-t border-white/15 py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Who it is for, and why it works
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              Two honest lists: who should be here, and what you get here that you would not get
              from a course.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-7">
              <div className="flex items-center gap-2 text-white">
                <Users className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">Who it is for</p>
              </div>
              <h3 className="mt-4 font-serif text-2xl font-normal text-white">
                People who want to build, not just learn about building
              </h3>
              <ul className="mt-6 flex-1 space-y-3">
                {whoItIsFor.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-white/75">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#F0D8C0]" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[15px] leading-relaxed text-white/75">
                The platform is built to carry a team from zero to first traction.
              </p>
            </div>

            <div className="flex flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-7">
              <div className="flex items-center gap-2 text-[#F0D8C0]">
                <Building2 className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                  What makes us different
                </p>
              </div>
              <h3 className="mt-4 font-serif text-2xl font-normal text-white">
                New company, but nothing here is untested
              </h3>
              <ul className="mt-6 flex-1 space-y-3">
                {whatMakesUsDifferent.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-white/75">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#F0D8C0]" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[15px] leading-relaxed text-white/75">
                We exist to reduce the failure that comes from poor validation, weak fundamentals and
                nobody senior looking at the work.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Vision and mission                                               */}
      {/* ---------------------------------------------------------------- */}
      <div className="border-t border-white/15 py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 lg:grid-cols-2">
            <div className="bg-[#814B28] p-8 md:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Our vision
              </p>
              <h3 className="mt-4 font-serif text-fluid-h2 font-normal tracking-tight text-white">
                Where we want to end up
              </h3>
              <p className="mt-5 text-fluid-body text-white/75">
                To give India's next generation of founders a trusted, end-to-end startup education
                and incubation platform — one that turns ideas into execution-ready, sustainable
                businesses through real guidance, real structure and real experience.
              </p>
            </div>
            <div className="bg-[#814B28] p-8 md:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Our mission
              </p>
              <h3 className="mt-4 font-serif text-fluid-h2 font-normal tracking-tight text-white">
                What we do about it, now
              </h3>
              <p className="mt-5 text-fluid-body text-white/75">
                Raise the odds through structured execution, build founder capability team by team,
                and guide ideas from validation to launch — strengthening the ecosystem through
                education that actually ends in something running.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Close                                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.07]">
            <div className="grid items-stretch gap-8 p-8 md:grid-cols-[1fr_1fr] md:gap-10 md:p-12">
              <div>
                <h2 className="font-serif text-fluid-h2 font-normal tracking-tight text-white">
                  We are one year in. Come build the next one with us.
                </h2>
                <p className="mt-4 max-w-xl text-fluid-body text-white/75">
                  Start with a project or start with a company. Either way you get owned tasks, real
                  deadlines, a mentor who reviews the work, and a clear record of everything you
                  shipped.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href="/plans">
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
      </div>
    </section>
  );
}
