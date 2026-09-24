import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, GraduationCap } from "lucide-react";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HeroChips, HeroFacts, PartnerMarquee, VenturesBand } from "@/components/plans/plans-shared";
import { VENTURES } from "@/components/plans/plans-shared";

/**
 * The Learner plan, on the same flat brown ground as the rest of the site —
 * see plans-shared.tsx for the colour notes.
 *
 * The page carries two readings of the same plan: come for the experience, or
 * come for a stake in what you help build. The toggle swaps the price, the
 * plan details and the sections; everything else is shared.
 */

type Variant = "experience" | "equity";

const learnerVentures = VENTURES.filter((v) => v.route === "Learner");

export default function InternPlanPage() {
  const [variant, setVariant] = useState<Variant>("experience");

  const price = useMemo(() => {
    if (variant === "experience") {
      return {
        amount: "₹1,00,000",
        equity: "Team support · certificate on completion",
        note: "Four months inside a working startup, with a reviewed record of everything you contributed.",
      };
    }

    return {
      amount: "₹1,50,000",
      equity: "5% equity share · team support",
      note: "Four months as an early contributor with a real stake. Equity is issued on completion of the programme and continued participation in the project.",
    };
  }, [variant]);

  const metrics = useMemo(() => {
    if (variant === "experience") {
      return [
        {
          title: "Startup support",
          subtitle: "Starter resources",
          value:
            "Hands-on resources, tooling and mentor time from the first week, so you are contributing rather than watching.",
        },
        {
          title: "Team support",
          subtitle: "Support every month",
          value:
            "A founder, a co-founder and a mentor around you while you learn how the company is actually run.",
        },
      ];
    }

    return [
      {
        title: "Startup support",
        subtitle: "Early contributor resources",
        value: "Everything the founding team gets, pointed at the piece of the product you own.",
      },
      {
        title: "Equity",
        subtitle: "Ownership in the startup",
        value: "Hold a 5% share, issued on completion of the programme and continued participation.",
      },
      {
        title: "Team support",
        subtitle: "Support every month",
        value: "Close mentorship from the founders while you carry real work with your name on it.",
      },
    ];
  }, [variant]);

  const sections = useMemo(() => {
    if (variant === "experience") {
      return [
        {
          title: "What you will experience",
          bullets: [
            "Work on real products that real people are using",
            "See how a startup is actually run, from the inside",
            "Learn product, marketing and operations by doing each of them",
          ],
        },
        {
          title: "Learning and mentorship",
          bullets: [
            "Direct mentorship from the founders you sit beside",
            "Every sprint reviewed against a rubric, with written feedback",
            "Room to try different roles and find the one you are best at",
          ],
        },
        {
          title: "Network and growth",
          bullets: [
            "Founders, mentors and alumni from every cohort since 2025",
            "Nine partner organisations across academia and industry",
          ],
        },
        {
          title: "Recognition and outcomes",
          bullets: [
            "A certificate that names what you actually contributed",
            "The confidence — and the evidence — to lead or launch something next",
          ],
        },
      ];
    }

    return [
      {
        title: "Your role in the startup",
        bullets: [
          "Join the founding team as an early-stage contributor, not an observer",
          "Take real ownership of your work and the results it produces",
        ],
      },
      {
        title: "Hands-on experience",
        bullets: [
          "Contribute to live products and the business decisions around them",
          "Sit inside the culture and the decision-making, from the first sprint",
        ],
      },
      {
        title: "Learning and mentorship",
        bullets: [
          "Close mentorship from founders who need you to succeed",
          "Intensive learning in product development and business strategy",
        ],
      },
      {
        title: "Network and growth",
        bullets: [
          "Network with founders, mentors and the whole partner ecosystem",
          "Build the relationships that carry the rest of your career",
        ],
      },
      {
        title: "Recognition and equity",
        bullets: [
          "Hold a 5% stake in the startup you are helping build",
          "Leave with both a certificate and real ownership",
        ],
      },
    ];
  }, [variant]);

  const gridCols = metrics.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
      <div className="bg-[#814B28]">
        {/* -------------------------------------------------------------- */}
        {/* Hero                                                            */}
        {/* -------------------------------------------------------------- */}
        <section className="pb-14 pt-12 text-white md:pb-20 md:pt-16">
          <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#F0D8C0]/35 bg-[#F0D8C0]/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Learner plan
                </span>

                <h1 className="mt-6 text-fluid-h1 font-light tracking-tight text-white">
                  An internship teaches you the job.{" "}
                  <span className="font-semibold">This teaches you the company.</span>
                </h1>

                <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">
                  StartupUniv was developed to effectively bridge these gaps.
                </p>

                <p className="mt-4 max-w-xl text-fluid-body text-white/80">
                  We started in 2025 and have worked with more than 20,000 students since, alongside
                  VTU, Jain University, NSDC, AWS, IBM, Cisco, Red Hat and NASSCOM. As a Learner you
                  sit inside a real founding team and carry work with your name on it.
                </p>

                <HeroFacts />
                <HeroChips
                  chips={["Live products", "Founder mentorship", "Four-month plan", "Certificate or equity"]}
                />

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/apply?plan=learner"
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

              <div className="space-y-6">
                {/* The same light plate the home hero uses, so every page opens
                    with the same object. */}
                <div className="overflow-hidden rounded-[20px] border border-[#F0D8C0]/20 bg-[#F6F1E9] shadow-2xl">
                  <img
                    src="/plans/about_pic.jpeg"
                    alt="A StartupUniv cohort working with its founding team"
                    className="block h-auto w-full"
                    width={1536}
                    height={1024}
                    loading="eager"
                    decoding="async"
                  />
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                    The plan
                  </p>
                  <p className="mt-3 font-serif text-4xl font-normal text-[#F0D8C0] lining-nums">
                    {price.amount}
                  </p>
                  <p className="mt-2 font-semibold text-white">{price.equity}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{price.note}</p>
                </div>

                <div className="rounded-2xl border-t-2 border-[#F0D8C0]/50 bg-white/[0.07] p-6">
                  <h2 className="font-semibold text-white">What a Learner walks out with</h2>
                  <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-white/75">
                    {[
                      "Work shipped alongside real founders, not shadowed",
                      "A portfolio of products that are actually running",
                      "A reviewed record of what you owned and delivered",
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

        {/* -------------------------------------------------------------- */}
        {/* Two ways to take the plan                                       */}
        {/* -------------------------------------------------------------- */}
        <section className="py-16 text-white md:py-24">
          <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
            <div className="max-w-2xl">
              <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
                Come for the experience, or come for a stake
              </h2>
              <p className="mt-4 text-fluid-body text-white/75">
                Same team, same work, same review. The difference is what you carry out at the end.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setVariant("experience")}
                aria-pressed={variant === "experience"}
                className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${
                  variant === "experience"
                    ? "border-[#F0D8C0] bg-[#F0D8C0] text-[#5C3318]"
                    : "border-[#F0D8C0]/45 bg-transparent text-[#F0D8C0] hover:bg-[#F0D8C0]/10"
                }`}
              >
                For experience
              </button>
              <button
                type="button"
                onClick={() => setVariant("equity")}
                aria-pressed={variant === "equity"}
                className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${
                  variant === "equity"
                    ? "border-[#F0D8C0] bg-[#F0D8C0] text-[#5C3318]"
                    : "border-[#F0D8C0]/45 bg-transparent text-[#F0D8C0] hover:bg-[#F0D8C0]/10"
                }`}
              >
                With a stake and equity
              </button>
            </div>

            <div
              className={`mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 ${gridCols}`}
            >
              {metrics.map((m) => (
                <div key={m.title} className="bg-[#814B28] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                    {m.subtitle}
                  </p>
                  <h3 className="mt-3 font-serif text-2xl font-normal text-[#F0D8C0]">{m.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-white/75">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* The detail, folded away until it is wanted                      */}
        {/* -------------------------------------------------------------- */}
        <section className="border-t border-white/15 py-16 text-white md:py-24">
          <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              What you actually do here
            </h2>

            <Accordion type="single" collapsible className="mt-8 w-full">
              {sections.map((s) => (
                <AccordionItem key={s.title} value={s.title} className="border-b border-white/15">
                  <AccordionTrigger className="py-6 font-serif text-2xl font-normal text-white hover:no-underline md:text-3xl">
                    {s.title}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <ul className="space-y-2.5">
                      {s.bullets.map((b, idx) => (
                        <li
                          key={idx}
                          className="flex gap-2.5 text-[15px] leading-relaxed text-white/75"
                        >
                          <span className="mt-0.5 shrink-0 font-bold text-[#F0D8C0]">✓</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <VenturesBand
          heading="Built by teams that had learners on them"
          intro="More than 40 startups have been started here since 2025. These two were carried by learners who were given something real to own."
          ventures={learnerVentures}
        />

        {/* -------------------------------------------------------------- */}
        {/* Close                                                           */}
        {/* -------------------------------------------------------------- */}
        <section className="py-16 text-white md:py-24">
          <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
            <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.07]">
              <div className="grid items-stretch gap-8 p-8 md:grid-cols-[1fr_1fr] md:gap-10 md:p-12">
                <div>
                  <h2 className="font-serif text-fluid-h2 font-normal tracking-tight text-white">
                    Start inside a real company.
                  </h2>
                  <p className="mt-4 max-w-xl text-fluid-body text-white/75">
                    Apply as a Learner and we will place you on a founding team with a mentor, a
                    brief, and work that carries your name on it from the first sprint.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-4">
                    <Link href={`/apply?plan=learner&tier=${variant === "equity" ? "premium" : "basic"}`}>
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
      </div>
    </SiteLayout>
  );
}
