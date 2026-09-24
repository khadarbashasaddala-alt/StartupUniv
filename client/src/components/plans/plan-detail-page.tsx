import { useMemo } from "react";
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HeroChips, HeroFacts, PartnerMarquee, VenturesBand, VENTURES } from "@/components/plans/plans-shared";
import { cn } from "@/lib/utils";

/**
 * The Founder and Co-founder pages share this shell. It runs on the same flat
 * brown ground as the home, about and plans pages — see plans-shared.tsx for
 * the colour notes.
 */

export type PlanMetric = {
  title: string;
  subtitle: string;
  value: string;
  description?: string;
};

export type PlanAccordionSection = {
  title: string;
  bullets: string[];
};

export type PlanHero = {
  /** Small caps label above the heading. */
  eyebrow: string;
  eyebrowIcon: LucideIcon;
  /** The heading reads as one sentence: the first half light, the second bold. */
  titleLight: string;
  titleBold: string;
  /** The sand-coloured line under the heading — the promise in one sentence. */
  lead: string;
  description: string;
  chips: string[];
  imageSrc?: string;
  imageAlt: string;
  applyHref: string;
  exploreHref?: string;
  /** The boxed "why this plan" list beside the hero copy. */
  highlight?: { title: string; points: string[] };
};

export type PlanPrice = {
  amount: string;
  equity: string;
  note: string;
};

type PlanDetailPageProps = {
  hero: PlanHero;
  price?: PlanPrice;
  metricsHeading?: string;
  metrics: PlanMetric[];
  sectionsHeading?: string;
  sections: PlanAccordionSection[];
  venturesHeading?: string;
  venturesIntro?: string;
  /** Only the ventures that came in on this plan, when a page wants to narrow it. */
  venturesRoute?: "Founder" | "Co-founder" | "Learner";
  closingTitle?: string;
  closingBody?: string;
  bottomApplyHref?: string;
  bottomExtra?: React.ReactNode;
  className?: string;
};

