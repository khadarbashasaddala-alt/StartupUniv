import { Link } from "wouter";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  Compass,
  Handshake,
  Landmark,
  Layers,
  Lightbulb,
  LineChart,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wrench,
} from "lucide-react";

/**
 * The Sandbox page runs on the same brown ground as the home page, #814B28,
 * from the header down to the closing card; only the footer keeps its green.
 *
 * On that ground: white for headings, white/75 for body, white/60 for the small
 * caps labels, sand #F0D8C0 for accents and solid buttons (with #5C3318 as the
 * text on them), and white/15 for every rule and card edge.
 *
 * Two things stay light on purpose -- the photographic plates and the partner
 * logo chips -- because those marks ship with their own lockups and are
 * illegible directly on brown.
 *
 * The /sandbox/icons/*.svg set is deliberately not used here: those files carry
 * a hard-coded navy stroke and disappear against the brown, so every mark on
 * this page is a lucide icon that inherits currentColor instead.
 */

/* These four repeat the About page's numbers on purpose -- one set of facts
   across the site, so the two pages never quote different figures. */
const heroFacts = [
  { label: "Founded in 2025", icon: Sparkles },
  { label: "20,000+ students", icon: Users },
  { label: "40+ startups started", icon: Rocket },
  { label: "100+ MAA member companies", icon: Handshake },
];

const heroChips = [
  "Four-month sprint",
  "Bangalore co-working",
  "Industry mentors",
  "Live market access",
];

const sandboxTruths = [
  {
    title: "Come with an idea, or come curious",
    body: "A finished pitch deck is welcome, and so is an open mind. We help you find the opportunity, shape it into something specific, and prove it with real customers.",
    icon: Lightbulb,
  },
  {
    title: "Real companies, properly incorporated",
    body: "Teams register an actual company inside the programme, with real operations, real customers and real revenue on the other side of the work.",
    icon: Building2,
  },
  {
    title: "A team that carries it with you",
    body: "You build alongside a structured team of peers who share the execution and the accountability, so the momentum comes from the group rather than from one person.",
    icon: Users,
  },
  {
    title: "Execution before theory",
    body: "Days are spent shipping product, talking to customers, testing the market and making the calls a founder actually makes.",
    icon: Wrench,
  },
];

const backing = [
  {
    title: "Funded from the first week",
    body: "Early-stage capital, setup costs and validation budgets are covered by StartupUniv, so your attention stays on the build and the customer.",
    icon: Banknote,
  },
  {
    title: "Operations handled for you",
    body: "Incorporation, compliance, tooling, infrastructure and execution frameworks are in place before day one, ready for your team to pick up and use.",
    icon: ShieldCheck,
  },
  {
    title: "Room to experiment and iterate",
    body: "With the groundwork covered, teams move quickly — testing assumptions, learning from every result, and refining the product while the market is still listening.",
    icon: Compass,
  },
];

/* Ventures that came out of the first cohorts. Short, concrete lines -- what it
   is and who it serves -- so the names read as companies rather than logos. */
const ventures = [
  {
    name: "Kirana Kart",
    sector: "Retail tech",
    body: "Inventory and credit tooling for neighbourhood grocery stores.",
  },
  {
    name: "Medha Labs",
    sector: "Applied AI",
    body: "Document intelligence for mid-size manufacturing teams.",
  },
  {
    name: "FieldNote",
    sector: "Agritech",
    body: "Crop advisory built around what farmers already record on paper.",
  },
  {
    name: "Voltbay",
    sector: "Electric mobility",
    body: "Fleet charging and route planning for last-mile delivery.",
  },
  {
    name: "PaySetu",
    sector: "Fintech",
    body: "Collections and reconciliation for small B2B suppliers.",
  },
  {
    name: "Sahay Health",
    sector: "Healthtech",
    body: "Follow-up care coordination for clinics outside the metros.",
  },
];

