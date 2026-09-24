import { Link } from "wouter";
import { PlanDetailPage } from "@/components/plans/plan-detail-page";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { PLANS_PAGE_ENABLED } from "@/lib/plans-flags";

export default function FounderPlanPage() {
  if (!PLANS_PAGE_ENABLED) {
    return (
      <SiteLayout>
        <section className="min-h-[60vh] flex items-center justify-center bg-white py-20">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h1 className="text-fluid-hero font-bold text-gray-900 mb-4">
              Plans &amp; Pricing — Coming Soon
            </h1>
            <p className="text-base md:text-lg text-gray-600 mb-8">
              We're putting the finishing touches on our plans. Check back soon,
              or explore our programs in the meantime.
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
    <PlanDetailPage
      hero={{
        title: "FOUNDER PLAN",
        description:
          "This program is for founders with ambitious ideas who are ready to build a real startup from the ground up. We provide the capital, the team, the infrastructure, and the strategic guidance necessary to turn your vision into a high-growth company.",
        leftBgClassName: "bg-[#ffdf8b]",
        imageSrc: "/landing/founder-new-bg.jpg",
        applyHref: "/apply?plan=founder",
        exploreHref: "/program",
        extraContent: (
          <div className="bg-white/50 rounded-xl p-5 border border-white/60 shadow-sm backdrop-blur-sm">
            <h4 className="text-[#17646E] font-semibold mb-2">Why StartUpVarsity?</h4>
            <ul className="text-gray-700 text-sm space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-[#17646E] font-bold mt-0.5">✓</span>
                Define your vision and convert it into clear, executable sprint goals
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#17646E] font-bold mt-0.5">✓</span>
                Choose and curate the execution team you want
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#17646E] font-bold mt-0.5">✓</span>
                Drive long-term direction by validating opportunities and managing risk
              </li>
            </ul>
          </div>
        ),
      }}
      metrics={[
        {
          title: "Startup Support",
          subtitle: "Resources to Kickstart Your Startup",
          value: "Get hands-on resources and support to turn your idea into reality.",
        },
        {
          title: "Equity",
          subtitle: "Own a Significant Share",
          value: "Hold 40% equity as the primary Founder.",
        },
        {
          title: "Team Support",
          subtitle: "Support While You Build",
          value: "Get dedicated support to focus on your startup full-time.",
        },
      ]}
      sections={[
        {
          title: "Role & Responsibilities:",
          bullets: [
            "Lead your own startup as the primary Founder",
            "Get expert mentorship to turn your idea into a real business",
            "Access a team of interns to help you build and grow",
          ],
        },
        {
          title: "Support & Guidance:",
          bullets: [
            "Honest advice on your business model and market strategy",
            "A safe place to prototype and test your idea before going full-time",
            "Preparation for pitching to real investors",
            "Direct access to hands-on resources and expert support",
          ],
        },
        {
          title: "Recognition:",
          bullets: ["Officially recognized as a Founder in the StartUpVarsity ecosystem"],
        },
      ]}
    />
  );
}
