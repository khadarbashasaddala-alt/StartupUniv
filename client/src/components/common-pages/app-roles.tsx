import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Rocket,
  Users,
  GraduationCap,
  Lightbulb,
  Settings,
  Check,
  Compass,
  UserPlus,
  MessageSquare,
  CheckCircle2,
  Shield,
  Handshake,
  Target,
  AlertCircle,
  HelpCircle,
  Key,
  FileText,
  LifeBuoy,
  Code,
  BookOpen,
  CheckSquare,
  UserCheck,
  ClipboardList,
  CreditCard,
  Scale,
  Wrench,
  Cpu,
  BarChart3,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Content per role                                                   */
/* ------------------------------------------------------------------ */

type RoleContent = {
  icon: React.ElementType;
  title: string;
  tagline: string;
  motto: string;
  accent: string;
  whoIntro: string[];
  tracks?: { title: string; funding: string; stipend: string; equity: string; bestFor: string; accent: string }[];
  doingSections: { heading: string; points: string[]; icon?: React.ReactNode }[];
  success: string[];
  quote: string;
  mindIntro?: string[];
  bottomBanner?: { title: string; subtitle: string };
};

const ROLES: Record<string, RoleContent> = {
  FOUNDER: {
    icon: Rocket,
    title: "The Founder",
    tagline: "The Visionary",
    motto: "Every big company started with one person who refused to give up.",
    accent: "#17646E",
    whoIntro: [
      "You are the primary architect of the vision and the driving force behind the mission. As a Founder, you move beyond ideation and build the entire ecosystem that brings your concept to life. You are the lead decision-maker, the team's primary motivator, and the one responsible for navigating the startup through its most critical early milestones.",
    ],
    doingSections: [
      {
        heading: "Pick the Path",
        points: ["You set the vision, define the goals, and make sure every person on the team knows where they are going and why it matters."],
        icon: <Compass className="w-4 h-4" />
      },
      {
        heading: "Build the Team",
        points: ["You bring in the right people, give them clear ownership, and create a space where they feel trusted enough to do their best work."],
        icon: <UserPlus className="w-4 h-4" />
      },
      {
        heading: "Talk to People",
        points: ["You get out of the building and have real conversations with real users — understanding their problems before assuming you already know the answers."],
        icon: <MessageSquare className="w-4 h-4" />
      },
      {
        heading: "Make the Big Calls",
        points: ["When there is no easy answer and the team is looking to you, you step up. You take in the facts, weigh the options, and make the call — even under pressure."],
        icon: <CheckCircle2 className="w-4 h-4" />
      },
      {
        heading: "Lead with Purpose",
        points: ["You foster the startup's core mission and values, building a resilient, high-performance culture that empowers your team to drive collective success."],
        icon: <Target className="w-4 h-4" />
      },
      {
        heading: "Scale Strategically",
        points: ["You translate long-term vision into actionable business plans, identifying market opportunities and navigating competitive landscapes for sustainable growth."],
        icon: <Rocket className="w-4 h-4" />
      },
      {
        heading: "Manage the Runway",
        points: ["You manage capital efficiency and unit economics while spearheading fundraising efforts and investor relations to secure your startup's future."],
        icon: <Scale className="w-4 h-4" />
      },
      {
        heading: "Drive Innovation",
        points: ["You drive the product roadmap from MVP to product-market fit, ensuring continuous differentiation based on customer feedback and market trends."],
        icon: <Lightbulb className="w-4 h-4" />
      },
    ],
    success: [
      "Real customers love using the product and it solves their problems.",
      "The team is motivated and knows exactly what they are working toward.",
      "The startup is hitting its goals and growing steadily.",
      "You have a clear plan for the next stage of growth.",
    ],
    quote: "The best Founders don't have all the answers. They just never stop asking the right questions until they find them.",
    mindIntro: [
      "You set the culture. How you act is how the team will act.",
      "Talk to Prospective customers often. Their feedback is more important than your own ideas.",
      "Proactively seek perspective. Building a startup is a team sport.",
      "Things will go wrong—use those moments to learn and adjust fast.",
    ],
    bottomBanner: {
      title: "This is more than a company.",
      subtitle: "It is proof that your idea was worth fighting for."
    }
  },

  COFOUNDER: {
    icon: Users,
    title: "The Co-Founder",
    tagline: "The Strategic Partner",
    motto: "Behind every great Founder is a Co-Founder making it all work.",
    accent: "#17646E",
    whoIntro: [
      "You are a strategic partner and co-owner of the startup's success. You provide the operational and technical backbone that turns high-level vision into a functioning reality. By sharing the executive weight with the Founder, you take full accountability for your core domains and ensure the team scales effectively.",
    ],
    doingSections: [
      {
        heading: "Own Your Area",
        points: ["Whether it is technology, marketing, or operations — you own it completely. You set the standards, do the work, and are fully accountable for the results."],
        icon: <Shield className="w-4 h-4" />
      },
      {
        heading: "Step Up as a Partner",
        points: ["As an owner, you actively challenge assumptions, offer strategic perspectives, and ensure every major decision is thoroughly vetted for success."],
        icon: <Handshake className="w-4 h-4" />
      },
      {
        heading: "Turn Vision into Reality",
        points: ["You take the Founder's goals and figure out how to actually get there. You break strategy into clear tasks, keep the team on track, and make sure things get delivered on time."],
        icon: <Target className="w-4 h-4" />
      },
      {
        heading: "Lead the Interns",
        points: ["You work directly with interns every day — setting expectations, reviewing their work, giving real feedback, and helping them grow into stronger contributors."],
        icon: <Users className="w-4 h-4" />
      },
      {
        heading: "Drive Revenue Growth (CBO)",
        points: ["You spearhead sales strategies and the market foundations required to scale, ensuring innovation is backed by a sustainable and growing business model."],
        icon: <BarChart3 className="w-4 h-4" />
      },
      {
        heading: "Champion Digital Innovation (CTO)",
        points: ["You leverage emerging tech and AI to modernize operations, ensuring the startup remains at the cutting edge of digital efficiency and innovation."],
        icon: <Zap className="w-4 h-4" />
      },
    ],
    success: [
      "The startup operates as a high-performance machine because of your systems.",
      "You have successfully bridged the gap between product vision and market execution.",
      "The team feels supported, organized, and focused on their highest-value tasks.",
      "You have shared the executive load, allowing the Founder to focus on the long-term vision.",
    ],
    quote: "Startups are won in the execution. My job is to make sure we don't just have a great idea, but a great company that actually works.",
    mindIntro: [
      "No task is too small. If it helps the startup move faster, it's your responsibility. Leading from the front means doing the work.",
      "Master the unit economics. Understanding the cost of every action is how you build a business that actually lasts.",
      "Build a culture of transparency. Clear communication and honesty are the foundations of the operational systems you create.",
      "Operate with extreme ownership. You are not just 'helping'—you are a pillar of the startup's survival and success.",
    ],
  },

  MENTOR: {
    icon: Lightbulb,
    title: "The Mentor",
    tagline: "The Guide",
    motto: "Experience you can actually learn from.",
    accent: "#17646E",
    whoIntro: [
      "You are a seasoned strategist and trusted advisor dedicated to sharpening the next generation of founders. Having navigated the complexities of the startup ecosystem yourself, your role is to provide the high-level perspective, critical feedback, and industry connections that help the team avoid pitfalls and accelerate their growth.",
    ],
    doingSections: [
      {
        heading: "Ask the Hard Questions",
        points: ["You help founders see the blind spots they cannot see themselves. You challenge their thinking, question their assumptions, and push them to arrive at sharper, better answers."],
        icon: <HelpCircle className="w-4 h-4" />
      },
      {
        heading: "Open Doors",
        points: ["Your network took years to build — and now it becomes one of the startup's greatest assets. You make the right introductions at the right time to the right people."],
        icon: <Key className="w-4 h-4" />
      },
      {
        heading: "Keep It Real",
        points: ["You tell the truth, even when it is uncomfortable. Honest feedback delivered with care is far more valuable than encouragement that leads the team in the wrong direction."],
        icon: <FileText className="w-4 h-4" />
      },
      {
        heading: "Advise on Governance",
        points: ["You provide perspective on leadership ethics, high-performance structures, and technical governance to ensure the startup builds a sustainable organizational foundation."],
        icon: <Shield className="w-4 h-4" />
      },
      {
        heading: "Challenge Assumptions Early",
        points: ["Challenge assumptions and pressure-test the business model Ask the hard questions teams avoid: Is this problem real? Who actually pays for this? What happens if this assumption is wrong?"],
        icon: <AlertCircle className="w-4 h-4" />
      },
    ],
    success: [
      "The founders are making smarter, faster decisions because of your guidance.",
      "You've opened doors that have led to real business opportunities.",
      "The team is more resilient and handles setbacks with confidence.",
      "The startup is better prepared for Demo Day and investor pitches.",
    ],
    quote: "The best Mentors aren't remembered for the advice they gave, but for the belief they showed in people when they needed it most.",
    mindIntro: [
      "Listen first. Provide the context and perspective that empowers the team to discover their own optimal path forward.",
      "Maintain strategic availability. Provide space for the team to navigate their own learning and failure under your guidance.",
      "Focus on the long term. While the team is stuck in the day-to-day, you are the one helping them plan for what happens next year.",
      "Integrity matters. Your reputation and your values are what the team will inherit. Lead by example.",
    ],
    bottomBanner: {
      title: "Your legacy is not the companies you built.",
      subtitle: "It is the people you helped succeed. Impact starts here."
    }
  },

  LEARNER: {
    icon: GraduationCap,
    title: "The Intern",
    tagline: "The Doer",
    motto: "You learn it today. You build it tomorrow.",
    accent: "#17646E",
    whoIntro: [
      "As an Intern at StartUpVarsity, you are a core contributor gaining high-impact, hands-on experience. You are integrated into a real product team where your work directly influences the platform's development. By delivering real-world value from day one, you build the technical and professional foundations required for a successful career in startups.",
    ],
    doingSections: [
      {
        heading: "Build Real Features",
        points: ["Every feature you build is production-ready and ships to real users. Whether you are writing code, designing pages, or running campaigns, your work has an immediate audience."],
        icon: <Code className="w-4 h-4" />
      },
      {
        heading: "Learn by Doing",
        points: ["Every task teaches you something new. You will not just read about how startups work — you will experience it firsthand, skill by skill, day by day."],
        icon: <BookOpen className="w-4 h-4" />
      },
      {
        heading: "Share Your Ideas",
        points: ["You are closer to the user than anyone else on the team. Your fresh perspective is genuinely valuable — speak up, challenge the norm, and bring ideas nobody else thought of."],
        icon: <Lightbulb className="w-4 h-4" />
      },
      {
        heading: "Master Tech Engineering",
        points: ["You build a strong technical foundation — from core engineering concepts to modern AI tools — and learn how to apply them across real areas like sales, finance, and operations. By the end, you do not just write good code, you understand the business it powers."],
        icon: <Cpu className="w-4 h-4" />
      },
      {
        heading: "Level Up in Cloud & Git",
        points: ["You implement collaborative development workflows using professional Git standards and integrate scalable cloud services into your projects."],
        icon: <Zap className="w-4 h-4" />
      },
    ],
    success: [
      "You've built features or campaigns that you're proud to show off.",
      "You've learned a ton of new technical and professional skills.",
      "You have strong relationships with your Founders and fellow interns.",
      "You feel ready to lead or launch your own startup after this.",
    ],
    quote: "The Intern who shows up curious and owns their work will leave ready to lead. This isn't just a line on a resume—it's the start of your career.",
    mindIntro: [
      "This is a real job. Your code, designs, and ideas will be seen by real users. Treat every task with that level of care.",
      "Be a sponge. Ask why decisions are being made, not just how to do the task. Understanding the 'why' is where you grow.",
      "Ownership starts with communication. If you are stuck, flag it early. If you are finished, ask what's next. Proactive transparency is key.",
      "Exercise initiative. Identify product improvements and proactively suggest solutions to make the product better.",
    ],
    bottomBanner: {
      title: "Every expert was once where you are right now.",
      subtitle: "Start strong, learn fast, and leave your mark."
    }
  },

  ADMIN: {
    icon: Settings,
    title: "The Admin",
    tagline: "The Engine Room",
    motto: "Keeping the whole ecosystem running smoothly.",
    accent: "#17646E",
    whoIntro: [
      "You are the operational anchor of the platform, responsible for its integrity and continuous performance. While others focus on individual products, you maintain the foundation that makes their work possible. By managing community standards, onboarding, and platform-wide operations, you ensure the ecosystem remains efficient and scalable.",
    ],
    doingSections: [
      {
        heading: "Help the Users",
        points: ["You manage accounts, handle issues, and help everybody get settled on the platform."],
        icon: <UserCheck className="w-4 h-4" />
      },
      {
        heading: "Process Applications",
        points: ["You look through new applications and help pick the best fits for our startups."],
        icon: <ClipboardList className="w-4 h-4" />
      },
      {
        heading: "Manage the Money",
        points: ["You make sure stipends and startup capital get to the right people on time."],
        icon: <CreditCard className="w-4 h-4" />
      },
      {
        heading: "Keep Things Fair",
        points: ["You make sure everyone follows the community rules and the platform stays safe."],
        icon: <Scale className="w-4 h-4" />
      },
      {
        heading: "Support the Tech",
        points: ["You help the engineering team find and fix platform bugs and launch new features."],
        icon: <Wrench className="w-4 h-4" />
      },
    ],
    success: [
      "The platform is safe, and everyone is following the rules.",
      "Payments are sent out accurately and on time.",
      "Users are happy with how easy it is to use the platform.",
      "New teams are onboarded without any hiccups.",
    ],
    quote: "Behind every great startup is an Admin who made sure the details were taken care of—so the builders could focus on building.",
  },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AppRolesPage() {
  const { user } = useAuth();
  const roleCode = user?.role || "FOUNDER";
  const data = ROLES[roleCode] || ROLES["LEARNER"];
  const Icon = data.icon;

  return (
    <AppLayout title="Roles & Responsibilities">
      <div className="font-sans antialiased text-foreground">
        {/* ── Horizontal Full-Bleed Hero ───────────────── */}
        <div
          className="shadow-md overflow-hidden border-b border-white/10 -mt-6 -mx-6 mb-12"
          style={{
            background: `linear-gradient(100deg, ${data.accent} 0%, ${data.accent}dd 100%)`,
          }}
        >
          <div className="w-full py-6 px-6 md:px-8 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="text-white opacity-90">
                <Icon className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl md:text-2xl font-bold tracking-tight text-white leading-tight">
                  {data.title}
                </h1>
                <p className="text-xs md:text-sm font-semibold text-white/80 mt-0.5 uppercase tracking-widest">
                  {data.tagline}
                </p>
              </div>
            </div>

            <div className="flex-1 text-right">
              <p className="text-[13px] md:text-[14px] text-white italic font-medium leading-relaxed">
                "{data.motto}"
              </p>
            </div>
          </div>
        </div>

        <div className="w-full px-6 md:px-8 lg:px-12 pb-20">
          {/* ── Who Is... Section ──────────────────────────── */}
          <div className="mb-10">
            <h2 className="text-[15px] font-extrabold mb-4 pb-2 border-b uppercase tracking-[0.1em]" style={{ color: data.accent, borderColor: `${data.accent}25` }}>
              Who Is {data.title.includes("Intern") ? "an Intern" : `a ${data.title.replace("The ", "")}`}?
            </h2>
            <div className="space-y-4">
              {data.whoIntro.map((para: string, idx: number) => (
                <p key={idx} className="text-foreground/90 text-[14.5px] leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          </div>

          {/* ── What You Will Be Doing ──────────────────────────── */}
          <div className="mb-10">
            <h2 className="text-[15px] font-extrabold mb-5 pb-2 border-b uppercase tracking-[0.1em]" style={{ color: data.accent, borderColor: `${data.accent}25` }}>
              What You Will Be Doing
            </h2>
            <div className="space-y-6">
              {data.doingSections.map((sec: any, idx: number) => (
                <div key={idx} className="flex gap-4 items-start">
                  <div className="shrink-0 mt-1" style={{ color: data.accent }}>
                    <div className="w-4 h-4">
                      {sec.icon}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold mb-1 text-foreground leading-snug">
                      {sec.heading}
                    </h3>
                    <p className="text-foreground/90 text-[14.5px] leading-relaxed max-w-4xl">
                      {sec.points[0]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── A Few Things to Always Keep in Mind ─────────────────────────── */}
          {data.mindIntro && data.mindIntro.length > 0 && (
            <div className="mb-10">
              <h2 className="text-[15px] font-extrabold mb-5 pb-2 border-b uppercase tracking-[0.1em]" style={{ color: data.accent, borderColor: `${data.accent}25` }}>
                A Few Things to Always Keep in Mind
              </h2>
              <ul className="space-y-3.5 pl-0">
                {data.mindIntro.map((item: string, idx: number) => (
                  <li key={idx} className="text-foreground/90 text-[14.5px] leading-relaxed pl-4 border-l-2 border-border flex items-start">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── What Does Success Look Like? ─────────────────────────── */}
          <div className="mb-10">
            <h2 className="text-[15px] font-extrabold mb-5 pb-2 border-b uppercase tracking-[0.1em]" style={{ color: data.accent, borderColor: `${data.accent}25` }}>
              What Does Success Look Like?
            </h2>
            <p className="text-muted-foreground text-[14.5px] mb-6 font-medium">
              Here is how we know {data.title.includes("Intern") ? "an Intern" : `a ${data.title.replace("The ", "")}`} is doing a great job:
            </p>
            <ul className="space-y-3 mb-10">
              {data.success.map((item: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <div className="shrink-0 mt-1.5" style={{ color: "#2E7D32" }}>
                    <div className="w-3 h-3 flex items-center justify-center">
                      <span className="font-bold text-[13px]">✓</span>
                    </div>
                  </div>
                  <span className="text-[14.5px] font-medium leading-relaxed" style={{ color: "#2E7D32" }}>{item}</span>
                </li>
              ))}
            </ul>

            <div className="px-8 py-7 my-10 rounded-2xl bg-muted/30 border-l-8 border-border flex items-center relative overflow-hidden" style={{ borderLeftColor: data.accent }}>
              <p className="text-[18px] leading-relaxed max-w-4xl italic font-medium relative z-10" style={{ color: data.accent }}>
                "{data.quote}"
              </p>
            </div>
          </div>

          {/* ── Bottom Banner (Compact) ─────────────────────────── */}
          <div
            className="w-full text-center text-white py-5 px-6 mt-4 rounded-2xl shadow-sm"
            style={{ backgroundColor: data.accent }}
          >
            <h3 className="text-base md:text-lg font-bold mb-1">
              {data.bottomBanner?.title || `You are building the future as ${data.title}.`}
            </h3>
            <p className="text-[14px] md:text-[15px] opacity-90 font-normal">
              {data.bottomBanner?.subtitle || "Take ownership and make it happen."}
            </p>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
