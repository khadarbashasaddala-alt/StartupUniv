import { useMemo, useState } from "react";
import { Link } from "wouter";
import { SiteLayout } from "@/components/layout/site-layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const defaultFaqs = [
  {
    category: "About StartupUniv",
    questions: [
      {
        q: "What is StartupUniv?",
        a: "StartupUniv is a Entrepreneurship as a Service (EAS) Platform operating as a Startup Sandbox, where individuals can explore entrepreneurship by building real companies with structured mentoring, team support, and managed early-stage risk. We seed startup ideas, form companies, mentor execution, and absorb early-stage risk—so participants can learn and build with confidence.",
      },
      {
        q: "Is StartupUniv a training institute or an incubator?",
        a: "No. StartupUniv is not a training institute, and it is not a traditional incubator or accelerator. Unlike training programs, we do not focus on classroom learning alone. Unlike incubators, we don't just provide space or advice. We form real companies, build founding teams, support execution, and guide startups from idea to early traction.",
      },
      {
        q: "Who can join StartupUniv?",
        a: "StartupUniv is open to: • Experienced professionals • Fresh graduates • Students and college project teams • Aspiring entrepreneurs • Individuals seeking real startup exposure. You can join with an idea or without one, and you can either be placed on a team through the cohort programme or bring a project or company you already have.",
      },
      {
        q: "Do I need to quit my job to join?",
        a: "No. Many participants—especially in the Visionary Program—continue in their current job or business while exploring entrepreneurship in a structured, low-risk manner.",
      },
    ],
  },
  {
    category: "Programs & Roles",
    questions: [
      {
        q: "What programs does StartupUniv offer?",
        a: "StartupUniv offers three programs: 1. Founder (Visionary) Program – For experienced professionals exploring entrepreneurship safely 2. Passionate (Co-Founder) Program – For young founders with startup ideas 3. Intern Program – For individuals joining founding teams for experience or equity",
      },
      {
        q: "What is the Founder (Visionary) Program?",
        a: "The Visionary Program is designed for professionals with 5–50 years of experience who are well-settled in their careers but want to explore entrepreneurship without taking major personal or financial risks. Participants join as Founders, build a startup over 4 months, and decide whether to continue full-time or exit safely.",
      },
      {
        q: "What is the Passionate (Co-Founder) Program?",
        a: "The Passionate Program is for fresh graduates and professionals with 1–5 years of experience who have innovative startup ideas. StartupUniv evaluates the idea, forms a team, provides mentorship, and supports execution—acting as a structured pre-incubation pathway. Participants may join as Founders or Co-Founders.",
      },
      {
        q: "What is the Intern Program?",
        a: "The Intern Program is for individuals who want to work in real startups as part of the founding team. There are two options: • Intern for Experience – Gain hands-on startup experience and an experience certificate • Intern with Equity – Join the founding team with up to 5% equity",
      },
      {
        q: "What roles exist within a startup team?",
        a: "Each startup typically includes: • Founder / Co-Founder(s) – Idea ownership, leadership, decision-making • Interns / Team Members – Product, technology, sales, marketing, operations • Mentors – Strategic, technical, and business guidance. Teams usually consist of ~10 members supported by 2–3 mentors/Coaches.",
      },
    ],
  },
  {
    category: "Idea & Company Formation",
    questions: [
      {
        q: "Can I bring my own project or startup instead of joining a cohort?",
        a: "Yes. If you already have a team and something you are building — a college project, a side product or an early company — you keep all of it and use the platform and mentoring to run it properly: milestones with deadlines, owned tasks, standups, reviewed evidence and a support desk. Talk to us and we will set your team up.",
      },
      {
        q: "What if I don't have a startup idea?",
        a: "That's completely fine. If you don't have an idea, StartupUniv helps you: • Identify real-world problems • Discover viable startup opportunities • Work on ideas seeded within the ecosystem. Many successful founders begin this way.",
      },
      {
        q: "Is a company actually registered?",
        a: "Yes. A real company is formed early in the program with defined founders, roles, and governance. Participants work in a real startup environment—not a simulation.",
      },
      {
        q: "Who owns the startup company?",
        a: "Ownership is distributed among founders and team members based on role, contribution, and program structure. Equity details are transparently defined at the start of the engagement.",
      },
    ],
  },
  {
    category: "Support & Risk",
    questions: [
      {
        q: "Does StartupUniv provide financial support?",
        a: "StartupUniv facilitates hands-on resources and support to enable early-stage execution, along with access to mentors, teams, and infrastructure. Further growth support may be available for high-performing teams.",
      },
      {
        q: "What does 'We Absorb the Risk' mean?",
        a: "'Risk absorption' means that StartupUniv provides: • Structured execution • Mentorship and oversight • Team support • Controlled capital exposure • Time-bound experimentation. This significantly reduces the personal and financial risk typically faced by first-time founders. Entrepreneurship still involves effort and uncertainty—but you are not alone.",
      },
      {
        q: "Do participants have to invest large personal capital?",
        a: "No. StartupUniv is designed to allow participants to explore entrepreneurship with low personal financial exposure, especially compared to starting independently.",
      },
    ],
  },
  {
    category: "Execution & Learning",
    questions: [
      {
        q: "Is this an internship or a job?",
        a: "No. This is real startup participation, not an internship simulation or a job placement program. Interns gain real startup experience that strengthens their resume and career prospects.",
      },
      {
        q: "What kind of mentoring is provided?",
        a: "Mentoring is provided by experienced professionals across: • Business strategy • Technology • Finance • Sales & marketing • Operations • Legal & compliance (as required). Mentors work closely with teams throughout the program.",
      },
      {
        q: "How long is the program?",
        a: "The core program runs for approximately 4 months, with structured milestones and reviews. Some startups may continue beyond this phase based on outcomes.",
      },
    ],
  },
  {
    category: "Outcomes",
    questions: [
      {
        q: "What happens at the end of the program?",
        a: "At the end of the program, participants may: • Continue building the startup • Seek further growth or scale-up support • Exit with real startup experience • Receive experience or participation certificates (where applicable)",
      },
      {
        q: "Will this help me get a job if I don't continue as a Founder/Founding Team Member?",
        a: "Yes. Participants gain: • Real startup execution experience • Exposure to product, tech, and business roles • Strong resume differentiation • Industry-relevant skills. This significantly improves employability.",
      },
      {
        q: "Is StartupUniv suitable for students?",
        a: "Yes, in two different ways. A college team can bring its own project — a capstone, semester build or research project — and run it here with mentoring, owned tasks, daily standups and reviewed evidence until it reaches production. Separately, students who want to go further can apply to the cohort programme and be placed on a team with a real brief.",
      },
    ],
  },
  {
    category: "Application & Next Steps",
    questions: [
      {
        q: "How do I apply?",
        a: "There are two routes. For the cohort programme, apply through the Apply section and select the programme that fits your profile; you will be assessed and, if accepted, placed on a team. If you already have your own project, startup or college team, contact us instead and we will set your team up on the platform directly.",
      },
      {
        q: "Is there a selection process?",
        a: "Yes. Applications are reviewed based on: • Background and intent • Idea quality (if applicable) • Commitment and availability • Program fit",
      },
      {
        q: "Where is StartupUniv located?",
        a: "Currently it's operating from two locations in Bangalore i.e, at Jayanagar and Electronics City. In the second phase we will launch our offices in all the Metro Cities. StartupUniv operates with a hybrid model, Where 3 weeks you go for Work from home and one week in a month you operate from our office.",
      },
      {
        q: "How is StartupUniv different from doing a startup on my own?",
        a: "Starting alone is high-risk, isolating, and unstructured. StartupUniv offers: • Startup Resources • Infrastructure • Mentorship • Technical Team • Reduced risk • Faster learning • Go to market Support" ,
      },
      {
        q: "Will StartupUniv help us in getting customers or business opportunities for the product developed by our startup?",
        a: "Yes. StartupUniv works with an empanelled network of mid- to large-scale companies. Where relevant, business opportunities, corporate requirements, and tender-based projects may be channelled through this network and allocated to suitable StartupUniv-backed startups for execution, based on capability and readiness.",
      },
      {
        q: "How StartupUniv will be associated with our Company post 4 months of our Cohort?",
        a: "StartupUniv goes beyond training and platform access. We actively support startups in acquiring real business opportunities by connecting them with relevant corporate, industry, and institutional partners. Even after the initial 4-month cohort period, our team continues to handhold founders to help establish their company, secure early orders or pilots, and transition into a sustainable, revenue-generating enterprise.",
      },
    ],
  },
];

