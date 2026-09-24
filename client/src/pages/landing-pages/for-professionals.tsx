import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/layout/site-layout";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  Layers,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessagesSquare,
  Milestone,
  Rocket,
  Timer,
  TrendingUp,
  Users,
  Video,
  Wrench,
} from "lucide-react";

/**
 * The startup-builder track. Teal (#17646E) and deep petrol (#12333A), matching
 * the "I'm building a startup" door on the home page.
 */

const pillars = [
  {
    label: "Build",
    body: "Sprints with written goals and deliverables. Tasks with one owner, a reviewer, dates and dependencies. Evidence attached to every claim, and a demo at the end of each sprint.",
    icon: Wrench,
  },
  {
    label: "Sell",
    body: "Real briefs from partner organisations, and introductions that put what you built in front of people ready to buy.",
    icon: TrendingUp,
  },
  {
    label: "Market",
    body: "Positioning, launch and demo day treated as first-class deliverables, with owners, deadlines and mentor review from the start.",
    icon: Megaphone,
  },
  {
    label: "Maintain",
    body: "A support desk with priority, category, response targets and escalation paths, so what you launch keeps serving customers well past month six.",
    icon: LifeBuoy,
  },
];

const system = [
  {
    title: "Milestones that carry their own resources",
    body: "Each milestone holds goals, deliverables, start and end dates, ordering and status — plus the reference material the team needs to hit it, attached to the milestone itself.",
    icon: Milestone,
  },
  {
    title: "Analytics on progress and team health",
    body: "Metrics roll up across sprints and the whole cohort: what shipped, where the momentum is, what is coming next, and who could use a hand.",
    icon: BarChart3,
  },
  {
    title: "A written daily pulse",
    body: "Standups capture yesterday, today and anything in the way, so the team can clear obstacles together the same day they come up.",
    icon: ClipboardCheck,
  },
  {
    title: "Demos and reviewed evidence",
    body: "Every sprint ends in a recorded demo and a rubric-scored review, with signed-off evidence behind each deliverable, so progress is always visible.",
    icon: Video,
  },
  {
    title: "Tickets with real SLA",
    body: "Raise, route, forward and escalate. Response targets are tracked and the full history stays on the ticket, so nothing needs chasing twice.",
    icon: LifeBuoy,
  },
  {
    title: "Chat and meetings beside the work",
    body: "Team channels with attachments and reactions, plus meetings with agenda, calendar invite, attendees, minutes and recording — all kept with the sprint they belong to.",
    icon: MessagesSquare,
  },
];

const comparison = [
  {
    aspect: "Team",
    alone: "Finding the right co-founders takes time",
    here: "A formed team with complementary roles, or bring your own",
  },
  {
    aspect: "Structure",
    alone: "You design the process yourself",
    here: "Milestones and sprints with dates, owners and deliverables",
  },
  {
    aspect: "Accountability",
    alone: "You set and hold your own checkpoints",
    here: "Owned tasks, daily standups, evidence and rubric-scored review",
  },
  {
    aspect: "Mentorship",
    alone: "Mentorship whenever you can arrange it",
    here: "Booked sessions, logged and attributed to the sprint they served",
  },
  {
    aspect: "Market access",
    alone: "You build the network from scratch",
    here: "Briefs and introductions through the partner network",
  },
  {
    aspect: "After launch",
    alone: "You handle support yourself",
    here: "A ticketing desk with SLA timers, escalation and history",
  },
];

