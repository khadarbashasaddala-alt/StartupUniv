import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteLayout } from "@/components/layout/site-layout";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { PLANS_PAGE_ENABLED } from "@/lib/plans-flags";
import {
  CheckCircle,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";

const founderFeatures = [
  "Lead the startup as the Primary Founder",
  "Get mentorship to refine ideas & execution",
  "Team support to build product, ops & marketing",
  "Guidance on business model, go-to-market & investors",
  "Prototype, test & validate before full-time commitment",
  "Network with founders, mentors & industry experts",
  "Access pre-incubator resources and mentorship (Passionate)",
  "Official Founder recognition in the startup ecosystem",
  "The plan duration is 4 months",

];

const cofounderFeatures = [
  "Join as Co-Founder with shared ownership",
  "Mentorship to refine ideas & execution",
  "Team support to build product, ops & marketing",
  "Guidance on business model, go-to-market & investors",
  "Prototype, test & validate before full-class",
  "Network with founders, mentors & industry experts",
  "Access pre-incubator resources and mentorship",
  "Official Co-Founder recognition in the startup ecosystem",
  "The plan duration is 4 months",
];

const internFeatures = [
  "Hands-on experience in real startup operations",
  "Mentorship from experienced founders",
  "Learn product, marketing, operations & business strategy",
  "Work on live products or functional prototypes",
  "Exposure to startup culture and decision-making",
  "Network with founders and core team members",
  "Recognition through certificate or equity",
  "Flexible involvement based on interest and role",
  "The plan duration is 4 months",
];

export default function PlansPage() {
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [internPlanType, setInternPlanType] = useState<"equity" | "experience">("equity");
  const [heroCtaHover, setHeroCtaHover] = useState<"apply" | "explore" | null>(null);
  const plansRef = useRef<HTMLElement>(null);

  // Use Vite base URL so this works even when the app is hosted under a sub-path.
  const plansHeroImageSrc = `${import.meta.env.BASE_URL}plans/plans-main.png`;

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

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.2,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  if (!PLANS_PAGE_ENABLED) {
    return (
      <SiteLayout>
        <section className="min-h-[60vh] flex items-center justify-center bg-white py-20">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h1 className="text-fluid-hero font-bold text-gray-900 mb-4">
              Plans &amp; Pricing — Coming Soon
            </h1>
            <p className="text-base md:text-lg text-gray-600 mb-8">
              We're finalising pricing for both routes — joining a cohort, and bringing your own
              project or company. In the meantime, see how each one works, or talk to us directly.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/">
                <Button
                  size="lg"
                  className="bg-[#17646E] hover:bg-[#1e3a8ae8] text-white px-6 py-4 text-base font-semibold rounded-full"
                >
                  Back to Home
                </Button>
              </Link>
              <Link href="/program">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-6 py-4 text-base font-semibold rounded-full"
                >
                  Explore Programs
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="bg-white py-10 md:py-12" ref={plansRef}>
        <div className="container mx-auto">
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-100">
            <div className="grid lg:grid-cols-2 items-stretch">
              {/* Left Column - Content (Blue) */}
              <div className="bg-[#17646E] px-8 py-12 md:px-12 md:py-16 lg:h-[600px]">
                <div className="space-y-6 max-w-xl">
                  <TimelineContent
                    animationNum={0}
                    timelineRef={plansRef}
                    customVariants={revealVariants}
                  >
                    {/* <Badge className="bg-white/10 text-white border border-white/20 px-4 py-2 text-sm">
                      Plans & Pricing
                    </Badge> */}
                  </TimelineContent>

                  <TimelineContent
                    animationNum={1}
                    timelineRef={plansRef}
                    customVariants={revealVariants}
                  >
                    <h1 className="text-fluid-hero font-bold text-white">
                      Plans & Pricing
                    </h1>
                  </TimelineContent>

                  <TimelineContent
                    animationNum={2}
                    timelineRef={plansRef}
                    customVariants={revealVariants}
                  >
                    <p className="text-base md:text-lg text-white/85 leading-relaxed">
                      Select the plan that best fits your entrepreneurial journey. Founder and Co-Founder plans include premium features, while Intern plans offer Basic and Premium tiers.
                    </p>
                  </TimelineContent>

                  <TimelineContent
                    animationNum={3}
                    timelineRef={plansRef}
                    customVariants={revealVariants}
                  >
                    <div className="flex flex-wrap gap-4 pt-1">
                      <Link href="/apply?plan=founder">
                        <Button
                          size="lg"
                          onMouseEnter={() => setHeroCtaHover("apply")}
                          onMouseLeave={() => setHeroCtaHover(null)}
                          className={
                            heroCtaHover === "explore"
                              ? "border-2 border-white text-white px-6 py-4 text-base font-semibold rounded-full bg-transparent transition-all"
                              : "bg-white text-[#17646E] px-6 py-4 text-base font-semibold rounded-full transition-all hover:bg-white/90"
                          }
                        >
                          Apply Now
                        </Button>
                      </Link>
                      <Link href="/program">
                        <Button
                          size="lg"
                          onMouseEnter={() => setHeroCtaHover("explore")}
                          onMouseLeave={() => setHeroCtaHover(null)}
                          className={
                            heroCtaHover === "explore"
                              ? "bg-white text-[#17646E] px-6 py-4 text-base font-semibold rounded-full transition-all border-2 border-white"
                              : "border-2 border-white text-white px-6 py-4 text-base font-semibold rounded-full bg-transparent transition-all hover:bg-white hover:text-[#17646E]"
                          }
                        >
                          Explore Programs
                        </Button>
                      </Link>
                    </div>

                    <div className="mt-8 bg-white/10 rounded-xl p-5 border border-white/20 shadow-sm backdrop-blur-sm">
                      <h4 className="text-white font-semibold mb-2">Build Together. Grow Faster.</h4>
                      <ul className="text-white/85 text-sm space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="text-white font-bold mt-0.5">✓</span>
                          Execute real projects, not just theory
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-white font-bold mt-0.5">✓</span>
                          Gain hands-on experience solving real-world challenges
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-white font-bold mt-0.5">✓</span>
                          Build alongside a structured team of peers
                        </li>
                      </ul>
                    </div>
                  </TimelineContent>
                </div>
              </div>

              {/* Right Column - Image */}
              <TimelineContent
                animationNum={4}
                timelineRef={plansRef}
                customVariants={revealVariants}
              >
                <div className="relative min-h-[320px] h-[420px] sm:h-[520px] lg:h-[600px]">
                  <img
                    src={plansHeroImageSrc}
                    alt="Team discussion"
                    className="w-full h-full object-cover"
                    fetchPriority="high"
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      const img = e.currentTarget;

                      // First retry: absolute path (covers some reverse-proxy setups).
                      if (!img.dataset.fallbackTried) {
                        img.dataset.fallbackTried = "1";
                        img.src = "/plans/plans-main.png";
                        return;
                      }

                      img.src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect width='1200' height='800' fill='%23E5E7EB'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='40' fill='%236B7280'%3ETeam Collaboration%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
              </TimelineContent>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 md:py-20 bg-white">
        <div className="container mx-auto">
          {/* Section Title */}
          <div className="text mb-12 text-center">
            <h2 className="text-fluid-h2 font-bold text-gray-900 mb-4">
              "Choose Your Plan"
            </h2>
          </div>
          
          <div className="grid gap-10 lg:grid-cols-2 max-w-[950px] mx-auto">
            {/* FOUNDER */}
            <TimelineContent
              animationNum={3}
              timelineRef={plansRef}
              customVariants={revealVariants}
            >
            <div id="founder" className="scroll-mt-28 group transition-all duration-300 cursor-pointer rounded-2xl hover:bg-gray-300 h-full" onClick={() => setActiveCard(activeCard === "founder" ? null : "founder")}>
            <Card 
              className="border-2 border-gray-200 rounded-2xl bg-transparent shadow-md group-hover:shadow-xl overflow-hidden flex flex-col h-full"
            >
              <CardHeader className="space-y-4 pb-8 px-8 pt-8">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[#17646E] rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-10 h-10 text-[#FFD700]" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-bold text-gray-900">FOUNDER Plan</CardTitle>
                    <CardDescription className="text-base text-gray-600 mt-1">
                      Aspiring startup founders
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-8 pb-8 flex flex-col flex-1">
                <div className="flex flex-col flex-1 gap-6">
                  <div className="text-left pb-6 border-b-2 border-gray-200">
                    <div className="text-4xl font-bold text-gray-900 mb-2">₹5,00,000 <span className="text-lg font-normal text-gray-600">/</span></div>
                    <div className="text-base font-semibold text-gray-700 mb-1">40% Equity Share / Team Support</div>
                  </div>
                  <ul className="space-y-3 bg-white p-4 rounded-lg">
                    {founderFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-[#17646E] shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700 leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-2">
                    <Link href="/apply?plan=founder">
                      <Button className="w-full bg-[#17646E] hover:bg-[#1e3a8ae8] text-white py-4 text-base font-semibold rounded-full">
                        Apply Now
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
            </TimelineContent>

            {/* Co-Founder */}
            <TimelineContent
              animationNum={4}
              timelineRef={plansRef}
              customVariants={revealVariants}
            >
            <div id="cofounder" className="scroll-mt-28 group transition-all duration-300 cursor-pointer rounded-2xl hover:bg-gray-300 h-full" onClick={() => setActiveCard(activeCard === "cofounder" ? null : "cofounder")}>
            <Card 
              className="border-2 border-gray-200 rounded-2xl bg-transparent shadow-md group-hover:shadow-xl overflow-hidden flex flex-col h-full"
            >
              <CardHeader className="space-y-4 pb-8 px-8 pt-8">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[#17646E] rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-10 h-10 text-[#FFD700]" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-bold text-gray-900">Co-Founder Plan</CardTitle>
                    <CardDescription className="text-base text-gray-600 mt-1">
                      Early-stage active contributors
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-8 pb-8 flex flex-col flex-1">
                <div className="flex flex-col flex-1 gap-6">
                  <div className="text-left pb-6 border-b-2 border-gray-200">
                    <div className="text-4xl font-bold text-gray-900 mb-2">₹3,00,000 <span className="text-lg font-normal text-gray-600">/</span></div>
                    <div className="text-base font-semibold text-gray-700 mb-1">20% Equity Share / Team Support</div>
                  </div>
                  <ul className="space-y-3 bg-white p-4 rounded-lg">
                    {cofounderFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-[#17646E] shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700 leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-2">
                    <Link href="/apply?plan=cofounder">
                      <Button className="w-full bg-[#17646E] hover:bg-[#1e3a8ae8] text-white py-4 text-base font-semibold rounded-full">
                        Apply Now
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
            </TimelineContent>

            {/* Intern - temporarily hidden */}
            {/* <TimelineContent
              animationNum={5}
              timelineRef={plansRef}
              customVariants={revealVariants}
            >
            <div id="intern" className="scroll-mt-28 group transition-all duration-300 cursor-pointer rounded-2xl hover:bg-gray-300 h-full" onClick={() => setActiveCard(activeCard === "intern" ? null : "intern")}>
            <Card
              className="border-2 border-gray-200 rounded-2xl bg-transparent shadow-md group-hover:shadow-xl overflow-hidden flex flex-col h-full"
            >
              <CardHeader className="space-y-4 pb-8 px-8 pt-8">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-[#17646E] rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-10 h-10 text-[#FFD700]" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-bold text-gray-900">Intern Plan</CardTitle>
                    <CardDescription className="text-base text-gray-600 mt-1">
                      Hands-on startup experience
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-8 pb-8 flex flex-col flex-1">
                <div className="flex flex-col flex-1 gap-6">
                  <div className="text-left pb-6 border-b-2 border-gray-200">
                    {internPlanType === "equity" ? (
                      <>
                        <div className="flex items-end gap-2 mb-2 flex-wrap">
                          <span className="text-4xl font-bold text-gray-900">₹1,50,000</span>
                          <span className="text-lg font-normal text-gray-600 mb-1">/</span>
                          <span className="text-base font-semibold text-gray-700 mb-1">5% Equity Share</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-semibold text-gray-700">Team Support</span>
                          <span className="text-gray-600">/</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setInternPlanType("experience"); }}
                            className="flex items-center gap-1 bg-[#eef0ff] text-[#17646E] px-3 py-1 rounded text-sm font-medium hover:bg-[#dde0ff] transition-colors"
                          >
                            With Equity <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-end gap-2 mb-2">
                          <span className="text-4xl font-bold text-gray-900">₹1,00,000</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-semibold text-gray-700">Team Support</span>
                          <span className="text-gray-600">/</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setInternPlanType("equity"); }}
                            className="flex items-center gap-1 bg-[#eef0ff] text-[#17646E] px-3 py-1 rounded text-sm font-medium hover:bg-[#dde0ff] transition-colors"
                          >
                            Experience <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <ul className="space-y-3 bg-white p-4 rounded-lg">
                    {internFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-[#17646E] shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700 leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-2">
                    <Link href={`/apply?plan=learner&tier=${internPlanType === "equity" ? "premium" : "basic"}`}>
                      <Button className="w-full bg-[#17646E] hover:bg-[#1e3a8ae8] text-white py-4 text-base font-semibold rounded-full">
                        Apply Now
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
            </TimelineContent> */}
          </div>
        </div>
      </section>

      {/* Equity Distribution Scenarios */}
      <section className="py-16 md:py-20 bg-white ">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl text-gray-900 mb-4">
              Team Equity Distribution Scenarios
            </h2>
          </div>

          <div className="max-w-6xl mx-auto">
            <Tabs defaultValue="scenario1" className="w-full">
              <TabsList className="flex w-full h-auto p-0 bg-transparent gap-4">
                <TabsTrigger 
                  value="scenario1" 
                  className="flex-1 data-[state=active]:bg-[#17646E] data-[state=active]:text-white data-[state=active]:border-0 data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-900 data-[state=inactive]:border-r-2 data-[state=inactive]:border-black text-sm md:text-base py-3 rounded-none"
                >
                  Scenario 1
                </TabsTrigger>
                <TabsTrigger 
                  value="scenario2" 
                  className="flex-1 data-[state=active]:bg-[#17646E] data-[state=active]:text-white data-[state=active]:border-0 data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-900 data-[state=inactive]:border-r-2 data-[state=inactive]:border-black text-sm md:text-base py-3 rounded-none"
                >
                  Scenario 2
                </TabsTrigger>
                <TabsTrigger 
                  value="scenario3" 
                  className="flex-1 data-[state=active]:bg-[#17646E] data-[state=active]:text-white data-[state=active]:border-0 data-[state=inactive]:bg-transparent data-[state=inactive]:text-gray-900 text-sm md:text-base py-3 rounded-none"
                >
                  Scenario 3
                </TabsTrigger>
              </TabsList>

              {/* Scenario 1 */}
              <TabsContent value="scenario1" className="mt-5">
                <div className="bg-[#FFDF8B] px-6 md:px-12 pt-12 md:pt-14 pb-12 md:pb-14">
                  <div className="flex flex-col gap-8 items-start max-w-5xl">
                    <h3 className="font-serif font-light text-[#12333A] text-4xl md:text-[70px] leading-[1.02] tracking-[-0.04em]">
                      2 Founders + 8 Interns + 1 Mentor
                    </h3>
                    <p className="text-[#12333A] text-base md:text-[21px] leading-relaxed">
                      “Two founders, each holding 40% equity, totaling 80%.”
                    </p>
                  </div>

                  <div className="mt-10 md:mt-14">
                    <div className="h-px w-full bg-[#12333A]" />
                    <p className="pt-3 text-[#12333A] text-sm md:text-[18px] leading-relaxed">
                      The StartupUniv
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Scenario 2 */}
              <TabsContent value="scenario2" className="mt-6">
                <div className="bg-[#D7FFE6] px-6 md:px-12 pt-12 md:pt-14 pb-12 md:pb-14">
                  <div className="flex flex-col gap-8 items-start max-w-5xl">
                    <h3 className="font-serif font-light text-[#12333A] text-4xl md:text-[70px] leading-[1.02] tracking-[-0.04em]">
                      1 Founder + 2 Co-founders + 7 Interns + 1 Mentor
                    </h3>
                    <ul className="list-disc pl-5 text-[#12333A] text-sm md:text-[18px] leading-relaxed space-y-2">
                      <li>Founder. Owns 40% of the company.</li>
                      <li>Co-founders: There are two of them, and each owns 20%, so together they have 40%.</li>
                      <li>Intern + Mentor + StartupUniv: Together, they own 20% of the company.</li>
                    </ul>
                  </div>

                  <div className="mt-10 md:mt-14">
                    <div className="h-px w-full bg-[#12333A]" />
                    <p className="pt-3 text-[#12333A] text-sm md:text-[18px] leading-relaxed">
                      The StartupUniv
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Scenario 3 */}
              <TabsContent value="scenario3" className="mt-6">
                <div className="bg-[#F7B6AD] px-6 md:px-12 pt-12 md:pt-14 pb-12 md:pb-14">
                  <div className="flex flex-col gap-8 items-start max-w-5xl">
                    <h3 className="font-serif font-light text-[#12333A] text-4xl md:text-[70px] leading-[1.02] tracking-[-0.04em]">
                      1 Founder + 1 Co-founder + 4 Premium Interns + 1 Mentor
                    </h3>
                    <ul className="list-disc pl-5 text-[#12333A] text-sm md:text-[18px] leading-relaxed space-y-2">
                      <li>Founder. Owns 40% of the startup.</li>
                      <li>Co-founder. Owns 20%.</li>
                      <li>Premium Interns: There are 4 interns, and each gets 5%, so together they have 20%.</li>
                      <li>Mentor + StartupUniv: Together, they get the remaining 20%.</li>
                    </ul>

                    <p className="text-[#12333A] text-sm md:text-[18px] leading-relaxed max-w-4xl">
                      This shows how ownership of the company is shared among the main founder, co-founder, interns, and the supporting team.
                    </p>
                  </div>

                  <div className="mt-10 md:mt-14">
                    <div className="h-px w-full bg-[#12333A]" />
                    <p className="pt-3 text-[#12333A] text-sm md:text-[18px] leading-relaxed">
                      The StartupUniv
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            {/* Team Application Section */}
      <section className="py-8 ">
        <div className="  px-2">
          <Link href="/plans/team-application">
            <Button className="bg-[#17646E]  text-white px-6 py-3 text-sm font-semibold rounded-full">
              Team Application
            </Button>
          </Link>
        </div>
      </section>

            {/* Equity Issuance Terms */}
            <div className="mt-10">
              <Card className="bg-gray-200 border-2  shadow-md">
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-900 mb-3 text-lg">Equity Issuance Terms</h3>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                    Equity will be issued upon successful completion of the program and continued participation in the project. This ensures commitment and aligns interests for long-term success.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      

      
    </SiteLayout>
  );
}
