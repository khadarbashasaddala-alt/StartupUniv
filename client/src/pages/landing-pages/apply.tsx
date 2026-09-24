import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { SiteLayout } from "@/components/layout/site-layout";
import { PlanBasedApplicationForm } from "@/components/plan-based-application-form";



function getPlanParamsFromSearch(): {
  planType: "learner" | "founder" | "cofounder" | null;
  tier: "basic" | "premium" | null;
  inviteToken: string | null;
} {
  if (typeof window === "undefined")
    return { planType: null, tier: null, inviteToken: null };
  const params = new URLSearchParams(window.location.search);
  const plan = params.get("plan");
  const planTier = params.get("tier");
  const invite = params.get("invite");
  const planType =
    plan === "learner" || plan === "founder" || plan === "cofounder" ? plan : null;
  const tier =
    planTier === "basic" || planTier === "premium" ? planTier : null;
  const inviteToken = invite?.trim() || null;
  return { planType, tier, inviteToken };
}

export default function ApplyPage() {
  const [location, setLocation] = useLocation();
  const [planType, setPlanType] = useState<"learner" | "founder" | "cofounder" | null>(
    () => getPlanParamsFromSearch().planType
  );
  const [inviteToken, setInviteToken] = useState<string | null>(
    () => getPlanParamsFromSearch().inviteToken
  );
  const [tier, setTier] = useState<"basic" | "premium" | null>(
    () => getPlanParamsFromSearch().tier
  );

  useEffect(() => {
    const { planType: p, tier: t, inviteToken: inv } = getPlanParamsFromSearch();
    setPlanType(p);
    setTier(t);
    setInviteToken(inv);
  }, [location]);

  // When no plan in URL, redirect to /plans so user picks a plan (old red/beige form removed)
  useEffect(() => {
    if (planType == null && typeof window !== "undefined") {
      const hasPlan = new URLSearchParams(window.location.search).get("plan");
      if (!hasPlan) setLocation("/plans");
    }
  }, [planType, setLocation]);

  // Determine fee based on plan type and tier
  // FOUNDER: Premium only (₹5,00,000)
  // COFOUNDER: Premium only (₹3,00,000)
  // LEARNER: Basic (₹1,00,000) or Premium (₹1,50,000)
  const getFee = () => {
    if (!planType) return "₹1,00,000";

    if (planType === "founder") {
      // FOUNDER: Premium only
      return "₹5,00,000";
    }
    if (planType === "cofounder") {
      // COFOUNDER: Premium only
      return "₹3,00,000";
    }
    if (planType === "learner") {
      // LEARNER: Basic or Premium
      return tier === "premium" ? "₹1,50,000" : "₹1,00,000";
    }
    return "₹1,00,000";
  };

  return (
    <SiteLayout>
      {planType ? (
        <>
          {/* Figma-style header strip (navbar/footer come from SiteLayout) */}
          <section className="bg-[#FAF7F3] pt-10 md:pt-12 pb-6 px-4 sm:px-6 md:px-8 lg:px-12">
            <div className="container mx-auto max-w-7xl">
              <div className="bg-[#F6F1E9] p-6">
                <h1 className="text-3xl md:text-5xl font-light tracking-tight uppercase text-[#12333A]" data-testid="heading-apply">
                  Apply to StartupUniv
                </h1>
              </div>
            </div>
          </section>

          {/* Figma-style content */}
          <section className="bg-[#FAF7F3] pb-16 md:pb-20 px-4 sm:px-6 md:px-8 lg:px-12">
            <div className="container mx-auto max-w-7xl">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="shadow-none rounded-none border-0 bg-white">
                  <CardContent className="p-6 md:p-8">
                    <div className="max-w-[420px]">
                      <div className="border-b border-[#12333A]/60 pb-3">
                        <div className="text-[#12333A] text-fluid-h2 font-bold tracking-tight">
                          <span className="font-normal">Program Fee- </span>
                          {getFee()}
                        </div>
                        <p className="text-[#12333A] text-sm mt-2">
                          One-time fee after offer acceptance
                        </p>
                      </div>
                      <ul className="mt-4 list-disc pl-5 text-[#12333A] text-sm space-y-1">
                        <li>4-month intensive program</li>
                        <li>Expert mentorship access</li>
                        <li>Workspace &amp; startup resources</li>
                        <li>Demo Day opportunity</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-none rounded-none border-0 bg-white">
                  <CardContent className="p-6 md:p-8">
                    <div className="max-w-[420px]">
                      <div className="border-b border-[#12333A]/60 pb-3">
                        <div className="text-[#12333A] text-fluid-h2 font-bold tracking-tight">
                          How You'll Work
                        </div>
                        <p className="text-[#12333A] text-sm mt-2">
                          The structure every accepted team runs in
                        </p>
                      </div>
                      <ul className="mt-4 list-disc pl-5 text-[#12333A] text-sm space-y-1">
                        <li>A team and a mentor assigned to you</li>
                        <li>Sprint board with owned tasks and daily standups</li>
                        <li>Mentor review scored against a rubric</li>
                        <li>Support desk with tracked response times</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-none rounded-none border-0 bg-white mt-6">
                <CardContent className="p-6 md:p-8">
                  <div className="space-y-1">
                    <h2 className="text-xl md:text-2xl font-medium uppercase tracking-tight text-[#12333A]">
                      Application Form
                    </h2>
                    <p className="text-sm text-black/60">
                      {`Fill in the required details for your ${planType === "learner" ? "Intern" : planType === "founder" ? "Founder" : "Co-founder"} application`}
                    </p>
                  </div>

                  <div className="mt-8">
                    <PlanBasedApplicationForm planType={planType} tier={tier} teamInviteToken={inviteToken || undefined} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      ) : (
        /* No plan in URL: redirecting to /plans (old red/beige form removed) */
        <section className="min-h-[40vh] flex items-center justify-center bg-[#FAF7F3]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#12333A]" />
            <p className="text-sm text-gray-600">Redirecting to plans...</p>
          </div>
        </section>
      )}
    </SiteLayout>
  );
}
