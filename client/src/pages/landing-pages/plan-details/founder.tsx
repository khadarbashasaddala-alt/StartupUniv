import { Link } from "wouter";
import { Rocket } from "lucide-react";
import { PlanDetailPage } from "@/components/plans/plan-detail-page";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { PLANS_PAGE_ENABLED } from "@/lib/plans-flags";

export default function FounderPlanPage() {
  if (!PLANS_PAGE_ENABLED) {
    return (
      <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
        <section className="flex min-h-[60vh] items-center justify-center py-20 text-white">
          <div className="mx-auto max-w-xl px-6 text-center">
            <h1 className="text-fluid-h1 font-light tracking-tight text-white">
              The Founder plan opens <span className="font-semibold">shortly.</span>
            </h1>
            <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">
              StartupUniv was developed to effectively bridge these gaps.
            </p>
            <p className="mt-4 text-fluid-body text-white/80">
              We started in 2025, have worked with more than 20,000 students since, and are
              finalising the intake for the next founder cohort. Talk to us in the meantime.
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
        eyebrow: "Founder plan",
        eyebrowIcon: Rocket,
        titleLight: "Bring the idea. ",
        titleBold: "We bring everything the idea is missing.",
        lead: "StartupUniv was developed to effectively bridge these gaps.",
        description:
          "We started in 2025, have worked with more than 20,000 students since, and partner with universities, skilling bodies and technology companies — VTU, Jain University, NSDC, AWS, IBM, Cisco, Red Hat and NASSCOM among them. As Founder you lead your own company, and that whole network stands behind it.",
        chips: ["40% equity", "Four-month plan", "Your own team", "Mentor reviews"],
        imageSrc: "/landing/founder-new-bg.jpg",
        imageAlt: "A founder walking their team through a market analysis",
        applyHref: "/apply?plan=founder",
        exploreHref: "/program",
        highlight: {
          title: "Why founders start here",
          points: [
            "Turn a vision into sprint goals somebody actually owns",
            "Curate the execution team you want, rather than the one you can find",
            "Validate opportunities and manage risk with a mentor reviewing every call",
          ],
        },
      }}
      price={{
        amount: "₹5,00,000",
        equity: "40% equity share · team support",
        note: "Four months, a team you help pick, and a mentor who reviews every sprint. Equity is issued on completion of the programme and continued participation in the project.",
      }}
      metricsHeading="What the Founder plan puts behind you"
      metrics={[
        {
          title: "Startup support",
          subtitle: "Resources to get started",
          value:
            "Hands-on resources, infrastructure and the partner network we have built since 2025, pointed at your idea from week one.",
        },
        {
          title: "Equity",
          subtitle: "Own a significant share",
          value: "Hold 40% as the primary Founder, issued on completion and continued participation.",
        },
        {
          title: "Team support",
          subtitle: "Support while you build",
          value:
            "Co-founders, learners and a mentor around you, so you can run the company rather than do every job in it.",
        },
      ]}
      sectionsHeading="What being the Founder here actually means"
      sections={[
        {
          title: "Role and responsibilities",
          bullets: [
            "Lead your own startup as the primary Founder, with final say on direction",
            "Break the vision into sprints with goals, deliverables and dates that hold",
            "Build out a team of co-founders and learners and give each of them real ownership",
          ],
        },
        {
          title: "Support and guidance",
          bullets: [
            "Honest review of your business model and market strategy, every sprint",
            "A safe place to prototype and validate before you commit full-time",
            "Preparation for pitching to real investors, with the evidence to back it",
            "Introductions through our academic and industry partners",
          ],
        },
        {
          title: "Recognition",
          bullets: [
            "Officially recognised as a Founder in the StartupUniv ecosystem",
            "A record of everything you shipped, reviewed and signed off",
          ],
        },
      ]}
      venturesRoute="Founder"
      venturesHeading="Founders who started where you are"
      venturesIntro="More than 40 startups have been started here since 2025. These two came in on the Founder plan, from teams who began with nothing but an idea and a deadline."
      closingTitle="Your company, built properly from day one."
      closingBody="Apply as Founder and we will take it from there — an assessment, a conversation, and a team assembled around the thing you want to build."
    />
  );
}
