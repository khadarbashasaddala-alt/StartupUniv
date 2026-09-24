import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteLayout } from "@/components/layout/site-layout";
import { HeroChips, HeroFacts, PartnerMarquee, VenturesBand } from "@/components/plans/plans-shared";
import { PLANS_PAGE_ENABLED } from "@/lib/plans-flags";
import { ArrowRight, Compass, GraduationCap, Handshake, Rocket, ShieldCheck } from "lucide-react";

/**
 * Plans runs on the same single brown ground as the home and about pages,
 * #814B28, from the header down to the closing card; only the footer keeps its
 * green. See plans-shared.tsx for the full colour notes.
 *
 * The scenario tabs used to carry three different pastel grounds. They are now
 * one surface with the rest of the page, told apart by the tab itself rather
 * than by colour.
 */

const founderFeatures = [
  "Lead the startup as the primary Founder",
  "Mentorship that refines both the idea and the execution",
  "A team behind you on product, operations and marketing",
  "Guidance on business model, go-to-market and investors",
  "Prototype, test and validate before you commit full-time",
  "Access to nine partner organisations across academia and industry",
  "Officially recognised as a Founder in the StartupUniv ecosystem",
  "The plan runs for four months",
];

const cofounderFeatures = [
  "Join a founding team as a full partner with shared ownership",
  "Own one core function end to end — tech, growth, operations or delivery",
  "A learner team under you and a mentor above you",
  "Guidance on business model, go-to-market and investors",
  "Join pre-vetted ideas that already have early traction",
  "Access to nine partner organisations across academia and industry",
  "Officially recognised as a Co-founder in the StartupUniv ecosystem",
  "The plan runs for four months",
];

const learnerFeatures = [
  "Hands-on work inside a real startup, not a simulation",
  "Mentorship direct from the founders you sit beside",
  "Learn product, marketing, operations and business strategy by doing them",
  "Work on live products with real users",
  "Sit inside the culture and the decision-making",
  "Network with founders, mentors and every cohort since 2025",
  "Recognition through a certificate, or through equity",
  "The plan runs for four months",
];

type Plan = {
  id: string;
  name: string;
  audience: string;
  price: string;
  terms: string;
  icon: typeof ShieldCheck;
  features: string[];
  applyHref: string;
  detailsHref: string;
};

const plans: Plan[] = [
  {
    id: "founder",
    name: "Founder",
    audience: "You have the idea and want to lead it",
    price: "₹5,00,000",
    terms: "40% equity share · team support",
    icon: Rocket,
    features: founderFeatures,
    applyHref: "/apply?plan=founder",
    detailsHref: "/plans/founder",
  },
  {
    id: "cofounder",
    name: "Co-founder",
    audience: "You want a real stake in someone else's",
    price: "₹3,00,000",
    terms: "20% equity share · team support",
    icon: Handshake,
    features: cofounderFeatures,
    applyHref: "/apply?plan=cofounder",
    detailsHref: "/plans/cofounder",
  },
  {
    id: "intern",
    name: "Learner",
    audience: "You want to learn how a company is actually run",
    price: "₹1,00,000",
    terms: "Team support · certificate, or ₹1,50,000 with 5% equity",
    icon: GraduationCap,
    features: learnerFeatures,
    applyHref: "/apply?plan=learner",
    detailsHref: "/plans/intern",
  },
];

const scenarios = [
  {
    value: "scenario1",
    tab: "Scenario 1",
    title: "2 Founders + 8 Learners + 1 Mentor",
    bullets: ["Two Founders, each holding 40% equity, totalling 80% between them."],
  },
  {
    value: "scenario2",
    tab: "Scenario 2",
    title: "1 Founder + 2 Co-founders + 7 Learners + 1 Mentor",
    bullets: [
      "Founder: owns 40% of the company.",
      "Co-founders: two of them, each owning 20%, so 40% together.",
      "Learners, mentor and StartupUniv: 20% between them.",
    ],
  },
  {
    value: "scenario3",
    tab: "Scenario 3",
    title: "1 Founder + 1 Co-founder + 4 Premium Learners + 1 Mentor",
    bullets: [
      "Founder: owns 40% of the startup.",
      "Co-founder: owns 20%.",
      "Premium Learners: four of them at 5% each, so 20% together.",
      "Mentor and StartupUniv: the remaining 20%.",
    ],
    footnote:
      "This is how ownership is shared between the primary Founder, the Co-founder, the Learners and the team supporting them.",
  },
];

