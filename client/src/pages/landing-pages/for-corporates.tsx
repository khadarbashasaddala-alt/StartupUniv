import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/layout/site-layout";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  ClipboardCheck,
  Handshake,
  Presentation,
  Puzzle,
  Rocket,
  Target,
  Users,
} from "lucide-react";

/**
 * Corporates supply the real briefs behind the "Sell" pillar on
 * /for-professionals, so this page carries the same teal (#17646E) and deep
 * petrol (#12333A).
 */

const engagementOptions = [
  {
    title: "Sponsor a challenge",
    body: "Frame a real business problem as a published brief. Teams apply to it and the work runs as tracked sprints over months, with IP terms agreed up front.",
    icon: Puzzle,
  },
  {
    title: "Pilot what gets built",
    body: "Evaluate a working solution before committing. You see the sprint demos along the way, so the pilot decision is a well-informed one.",
    icon: Rocket,
  },
  {
    title: "Hire from the pipeline",
    body: "Post roles to people who have already shipped under deadline and review. Their task history, evidence and rubric scores give you a richer signal than a résumé.",
    icon: Briefcase,
  },
  {
    title: "Invest early",
    body: "Co-invest in teams whose execution you have watched for months, with a full record of what they delivered sprint by sprint.",
    icon: Handshake,
  },
];

const processSteps = [
  {
    step: "01",
    title: "Define the brief",
    body: "We work with your team to frame the business challenge as a problem statement with scope, constraints and what a good outcome looks like.",
    icon: Target,
  },
  {
    step: "02",
    title: "Teams are matched",
    body: "Teams apply against the brief and two or three with relevant skills are matched to it, each with a mentor attached.",
    icon: Users,
  },
  {
    step: "03",
    title: "Build in the open",
    body: "Work runs in sprints with owned tasks, submitted evidence and rubric-scored review, so you see progress as it happens.",
    icon: ClipboardCheck,
  },
  {
    step: "04",
    title: "Demo and decide",
    body: "Every sprint closes with a recorded demo. At the end the choice is yours: pilot it, invest in the team, hire them, or simply keep the learning.",
    icon: Presentation,
  },
];

const visibility = [
  {
    title: "Progress you can audit",
    body: "Sprint goals, deliverables and pass status — each one backed by evidence that has been reviewed and signed off.",
    icon: ClipboardCheck,
  },
  {
    title: "Recorded demos, not decks",
    body: "Each sprint ends in a demo that is captured and kept, so you can see exactly how the solution evolved.",
    icon: Presentation,
  },
  {
    title: "Reporting across teams",
    body: "When several teams work the same brief, progress rolls up so you can compare approaches on what each one actually delivered.",
    icon: BarChart3,
  },
];

export default function ForCorporatesPage() {
  return (
    <SiteLayout hideCTA>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-[#12333A] py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#7FD3DD]">
                <Briefcase className="h-3.5 w-3.5" />
                For corporates
              </span>
              <h1 className="mt-6 font-serif text-fluid-hero font-normal tracking-tight text-white">
                Put a real problem in front of teams who finish.
              </h1>
              <p className="mt-6 max-w-xl text-fluid-body text-white/75">
                Your brief becomes real work with owners, deadlines, evidence and mentor review — and you
                watch it progress sprint by sprint, with a working demo at the end of each one.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <Link href="/contact">
                  <Button className="rounded-full bg-[#7FD3DD] px-7 py-6 text-base font-medium text-[#0B242A] hover:bg-[#9BE0E8]">
                    Sponsor a challenge
                  </Button>
                </Link>
                <Link href="/problems">
                  <Button
                    variant="outline"
                    className="rounded-full border-2 border-white/40 bg-transparent px-7 py-6 text-base font-medium text-white hover:bg-white hover:text-[#12333A]"
                  >
                    See live briefs
                  </Button>
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-white/15">
              <img
                src="/landing/home/build-market-access.png"
                alt="A team reviewing progress against a corporate brief"
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Engagement options                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              Four ways in
            </h2>
            <p className="mt-4 text-fluid-body text-[#4A453F]">
              They stack. Most partners start with a challenge and grow into two or three of these.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {engagementOptions.map((o) => (
              <div
                key={o.title}
                className="rounded-2xl border-t-2 border-[#17646E]/50 bg-white/70 p-6"
              >
                <o.icon className="h-6 w-6 text-[#17646E]" />
                <h3 className="mt-4 font-semibold leading-snug text-[#12333A]">{o.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#4A453F]">{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Process — a genuine sequence, so it is numbered                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-[#E3D9CC] bg-[#F6F1E9] py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              How a sponsored challenge runs
            </h2>
          </div>
          <ol className="mt-11 grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {processSteps.map((s) => (
              <li key={s.step} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#17646E]/35 bg-[#17646E]/[0.07] text-xs font-semibold text-[#17646E]">
                  {s.step}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <s.icon className="h-4 w-4 shrink-0 text-[#17646E]" />
                    <h3 className="font-semibold text-[#12333A]">{s.title}</h3>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[#4A453F]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* What you see while it runs                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              You see it as it happens
            </h2>
            <p className="mt-4 text-fluid-body text-[#4A453F]">
              Visibility is built into the way the work runs, so you always know exactly where the brief
              stands.
            </p>
          </div>
          <div className="mt-11 grid gap-x-12 gap-y-8 sm:grid-cols-3">
            {visibility.map((v) => (
              <div key={v.title} className="border-t border-[#E3D9CC] pt-4">
                <div className="flex items-center gap-2">
                  <v.icon className="h-4 w-4 shrink-0 text-[#17646E]" />
                  <h3 className="font-semibold text-[#12333A]">{v.title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-[#4A453F]">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Close                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-[#E3D9CC] bg-[#F6F1E9] py-16 md:py-20">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="font-serif text-fluid-h2 font-normal tracking-tight text-[#12333A]">
                Bring us the problem that matters most.
              </h2>
              <p className="mt-4 text-fluid-body text-[#4A453F]">
                The one worth solving properly, with a dedicated team on it for months. That makes a great brief.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/contact">
                <Button className="rounded-full bg-[#17646E] px-7 py-6 text-base font-medium text-white hover:bg-[#124F57]">
                  Talk to us
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/problems">
                <Button
                  variant="outline"
                  className="rounded-full border-2 border-[#12333A] px-7 py-6 text-base font-medium text-[#12333A] hover:bg-[#12333A] hover:text-white"
                >
                  See live briefs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