export function PlanDetailPage({
  hero,
  price,
  metricsHeading = "What the plan gives you",
  metrics,
  sectionsHeading = "What you actually do here",
  sections,
  venturesHeading = "Started here, still running",
  venturesIntro = "Since 2025 more than 20,000 students have come through StartupUniv, and over 40 startups have been started by teams who began exactly where you are about to.",
  venturesRoute,
  closingTitle = "Ready when you are.",
  closingBody = "Apply and we will take it from there — an assessment, a conversation, and a place on a team with a mentor who reviews the work.",
  bottomApplyHref,
  bottomExtra,
  className,
}: PlanDetailPageProps) {
  const resolvedExploreHref = hero.exploreHref ?? "/program";

  const metricGridColsClassName = useMemo(() => {
    if (metrics.length <= 2) return "sm:grid-cols-2";
    return "sm:grid-cols-2 lg:grid-cols-3";
  }, [metrics.length]);

  const ventures = useMemo(
    () => (venturesRoute ? VENTURES.filter((v) => v.route === venturesRoute) : VENTURES),
    [venturesRoute],
  );

  return (
    <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
      <div className={cn("bg-[#814B28]", className)}>
        {/* -------------------------------------------------------------- */}
        {/* Hero — the claim left, the work right                           */}
        {/* -------------------------------------------------------------- */}
        <section className="pb-14 pt-12 text-white md:pb-20 md:pt-16">
          <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#F0D8C0]/35 bg-[#F0D8C0]/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#F0D8C0]">
                  <hero.eyebrowIcon className="h-3.5 w-3.5" />
                  {hero.eyebrow}
                </span>

                <h1 className="mt-6 text-fluid-h1 font-light tracking-tight text-white">
                  {hero.titleLight}
                  <span className="font-semibold">{hero.titleBold}</span>
                </h1>

                <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">{hero.lead}</p>

                <p className="mt-4 max-w-xl text-fluid-body text-white/80">{hero.description}</p>

                <HeroFacts />
                <HeroChips chips={hero.chips} />

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href={hero.applyHref}
                    className="group inline-flex items-center gap-3 rounded-xl bg-[#F0D8C0] px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#5C3318] transition-colors hover:bg-[#F6EFE6]"
                  >
                    Apply now
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href={resolvedExploreHref}
                    className="group inline-flex items-center gap-3 rounded-xl border border-[#F0D8C0]/45 px-6 py-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#F0D8C0] transition-colors hover:border-[#F0D8C0] hover:bg-[#F0D8C0] hover:text-[#5C3318]"
                  >
                    Explore programmes
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>

              <div className="space-y-6">
                {/* The photograph sits on the same light plate the home hero
                    uses, so every page opens with the same object. */}
                {hero.imageSrc && (
                  <div className="overflow-hidden rounded-[20px] border border-[#F0D8C0]/20 bg-[#F6F1E9] shadow-2xl">
                    <img
                      src={hero.imageSrc}
                      alt={hero.imageAlt}
                      className="block h-auto w-full"
                      loading="eager"
                      decoding="async"
                    />
                  </div>
                )}

                {price && (
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
                )}

                {hero.highlight && (
                  <div className="rounded-2xl border-t-2 border-[#F0D8C0]/50 bg-white/[0.07] p-6">
                    <h2 className="font-semibold text-white">{hero.highlight.title}</h2>
                    <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-white/75">
                      {hero.highlight.points.map((point) => (
                        <li key={point} className="flex gap-2">
                          <span className="mt-0.5 shrink-0 font-bold text-[#F0D8C0]">✓</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <PartnerMarquee />

        {/* -------------------------------------------------------------- */}
        {/* What the plan gives you                                         */}
        {/* -------------------------------------------------------------- */}
        <section className="py-16 text-white md:py-24">
          <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
            <div className="max-w-2xl">
              <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
                {metricsHeading}
              </h2>
              <p className="mt-4 text-fluid-body text-white/75">
                StartupUniv was developed to effectively bridge these gaps — here is exactly what
                this plan puts behind you.
              </p>
            </div>

            <div
              className={cn(
                "mt-11 grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15",
                metricGridColsClassName,
              )}
            >
              {metrics.map((metric) => (
                <div key={metric.title} className="bg-[#814B28] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                    {metric.subtitle}
                  </p>
                  <h3 className="mt-3 font-serif text-2xl font-normal text-[#F0D8C0]">
                    {metric.title}
                  </h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-white/75">{metric.value}</p>
                  {metric.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{metric.description}</p>
                  ) : null}
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
              {sectionsHeading}
            </h2>

            <Accordion type="single" collapsible className="mt-8 w-full">
              {sections.map((section) => (
                <AccordionItem
                  key={section.title}
                  value={section.title}
                  className="border-b border-white/15"
                >
                  <AccordionTrigger className="py-6 font-serif text-2xl font-normal text-white hover:no-underline md:text-3xl">
                    {section.title}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <ul className="space-y-2.5">
                      {section.bullets.map((bullet, idx) => (
                        <li
                          key={idx}
                          className="flex gap-2.5 text-[15px] leading-relaxed text-white/75"
                        >
                          <span className="mt-0.5 shrink-0 font-bold text-[#F0D8C0]">✓</span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {bottomExtra && <div className="mt-8">{bottomExtra}</div>}
          </div>
        </section>

        <VenturesBand heading={venturesHeading} intro={venturesIntro} ventures={ventures} />

        {/* -------------------------------------------------------------- */}
        {/* Close                                                           */}
        {/* -------------------------------------------------------------- */}
        <section className="py-16 text-white md:py-24">
          <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
            <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.07]">
              <div className="grid items-stretch gap-8 p-8 md:grid-cols-[1fr_1fr] md:gap-10 md:p-12">
                <div>
                  <h2 className="font-serif text-fluid-h2 font-normal tracking-tight text-white">
                    {closingTitle}
                  </h2>
                  <p className="mt-4 max-w-xl text-fluid-body text-white/75">{closingBody}</p>
                  <div className="mt-8 flex flex-wrap gap-4">
                    <Link href={bottomApplyHref ?? hero.applyHref}>
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
