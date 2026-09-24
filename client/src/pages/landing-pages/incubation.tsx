import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteLayout } from "@/components/layout/site-layout";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  Banknote,
  Building2,
  Calculator,
  CheckCircle,
  IndianRupee,
  PieChart,
  Rocket,
  Users,
  Wallet,
  Trophy,
} from "lucide-react";

const equityBreakdown = [
  { label: "Promoters (2)", percentage: 40, description: "2 × 20% each", color: "bg-chart-1" },
  { label: "Co-Promoters (3)", percentage: 30, description: "3 × 10% each", color: "bg-chart-2" },
  { label: "StartupUniv", percentage: 10, description: "Program equity", color: "bg-chart-3" },
  { label: "Others/SV Pool", percentage: 20, description: "Reserved pool", color: "bg-chart-4" },
];

const teamSupportTiers = [
  { role: "Promoter", band: "A", duration: 4, focus: "Full-time dedicated support" },
  { role: "Co-Promoter", band: "B", duration: 4, focus: "Active leadership support" },
  { role: "Member", band: "C", duration: 4, focus: "Core team support" },
];

const resourceAllocation = [
  { source: "Equity Cash (Promoters + Co-Promoters)", share: "70%" },
  { source: "StartupUniv Contribution", share: "10%" },
  { source: "Pool/Reserve", share: "20%" },
];

const microPnL = {
  inflow: [
    { item: "Cohort Fee (10 members × ₹1,00,000)", amount: 1000000 },
  ],
  passThrough: [
    { item: "Equity Cash to Resource Pool", amount: 700000 },
  ],
  outflow: [
    { item: "Resource Deployment", amount: 1000000 },
    { item: "Team Support (4 months)", amount: 600000 },
    { item: "Operations & Support", amount: 165000 },
  ],
  retention: 200000,
};

