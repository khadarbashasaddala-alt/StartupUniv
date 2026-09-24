import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/layout/site-layout";
import {
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  Users,
} from "lucide-react";

/**
 * The institution channel for the college-team track, so it carries the same
 * ochre (#A85A1C) as /for-students.
 */

const outcomes = [
  {
    title: "One standard across every batch",
    body:
      "Every team runs the same sprints, standups and reviews, so marks reflect the work itself and every guide is looking at the same evidence.",
  },
  {
    title: "A record that lasts",
    body:
      "Who built what, when it was reviewed and what the feedback said — all kept, and all available long after the demo is over.",
  },
  {
    title: "Accreditation answered from data",
    body:
      "Programme hours, outcomes and student evidence are already recorded, so the reporting pack assembles from what the platform holds.",
  },
];

const capabilities = [
  {
    title: "Credit mapping your institution controls",
    body: "Programme hours and outcomes are recorded against your own credit structure, with the mapping document attached and versioned. You decide the weighting; we keep the record that supports it.",
    icon: Award,
  },
  {
    title: "An evidence trail per student",
    body: "Every task carries one named owner, every deliverable carries submitted evidence, and every review carries a rubric score and written feedback. Individual contribution is clear and easy to justify.",
    icon: ClipboardCheck,
  },
  {
    title: "Cohort dashboards for your faculty",
    body: "Progress across every team in the batch in one place: what shipped, what is coming next, where momentum is strongest, and which students could use a nudge.",
    icon: BarChart3,
  },
  {
    title: "Consistent process across guides",
    body: "Sprints, standups and reviews run the same way for every team, so results stay comparable across batches and across years.",
    icon: ListChecks,
  },
  {
    title: "Certificates and outcome records",
    body: "Issued on completion with outcomes recorded, so students leave with something verifiable and you keep the reporting copy.",
    icon: GraduationCap,
  },
  {
    title: "A standard MoU",
    body: "One partnership framework with defined scope, outcomes and metrics, reusable every academic year.",
    icon: FileText,
  },
];

const partnershipLevels = [
  {
    name: "Associate Partner",
    summary: "Start small, one department or one batch.",
    features: [
      "Student referral into the cohort programme",
      "Campus awareness sessions",
      "Access to webinars and resources",
      "Basic credit mapping support",
    ],
  },
  {
    name: "Academic Partner",
    summary: "Run it as part of the curriculum.",
    features: [
      "Everything in Associate",
      "Full credit integration support",
      "Faculty development workshops",
      "Priority student selection",
      "Quarterly progress reports",
    ],
    highlighted: true,
  },
  {
    name: "Strategic Partner",
    summary: "A cohort built around your institution.",
    features: [
      "Everything in Academic",
      "Custom cohort for university students",
      "On-campus immersion weeks",
      "Co-branded certification",
      "Advisory board seat",
    ],
  },
];

