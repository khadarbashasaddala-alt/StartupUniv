import { Link } from "wouter";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";

export default function SandboxPage() {
  return (
    <SiteLayout hideCTA>
      <div className="bg-[#F9FCFF]">
        <section className="w-full">
          <div className="container mx-auto grid lg:grid-cols-2">
            <div className="flex flex-col justify-center gap-10 bg-[#FFDF8B] pl-6 pr-10 py-14 sm:pl-10 sm:pr-14 sm:py-16 lg:pl-6 lg:pr-16 lg:py-20">
              <div className="max-w-[640px]">
                <h1 className="font-serif font-medium tracking-tight text-[36px] leading-[1.1] sm:text-[48px] lg:text-[56px] text-[#12333A]">
                  StartupUniv
                  <br />
                  SANDBOX Program
                </h1>
                <p className="mt-6 max-w-[500px] text-[16px] sm:text-[18px] leading-[1.6] text-[#12333A]">
                  Explore real startup opportunities while we absorb the risk—build real companies with resources,
                  mentors, and market access from day one.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="/plans">
                  <Button className="w-[213px] rounded-full px-[36px] py-[24px] text-[18px] bg-[#17646E] hover:bg-[#17646E]/90 text-white">
                    Apply Now
                  </Button>
                </Link>
                <Link href="/program">
                  <Button
                    variant="outline"
                    className="w-[213px] rounded-full border px-[37px] py-[25px] text-[18px] bg-transparent border-[#17646E] text-[#17646E] hover:bg-[#17646E] hover:text-white"
                  >
                    Explore Programs
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative min-h-[360px] sm:min-h-[460px] lg:min-h-[600px]">
              <img
                src="/sandbox/figma/hero.jpg"
                alt="StartupUniv Sandbox"
                className="absolute inset-0 h-full w-full object-cover"
                fetchPriority="high"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="container mx-auto">
            <div className="mx-auto w-full max-w-[1300px] flex flex-col gap-10 sm:gap-14">
              <h2 className="max-w-[500px] font-serif font-medium tracking-tight text-[32px] leading-[1.15] sm:text-[40px] lg:text-[44px] text-[#12333A]">
                A Startup&nbsp;Sandbox, Not a Course
              </h2>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="px-6 py-8 bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300">
                  <img src="/sandbox/icons/join-idea.svg" alt="" className="h-10 w-10" aria-hidden="true" />
                  <h3 className="mt-8 font-serif font-light text-[26px] leading-[30px] sm:text-[30px] tracking-[-0.6px] text-[#17646E]">
                    Join With or Without an Idea
                  </h3>
                  <div className="mt-6 h-px w-full bg-[#17646E]" />
                  <p className="mt-5 text-[16px] sm:text-[18px] leading-[25.92px] tracking-[-0.09px] text-[#17646E]">
                    You don’t need a finished pitch or business plan. Whether you arrive with a concept or just
                    curiosity, we help you identify opportunities, shape ideas, and validate them through real-world
                    execution.
                  </p>
                </div>

                <div className="px-6 py-8 bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300">
                  <img src="/sandbox/icons/companies.svg" alt="" className="h-10 w-10" aria-hidden="true" />
                  <h3 className="mt-8 font-serif font-light text-[26px] leading-[30px] sm:text-[30px] tracking-[-0.6px] text-[#17646E]">
                    Real Companies Formed
                  </h3>
                  <div className="mt-6 h-px w-full bg-[#17646E]" />
                  <p className="mt-5 text-[16px] sm:text-[18px] leading-[25.92px] tracking-[-0.09px] text-[#17646E]">
                    This is not a simulation or classroom exercise. Legally incorporated companies are formed during
                    the program, with real operations, teams, and market-facing activities.
                  </p>
                </div>

                <div className="px-6 py-8 bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300">
                  <img src="/sandbox/icons/shared-exec.svg" alt="" className="h-10 w-10" aria-hidden="true" />
                  <h3 className="mt-8 font-serif font-light text-[26px] leading-[30px] sm:text-[30px] tracking-[-0.6px] text-[#17646E]">
                    Shared Execution Responsibility
                  </h3>
                  <div className="mt-6 h-px w-full bg-[#17646E]" />
                  <p className="mt-5 text-[16px] sm:text-[18px] leading-[25.92px] tracking-[-0.09px] text-[#17646E]">
                    You build alongside a structured team of peers, sharing execution, learning, and accountability
                    reducing individual risk while accelerating real progress.
                  </p>
                </div>

                <div className="px-6 py-8 bg-[#F6F1E9] hover:bg-[#FFDAA0] transition-colors duration-300">
                  <img src="/sandbox/icons/focus.svg" alt="" className="h-10 w-10" aria-hidden="true" />
                  <h3 className="mt-8 font-serif font-light text-[26px] leading-[30px] sm:text-[30px] tracking-[-0.6px] text-[#17646E]">
                    Focus on Execution
                  </h3>
                  <div className="mt-6 h-px w-full bg-[#17646E]" />
                  <p className="mt-5 text-[16px] sm:text-[18px] leading-[25.92px] tracking-[-0.09px] text-[#17646E]">
                    The program prioritizes action over theory building products, engaging customers, testing markets,
                    and executing real business decisions from day one.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="/plans">
                  <Button className="w-[213px] rounded-full px-[36px] py-[24px] text-[18px] bg-[#17646E] hover:bg-[#17646E]/90 text-white">
                    Apply Now
                  </Button>
                </Link>
                <Link href="/program">
                  <Button
                    variant="outline"
                    className="w-[213px] rounded-full border px-[37px] py-[25px] text-[18px] bg-transparent border-[#17646E] text-[#17646E] hover:bg-[#17646E] hover:text-white"
                  >
                    Explore Programs
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="container mx-auto">
            <div className="mx-auto w-full max-w-[1300px] flex flex-col gap-14">
              <h2 className="font-serif font-medium tracking-tight text-[32px] leading-[1.15] sm:text-[40px] lg:text-[44px] text-[#12333A]">
                We Absorb the&nbsp;Early-Stage Risk
              </h2>

              <div className="grid gap-12 lg:gap-20 lg:grid-cols-[minmax(0,545px)_minmax(0,675px)] items-end">
                <div className="flex flex-col gap-8">
                  <div>
                    <h3 className="font-serif font-light tracking-[-1.05px] text-[28px] leading-[32px] sm:text-[35px] sm:leading-[35px] text-[#12333A]">
                      Financial Risk Shielded
                    </h3>
                    <div className="mt-6 h-px w-full bg-[#12333A]" />
                    <p className="mt-5 text-[16px] leading-[23px] tracking-[-0.08px] text-[#12333A]">
                      Early-stage capital, setup costs, and validation expenses are absorbed by SANDBOX, allowing
                      participants to test ideas and explore opportunities without personal financial exposure.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-serif font-light tracking-[-1.05px] text-[28px] leading-[32px] sm:text-[35px] sm:leading-[35px] text-[#12333A]">
                      Operational Support from Day One
                    </h3>
                    <div className="mt-6 h-px w-full bg-[#12333A]" />
                    <p className="mt-5 text-[16px] leading-[23px] tracking-[-0.08px] text-[#12333A]">
                      From company formation and compliance to tools, infrastructure, and execution frameworks, SANDBOX
                      provides operational backing so teams can focus on building and executing.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-serif font-light tracking-[-1.05px] text-[28px] leading-[32px] sm:text-[35px] sm:leading-[35px] text-[#12333A]">
                      Freedom to Experiment and Iterate
                    </h3>
                    <div className="mt-6 h-px w-full bg-[#12333A]" />
                    <p className="mt-5 text-[16px] leading-[23px] tracking-[-0.08px] text-[#12333A]">
                      With risk managed and support in place, teams can move fast—testing assumptions, learning from
                      failures, and refining their approach without the fear that typically slows early-stage startups.
                    </p>
                  </div>
                </div>

                <div className="relative h-[420px] sm:h-[520px] lg:h-[590px] overflow-hidden">
                  <img
                    src="/sandbox/figma/schoolgirl.jpg"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="container mx-auto">
            <div className="mx-auto w-full max-w-[1300px] flex flex-col gap-14">
              <h2 className="font-serif font-medium tracking-tight text-[32px] leading-[1.15] sm:text-[40px] lg:text-[44px] text-[#12333A]">
                The&nbsp;<span className="font-medium text-[#17646E]">SANDBOX</span>&nbsp;Ecosystem
              </h2>

              <div className="flex flex-col gap-0">
                <div className="bg-[#FFDF8B] px-6 sm:px-10 lg:px-12 py-10 sm:py-14 flex flex-col gap-8">
                  <h3 className="font-serif font-medium tracking-tight text-[28px] leading-[1.2] sm:text-[36px] lg:text-[44px] text-[#12333A]">
                    Stage 1: Builders (Foundation Stage)
                  </h3>
                  <div className="text-[16px] sm:text-[18px] leading-[1.6] text-[#12333A]">
                    <p>
                      <span className="font-bold">Who they are-</span> Engineers, sales, and operations team members
                    </p>
                    <p>
                      <span className="font-bold">What they do- </span>
                      Build, execute, and scale the solution by turning ideas into working products and real operations.
                    </p>
                    <p>
                      <span className="font-bold">Purpose- </span>
                      Hands-on execution, product development, sales, and day-to-day startup operations.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link href="/plans">
                      <Button className="w-[213px] rounded-full px-[36px] py-[24px] text-[18px] bg-[#17646E] hover:bg-[#17646E]/90 text-white">
                        Apply Now
                      </Button>
                    </Link>
                    <Link href="/program">
                      <Button
                        variant="outline"
                        className="w-[213px] rounded-full border px-[37px] py-[25px] text-[18px] bg-transparent border-[#17646E] text-[#17646E] hover:bg-[#17646E] hover:text-white"
                      >
                        Explore Programs
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="bg-[#CCCCFF] px-6 sm:px-10 lg:px-12 py-10 sm:py-14 flex flex-col gap-8">
                  <h3 className="font-serif font-medium tracking-tight text-[28px] leading-[1.2] sm:text-[36px] lg:text-[44px] text-[#12333A]">
                    Stage 2: Architects (Strategy &amp; Design Layer)
                  </h3>
                  <div className="text-[16px] sm:text-[18px] leading-[1.6] text-[#12333A]">
                    <p>
                      <span className="font-bold">Who they are-</span>: Co-Founders — CBO / CTO
                    </p>
                    <p>
                      <span className="font-bold">What they do- </span>
                      Design the business and technology strategy, define systems, and translate vision into scalable
                      solutions.
                    </p>
                    <p>
                      <span className="font-bold">Purpose- </span>
                      Ensure strong technical and business architecture for long-term growth.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link href="/plans">
                      <Button className="w-[213px] rounded-full px-[36px] py-[24px] text-[18px] bg-[#17646E] hover:bg-[#17646E]/90 text-white">
                        Apply Now
                      </Button>
                    </Link>
                    <Link href="/program">
                      <Button
                        variant="outline"
                        className="w-[213px] rounded-full border px-[37px] py-[25px] text-[18px] bg-transparent border-[#17646E] text-[#17646E] hover:bg-[#17646E] hover:text-white"
                      >
                        Explore Programs
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="bg-[#F4B4A9] px-6 sm:px-10 lg:px-12 py-10 sm:py-14 flex flex-col gap-8">
                  <h3 className="font-serif font-medium tracking-tight text-[28px] leading-[1.2] sm:text-[36px] lg:text-[44px] text-[#12333A]">
                    Stage 3: Visionary (Leadership Layer)
                  </h3>
                  <div className="text-[16px] sm:text-[18px] leading-[1.6] text-[#12333A]">
                    <p>
                      <span className="font-bold">Who they are- </span>Founder / CEO
                    </p>
                    <p>
                      <span className="font-bold">What they do- </span>
                      Set the vision, define direction, and make key leadership and strategic decisions.
                    </p>
                    <p>
                      <span className="font-bold">Purpose- </span>
                      Drive purpose, alignment, and overall company direction.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link href="/plans">
                      <Button className="w-[213px] rounded-full px-[36px] py-[24px] text-[18px] bg-[#17646E] hover:bg-[#17646E]/90 text-white">
                        Apply Now
                      </Button>
                    </Link>
                    <Link href="/program">
                      <Button
                        variant="outline"
                        className="w-[213px] rounded-full border px-[37px] py-[25px] text-[18px] bg-transparent border-[#17646E] text-[#17646E] hover:bg-[#17646E] hover:text-white"
                      >
                        Explore Programs
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="bg-[#B3D4F2] px-6 sm:px-10 lg:px-12 py-10 sm:py-14 flex flex-col gap-8">
                  <h3 className="font-serif font-medium tracking-tight text-[28px] leading-[1.2] sm:text-[36px] lg:text-[44px] text-[#12333A]">
                    Stage 4: Mentors &amp; Coaches (Guidance Layer)
                  </h3>
                  <div className="text-[16px] sm:text-[18px] leading-[1.6] text-[#12333A]">
                    <p>
                      <span className="font-bold">Who they are-</span> Experienced founders, operators, and domain
                      experts
                    </p>
                    <p>
                      <span className="font-bold">What they do- </span>
                      Guide, mentor, and advise the founding team across strategy, execution, and scaling.
                    </p>
                    <p>
                      <span className="font-bold">Purpose-</span> Reduce mistakes, accelerate learning, and strengthen
                      execution quality.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link href="/plans">
                      <Button className="w-[213px] rounded-full px-[36px] py-[24px] text-[18px] bg-[#17646E] hover:bg-[#17646E]/90 text-white">
                        Apply Now
                      </Button>
                    </Link>
                    <Link href="/program">
                      <Button
                        variant="outline"
                        className="w-[213px] rounded-full border px-[37px] py-[25px] text-[18px] bg-transparent border-[#17646E] text-[#17646E] hover:bg-[#17646E] hover:text-white"
                      >
                        Explore Programs
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="bg-[#FFDF8B] px-6 sm:px-10 lg:px-12 py-10 sm:py-14 flex flex-col gap-8">
                  <h3 className="font-serif font-medium tracking-tight text-[28px] leading-[1.2] sm:text-[36px] lg:text-[44px] text-[#12333A]">
                    Stage 5: MAA – Market Access Alliance (Growth &amp; Access Layer)
                  </h3>
                  <div className="text-[16px] sm:text-[18px] leading-[1.6] text-[#12333A]">
                    <p>
                      <span className="font-bold">What it is- </span>
                      StartupUniv’s consortium of 100+ empanelled medium and large companies.
                    </p>
                    <p>
                      <span className="font-bold">What it provides- </span>
                      Market access, business facilitation, enterprise credibility, and real project opportunities.
                    </p>
                    <p>
                      <span className="font-bold">Purpose: </span>
                      Enable startups to move beyond prototypes into revenue-generating, market-ready businesses.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link href="/plans">
                      <Button className="w-[213px] rounded-full px-[36px] py-[24px] text-[18px] bg-[#17646E] hover:bg-[#17646E]/90 text-white">
                        Apply Now
                      </Button>
                    </Link>
                    <Link href="/program">
                      <Button
                        variant="outline"
                        className="w-[213px] rounded-full border px-[37px] py-[25px] text-[18px] bg-transparent border-[#17646E] text-[#17646E] hover:bg-[#17646E] hover:text-white"
                      >
                        Explore Programs
                      </Button>
                    </Link>
                  </div>
                </div>


              </div>
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="container mx-auto">
            <div className="mx-auto w-full max-w-[1300px] flex flex-col gap-14">
              <h2 className="font-serif font-medium tracking-tight text-[32px] leading-[1.15] sm:text-[40px] lg:text-[44px] text-[#12333A]">
                MAA Program: Market Access Built Into the Journey
              </h2>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="bg-[#E8F4FF] px-6 py-8">
                  <img
                    src="/sandbox/icons/maa-credibility.svg"
                    alt=""
                    className="h-10 w-10"
                    aria-hidden="true"
                  />
                  <h3 className="mt-12 font-serif font-light tracking-[-0.6px] text-[26px] leading-[30px] sm:text-[30px] text-[#12333A]">
                    Credibility Support
                  </h3>
                  <p className="mt-4 text-[16px] leading-[23px] tracking-[-0.08px] text-[#12333A]">
                    Leverage StartupUniv&apos;s established network to build trust with potential partners and clients.
                  </p>
                </div>

                <div className="bg-[#F6F1E9] px-6 py-8">
                  <img
                    src="/sandbox/icons/maa-enterprise.svg"
                    alt=""
                    className="h-10 w-10"
                    aria-hidden="true"
                  />
                  <h3 className="mt-12 font-serif font-light tracking-[-0.6px] text-[26px] leading-[30px] sm:text-[30px] text-[#17646E]">
                    Enterprise &amp; Government Exposure
                  </h3>
                  <p className="mt-4 text-[16px] leading-[23px] tracking-[-0.08px] text-[#17646E]">
                    Access to enterprise projects and government initiatives that would otherwise be unreachable for
                    early-stage startups.
                  </p>
                </div>

                <div className="bg-[#F6F1E9] px-6 py-8">
                  <img src="/sandbox/icons/maa-focus.svg" alt="" className="h-10 w-10" aria-hidden="true" />
                  <h3 className="mt-12 font-serif font-light tracking-[-0.6px] text-[26px] leading-[30px] sm:text-[30px] text-[#17646E]">
                    Freedom to Experiment and Iterate
                  </h3>
                  <p className="mt-4 text-[16px] leading-[23px] tracking-[-0.08px] text-[#17646E]">
                    Focus on delivering value and generating revenue from day one, not just building products.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="container mx-auto">
            <div className="mx-auto w-full max-w-[1300px] flex flex-col gap-14">
              <h2 className="font-serif font-medium tracking-tight text-[32px] leading-[1.15] sm:text-[40px] lg:text-[44px] text-[#12333A]">
                The SANDBOX Program Framework
              </h2>

              <div className="grid gap-12 lg:gap-20 lg:grid-cols-[minmax(0,545px)_minmax(0,675px)] items-end">
                <div className="flex flex-col gap-8">
                  <div>
                    <h3 className="font-serif font-light tracking-[-1.05px] text-[28px] leading-[32px] sm:text-[35px] sm:leading-[35px] text-[#12333A]">
                      Structured 4-Month Execution Journey
                    </h3>
                    <div className="mt-6 h-px w-full bg-[#12333A]" />
                    <p className="mt-5 text-[16px] leading-[23px] tracking-[-0.08px] text-[#12333A]">
                      A focused four-month program that blends hands-on startup execution with industry mentorship,
                      AI-assisted guidance, and 200–400 hours of future-skills and leadership training—while operating
                      real startups from day one.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-serif font-light tracking-[-1.05px] text-[28px] leading-[32px] sm:text-[35px] sm:leading-[35px] text-[#12333A]">
                      Resources, Mentorship &amp; Team Support
                    </h3>
                    <div className="mt-6 h-px w-full bg-[#12333A]" />
                    <p className="mt-5 text-[16px] leading-[23px] tracking-[-0.08px] text-[#12333A]">
                      Each team receives dedicated startup resources in the first week, supported by multiple domain
                      coaches, a dedicated industry mentor, and cross-functional team formation across technology,
                      business, and operations.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-serif font-light tracking-[-1.05px] text-[28px] leading-[32px] sm:text-[35px] sm:leading-[35px] text-[#12333A]">
                      End-to-End Infrastructure &amp; Market Access
                    </h3>
                    <div className="mt-6 h-px w-full bg-[#12333A]" />
                    <p className="mt-5 text-[16px] leading-[23px] tracking-[-0.08px] text-[#12333A]">
                      Participants gain access to complimentary co-working space in Bangalore, full support for company
                      incorporation and compliance, enterprise-grade operational tools, continuous evaluation and
                      feedback, and direct market access through the Market Access Alliance (MAA).
                    </p>
                  </div>
                </div>

                <div className="relative h-[420px] sm:h-[520px] lg:h-[590px] overflow-hidden">
                  <img
                    src="/sandbox/figma/schoolgirl.jpg"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>


      </div>
    </SiteLayout>
  );
}
