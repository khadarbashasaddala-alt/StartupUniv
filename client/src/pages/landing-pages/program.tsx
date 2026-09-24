import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteLayout } from "@/components/layout/site-layout";
import {
  CheckCircle,
  Code2,
  Rocket,
  Target,
  Users,
} from "lucide-react";

const timeline = [
  {
    week: "1",
    title: "Week-1: Real Company Formation",
    items: [
      "Company is incorporated (LLP / Private Limited)",
      "Current bank account is opened in company's name",
      "Startup capital is deposited",
      "Equity is formally allocated",
      "Roles and responsibilities are assigned",
      "Begin operations immediately",
    ],
  },
  {
    week: "2-3",
    title: "Team Formation & Orientation",
    items: [
      "Team matching based on skills and interests",
      "Problem statement selection",
      "Mentor assignment",
      "Program kickoff and orientation",
    ],
  },
  {
    week: "4-8",
    title: "Foundation & Discovery",
    items: [
      "Entrepreneurship fundamentals workshops",
      "Customer discovery and validation",
      "Market research deep-dives",
      "Product thinking sessions",
    ],
  },
  {
    week: "9-12",
    title: "Immersion Week 1",
    items: [
      "Intensive on-site bootcamp",
      "Expert masterclasses",
      "Prototype development sprint",
      "Peer learning sessions",
    ],
  },
  {
    week: "13-18",
    title: "Build Phase",
    items: [
      "Product development sprints",
      "Weekly mentor check-ins",
      "Technical workshops",
      "User testing and iteration",
    ],
  },
  {
    week: "19-20",
    title: "Immersion Week 2",
    items: [
      "Go-to-market strategy",
      "Pitch preparation",
      "Investor relations basics",
      "Legal and compliance",
    ],
  },
  {
    week: "21-24",
    title: "Launch & Demo",
    items: [
      "Product launch preparation",
      "Demo day presentations",
      "Investor meetings",
      "Post-program planning",
    ],
  },
];

const learningModules = [
  {
    icon: Target,
    title: "Problem Discovery",
    topics: [
      "Customer interviews",
      "Problem validation",
      "Market sizing",
      "Competitive analysis",
    ],
  },
  {
    icon: Code2,
    title: "Product Development",
    topics: [
      "MVP methodology",
      "Agile practices",
      "Technical architecture",
      "DevOps basics",
    ],
  },
  {
    icon: Users,
    title: "Team Building",
    topics: [
      "Co-founder dynamics",
      "Hiring and culture",
      "Remote collaboration",
      "Conflict resolution",
    ],
  },
  {
    icon: Rocket,
    title: "Go-to-Market",
    topics: [
      "Growth strategies",
      "Sales fundamentals",
      "Marketing essentials",
      "Partnership development",
    ],
  },
];

const cohortDetails = {
  name: "Cohort 2025",
  startDate: "January 2026",
  duration: "4 months",
  location: "Bangalore + Remote",
  seats: 100,
  fee: "₹1,00,000",
};

type WeekContent = {
  week: string;
  title: string;
  items: string[];
};

type Phase = {
  title: string;
  weeks: WeekContent[];
};

type RoleProgramContentProps = {
  role: string;
  duration: string;
  description: string;
  phases: Phase[];
};

