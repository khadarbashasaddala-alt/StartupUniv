import { Link } from "wouter";
import { PlanDetailPage } from "@/components/plans/plan-detail-page";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { PLANS_PAGE_ENABLED } from "@/lib/plans-flags";

export default function CoFounderPlanPage() {
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
        title: "Co-Founder",
        description:
          "Join a startup as a key partner. You'll bring your expertise to a new venture while holding a significant stake in its success. We provide the platform for you to build together.",
        leftBgClassName: "bg-[#D7FFE6]",
        imageSrc: "/landing/cofounder-new-bg.jpg",
        applyHref: "/apply?plan=cofounder",
        exploreHref: "/program",
        extraContent: (
          <div className="bg-white/50 rounded-xl p-5 border border-white/60 shadow-sm backdrop-blur-sm">
            <h4 className="text-[#17646E] font-semibold mb-2">The Scale-Up Advantage</h4>
            <ul className="text-gray-700 text-sm space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-[#17646E] font-bold mt-0.5">✓</span>
                Join pre-vetted ideas with early traction
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#17646E] font-bold mt-0.5">✓</span>
                Own one core function deeply (tech, growth, operations, or product delivery)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#17646E] font-bold mt-0.5">✓</span>
                Minimize early-stage risk with our structured ecosystem
              </li>
            </ul>
          </div>
        ),
      }}
      metrics={[
        {
          title: "Startup Support",
          subtitle: "Early-Stage Resource Support",
          value: "Get hands-on resources to build and grow your product.",
        },
        {
          title: "Equity",
          subtitle: "Meaningful Ownership",
          value: "Hold a 20% equity share in the startup.",
        },
        {
          title: "Team Support",
          subtitle: "Ongoing Support",
          value: "Get dedicated support while contributing to the startup.",
        },
      ]}
      sections={[
        {
          title: "Role & Responsibilities:",
          bullets: [
            "Join a founding team as a high-level partner",
            "Lead a specific area like Tech, Marketing, or Operations",
            "Collaborate directly with the Founder on all big decisions",
          ],
        },
        {
          title: "Mentorship & Support:",
          bullets: [
            "Mentorship to help you scale your part of the business",
            "Work on live products with a dedicated intern team",
          ],
        },
        {
          title: "Strategy & Growth:",
          bullets: [
            "Honest guidance on how to grow the startup and find investors",
            "A safe space to test your ideas and see what works",
          ],
        },
        {
          title: "Networking & Resources:",
          bullets: [
            "Connect with a powerful network of founders and mentors",
            "Direct access to hands-on resources and growth tools",
          ],
        },
        {
          title: "Recognition:",
          bullets: ["Officially recognized as a Co-Founder with a 20% stake in the company"],
        },
      ]}
    />
  );
}