export default function ForUniversitiesPage() {
  return (
    <SiteLayout hideCTA>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-14 md:py-20 lg:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#A85A1C]/30 bg-[#A85A1C]/[0.07] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#A85A1C]">
                <Building2 className="h-3.5 w-3.5" />
                For universities and colleges
              </span>
              <h1 className="mt-6 font-serif text-fluid-hero font-normal tracking-tight text-[#12333A]">
                Give every project team the same discipline.
              </h1>
              <p className="mt-6 max-w-xl text-fluid-body text-[#4A453F]">
                Set your students up on the platform as a batch and their coursework runs like real
                engineering work — owned tasks, daily standups, mentor review against a rubric, and
                evidence behind every deliverable. You get a record you can assess and report from.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <Link href="/contact">
                  <Button className="rounded-full bg-[#A85A1C] px-7 py-6 text-base font-medium text-white hover:bg-[#8F4B15]">
                    Set this up for a batch
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    variant="outline"
                    className="rounded-full border-2 border-[#12333A] px-7 py-6 text-base font-medium text-[#12333A] hover:bg-[#12333A] hover:text-white"
                  >
                    Schedule a call
                  </Button>
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-[#E3D9CC] bg-white shadow-sm">
              <img
                src="/landing/home/build-team-mentorship.png"
                alt="A mentor reviewing work with a student team"
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* What the department gains                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-[#E3D9CC] bg-[#F6F1E9] py-16 md:py-20">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              What your department gains
            </h2>
            <p className="mt-4 text-fluid-body text-[#4A453F]">
              Three things that change the moment every project runs on a shared structure.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {outcomes.map((p) => (
              <div key={p.title} className="border-t-2 border-[#A85A1C]/45 pt-5">
                <p className="font-serif text-xl text-[#12333A]">{p.title}</p>
                <p className="mt-2.5 text-[15px] leading-relaxed text-[#4A453F]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* What the institution gets                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              What your institution gets
            </h2>
            <p className="mt-4 text-fluid-body text-[#4A453F]">
              A structure your existing projects run inside, with no new syllabus to deliver.
            </p>
          </div>
          <div className="mt-11 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => (
              <div key={c.title} className="border-t border-[#E3D9CC] pt-4">
                <div className="flex items-center gap-2">
                  <c.icon className="h-4 w-4 shrink-0 text-[#A85A1C]" />
                  <h3 className="font-semibold text-[#12333A]">{c.title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-[#4A453F]">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Two ways to work together                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-[#12333A] py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Two ways to work with us
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              Most institutions start with the first and add the second later.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-7">
              <div className="flex items-center gap-2 text-[#E6A15C]">
                <Layers className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">Your own batch</p>
              </div>
              <h3 className="mt-4 font-serif text-2xl font-normal text-white">
                Run your students' own projects here
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-white/70">
                Your curriculum, your project topics, your guides. The platform supplies the
                structure and the record: sprints, owned tasks, standups, evidence, review and a
                dashboard across the whole batch.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-7">
              <div className="flex items-center gap-2 text-[#7FD3DD]">
                <Users className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">The programme</p>
              </div>
              <h3 className="mt-4 font-serif text-2xl font-normal text-white">
                Refer students into a cohort
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-white/70">
                Students apply, are assessed, and selected students join a cohort with a team, a
                mentor and a real brief. Suited to students who want to go further than the
                curriculum requires.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Partnership levels                                               */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-[#E3D9CC] bg-[#F6F1E9] py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              Partnership levels
            </h2>
            <p className="mt-4 text-fluid-body text-[#4A453F]">
              One MoU framework, three depths of involvement.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {partnershipLevels.map((level) => (
              <div
                key={level.name}
                className={
                  "flex flex-col rounded-2xl border bg-white/70 p-7 " +
                  (level.highlighted
                    ? "border-[#A85A1C]/45 ring-1 ring-[#A85A1C]/25"
                    : "border-[#E3D9CC]")
                }
              >
                <h3 className="font-serif text-2xl font-normal text-[#12333A]">{level.name}</h3>
                <p className="mt-2 text-sm text-[#6B6259]">{level.summary}</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {level.features.map((f) => (
                    <li key={f} className="flex gap-3 text-[15px] leading-relaxed text-[#4A453F]">
                      <span
                        aria-hidden="true"
                        className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A85A1C]"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Close                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="font-serif text-fluid-h2 font-normal tracking-tight text-[#12333A]">
                Start with one batch.
              </h2>
              <p className="mt-4 text-fluid-body text-[#4A453F]">
                Pick a single department or a single semester, run it end to end, and judge it on the
                record it produces.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/contact">
                <Button className="rounded-full bg-[#A85A1C] px-7 py-6 text-base font-medium text-white hover:bg-[#8F4B15]">
                  Talk to us
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/for-students">
                <Button
                  variant="outline"
                  className="rounded-full border-2 border-[#12333A] px-7 py-6 text-base font-medium text-[#12333A] hover:bg-[#12333A] hover:text-white"
                >
                  What students see
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