export default function PlansPage() {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.replace("#", "").trim();
      if (!hash) return;
      const el = document.getElementById(hash);
      if (!el) return;
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  if (!PLANS_PAGE_ENABLED) {
    return (
      <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
        <section className="flex min-h-[60vh] items-center justify-center py-20 text-white">
          <div className="mx-auto max-w-xl px-6 text-center">
            <h1 className="text-fluid-h1 font-light tracking-tight text-white">
              Plans and pricing open <span className="font-semibold">shortly.</span>
            </h1>
            <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">
              StartupUniv was developed to effectively bridge these gaps.
            </p>
            <p className="mt-4 text-fluid-body text-white/80">
              We started in 2025, have worked with more than 20,000 students since, and are
              finalising pricing for both routes — joining a cohort, and bringing your own project or
              company. In the meantime, see how each one works, or talk to us directly.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/">
                <Button className="rounded-full bg-[#F0D8C0] px-7 py-6 text-base font-medium text-[#5C3318] hover:bg-[#F6EFE6]">
                  Back to home
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
      </SiteLayout>
    );
  }

  return (
    <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the claim left, the work right                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="pb-14 pt-12 text-white md:pb-20 md:pt-16">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#F0D8C0]/35 bg-[#F0D8C0]/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
                <Compass className="h-3.5 w-3.5" />
                Plans and pricing
              </span>

              <h1 className="mt-6 text-fluid-h1 font-light tracking-tight text-white">
                Three ways in.{" "}
                <span className="font-semibold">One company at the end of all of them.</span>
              </h1>

              <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">
                StartupUniv was developed to effectively bridge these gaps.
              </p>

              <p className="mt-4 max-w-xl text-fluid-body text-white/80">
                We started in 2025 and have since worked with more than 20,000 students, partnering
                with VTU, Jain University, NSDC, AWS, IBM, Cisco, Red Hat and NASSCOM. Over 40
                startups have been started here. Pick the seat you want on the next one.
              </p>

              <HeroFacts />
              <HeroChips chips={["Owned tasks", "Daily standups", "Mentor reviews", "Evidence of the work"]} />

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#choose"
                  className="group inline-flex items-center gap-3 rounded-xl bg-[#F0D8C0] px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#5C3318] transition-colors hover:bg-[#F6EFE6]"
                >
                  Compare the plans
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
                <Link
                  href="/program"
                  className="group inline-flex items-center gap-3 rounded-xl border border-[#F0D8C0]/45 px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#F0D8C0] transition-colors hover:border-[#F0D8C0] hover:bg-[#F0D8C0] hover:text-[#5C3318]"
                >
                  Explore programmes
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* The photograph sits on the same light plate the home hero uses,
                so every page opens with the same object. */}
            <div className="space-y-6">
              <div className="overflow-hidden rounded-[20px] border border-[#F0D8C0]/20 bg-[#F6F1E9] shadow-2xl">
                <img
                  src="/plans/plans-main.png"
                  alt="A cohort working through a sprint together"
                  className="block h-auto w-full"
                  loading="eager"
                  decoding="async"
                />
              </div>

              <div className="rounded-2xl border-t-2 border-[#F0D8C0]/50 bg-white/[0.07] p-6">
                <h2 className="font-semibold text-white">Build together. Grow faster.</h2>
                <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-white/75">
                  {[
                    "Execute real projects, not theory",
                    "Solve real-world briefs set by our partner organisations",
                    "Build alongside a structured team, with a mentor reviewing the work",
                  ].map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-0.5 shrink-0 font-bold text-[#F0D8C0]">✓</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PartnerMarquee />

      {/* ---------------------------------------------------------------- */}
      {/* The three plans                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section id="choose" className="scroll-mt-20 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Choose the seat, not the price
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              All three sit on the same team, run the same sprints and get the same review. What
              changes is what you own, and how much of the company you own at the end.
            </p>
          </div>

          <div className="mt-11 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                id={plan.id}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                className={`flex scroll-mt-28 flex-col rounded-2xl border-t-2 border-[#F0D8C0]/50 p-7 transition-colors ${
                  hoveredPlan === plan.id ? "bg-white/[0.12]" : "bg-white/[0.07]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <plan.icon className="h-6 w-6 shrink-0 text-[#F0D8C0]" />
                  <h3 className="font-serif text-3xl font-normal text-white">{plan.name}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{plan.audience}</p>

                <div className="mt-6 border-t border-white/15 pt-5">
                  <p className="font-serif text-4xl font-normal text-[#F0D8C0] lining-nums">
                    {plan.price}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">{plan.terms}</p>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-2.5 text-[15px] leading-relaxed text-white/75"
                    >
                      <span className="mt-0.5 shrink-0 font-bold text-[#F0D8C0]">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-7 flex flex-col gap-3">
                  <Link href={plan.applyHref}>
                    <Button className="w-full rounded-full bg-[#F0D8C0] px-7 py-6 text-base font-medium text-[#5C3318] hover:bg-[#F6EFE6]">
                      Apply as {plan.name}
                    </Button>
                  </Link>
                  <Link
                    href={plan.detailsHref}
                    className="group inline-flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#F0D8C0] transition-colors hover:text-white"
                  >
                    See the full plan
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How the equity actually splits                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-white/15 py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Who owns what, spelled out
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              Equity is the part that goes wrong quietly, years later. So here are three real team
              shapes and exactly how the company splits in each of them.
            </p>
          </div>

          <Tabs defaultValue="scenario1" className="mt-10 w-full">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-3 bg-transparent p-0">
              {scenarios.map((s) => (
                <TabsTrigger
                  key={s.value}
                  value={s.value}
                  className="rounded-full border border-[#F0D8C0]/45 bg-transparent px-5 py-2.5 text-sm font-medium text-[#F0D8C0] transition-colors hover:bg-[#F0D8C0]/10 data-[state=active]:border-[#F0D8C0] data-[state=active]:bg-[#F0D8C0] data-[state=active]:text-[#5C3318] data-[state=active]:shadow-none"
                >
                  {s.tab}
                </TabsTrigger>
              ))}
            </TabsList>

            {scenarios.map((s) => (
              <TabsContent key={s.value} value={s.value} className="mt-6">
                <div className="rounded-2xl border border-white/15 bg-white/[0.07] px-6 py-10 md:px-12 md:py-14">
                  <h3 className="max-w-4xl font-serif text-3xl font-light leading-[1.05] tracking-tight text-white md:text-[56px]">
                    {s.title}
                  </h3>
                  <ul className="mt-8 max-w-3xl space-y-2.5">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex gap-2.5 text-fluid-body leading-relaxed text-white/80">
                        <span className="mt-1 shrink-0 font-bold text-[#F0D8C0]">✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  {s.footnote ? (
                    <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-white/60">
                      {s.footnote}
                    </p>
                  ) : null}

                  <div className="mt-10 border-t border-white/15 pt-3">
                    <p className="text-sm text-white/60">StartupUniv</p>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-6">
              <h3 className="font-semibold text-white">Equity issuance terms</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-white/75">
                Equity is issued on successful completion of the programme and continued
                participation in the project. That is deliberate: it keeps everyone in the room for
                the part that decides whether the company survives its first year.
              </p>
            </div>

            <div className="rounded-2xl border-t-2 border-[#F0D8C0]/50 bg-white/[0.07] p-6">
              <h3 className="font-semibold text-white">Applying as a whole team?</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-white/75">
                Bring the people you already build with and we will place you together.
              </p>
              <Link href="/plans/team-application">
                <Button className="mt-5 rounded-full bg-[#F0D8C0] px-7 py-6 text-base font-medium text-[#5C3318] hover:bg-[#F6EFE6]">
                  Team application
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <VenturesBand
        heading="Started here, still running"
        intro="Over 40 startups have been started at StartupUniv since 2025, by teams that came in on exactly these three plans."
      />

      {/* ---------------------------------------------------------------- */}
      {/* Close                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.07]">
            <div className="grid items-stretch gap-8 p-8 md:grid-cols-[1fr_1fr] md:gap-10 md:p-12">
              <div>
                <h2 className="font-serif text-fluid-h2 font-normal tracking-tight text-white">
                  Still not sure which seat is yours?
                </h2>
                <p className="mt-4 max-w-xl text-fluid-body text-white/75">
                  Most people are not, at this point. Apply anyway — the assessment and the
                  conversation that follows exist to work that out with you, not to catch you out.
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
                      className="rounded-full border-2 border-white/40 bg-transparent px-7 py-6 text-base font-medium text-white hover:bg-white hover:text-[#814B28]"
                    >
                      Talk to us first
                    </Button>
                  </Link>
                </div>
              </div>
              {/* Shown whole at its own 2:1 ratio — the art carries a caption
                  baked into it, so cropping it to fill the column loses it. */}
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
