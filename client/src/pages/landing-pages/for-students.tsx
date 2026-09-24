import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/layout/site-layout";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  GitPullRequest,
  GraduationCap,
  ListChecks,
  Presentation,
  Rocket,
  Target,
  Timer,
  Users,
} from "lucide-react";

/**
 * The college-team track. Ochre (#A85A1C) on the warm paper ground, matching
 * the "I'm on a college team" door on the home page.
 */

const habits = [
  {
    habit: "“This one is mine”",
    result:
      "Work is split on day one and every piece has a name on it, so each person knows what they own and the team can see the whole picture.",
  },
  {
    habit: "“Done means reviewed”",
    result:
      "Each task closes with something you can point at and a reviewer who has signed it off, so progress is always clear.",
  },
  {
    habit: "“It runs from week one”",
    result:
      "The parts are wired together early and stay working, so every sprint ends with something the team can demo for real.",
  },
];

const sprintLoop = [
  {
    step: "01",
    title: "Write down what done means",
    body: "Each sprint opens with goals, objectives and deliverables. If the team cannot describe done in a sentence, the sprint is not ready to start.",
    icon: Target,
  },
  {
    step: "02",
    title: "One task, one name",
    body: "Every task has a single named owner, a priority, story points, start and end dates, and a clear list of what it builds on. Everyone knows exactly what is theirs.",
    icon: ListChecks,
  },
  {
    step: "03",
    title: "Two minutes each, every day",
    body: "Yesterday, today, anything in the way — written and kept. Something raised on Tuesday gets solved on Tuesday, by the whole team.",
    icon: CalendarClock,
  },
  {
    step: "04",
    title: "Show the work",
    body: "Attach the commit, the document, the running build to the task it proves. Every task closes with something real behind it.",
    icon: ClipboardCheck,
  },
  {
    step: "05",
    title: "Someone reviews your work",
    body: "A mentor scores the sprint against a clear rubric and writes feedback, so you always know what good looks like and how to reach it.",
    icon: BookOpen,
  },
  {
    step: "06",
    title: "Demo, then start again",
    body: "The sprint is demoed and recorded, and the next one opens with that feedback already on the board.",
    icon: Presentation,
  },
];

const learned = [
  {
    title: "Owning a piece of work end to end",
    body: "Your name is on the task, on the evidence and on the review — the clearest preparation there is for a first job.",
    icon: ListChecks,
  },
  {
    title: "Reviewing and being reviewed",
    body: "Reading someone else's work and giving useful feedback is a skill — and receiving it well is just as valuable.",
    icon: GitPullRequest,
  },
  {
    title: "Working to a date that matters",
    body: "Dates sit on the task where everyone can see them, along with the work that follows, so the team keeps the plan together.",
    icon: Timer,
  },
  {
    title: "Handing something over",
    body: "A project someone else can run, deploy and understand — that is what turns a demo into a product.",
    icon: Rocket,
  },
];

const fit = [
  "A team of two or more working on the same project",
  "A real deliverable — capstone, semester project, mini project or research build",
  "Willing to run standups and have work reviewed",
  "At least one full term ahead of you",
  "Any discipline, any college, any year",
];

export default function ForStudentsPage() {
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
                <GraduationCap className="h-3.5 w-3.5" />
                For college teams
              </span>
              <h1 className="mt-6 font-serif text-fluid-hero font-normal tracking-tight text-[#12333A]">
                Your project. Finished properly.
              </h1>
              <p className="mt-6 max-w-xl text-fluid-body text-[#4A453F]">
                Bring the project you already have — your capstone, your semester build, your idea —
                and run it the way real teams run work. Owned tasks, daily standups, mentor review
                and a demo at the end of every sprint, until it is something that actually runs.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <Link href="/apply">
                  <Button className="rounded-full bg-[#A85A1C] px-7 py-6 text-base font-medium text-white hover:bg-[#8F4B15]">
                    Start a project
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    variant="outline"
                    className="rounded-full border-2 border-[#12333A] px-7 py-6 text-base font-medium text-[#12333A] hover:bg-[#12333A] hover:text-white"
                  >
                    Set this up for our college
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
      {/* Habits that carry a project                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-[#E3D9CC] bg-[#F6F1E9] py-16 md:py-20">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              Three habits that carry a project through
            </h2>
            <p className="mt-4 text-fluid-body text-[#4A453F]">
              These are the habits that separate a project that ships from one that stays on paper — and they are all learnable.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {habits.map((f) => (
              <div key={f.habit} className="border-t-2 border-[#A85A1C]/45 pt-5">
                <p className="font-serif text-xl text-[#12333A]">{f.habit}</p>
                <p className="mt-2.5 text-[15px] leading-relaxed text-[#4A453F]">{f.result}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The loop                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-[#12333A]">
              One sprint, start to finish
            </h2>
            <p className="mt-4 text-fluid-body text-[#4A453F]">
              This is the whole method. It repeats until the project is done, and it is the same loop
              the startup teams on this platform run.
            </p>
          </div>

          <ol className="mt-11 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {sprintLoop.map((s) => (
              <li key={s.step} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#A85A1C]/35 bg-[#A85A1C]/[0.07] text-xs font-semibold text-[#A85A1C]">
                  {s.step}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <s.icon className="h-4 w-4 shrink-0 text-[#A85A1C]" />
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
      {/* What the team learns                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-[#12333A] py-16 text-white md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              What your team walks away with
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              The project is the outcome you can point at. These are the ones that keep paying.
            </p>
          </div>
          <div className="mt-11 grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {learned.map((l) => (
              <div key={l.title}>
                <div className="flex items-center gap-2">
                  <l.icon className="h-4 w-4 shrink-0 text-[#E6A15C]" />
                  <h3 className="font-semibold text-white">{l.title}</h3>
                </div>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">{l.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Credit + fit                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="rounded-2xl border border-[#E3D9CC] bg-white/70 p-7 md:p-9">
              <GraduationCap className="h-6 w-6 text-[#A85A1C]" />
              <h2 className="mt-4 font-serif text-2xl font-normal text-[#12333A]">
                Credit, where your college maps it
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[#4A453F]">
                Programme hours and outcomes can be mapped to your institution's own credit
                structure, and certificates are issued on completion with the outcomes recorded. How
                much credit it carries is your college's decision, not ours — we provide the record
                that makes the conversation possible.
              </p>
              <Link href="/for-universities">
                <span className="mt-5 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-[#A85A1C] hover:underline">
                  How colleges set this up
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>

            <div>
              <h2 className="font-serif text-2xl font-normal text-[#12333A]">
                Who this is for
              </h2>
              <ul className="mt-5 space-y-3">
                {fit.map((f) => (
                  <li key={f} className="flex gap-3 text-[15px] leading-relaxed text-[#4A453F]">
                    <span
                      aria-hidden="true"
                      className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A85A1C]"
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-relaxed text-[#6B6259]">
                Looking for the full-time cohort programme with a team and a brief assigned to you
                instead?{" "}
                <Link href="/for-professionals">
                  <span className="cursor-pointer font-medium text-[#17646E] hover:underline">
                    That track is here
                  </span>
                </Link>
                .
              </p>
            </div>
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
                Bring the project you already have.
              </h2>
              <p className="mt-4 text-fluid-body text-[#4A453F]">
                Tell us about your team and what you are building, and we will set it up on the
                platform with you.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/apply">
                <Button className="rounded-full bg-[#A85A1C] px-7 py-6 text-base font-medium text-white hover:bg-[#8F4B15]">
                  Start a project
                </Button>
              </Link>
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
      </section>
    </SiteLayout>
  );
}