export default function ForProfessionalsPage() {
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
                <Rocket className="h-3.5 w-3.5" />
                For startup builders
              </span>
              <h1 className="mt-6 font-serif text-fluid-hero font-normal tracking-tight text-white">
                A company is more than the product.
              </h1>
              <p className="mt-6 max-w-xl text-fluid-body text-white/75">
                Most founders already know how to build. What compounds is selling it, marketing it and
                supporting it well after launch. Here, every one of those is run as real work — with
                an owner, a deadline and a review.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <Link href="/apply">
                  <Button className="rounded-full bg-[#7FD3DD] px-7 py-6 text-base font-medium text-[#0B242A] hover:bg-[#9BE0E8]">
                    Apply to a cohort
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    variant="outline"
                    className="rounded-full border-2 border-white/40 bg-transparent px-7 py-6 text-base font-medium text-white hover:bg-white hover:text-[#12333A]"
                  >
                    Bring your own startup
                  </Button>
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-white/15">
              <img
                src="/landing/home/build-market-access.png"
                alt="A founding team reviewing milestone progress"
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Four pillars                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              Four things that make a company
            </h2>
            <p className="mt-4 text-fluid-body text-[#4A453F]">
              Great products earn their market, and great support keeps it. We run all four with you.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <div key={p.label} className="rounded-2xl border-t-2 border-[#17646E]/50 bg-white/70 p-6">
                <p.icon className="h-6 w-6 text-[#17646E]" />
                <h3 className="mt-4 font-serif text-2xl font-normal text-[#12333A]">{p.label}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#4A453F]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it is run                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-[#E3D9CC] bg-[#F6F1E9] py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              How it is actually run
            </h2>
            <p className="mt-4 text-fluid-body text-[#4A453F]">
              This is the machinery your team works in every day.
            </p>
          </div>
          <div className="mt-11 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {system.map((f) => (
              <div key={f.title} className="border-t border-[#E3D9CC] pt-4">
                <div className="flex items-center gap-2">
                  <f.icon className="h-4 w-4 shrink-0 text-[#17646E]" />
                  <h3 className="font-semibold text-[#12333A]">{f.title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-[#4A453F]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Alone vs here                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              Building alone, and building with us
            </h2>
          </div>

          <div className="mt-9 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E3D9CC]">
                  <th className="py-3 pr-6 text-xs font-semibold uppercase tracking-[0.14em] text-[#6B6259]">
                    &nbsp;
                  </th>
                  <th className="py-3 pr-6 text-xs font-semibold uppercase tracking-[0.14em] text-[#6B6259]">
                    On your own
                  </th>
                  <th className="py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#17646E]">
                    With StartupUniv
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.aspect} className="border-b border-[#E3D9CC]/70">
                    <th className="py-4 pr-6 align-top font-semibold text-[#12333A]">{row.aspect}</th>
                    <td className="py-4 pr-6 align-top text-[15px] leading-relaxed text-[#6B6259]">
                      {row.alone}
                    </td>
                    <td className="py-4 align-top text-[15px] leading-relaxed text-[#12333A]">
                      {row.here}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Two ways in                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-[#E3D9CC] bg-[#F6F1E9] py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              Two ways in
            </h2>
            <p className="mt-4 text-fluid-body text-[#4A453F]">
              They are genuinely different routes. Pick the one that matches where you already are.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col rounded-2xl border border-[#E3D9CC] bg-white/70 p-7">
              <div className="flex items-center gap-2 text-[#17646E]">
                <Building2 className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">The programme</p>
              </div>
              <h3 className="mt-4 font-serif text-2xl font-normal text-[#12333A]">
                You want the team and the brief
              </h3>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[#4A453F]">
                Selective. Apply, take the assessment, and if you are accepted you are placed into a
                cohort with a team, a mentor and a real problem statement to work against. The
                structure and the partner network come with it.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#4A453F]">
                <li className="flex gap-2">
                  <Timer className="mt-0.5 h-4 w-4 shrink-0 text-[#17646E]" />
                  Apply, assess, then placed in a cohort
                </li>
                <li className="flex gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#17646E]" />
                  Team, mentor and brief assigned to you
                </li>
              </ul>
              <div className="mt-7">
                <Link href="/apply">
                  <Button className="rounded-full bg-[#12333A] px-7 py-6 text-base font-medium text-white hover:bg-[#1B4752]">
                    Apply to a cohort
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-[#E3D9CC] bg-white/70 p-7">
              <div className="flex items-center gap-2 text-[#A85A1C]">
                <Layers className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">Bring your own</p>
              </div>
              <h3 className="mt-4 font-serif text-2xl font-normal text-[#12333A]">
                You already have the company
              </h3>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[#4A453F]">
                An early product, a founding team, maybe your first customers. You keep all of it and
                use the platform and the mentoring to run it with real milestones, review and
                support. Talk to us about setting your team up.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#4A453F]">
                <li className="flex gap-2">
                  <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[#A85A1C]" />
                  Your company, your team, your roadmap
                </li>
                <li className="flex gap-2">
                  <Milestone className="mt-0.5 h-4 w-4 shrink-0 text-[#A85A1C]" />
                  Milestones, analytics and support desk from day one
                </li>
              </ul>
              <div className="mt-7">
                <Link href="/contact">
                  <Button
                    variant="outline"
                    className="rounded-full border-2 border-[#12333A] px-7 py-6 text-base font-medium text-[#12333A] hover:bg-[#12333A] hover:text-white"
                  >
                    Talk to us
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-8 text-sm leading-relaxed text-[#6B6259]">
            On a college project rather than a company?{" "}
            <Link href="/for-students">
              <span className="cursor-pointer font-medium text-[#A85A1C] hover:underline">
                The college team track is here
              </span>
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Close                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="font-serif text-fluid-h2 font-normal tracking-tight text-[#12333A]">
                The idea was always the easy part.
              </h2>
              <p className="mt-4 text-fluid-body text-[#4A453F]">
                Finishing it, selling it, and supporting it well — that is the part we run with you.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/apply">
                <Button className="rounded-full bg-[#17646E] px-7 py-6 text-base font-medium text-white hover:bg-[#124F57]">
                  Apply now
                </Button>
              </Link>
              <Link href="/plans">
                <Button
                  variant="outline"
                  className="rounded-full border-2 border-[#12333A] px-7 py-6 text-base font-medium text-[#12333A] hover:bg-[#12333A] hover:text-white"
                >
                  See the plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
