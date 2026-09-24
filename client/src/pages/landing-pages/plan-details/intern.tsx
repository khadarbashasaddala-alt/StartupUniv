import { useMemo, useState } from "react";
import { Link } from "wouter";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function HeroImage({ src }: { src?: string }) {
  const [imageError, setImageError] = useState(false);

  if (!src || imageError) {
    return <div className="w-full h-full min-h-[260px] md:min-h-[340px] bg-gray-200" aria-hidden="true" />;
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

type Variant = "experience" | "equity";

export default function InternPlanPage() {
  const [variant, setVariant] = useState<Variant>("experience");

  const metrics = useMemo(() => {
    if (variant === "experience") {
      return [
        {
          title: "Startup Support",
          subtitle: "Starter Resources",
          value: "Get hands-on resources to support early project work.",
        },
        {
          title: "Team Support",
          subtitle: "Monthly Support",
          value: "Get dedicated support while gaining startup experience.",
        },
      ];
    }

    return [
      {
        title: "Startup Support",
        subtitle: "Early Contribution Resources",
        value: "Get hands-on resources to support your role in the startup.",
      },
      {
        title: "Equity",
        subtitle: "Ownership in the Startup",
        value: "Hold a 5% equity share in the company.",
      },
      {
        title: "Team Support",
        subtitle: "Monthly Support",
        value: "Get dedicated support while contributing actively.",
      },
    ];
  }, [variant]);

  const sections = useMemo(() => {
    if (variant === "experience") {
      return [
        {
          title: "What You'll Experience:",
          bullets: [
            "Work on real products that real people are using",
            "See how a startup actually runs from the inside",
            "Learn the ropes of product, marketing, and operations",
          ],
        },
        {
          title: "Learning & Mentorship:",
          bullets: [
            "Direct mentorship from the startup founders",
            "Learn by doing, not just by reading textbooks",
            "Explore different roles to find what you're best at",
          ],
        },
        {
          title: "Networking & Growth:",
          bullets: [
            "Build real connections with founders and mentors",
            "Grow your professional network in the startup world",
          ],
        },
        {
          title: "Recognition & Outcomes:",
          bullets: [
            "Get a professional certificate showing your real-world contribution",
            "Gain the confidence to launch or lead a startup",
          ],
        },
      ];
    }

    return [
      {
        title: "Role in the Startup:",
        bullets: [
          "Join the founding team as an early-stage contributor",
          "Take real ownership of your work and your results",
        ],
      },
      {
        title: "Hands-On Experience:",
        bullets: [
          "Contribute to live products and important business tasks",
          "Be part of the culture and the decision-making process",
        ],
      },
      {
        title: "Learning & Mentorship:",
        bullets: [
          "Close mentorship from founders who want you to succeed",
          "Intensive learning in product development and business strategy",
        ],
      },
      {
        title: "Networking & Growth:",
        bullets: [
          "Network with founders, mentors, and the whole ecosystem",
          "Build long-term relationships that will help your entire career",
        ],
      },
      {
        title: "Recognition & Equity:",
        bullets: [
          "Hold a 5% equity stake in the startup you're helping build",
          "Gain both a certificate and real ownership",
        ],
      },
    ];
  }, [variant]);

  const gridCols = metrics.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3";

  return (
    <SiteLayout>
      <div className="bg-white">
        {/* Hero */}
        <section className="py-10 md:py-14">
          <div className="container mx-auto">
            <div className="grid md:grid-cols-2 overflow-hidden rounded-2xl">
              <div className="p-8 md:p-12 bg-[#f4b4a9]">
                <h1 className="font-serif text-fluid-h1 text-gray-900">Intern</h1>
                <p className="mt-4 text-gray-800 text-sm md:text-base leading-relaxed max-w-xl">
                  This is for people who want real hands-on startup experience. You'll work on live projects, see how decisions are made, and learn the skills you need to accelerate your career—whether by earning equity as a core team member or building foundational expertise.
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href="/apply?plan=learner">
                    <Button className="no-default-hover-elevate no-default-active-elevate h-12 md:h-14 bg-[#17646E] text-white hover:bg-[#1e3a8ae8] rounded-full px-8 text-sm md:text-base font-semibold transition-colors duration-200 ease-out">
                      Apply Now
                    </Button>
                  </Link>
                  <Link href="/program">
                    <Button
                      variant="outline"
                      className="no-default-hover-elevate no-default-active-elevate h-12 md:h-14 border-2 border-[#17646E] text-[#17646E] hover:bg-[#17646E] hover:text-white rounded-full px-8 text-sm md:text-base font-semibold transition-colors duration-200 ease-out"
                    >
                      Explore Programs
                    </Button>
                  </Link>
                </div>

                <div className="mt-8 bg-white/50 rounded-xl p-5 border border-white/60 shadow-sm backdrop-blur-sm">
                  <h4 className="text-[#17646E] font-semibold mb-2">Kickstart Your Career</h4>
                  <ul className="text-gray-700 text-sm space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-[#17646E] font-bold mt-0.5">✓</span>
                      Work side-by-side with real Founders
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#17646E] font-bold mt-0.5">✓</span>
                      Build a portfolio of actual shipped products
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#17646E] font-bold mt-0.5">✓</span>
                      Build startup readiness through hands-on collaboration
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-white">
                <HeroImage src="/plans/plans-classroom.png" />
              </div>
            </div>
          </div>
        </section>

        {/* Plan Details */}
        <section className="py-10 md:py-14 bg-[#F8FAFC]">
          <div className="container mx-auto">
            <h2 className="font-serif text-fluid-h2 text-gray-900">Plan Details</h2>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setVariant("experience")}
                className={`rounded-full px-5 py-2.5 text-sm font-medium border transition-colors ${
                  variant === "experience"
                    ? "bg-[#17646E] text-white border-[#17646E]"
                    : "bg-transparent text-gray-700 border-gray-300 hover:border-gray-400"
                }`}
              >
                For Experience
              </button>
              <button
                type="button"
                onClick={() => setVariant("equity")}
                className={`rounded-full px-5 py-2.5 text-sm font-medium border transition-colors ${
                  variant === "equity"
                    ? "bg-[#17646E] text-white border-[#17646E]"
                    : "bg-transparent text-gray-700 border-gray-300 hover:border-gray-400"
                }`}
              >
                With Stake and Equity
              </button>
            </div>

            <div className={`mt-10 grid gap-10 ${gridCols}`}>
              {metrics.map((m) => (
                <div key={m.title}>
                  <div className="text-lg font-medium text-gray-900">{m.title}</div>
                  <div className="h-px bg-gray-300 mt-2" />
                  <div className="mt-3 text-xs uppercase tracking-wide text-gray-600">{m.subtitle}</div>
                  <div className="mt-4 text-lg md:text-xl text-gray-900">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sections */}
        <section className="py-10 md:py-14 bg-white">
          <div className="container mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {sections.map((s) => (
                <AccordionItem key={s.title} value={s.title} className="border-b border-gray-300">
                  <AccordionTrigger className="py-6 font-serif text-2xl md:text-4xl text-gray-900 hover:no-underline">
                    {s.title}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <ul className="list-disc pl-6 space-y-2 text-gray-800 text-sm md:text-base">
                      {s.bullets.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-10">
              <Link href="/apply?plan=learner" className="block w-full">
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