export default function FaqPage() {
  const categories = useMemo(() => defaultFaqs.map((section) => section.category), []);
  const [selectedCategory, setSelectedCategory] = useState(categories[0] ?? "");

  const selectedSection = useMemo(() => {
    return defaultFaqs.find((section) => section.category === selectedCategory) ?? defaultFaqs[0];
  }, [selectedCategory]);

  return (
    <SiteLayout>
      <div className="bg-[#FFFBF8]">
        {/* Hero (Figma) */}
        <section className="px-4 sm:px-6 lg:px-0 pt-10 md:pt-12">
          <div className="mx-auto w-full max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="bg-[#CEFFDB] px-6 sm:px-8 lg:px-6 py-12 md:py-16 lg:py-20 flex items-center">
                <div className="w-full max-w-xl">
                  <h1
                    className="font-['Crimson_Pro',serif] font-light text-[44px] leading-[1.15] md:text-[56px] md:leading-[1.2] lg:text-[68px] lg:leading-[86px] tracking-[-2.58px] text-black"
                    data-testid="heading-faq"
                  >
                    Frequently Asked Questions
                  </h1>
                  <p className="mt-6 font-['Almarai',sans-serif] text-[18px] md:text-[21px] leading-[30px] tracking-[-0.105px] text-black/90 max-w-[569px]">
                    Find answers to common questions about our program, support, application process, and more.
                  </p>

                  <div className="mt-10">
                    <Link href="/program">
                      <a className="inline-flex items-center justify-center rounded-full bg-[#17646E] px-9 py-6 text-[#FFFBF8] text-[18px] leading-[23px] font-['Almarai',sans-serif] tracking-[-0.09px] w-[254px]">
                        Explore Programs
                      </a>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="relative min-h-[320px] h-[420px] sm:h-[520px] lg:h-[600px]">
                <img
                  alt=""
                  src="/faq/faq-hero.jpg"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Body (Figma) */}
        <section className="px-4 sm:px-6 lg:px-0 pt-16 md:pt-20 pb-20 md:pb-28">
          <div className="mx-auto w-full max-w-7xl">
            <div className="bg-[#F6F1E9] p-6 md:p-8">
              <h2 className="font-['Crimson_Pro',serif] font-light text-[#12333A] text-[32px] md:text-[40px] lg:text-[48px] uppercase leading-[1.4] tracking-[-0.2px]">
                Got Questions? We’ve Got Answers
              </h2>

              {/* Category dropdown (styled per Figma dropdown item) */}
              <div className="mt-6">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger
                    className={cn(
                      "h-10 w-[300px] rounded-none border-0 border-b border-[#A7A7A7] bg-white px-4 py-4",
                      "text-[24px] tracking-[1px] text-[#606060]",
                      "focus:ring-0 focus:ring-offset-0",
                      "data-[placeholder]:text-[#606060]",
                      "[&>svg]:h-6 [&>svg]:w-6 [&>svg]:opacity-100 [&>svg]:text-[#606060]"
                    )}
                    aria-label="Location"
                  >
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent
                    className={cn(
                      "rounded-none border border-[#A7A7A7] p-0 bg-white",
                      "[&_[data-radix-select-viewport]]:p-0"
                    )}
                    position="popper"
                  >
                    {defaultFaqs.map((section) => (
                      <SelectItem
                        key={section.category}
                        value={section.category}
                        className={cn(
                          "rounded-none border-b border-[#A7A7A7]",
                          "bg-white text-[#17646E]",
                          "focus:bg-[#17646E] focus:text-white",
                          "data-[state=checked]:bg-[#17646E] data-[state=checked]:text-white",
                          "text-[24px] tracking-[1px] py-3 pr-4 pl-4",
                          "[&>span:first-child]:hidden"
                        )}
                      >
                        {section.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Questions */}
              <div className="mt-8 w-full max-w-4xl">
                <Accordion
                  key={selectedCategory}
                  type="single"
                  collapsible
                  defaultValue="0"
                  className="w-full flex flex-col gap-3"
                >
                  {selectedSection?.questions?.map((faq, index) => (
                    <AccordionItem
                      key={`${selectedCategory}-${index}`}
                      value={`${index}`}
                      data-testid={`faq-${selectedCategory}-${index}`}
                      className={cn(
                        "rounded-[4px] border border-black/10 bg-white px-3 py-2",
                        "data-[state=open]:border-transparent data-[state=open]:bg-transparent"
                      )}
                    >
                      <AccordionTrigger
                        className={cn(
                          "py-0 hover:no-underline",
                          "text-left font-normal",
                          "text-[20px] md:text-[24px] leading-[1.4] tracking-[-0.4px]",
                          "text-[#2C2B49]/80",
                          "[&>svg]:h-6 [&>svg]:w-6"
                        )}
                      >
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="pt-3 pb-0 text-[16px] leading-[1.4] tracking-[-0.4px] text-[#2C2B49]/80 max-w-2xl">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
