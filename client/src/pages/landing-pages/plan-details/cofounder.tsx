import { Link } from "wouter";
import { Handshake } from "lucide-react";
import { PlanDetailPage } from "@/components/plans/plan-detail-page";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { PLANS_PAGE_ENABLED } from "@/lib/plans-flags";

export default function CoFounderPlanPage() {
  if (!PLANS_PAGE_ENABLED) {
    return (
      <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
        <section className="flex min-h-[60vh] items-center justify-center py-20 text-white">
          <div className="mx-auto max-w-xl px-6 text-center">
            <h1 className="text-fluid-h1 font-light tracking-tight text-white">
              The Co-founder plan opens <span className="font-semibold">shortly.</span>
            </h1>
            <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">
              StartupUniv was developed to effectively bridge these gaps.
            </p>
            <p className="mt-4 text-fluid-body text-white/80">
              We started in 2025, have worked with more than 20,000 students since, and are matching
              the next set of co-founders to founding teams. Talk to us in the meantime.
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
    <PlanDetailPage
      hero={{
        eyebrow: "Co-founder plan",
        eyebrowIcon: Handshake,
        titleLight: "You do not need your own idea. ",
        titleBold: "You need one worth owning.",
        lead: "StartupUniv was developed to effectively bridge these gaps.",
        description:
          "We started in 2025 and have since worked with more than 20,000 students, partnering with VTU, Jain University, NSDC, AWS, IBM, Cisco, Red Hat and NASSCOM. Join a founding team here and you take a real stake in a company that already has traction, a mentor and a brief.",
        chips: ["20% equity", "Four-month plan", "Own one core function", "Pre-vetted ideas"],
        imageSrc: "/landing/cofounder-new-bg.jpg",
        imageAlt: "A co-founder mapping a sprint with the founding team",
        applyHref: "/apply?plan=cofounder",
        exploreHref: "/program",
        highlight: {
          title: "The scale-up advantage",
          points: [
            "Join pre-vetted ideas that already have early traction",
            "Own one core function deeply — tech, growth, operations or delivery",
            "Carry far less early-stage risk, inside a structure that has already run it",
          ],
        },
      }}
      price={{
        amount: "₹3,00,000",
        equity: "20% equity share · team support",
        note: "Four months alongside a Founder who has already been through validation. Equity is issued on completion of the programme and continued participation in the project.",
      }}
      metricsHeading="What the Co-founder plan puts behind you"
      metrics={[
        {
          title: "Startup support",
          subtitle: "Early-stage resources",
          value:
            "The same resources, infrastructure and partner introductions the Founder gets, pointed at the function you own.",
        },
        {
          title: "Equity",
          subtitle: "Meaningful ownership",
          value: "Hold a 20% share in the startup, issued on completion and continued participation.",
        },
        {
          title: "Team support",
          subtitle: "Ongoing support",
          value:
            "A learner team under you and a mentor above you, so your function scales without you doing all of it.",
        },
      ]}
      sectionsHeading="What being a Co-founder here actually means"
      sections={[
        {
          title: "Role and responsibilities",
          bullets: [
            "Join a founding team as a full partner, not a senior hire",
            "Lead one function end to end — tech, marketing, operations or delivery",
            "Sit in on every decision that changes the direction of the company",
          ],
        },
        {
          title: "Mentorship and support",
          bullets: [
            "Mentorship aimed squarely at scaling the part of the business you own",
            "Work on live products with a learner team assigned to your function",
          ],
        },
        {
          title: "Strategy and growth",
          bullets: [
            "Honest guidance on growth, pricing and finding the first investors",
            "A safe place to test what you think will work, before it costs anything",
          ],
        },
        {
          title: "Network and resources",
          bullets: [
            "Nine partner organisations across academia and industry, opening doors",
            "Founders, mentors and alumni from every cohort we have run since 2025",
          ],
        },
        {
          title: "Recognition",
          bullets: [
            "Officially recognised as a Co-founder with a 20% stake in the company",
            "A reviewed record of the function you built and what it delivered",
          ],
        },
      ]}
      venturesRoute="Co-founder"
      venturesHeading="Companies a co-founder made work"
      venturesIntro="More than 40 startups have been started here since 2025. These two were carried by co-founders who owned a single function and did it properly."
      closingTitle="Find the team worth betting on."
      closingBody="Apply as Co-founder and we will match you to a founding team whose idea has already been validated, and to the function you are best at."
    />
  );
}