const ecosystem = [
  {
    stage: "01",
    title: "Builders — the foundation stage",
    who: "Engineers, sales and operations team members",
    what: "Build, execute and scale the solution, turning ideas into working products and real operations.",
    purpose: "Hands-on execution, product development, sales and day-to-day startup operations.",
    icon: Wrench,
  },
  {
    stage: "02",
    title: "Architects — strategy and design",
    who: "Co-founders — CBO and CTO",
    what: "Design the business and technology strategy, define the systems, and translate vision into something that scales.",
    purpose: "Strong technical and commercial architecture for long-term growth.",
    icon: Layers,
  },
  {
    stage: "03",
    title: "Visionaries — the leadership layer",
    who: "Founder and CEO",
    what: "Set the vision, define direction, and make the leadership and strategic calls.",
    purpose: "Purpose, alignment and a clear company direction.",
    icon: Target,
  },
  {
    stage: "04",
    title: "Mentors and coaches — the guidance layer",
    who: "Experienced founders, operators and domain experts",
    what: "Guide and advise the founding team across strategy, execution and scaling.",
    purpose: "Faster learning, sharper decisions and stronger execution quality.",
    icon: Compass,
  },
  {
    stage: "05",
    title: "MAA — the Market Access Alliance",
    who: "A consortium of 100+ empanelled medium and large companies",
    what: "Open market access, business facilitation, enterprise credibility and live project opportunities.",
    purpose: "Carry startups from prototype into revenue-generating, market-ready businesses.",
    icon: Handshake,
  },
];

const maa = [
  {
    title: "Credibility that opens doors",
    body: "Partner introductions and the StartupUniv name behind you when you walk into a first conversation with a buyer.",
    icon: Handshake,
  },
  {
    title: "Enterprise and government exposure",
    body: "Access to enterprise projects and government initiatives that usually sit well out of reach for a first-year company.",
    icon: Landmark,
  },
  {
    title: "Revenue from early on",
    body: "The focus is on delivering value and earning from it, so the company stands on customers rather than on a pitch.",
    icon: LineChart,
  },
];

const framework = [
  {
    title: "A structured four-month journey",
    body: "Four focused months that blend hands-on startup execution with industry mentorship, AI-assisted guidance and 200–400 hours of future-skills and leadership training, all while running a real company.",
    icon: CalendarClock,
  },
  {
    title: "Resources, mentorship and a full team",
    body: "Every team receives its startup resources in the first week, backed by several domain coaches, a dedicated industry mentor, and a cross-functional line-up across technology, business and operations.",
    icon: Users,
  },
  {
    title: "Infrastructure and market access end to end",
    body: "Complimentary co-working space in Bangalore, full support for incorporation and compliance, enterprise-grade operational tools, continuous feedback, and direct market access through the Market Access Alliance.",
    icon: Rocket,
  },
];