const RoleProgramContent = ({ role, duration, description, phases }: RoleProgramContentProps) => {
  return (
    <div className="space-y-8">
      <Card className="bg-gradient-to-br from-red-600 to-red-700 text-white border-0 shadow-xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <h3 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 break-words">{role} Program</h3>
              <p className="text-sm sm:text-base text-red-50 break-words">{description}</p>
            </div>
            <Badge className="bg-white text-red-600 text-sm sm:text-lg px-3 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap shrink-0">
              {duration}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-12">
        {phases.length === 2 ? (
          // Side by side layout for Phase 0 and Phase 1
          <div className="grid md:grid-cols-2 gap-8">
            {phases.map((phase, phaseIndex) => (
              <div key={phaseIndex} className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-2 sm:px-0">
                  <div className="h-px w-full sm:flex-1 bg-gradient-to-r from-transparent via-[#E3D9CC] to-transparent order-2 sm:order-1"></div>
                  <h4 className="text-base sm:text-lg md:text-xl font-bold text-red-600 text-center sm:text-left break-words order-1 sm:order-2">{phase.title}</h4>
                  <div className="h-px w-full sm:flex-1 bg-gradient-to-r from-transparent via-[#E3D9CC] to-transparent order-3"></div>
                </div>

                <div className="grid gap-6">
                  {phase.weeks.map((week, weekIndex) => (
                    <div key={weekIndex}>
                      <h5 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                        {week.week} - {week.title}
                      </h5>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Original vertical layout for other cases (like Intern)
          phases.map((phase, phaseIndex) => (
            <div key={phaseIndex} className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-2 sm:px-0">
                <div className="h-px w-full sm:flex-1 bg-gradient-to-r from-transparent via-[#E3D9CC] to-transparent order-2 sm:order-1"></div>
                <h4 className="text-base sm:text-lg md:text-xl font-bold text-red-600 text-center sm:text-left break-words order-1 sm:order-2">{phase.title}</h4>
                <div className="h-px w-full sm:flex-1 bg-gradient-to-r from-transparent via-[#E3D9CC] to-transparent order-3"></div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {phase.weeks.map((week, weekIndex) => (
                  <div key={weekIndex}>
                    <h5 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                      {week.week} - {week.title}
                    </h5>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {role === "Intern" && (
        <Card className="bg-gradient-to-br from-[#F5E6D3] to-[#FAF7F3] border-2 border-[#E3D9CC] shadow-lg mt-8">
          <CardContent className="p-6">
            <h4 className="text-xl font-bold text-gray-900 mb-4">🎯 Intern Outcomes</h4>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <span>Worked on a real startup</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <span>Shipped a production-ready product</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <span>Experience with real customers & markets</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <span>Strong portfolio + execution credibility</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default function ProgramPage() {
  return (
    <SiteLayout>
      <div className="bg-[#F7FAFC] text-[#232323] font-serif">
        {/* Hero Section */}
        <section className="pt-10 md:pt-12">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="bg-[#CEFFDB] px-6 sm:px-8 lg:pl-6 lg:pr-16 py-8 md:py-12 flex flex-col justify-end gap-10 lg:h-[600px]">
                <div className="w-full max-w-xl">
                  <h1 className="font-['Crimson_Pro',serif] font-light text-[44px] leading-[1.15] md:text-[56px] md:leading-[1.2] lg:text-[68px] lg:leading-[86px] tracking-[-2.58px] text-black">
                    Inside the StartupUniv Program
                  </h1>
                  <p className="mt-6 font-['Almarai',sans-serif] text-[18px] md:text-[21px] leading-[30px] tracking-[-0.105px] text-black/90 max-w-[569px]">
                    This is the cohort route: you apply, you are assessed, and if accepted you are placed on a
                    team with a mentor and a real brief. Everything below describes how those four months run.
                  </p>
                  <p className="mt-4 font-['Almarai',sans-serif] text-[16px] leading-[26px] text-black/70 max-w-[569px]">
                    Already have your own project, team or company? That runs on the same platform by a
                    different route — <Link href="/for-professionals"><a className="underline">see bring your own</a></Link>.
                  </p>

                  <div className="mt-10 flex flex-wrap gap-4">
                    <Link href="/plans">
                      <a className="inline-flex items-center justify-center rounded-full bg-[#2F2E7E] px-[36px] py-[24px] text-[#FFFBF8] text-[18px] leading-[23px] font-['Almarai',sans-serif] tracking-[-0.09px] w-[213px]">
                        Apply Now
                      </a>
                    </Link>
                    <Link href="/program">
                      <a className="inline-flex items-center justify-center rounded-full border border-[#2F2E7E] px-[37px] py-[25px] text-[#2F2E7E] text-[18px] leading-[23px] font-['Almarai',sans-serif] tracking-[-0.09px]">
                        Explore Programs
                      </a>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="relative min-h-[320px] h-[420px] sm:h-[520px] lg:h-[600px]">
                <img
                  src="/landing/Background (6).png"
                  alt="Founders collaborating at StartupUniv"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Program Features & Benefits */}
        <section className="bg-[#F9F6F2] py-8 md:py-12">
          <div className="container mx-auto">
            <h2 className="text-fluid-h2 mb-8 uppercase tracking-[0.12em]">
              PROGRAM FEATURES &amp; BENEFITS
            </h2>
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 text-fluid-body">
              <article className="bg-[#F9F6F2]">
                <p className="text-sm mb-2">From launch to scale</p>
                <div className="h-px w-full bg-[#232323] mb-5" />
                <h3 className="text-2xl mb-4">Growth Support</h3>
                <p>
                  Startups receive dedicated resources to kickstart their venture, with additional
                  growth support available for high-potential startups to accelerate growth and scale.
                </p>
              </article>

              <article className="bg-[#F9F6F2]">
                <p className="text-sm mb-2">Collaborate, create, and grow</p>
                <div className="h-px w-full bg-[#232323] mb-5" />
                <h3 className="text-2xl mb-4">Workspace</h3>
                <p>
                  Access a fully equipped, collaborative workspace to work alongside co-founders and interns,
                  fostering teamwork, productivity, and innovation from day one.
                </p>
              </article>

              <article className="bg-[#F9F6F2]">
                <p className="text-sm mb-2">Bring your product to market</p>
                <div className="h-px w-full bg-[#232323] mb-5" />
                <h3 className="text-2xl mb-4">Launch</h3>
                <p>
                  Get hands-on support to launch your startup, reach early customers, and validate your product
                  in real market conditions for maximum impact.
                </p>
              </article>

              <article className="bg-[#F9F6F2]">
                <p className="text-sm mb-2">Learn from industry experts</p>
                <div className="h-px w-full bg-[#232323] mb-5" />
                <h3 className="text-2xl mb-4">Mentorship</h3>
                <p>
                  Get guidance from experienced founders and industry experts to make smart decisions and grow
                  your startup.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 4‑month journey into 3 phases */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto">
            <h2 className="text-fluid-h2 mb-8">
              4-month journey broken into 3 phases
            </h2>
            <div className="grid gap-8 md:grid-cols-3 text-fluid-body">
              <article className="bg-[#E6F2FF] rounded-md px-8 py-10">
                <div className="text-3xl mb-4">📅</div>
                <h3 className="text-xl mb-4">Phase 1: Learn (Weeks 1–8)</h3>
                <p>
                  In this phase, participants learn entrepreneurship and design thinking, conduct market
                  research, validate ideas through 100+ customer interviews, and build strong business models.
                </p>
              </article>

              <article className="bg-[#F9F6F2] rounded-md px-8 py-10">
                <div className="text-3xl mb-4">📅</div>
                <h3 className="text-xl mb-4">Phase 2: Build (Weeks 9–20)</h3>
                <p>
                  During this phase, participants form teams and assign roles, run MVP development sprints,
                  test their products with real customers, and gather feedback to iterate toward their first
                  10–50 paying customers.
                </p>
              </article>

              <article className="bg-[#F9F6F2] rounded-md px-8 py-10">
                <div className="text-3xl mb-4">📅</div>
                <h3 className="text-xl mb-4">Phase 3: Launch (Weeks 21–24)</h3>
                <p>
                  In the final phase, startups prepare for investor pitches,
                  execute go-to-market strategies, and showcase their progress at Demo Day in front of 50+
                  investors.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Who Can Join These Programs? */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto space-y-10">
            <h2 className="text-fluid-h2">Who Can Join These Programs?</h2>

            <article className="bg-[#FFE48A] rounded-md px-8 lg:px-10 py-10 text-fluid-body">
              <h3 className="text-fluid-h3 mb-6">
                A <span className="font-bold">visionary</span> ready to take the first step toward becoming a
                <span className="font-bold"> founder.</span>
              </h3>
              <p className="mb-4 max-w-3xl">
                Test your entrepreneurial idea safely without leaving your current job, turning possibilities
                into real opportunities.
              </p>
              <ul className="list-disc pl-6 space-y-1 mb-6">
                <li>Professionals with 5–50 years of experience</li>
                <li>Well-settled and accomplished in current job or business</li>
                <li>Passion for entrepreneurship but prefer a safe step</li>
                <li>Want to try their idea for 4 months</li>
                <li>Build team &amp; prototype, then decide on full-time transition</li>
              </ul>
              <div className="flex flex-wrap gap-4">
                <Link href="/plans">
                  <button className="rounded-full bg-[#232366] text-white px-10 py-3 text-fluid-body font-medium">
                    Apply Now
                  </button>
                </Link>
                <Link href="/program">
                  <button className="rounded-full border border-[#232366] text-[#232366] px-10 py-3 text-fluid-body font-medium bg-transparent">
                    Explore Programs
                  </button>
                </Link>
              </div>
            </article>

            <article className="bg-[#D6FFE6] rounded-md px-8 lg:px-10 py-10 text-fluid-body">
              <h3 className="text-fluid-h3 mb-6">
                A <span className="font-bold">passionate founder / co‑founder</span> is someone who wants to fuel
                ideas with energy.
              </h3>
              <p className="mb-4 max-w-3xl">
                Ambitious young minds turning ideas into real solutions and shaping the future of innovation.
              </p>
              <ul className="list-disc pl-6 space-y-1 mb-6">
                <li>Fresh graduates or professionals with 1–5 years of experience</li>
                <li>Have an innovative idea ready to execute</li>
                <li>Ready to start their entrepreneurial journey</li>
                <li>Passion, vision, and willingness to act matter more than years of experience</li>
              </ul>
              <div className="flex flex-wrap gap-4">
                <Link href="/plans">
                  <button className="rounded-full bg-[#232366] text-white px-10 py-3 text-fluid-body font-medium">
                    Apply Now
                  </button>
                </Link>
                <Link href="/program">
                  <button className="rounded-full border border-[#232366] text-[#232366] px-10 py-3 text-fluid-body font-medium bg-transparent">
                    Explore Programs
                  </button>
                </Link>
              </div>
            </article>

            <article className="bg-[#FFB6B6] rounded-md px-8 lg:px-10 py-10 text-fluid-body">
              <h3 className="text-fluid-h3 mb-6">
                An <span className="font-bold">Intern</span> is someone eager to grow through curiosity and
                hands‑on learning.
              </h3>
              <p className="mb-4 max-w-3xl">
                Engage with startups to gain hands-on experience, add value through your work, and develop your
                skills while growing alongside real ventures.
              </p>
              <ul className="list-disc pl-6 space-y-1 mb-6">
                <li>Want hands-on experience with innovative founders</li>
                <li>Ready to contribute to a startup's growth</li>
                <li>Seeking exposure and skill development</li>
                <li>Want to be part of a founding journey</li>
              </ul>
              {/* <div className="flex flex-wrap gap-4">
                <Link href="/plans">
                  <button className="rounded-full bg-[#232366] text-white px-10 py-3 text-fluid-body font-medium">
                    Apply Now
                  </button>
                </Link>
                <Link href="/program">
                  <button className="rounded-full border border-[#232366] text-[#232366] px-10 py-3 text-fluid-body font-medium bg-transparent">
                    Explore Programs
                  </button>
                </Link>
              </div> */}
            </article>
          </div>
        </section>

        {/* Key Takeaways from the Program */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto">
            <h2 className="text-fluid-h2 mb-6">Key Takeaways from the Program</h2>
            <div className="grid gap-8 md:grid-cols-2 text-fluid-body">
              <article className="bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300 rounded-md px-8 py-10 group">
                <div className="text-3xl mb-4">🚀</div>
                <h3 className="text-xl mb-3">Understanding the Problem</h3>
                <div className="h-px w-full bg-[#232323] mb-4" />
                <ul className="list-disc pl-6 space-y-1">
                  <li>Customer Interviews</li>
                  <li>Problem Validation</li>
                  <li>Market Sizing</li>
                  <li>Competitive Analysis</li>
                </ul>
              </article>

              <article className="bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300 rounded-md px-8 py-10 group">
                <div className="text-3xl mb-4">📘</div>
                <h3 className="text-xl mb-3">Product Development</h3>
                <div className="h-px w-full bg-[#232323] mb-4" />
                <ul className="list-disc pl-6 space-y-1">
                  <li>MVP Methodology</li>
                  <li>Agile Practices</li>
                  <li>Technical Architecture</li>
                  <li>DevOps Basics</li>
                </ul>
              </article>

              <article className="bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300 rounded-md px-8 py-10 group">
                <div className="text-3xl mb-4">👥</div>
                <h3 className="text-xl mb-3">Creating Strong Teams</h3>
                <div className="h-px w-full bg-[#232323] mb-4" />
                <ul className="list-disc pl-6 space-y-1">
                  <li>Co-founder Dynamics</li>
                  <li>Hiring &amp; Culture</li>
                  <li>Remote Collaboration</li>
                  <li>Conflict Resolution</li>
                </ul>
              </article>

              <article className="bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300 rounded-md px-8 py-10 group">
                <div className="text-3xl mb-4">📈</div>
                <h3 className="text-xl mb-3">Launching &amp; Scaling</h3>
                <div className="h-px w-full bg-[#232323] mb-4" />
                <ul className="list-disc pl-6 space-y-1">
                  <li>Growth Strategies</li>
                  <li>Sales Fundamentals</li>
                  <li>Marketing Essentials</li>
                  <li>Partnership Development</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* Program Details Strip */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 text-fluid-body">
            <article className="bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300 rounded-md px-6 py-8 group">
              <div className="text-3xl mb-3">📅</div>
              <h3 className="text-xl mb-2">Start Date</h3>
              <p className="text-fluid-body">
                January 2026
                <br />
                Program begins in January.
              </p>
            </article>

            <article className="bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300 rounded-md px-6 py-8 group">
              <div className="text-3xl mb-3">⏱️</div>
              <h3 className="text-xl mb-2">Duration</h3>
              <p className="text-fluid-body">4 Months (Starting January 2026)</p>
            </article>

            <article className="bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300 rounded-md px-6 py-8 group">
              <div className="text-3xl mb-3">📍</div>
              <h3 className="text-xl mb-2">Format</h3>
              <p className="text-fluid-body">
                Bangalore + Remote (Hybrid)
                <br />
                Flexible learning.
              </p>
            </article>

            <article className="bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300 rounded-md px-6 py-8 group">
              <div className="text-3xl mb-3">👥</div>
              <h3 className="text-xl mb-2">Cohort Size</h3>
              <p className="text-fluid-body">
                100 Seats
                <br />
                Limited seats for quality.
              </p>
            </article>

            <article className="bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300 rounded-md px-6 py-8 group">
              <div className="text-3xl mb-3">₹</div>
              <h3 className="text-xl mb-2">Program Fee</h3>
              <p className="text-fluid-body">
                ₹1,00,000
                <br />
                One-time learning investment.
              </p>
            </article>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
