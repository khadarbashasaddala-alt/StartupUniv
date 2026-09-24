import { useMemo, useState } from "react";
import { Link } from "wouter";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

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
  title: string;
  description: string;
  leftBgClassName: string;
  imageSrc?: string;
  applyHref: string;
  exploreHref?: string;
  extraContent?: React.ReactNode;
};

type PlanDetailPageProps = {
  hero: PlanHero;
  metrics: PlanMetric[];
  sections: PlanAccordionSection[];
  bottomApplyHref?: string;
  bottomExtra?: React.ReactNode;
  className?: string;
};

function HeroImage({ src }: { src?: string }) {
  const [imageError, setImageError] = useState(false);

  if (!src || imageError) {
    return (
      <div className="w-full h-full min-h-[260px] md:min-h-[340px] bg-gray-200" aria-hidden="true" />
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="w-full h-full object-cover"
      onError={() => setImageError(true)}
    />
  );
}

export function PlanDetailPage({ hero, metrics, sections, bottomApplyHref, bottomExtra, className }: PlanDetailPageProps) {
  const resolvedExploreHref = hero.exploreHref ?? "/program";

  const metricGridColsClassName = useMemo(() => {
    if (metrics.length <= 2) return "md:grid-cols-2";
    if (metrics.length === 3) return "md:grid-cols-3";
    return "md:grid-cols-3";
  }, [metrics.length]);

  return (
    <SiteLayout>
      <div className={cn("bg-white", className)}>
        {/* Hero */}
        <section className="py-10 md:py-14">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 overflow-hidden rounded-2xl">
              <div className={cn("p-8 md:p-12", hero.leftBgClassName)}>
                <h1 className="font-serif text-fluid-h1 text-gray-900">
                  {hero.title}
                </h1>
                <p className="mt-4 text-gray-800 text-sm md:text-base leading-relaxed max-w-xl">
                  {hero.description}
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href={hero.applyHref}>
                    <Button className="no-default-hover-elevate no-default-active-elevate h-12 md:h-14 bg-[#17646E] text-white hover:bg-[#1e3a8ae8] rounded-full px-8 text-sm md:text-base font-semibold transition-colors duration-200 ease-out">
                      Apply Now
                    </Button>
                  </Link>
                  <Link href={resolvedExploreHref}>
                    <Button
                      variant="outline"
                      className="no-default-hover-elevate no-default-active-elevate h-12 md:h-14 border-2 border-[#17646E] text-[#17646E] hover:bg-[#17646E] hover:text-white rounded-full px-8 text-sm md:text-base font-semibold transition-colors duration-200 ease-out"
                    >
                      Explore Programs
                    </Button>
                  </Link>
                </div>

                {hero.extraContent && (
                  <div className="mt-8">
                    {hero.extraContent}
                  </div>
                )}
              </div>

              <div className="bg-white">
                <div className="h-full w-full">
                  <HeroImage src={hero.imageSrc} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Plan Details */}
        <section className="py-10 md:py-14 bg-[#F8FAFC]">
          <div className="container mx-auto px-4">
            <h2 className="font-serif text-fluid-h2 text-gray-900">Plan Details</h2>

            <div className={cn("mt-10 grid gap-10", metricGridColsClassName)}>
              {metrics.map((metric) => (
                <div key={metric.title}>
                  <div className="text-lg font-medium text-gray-900">{metric.title}</div>
                  <div className="h-px bg-gray-300 mt-2" />
                  <div className="mt-3 text-xs uppercase tracking-wide text-gray-600">{metric.subtitle}</div>
                  <div className="mt-4 text-lg md:text-xl text-gray-900">{metric.value}</div>
                  {metric.description ? (
                    <div className="mt-2 text-sm text-gray-700 leading-relaxed">{metric.description}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sections */}
        <section className="py-10 md:py-14 bg-white">
          <div className="container mx-auto px-4">
            <Accordion type="single" collapsible className="w-full">
              {sections.map((section) => (
                <AccordionItem key={section.title} value={section.title} className="border-b border-gray-300">
                  <AccordionTrigger className="py-6 font-serif text-2xl md:text-4xl text-gray-900 hover:no-underline">
                    {section.title}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <ul className="list-disc pl-6 space-y-2 text-gray-800 text-sm md:text-base">
                      {section.bullets.map((bullet, idx) => (
                        <li key={idx}>{bullet}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {bottomExtra && <div className="mt-8">{bottomExtra}</div>}

            <div className="mt-6">
              <Link href={bottomApplyHref ?? hero.applyHref} className="block w-full">
                <Button className="w-full bg-[#17646E] hover:bg-[#1e3a8ae8] text-white py-3 rounded-full text-sm md:text-base font-semibold">
                  Apply Now
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