export default function IncubationPage() {
  return (
    <SiteLayout>
      {/* Hero - Light Theme */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] py-20 md:py-28">
        <div className="absolute inset-0">
          {/* Beige/Red bubble effects */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#F5E6D3]/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-red-100/20 rounded-full blur-3xl"></div>
        </div>
        <div className="container relative mx-auto px-4 z-10">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4 bg-red-600 text-white border-red-500 shadow-md">
              <Rocket className="w-3 h-3 mr-1" />
              Incubation & Growth Support
            </Badge>
            <h1 className="text-4xl font-bold md:text-5xl text-gray-900" data-testid="heading-incubation">
              Comprehensive Startup Support
            </h1>
            <p className="mt-6 text-lg text-gray-700">
              This page covers the cohort route, where a qualifying team is incorporated and
              supported end to end. Understand the support structure, equity model and team
              support system before you apply.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/plans">
                <Button size="lg" className="gap-2 bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg" data-testid="button-incubation-apply">
                  Apply Now
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/faq">
                <Button size="lg" variant="outline" className="border-2 border-red-600 text-red-600 hover:bg-red-50 bg-white" data-testid="button-incubation-faq">
                  View FAQ
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="border-2 border-red-600 text-red-600 hover:bg-red-50 bg-white">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Key Numbers */}
      <section className="border-y border-[#E3D9CC] bg-white py-12">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 text-center">
            <div data-testid="stat-seed">
              <IndianRupee className="h-6 w-6 mx-auto mb-2 text-red-600" />
              <div className="text-3xl font-bold text-gray-900">100%</div>
              <div className="text-sm text-gray-600">Resource Backed</div>
            </div>
            <div data-testid="stat-equity">
              <PieChart className="h-6 w-6 mx-auto mb-2 text-red-600" />
              <div className="text-3xl font-bold text-gray-900">70%</div>
              <div className="text-sm text-gray-600">Team Equity</div>
            </div>
            <div data-testid="stat-stipend">
              <Wallet className="h-6 w-6 mx-auto mb-2 text-red-600" />
              <div className="text-3xl font-bold text-gray-900">4</div>
              <div className="text-sm text-gray-600">Months of Support</div>
            </div>
            <div data-testid="stat-team">
              <Users className="h-6 w-6 mx-auto mb-2 text-red-600" />
              <div className="text-3xl font-bold text-gray-900">10</div>
              <div className="text-sm text-gray-600">Team Size</div>
            </div>
          </div>
        </div>
      </section>

      {/* Equity Breakdown - Beige Background */}
      <section className="py-20 md:py-28 relative overflow-hidden bg-gradient-to-br from-[#FAF7F3] via-[#FEFBF8] to-[#F5E6D3]">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#E3D9CC]/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-red-100/15 rounded-full blur-3xl"></div>
        </div>
        <div className="container relative mx-auto px-4 z-10">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 bg-red-600 text-white border-red-500 shadow-md">
                <PieChart className="w-3 h-3 mr-1" />
                Cap Table
              </Badge>
              <h2 className="text-3xl font-bold md:text-4xl mb-6 text-gray-900" data-testid="heading-equity">
                Equity Distribution
              </h2>
              <p className="text-gray-700 mb-8">
                Our equity model ensures founding team members retain majority
                ownership while providing StartupUniv a stake in the success
                of the ventures we support.
              </p>
              <div className="space-y-4">
                {equityBreakdown.map((item, index) => (
                  <div key={index} className="space-y-2" data-testid={`equity-${index}`}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-900">{item.label}</span>
                      <span className="text-gray-600">{item.description}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={item.percentage} className="h-3 flex-1" />
                      <span className="text-sm font-semibold w-12 text-gray-900">{item.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Card className="bg-gradient-to-br from-red-600 to-red-700 text-white border-0 shadow-xl">
              <CardContent className="pt-8">
                <h3 className="text-xl font-semibold mb-6">How It Works</h3>
                <div className="space-y-4">
                  {[
                    {
                      title: "Team Formation",
                      desc: "10-member teams with 2 Promoters, 3 Co-Promoters, and 5 Members",
                    },
                    {
                      title: "Equity Assignment",
                      desc: "Equity stakes assigned based on roles and contributions",
                    },
                    {
                      title: "Cash Contribution",
                      desc: "Promoters and Co-Promoters contribute from their program fees",
                    },
                    {
                      title: "Resource Deployment",
                      desc: "Startup capital deployed as working capital for the startup",
                    },
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20 text-sm font-semibold shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="font-medium">{step.title}</h4>
                        <p className="text-sm opacity-80">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Team Support */}
      <section className="py-20 md:py-28 bg-[#0a0e27]">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-primary/20 text-primary-foreground border-primary/40">
              <Banknote className="w-3 h-3 mr-1" />
              Monthly Support
            </Badge>
            <h2 className="text-3xl font-bold md:text-4xl text-white" data-testid="heading-stipend">
              Support Structure
            </h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
              Team members receive dedicated monthly support for 4 months during the
              program, subject to sprint performance.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {teamSupportTiers.map((tier, index) => (
              <Card key={index} className="text-center hover-elevate" data-testid={`stipend-card-${index}`}>
                <CardHeader>
                  <Badge variant="outline" className="mx-auto mb-2">
                    Band {tier.band}
                  </Badge>
                  <CardTitle>{tier.role}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold text-primary mb-2">
                    {tier.focus}
                  </div>
                  <Separator className="my-4" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">{tier.duration} months</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-8 max-w-4xl mx-auto">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold mb-1">Sprint-Gated Support</h4>
                  <p className="text-sm text-muted-foreground">
                    Support is provided monthly, contingent on the team passing
                    their current sprint. This ensures active participation and
                    progress toward milestones.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Program Resource Sources */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  <CardTitle>Program Resource Allocation</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {resourceAllocation.map((source, index) => (
                    <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-muted/50" data-testid={`source-${index}`}>
                      <span className="text-sm">{source.source}</span>
                      <span className="font-semibold">
                        {source.share}
                      </span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10">
                    <span className="font-semibold">Total Program Resources</span>
                    <span className="text-xl font-bold text-primary">100%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <Badge variant="secondary" className="mb-4">
                <Building2 className="w-3 h-3 mr-1" />
                Resource Flow
              </Badge>
              <h2 className="text-3xl font-bold md:text-4xl mb-6" data-testid="heading-fund-flow">
                Where Do the Resources Come From?
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Program resources are composed of contributions from team members
                  (through their program fees), StartupUniv's investment, and
                  a reserved pool for additional support.
                </p>
                <p>
                  When you pay the program fee, a portion of it goes directly
                  into the program's resource pool as your equity contribution.
                </p>
                <p>
                  This model ensures that all founders have skin in the game and
                  are invested in the success of the startup.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Micro P&L */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <Calculator className="w-3 h-3 mr-1" />
              Financial Model
            </Badge>
            <h2 className="text-3xl font-bold md:text-4xl" data-testid="heading-pnl">
              Per-Team Economics
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Understanding how resources flow through the program for each team.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {/* Inflow */}
                  <div>
                    <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                      Inflow
                    </h4>
                    {microPnL.inflow.map((item, i) => (
                      <div key={i} className="flex justify-between items-center py-2">
                        <span>{item.item}</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          +₹{item.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Pass-through */}
                  <div>
                    <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                      Pass-through (to Seed)
                    </h4>
                    {microPnL.passThrough.map((item, i) => (
                      <div key={i} className="flex justify-between items-center py-2">
                        <span>{item.item}</span>
                        <span className="font-semibold text-primary">
                          ₹{item.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Outflow */}
                  <div>
                    <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                      Outflow
                    </h4>
                    {microPnL.outflow.map((item, i) => (
                      <div key={i} className="flex justify-between items-center py-2">
                        <span>{item.item}</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          -₹{item.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Retention */}
                  <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-primary/10">
                    <span className="font-semibold">Program Retention</span>
                    <span className="text-xl font-bold text-primary">
                      ₹{microPnL.retention.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Big Rewards for Big Execution */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-[#FAF7F3] via-[#FEFBF8] to-[#F5E6D3] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#E3D9CC]/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-red-100/15 rounded-full blur-3xl"></div>
        </div>
        <div className="container mx-auto relative z-10">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-red-600 text-white border-red-500 shadow-md">
              <Trophy className="w-3 h-3 mr-1" />
              Big Rewards
            </Badge>
            <h2 className="text-3xl font-bold md:text-4xl text-gray-900" data-testid="heading-rewards">
              Big Rewards for Big Execution
            </h2>
            <p className="mt-4 text-gray-700 max-w-2xl mx-auto">
              For each problem statement, 10 startups compete. One finalist is selected.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
            {/* Winning Startup */}
            <Card className="bg-gradient-to-br from-red-600 to-red-700 text-white border-0 shadow-2xl">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Trophy className="h-8 w-8" />
                  <CardTitle className="text-2xl">🏆 Winning Startup Receives</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    "Special recognition from StartupUniv",
                    "Incubation under Rooman–JainX",
                    "Continued growth support",
                    "Enterprise & investor introductions",
                  ].map((reward, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 shrink-0" />
                      <span>{reward}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Other Teams */}
            <Card className="bg-white border-2 border-[#E3D9CC] shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl text-gray-900">Other Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    "Can join the winning startup",
                    "Can continue independently",
                    "Receive strong experience certificates for placements",
                  ].map((option, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-red-600 shrink-0" />
                      <span className="text-gray-800">{option}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-6 border-t border-[#E3D9CC]">
                  <p className="text-sm text-gray-600 italic">
                    Every participant gains real startup experience that stands out on their resume.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold md:text-3xl mb-4" data-testid="heading-cta">
            Ready to Get Started?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Join StartupUniv and get access to hands-on resources, mentorship, and
            a structured path to launching your startup.
          </p>
          <Link href="/plans">
            <Button size="lg" className="gap-2" data-testid="button-apply-cta">
              Apply Now
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