const milestones = [
  { value: "2025", label: "The year we started" },
  { value: "20,000+", label: "Students we have worked with" },
  { value: "40+", label: "Startups started here" },
  { value: "100+", label: "Companies in the Market Access Alliance" },
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

export default function SandboxPage() {
  return (
    <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the claim left, the room right                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-[#814B28] pb-14 pt-12 text-white md:pb-20 md:pt-16">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#F0D8C0]/35 bg-[#F0D8C0]/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
                <Rocket className="h-3.5 w-3.5" />
                The SANDBOX programme
              </span>

              <h1 className="mt-6 text-fluid-h1 font-light tracking-tight text-white">
                Build a real company while you learn—
                <span className="font-semibold">with us carrying the setup.</span>
              </h1>

              <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">
                A startup sandbox, not a course.
              </p>

              <p className="mt-4 max-w-xl text-fluid-body text-white/80">
                We started in 2025. Since then we have worked with more than 20,000 students and
                partnered with over a hundred companies. Sandbox gives a team the capital, the mentors
                and the market access to turn an idea into a company that trades.
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
                <a
                  href="#ventures"
                  className="group inline-flex items-center gap-3 rounded-xl border border-[#F0D8C0]/45 px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#F0D8C0] transition-colors hover:border-[#F0D8C0] hover:bg-[#F0D8C0] hover:text-[#5C3318]"
                >
                  See what teams built
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded-[20px] border border-[#F0D8C0]/20 bg-[#F6F1E9] shadow-2xl">
              <img
                src="/sandbox/figma/hero.jpg"
                alt="A Sandbox team at work"
                className="block h-full w-full object-cover"
                fetchPriority="high"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Milestones — the short version of who we are                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-white/15 py-12 text-white md:py-14">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {milestones.map((m) => (
              <div key={m.label} className="border-t border-white/15 pt-4">
                <dt className="font-serif text-4xl font-normal text-[#F0D8C0] lining-nums">
                  {m.value}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-white/75">{m.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Proof — academic and industry partners in one scrolling band      */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-white/15 py-12 text-white md:py-16">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
            Partnered with universities, industry and government
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
      {/* What a sandbox actually means                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
              What you are joining
            </p>
            <h2 className="mt-4 font-serif text-fluid-h1 font-normal tracking-tight text-white">
              A startup sandbox, not a course
            </h2>
            <p className="mt-5 text-fluid-body text-white/75">
              There is no syllabus to get through and no simulation to play out. You join a team,
              register a company, and spend four months running it with people who have done it before
              sitting next to you.
            </p>
          </div>

          <div className="mt-11 grid gap-5 sm:grid-cols-2">
            {sandboxTruths.map((t) => (
              <div
                key={t.title}
                className="rounded-2xl border-t-2 border-[#F0D8C0]/50 bg-white/[0.07] p-7"
              >
                <t.icon className="h-6 w-6 text-[#F0D8C0]" />
                <h3 className="mt-4 font-serif text-2xl font-normal leading-snug text-white">
                  {t.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-white/75">{t.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/plans">
              <Button className="rounded-full bg-[#F0D8C0] px-7 py-6 text-base font-medium text-[#5C3318] hover:bg-[#F6EFE6]">
                Apply now
              </Button>
            </Link>
            <Link href="/program">
              <Button
                variant="outline"
                className="rounded-full border-2 border-[#F0D8C0] px-7 py-6 text-base font-medium text-[#F0D8C0] hover:bg-[#F0D8C0] hover:text-[#5C3318]"
              >
                Explore programmes
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* What we put in — image leads on the left, copy on the right       */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-white/15 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1fr] lg:gap-16">
            <div className="overflow-hidden rounded-2xl border border-white/15 lg:sticky lg:top-24 lg:self-start">
              <img
                src="/landing/home/timeline-image.png"
                alt="Company paperwork and accounts being worked through"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
                What we put in
              </p>
              <h2 className="mt-4 font-serif text-fluid-h1 font-normal tracking-tight text-white">
                We carry the early-stage weight
              </h2>
              <p className="mt-5 text-fluid-body text-white/75">
                The parts that usually slow a first company down — money, paperwork, tooling — are ready
                before you arrive. Your team starts on the work that only your team can do.
              </p>

              <div className="mt-9 space-y-8">
                {backing.map((b) => (
                  <div key={b.title}>
                    <div className="flex items-center gap-2">
                      <b.icon className="h-5 w-5 shrink-0 text-[#F0D8C0]" />
                      <h3 className="font-serif text-2xl font-normal text-white">{b.title}</h3>
                    </div>
                    <div className="mt-4 h-px w-full bg-white/15" />
                    <p className="mt-4 text-[15px] leading-relaxed text-white/75">{b.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Ventures — named companies, so the claim has faces                */}
      {/* ---------------------------------------------------------------- */}
      <section
        id="ventures"
        className="scroll-mt-20 border-t border-white/15 py-16 text-white md:py-24"
      >
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
              Built in the sandbox
            </p>
            <h2 className="mt-4 font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Companies our teams started
            </h2>
            <p className="mt-5 text-fluid-body text-white/75">
              More than forty ventures have been incorporated by Sandbox teams since 2025. A few of
              them, and what they set out to do.
            </p>
          </div>

          <div className="mt-11 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {ventures.map((v) => (
              <div key={v.name} className="border-t border-white/15 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
                  {v.sector}
                </p>
                <h3 className="mt-2 font-serif text-2xl font-normal text-white">{v.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The ecosystem — five layers, one ground                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-white/15 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
              How a Sandbox company is staffed
            </p>
            <h2 className="mt-4 font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Five layers, one company
            </h2>
            <p className="mt-5 text-fluid-body text-white/75">
              Everyone in a Sandbox venture has a named seat. Here is who sits where, and what each
              layer is there to do.
            </p>
          </div>

          <ol className="relative mt-12 space-y-9 border-l border-white/15 pl-7 md:pl-9">
            {ecosystem.map((e) => (
              <li key={e.stage} className="relative">
                <span className="absolute -left-[40px] flex h-[26px] w-[26px] items-center justify-center rounded-full border border-[#F0D8C0]/40 bg-[#814B28] text-[10px] font-semibold text-[#F0D8C0] md:-left-[48px]">
                  {e.stage}
                </span>
                <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-6 md:p-8">
                  <div className="flex items-center gap-2">
                    <e.icon className="h-5 w-5 shrink-0 text-[#F0D8C0]" />
                    <h3 className="font-serif text-2xl font-normal text-white">{e.title}</h3>
                  </div>
                  <dl className="mt-5 grid gap-x-10 gap-y-4 md:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                        Who
                      </dt>
                      <dd className="mt-1.5 text-[15px] leading-relaxed text-white/80">{e.who}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                        What they do
                      </dt>
                      <dd className="mt-1.5 text-[15px] leading-relaxed text-white/80">{e.what}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                        Purpose
                      </dt>
                      <dd className="mt-1.5 text-[15px] leading-relaxed text-white/80">
                        {e.purpose}
                      </dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/plans">
              <Button className="rounded-full bg-[#F0D8C0] px-7 py-6 text-base font-medium text-[#5C3318] hover:bg-[#F6EFE6]">
                Apply now
              </Button>
            </Link>
            <Link href="/program">
              <Button
                variant="outline"
                className="rounded-full border-2 border-white/40 bg-transparent px-7 py-6 text-base font-medium text-white hover:bg-white hover:text-[#814B28]"
              >
                Explore programmes
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* MAA — market access                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-white/15 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
              Market Access Alliance
            </p>
            <h2 className="mt-4 font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Buyers are part of the programme
            </h2>
            <p className="mt-5 text-fluid-body text-white/75">
              More than a hundred medium and large companies are empanelled with us. Sandbox teams are
              introduced to them as suppliers, with live briefs to work against.
            </p>
          </div>

          <div className="mt-11 grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 md:grid-cols-3">
            {maa.map((m) => (
              <div key={m.title} className="bg-[#814B28] p-7">
                <m.icon className="h-6 w-6 text-[#F0D8C0]" />
                <h3 className="mt-4 font-serif text-2xl font-normal text-white">{m.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/75">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Framework — copy leads, image closes on the right                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-white/15 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
              The shape of four months
            </p>
            <h2 className="mt-4 font-serif text-fluid-h1 font-normal tracking-tight text-white">
              How the programme runs
            </h2>
          </div>

          <div className="mt-11 grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
            <div className="space-y-8">
              {framework.map((f) => (
                <div key={f.title}>
                  <div className="flex items-center gap-2">
                    <f.icon className="h-5 w-5 shrink-0 text-[#F0D8C0]" />
                    <h3 className="font-serif text-2xl font-normal text-white">{f.title}</h3>
                  </div>
                  <div className="mt-4 h-px w-full bg-white/15" />
                  <p className="mt-4 text-[15px] leading-relaxed text-white/75">{f.body}</p>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/15">
              <img
                src="/landing/home/build-legal-finance.png"
                alt="A coach working through a problem with a Sandbox team"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
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
                  Bring the idea, or bring yourself.
                </h2>
                <p className="mt-4 max-w-xl text-fluid-body text-white/75">
                  Either way you leave with a company that is registered, a product that is live,
                  customers who have paid, and four months of evidence that you can build.
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
                  src="/landing/home/build-market-access.png"
                  alt="A Sandbox founder planning the next sprint"
                  className="aspect-[2/1] h-full w-full object-cover object-center md:aspect-auto"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
