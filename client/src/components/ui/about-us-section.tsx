"use client"

import { Link } from "wouter"
import { TrustedByPartnersSection } from "@/components/ui/trusted-by-partners"

export default function AboutUsSection() {
  return (
    <section className="w-full bg-white text-gray-900 font-serif">
      {/* Hero Section */}
      <div className="container mx-auto py-10 md:py-17 ">
        <div className="grid md:grid-cols-2 gap-0 items-stretch rounded-xl overflow-hidden">
          <div className="bg-[#FFE29A] p-10 flex flex-col justify-center min-h-[320px] lg:min-h-[520px]">
            <h1 className="text-fluid-hero font-serif font-normal mb-8 text-gray-900">Building Founders<br />Daily at StartupUniv</h1>
            <p className="text-lg font-sans mb-8 text-gray-900">StartupUniv gives teams the structure to turn ideas into outcomes — whether that is a college project carried through to production, or a company built, sold, marketed and maintained. Owned tasks, daily standups, mentor review against a rubric, and evidence behind every claim.</p>
            <div className="flex gap-4 flex-wrap">
              <Link href="/plans">
                <button className="bg-[#2B2563] hover:bg-[#12333A] text-white px-10 py-4 rounded-full text-lg font-medium transition-colors">Apply Now</button>
              </Link>
              <Link href="/program">
                <button className="border-2 border-[#2B2563] text-[#2B2563] hover:bg-[#2B2563] hover:text-white px-10 py-4 rounded-full text-lg font-medium transition-colors">Explore Programs</button>
              </Link>
            </div>
          </div>
          <div className="relative overflow-hidden min-h-[200px]">
            <img src="/plans/about_pic.jpeg" alt="StartupUniv Team" className="absolute inset-0 h-full w-full object-cover object-left" loading="eager" decoding="async" />
          </div>
        </div>
      </div>

      {/* Focused on Real Results */}
      <div className="container mx-auto py-8 md:py-12">
        <h2 className="text-fluid-h1 font-serif font-normal mb-12">Focused on Real Results</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="bg-[#F6F1E9] hover:bg-[#FFE29A] transition-colors duration-300 border border-gray-200 rounded-xl p-8 group">
            <svg className="w-10 h-10 mb-6 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
            </svg>
            <h3 className="text-xl font-serif mb-2">Ideas Validated</h3>
            <p className="text-base font-sans text-gray-700">Market-tested ideas with real user and business validation</p>
          </div>
          <div className="bg-[#F6F1E9] hover:bg-[#FFE29A] transition-colors duration-300 border border-gray-200 rounded-xl p-8 group">
            <svg className="w-10 h-10 mb-6 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
            <h3 className="text-xl font-serif mb-2">Startups Launched</h3>
            <p className="text-base font-sans text-gray-700">Products built, launched, and actively operating</p>
          </div>
          <div className="bg-[#F6F1E9] hover:bg-[#FFE29A] transition-colors duration-300 border border-gray-200 rounded-xl p-8 group">
            <svg className="w-10 h-10 mb-6 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <h3 className="text-xl font-serif mb-2">Founder Readiness</h3>
            <p className="text-base font-sans text-gray-700">Execution-ready founders with real-world skills</p>
          </div>
          <div className="bg-[#F6F1E9] hover:bg-[#FFE29A] transition-colors duration-300 border border-gray-200 rounded-xl p-8 group">
            <svg className="w-10 h-10 mb-6 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <h3 className="text-xl font-serif mb-2">Long-Term Growth</h3>
            <p className="text-base font-sans text-gray-700">Startups designed for survival, scale, and sustainability</p>
          </div>
        </div>
      </div>

      {/* Founder Story */}
      <div className="container mx-auto py-8 md:py-12 grid md:grid-cols-2 gap-12 items-center">
        <div className="rounded-xl overflow-hidden w-full h-full relative">
          <img src="/manish-kumar.png" alt="Manish Kumar, Founder of StartupUniv" className="object-cover w-full h-full min-h-[450px]" loading="eager" decoding="async" />
          <div className="absolute bottom-0 left-0 bg-[#FFE29A] px-8 py-4" style={{ width: '60%' }}>
            <div className="font-serif text-2xl font-normal text-gray-900">Manish Kumar</div>
            <div className="text-base font-sans font-light text-gray-900">Founder, StartupUniv</div>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <blockquote className="text-fluid-h3 font-serif leading-relaxed text-gray-900">"We built StartupUniv because entrepreneurship can't be taught through PowerPoints and outdated frameworks. The only real way to learn is by building – by selling, failing, iterating and trying again."</blockquote>
        </div>
      </div>

      {/* Foundation Section */}
      <div className="container mx-auto py-8 md:py-12">
        <h1 className="text-fluid-h1 font-serif font-normal mb-16 text-left">The Foundation of StartupUniv</h1>
        
        {/* Rooman Technologies Section */}
        <div className="grid md:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <h2 className="text-fluid-h2 font-serif text-[#2B2563] mb-8 lining-nums">Since 1999 — Rooman Technologies</h2>
            
            <h3 className="text-2xl font-serif mb-6 lining-nums">A Legacy Since 1999</h3>
            <hr className="border-gray-300 mb-6" />
            <p className="text-lg mb-8 leading-relaxed lining-nums">
              Rooman Technologies, founded by Mr. Manish Kumar, brings over 25 years of 
              experience in technology and employability-focused skilling, shaping India's 
              workforce for the future.
            </p>

            <h3 className="text-2xl font-serif mb-6">Impact at National Scale</h3>
            <hr className="border-gray-300 mb-6" />
            <p className="text-lg mb-8 leading-relaxed lining-nums">
              With 1+ million learners trained across IT, emerging technologies, and 
              professional skills, Rooman has built one of India's largest industry-focused 
              skilling ecosystems.
            </p>

            <h3 className="text-2xl font-serif mb-6">Industry-Aligned Expertise</h3>
            <hr className="border-gray-300 mb-6" />
            <p className="text-lg leading-relaxed">
              Backed by strong partnerships with universities, enterprises, and government 
              programs, Rooman Technologies is known for designing outcome-driven, 
              industry-aligned curricula that deliver real-world results.
            </p>
          </div>
          <div className="rounded-xl overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop" 
              alt="Rooman Technologies Building" 
              className="object-cover w-full h-full min-h-[500px]" 
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
        {/* JGI Section */}
        <div className="grid md:grid-cols-2 gap-16 items-center mb-20">
          <div className="rounded-xl overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1562774053-701939374585?w=800&h=600&fit=crop" 
              alt="Jain Group of Institutions Campus" 
              className="object-cover w-full h-full min-h-[500px]" 
              loading="eager"
              decoding="async"
            />
          </div>
          <div>
            <h2 className="text-fluid-h2 font-serif text-[#2B2563] mb-8 lining-nums">Since 1990 — Jain Group of Institutions (JGI)</h2>
            
            <h3 className="text-2xl font-serif mb-6 lining-nums">Legacy Since 1990</h3>
            <hr className="border-gray-300 mb-6" />
            <p className="text-lg mb-8 leading-relaxed">
              Jain Group of Institutions (JGI), headquartered in Bengaluru, brings decades of 
              academic excellence combined with a strong focus on innovation and 
              entrepreneurship.
            </p>

            <h3 className="text-2xl font-serif mb-6">Education at Scale</h3>
            <hr className="border-gray-300 mb-6" />
            <p className="text-lg mb-8 leading-relaxed lining-nums">
              With 70+ educational institutions across India, JGI engages thousands of 
              learners every year through academic, innovation, and venture-driven programs.
            </p>

            <h3 className="text-2xl font-serif mb-6">Startup & Innovation Impact</h3>
            <hr className="border-gray-300 mb-6" />
            <p className="text-lg leading-relaxed">
              JGI has a strong presence in startup incubation and mentoring, with a proven 
              legacy of transforming academic learning into real-world entrepreneurial 
              outcomes.
            </p>
          </div>
        </div>
      </div>

      {/* Trusted by Industry Leaders */}
      <TrustedByPartnersSection />

      {/* Vision Section */}
      <div className="bg-[#FFE29A] py-10 md:py-14">
        <div className="container mx-auto">
          <h2 className="text-fluid-h1 font-serif font-normal mb-8 text-left text-gray-900">Our Vision</h2>
          <p className="text-xl leading-relaxed mb-12 text-left text-gray-900">
            Our vision is to empower India's next generation of founders by providing a trusted, 
            end-to-end startup education and incubation platform—one that consistently transforms 
            ideas into execution-ready, sustainable businesses through the right guidance, structure, 
            and real-world experience.
          </p>
          <div className="flex gap-6">
            <Link href="/plans">
              <button className="bg-[#2B2563] hover:bg-[#12333A] text-white px-8 py-4 rounded-full text-lg font-medium">
                Apply Now
              </button>
            </Link>
            <Link href="/program">
              <button className="bg-white border-2 border-[#2B2563] text-[#2B2563] hover:bg-[#2B2563] hover:text-white px-8 py-4 rounded-full text-lg font-medium">
                Explore Programs
              </button>
            </Link>
          </div>
        </div>
      </div>


      {/* Mission Section */}
      <div className="bg-[#C5CAE9] py-10 md:py-14">
        <div className="container mx-auto">
          <h2 className="text-fluid-h1 font-serif font-normal mb-8 text-left text-gray-900">Our Mission</h2>
          <p className="text-xl leading-relaxed mb-12 text-left text-gray-900">
            We boost startup success through structured execution, build founder capabilities, 
            and guide ideas from validation to launch, strengthening India's startup ecosystem 
            through education-driven innovation.
          </p>
          <div className="flex gap-6">
            <Link href="/plans">
              <button className="bg-[#2B2563] hover:bg-[#12333A] text-white px-8 py-4 rounded-full text-lg font-medium">
                Apply Now
              </button>
            </Link>
            <Link href="/program">
              <button className="bg-white border-2 border-[#2B2563] text-[#2B2563] hover:bg-[#2B2563] hover:text-white px-8 py-4 rounded-full text-lg font-medium">
                Explore Programs
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Who It's For & Why It Works */}
      <div className="container mx-auto py-10 md:py-14">
        <h2 className="text-fluid-h1 font-serif font-normal mb-16 text-left">Who It's For & Why It Works</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Card - Who is StartupUniv for? */}
          <div className="bg-[#C5CAE9] rounded-xl p-10">
            {/* Icon */}
            <svg className="w-10 h-10 mb-6 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>

            <h3 className="text-2xl font-serif font-normal mb-6 text-gray-900">Who is StartupUniv for?</h3>
            <hr className="border-gray-500 mb-6" />

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-1 text-[#2B2563] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg text-gray-900">Students seeking to build startups while studying</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-1 text-[#2B2563] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg text-gray-900">Entrepreneurs looking to accelerate their startup journey</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-1 text-[#2B2563] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg text-gray-900">First-time founders needing structured guidance</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-1 text-[#2B2563] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg text-gray-900">Working professionals transitioning into entrepreneurship</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-1 text-[#2B2563] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg text-gray-900">Early-stage startups looking to validate and scale</span>
              </li>
            </ul>

            <p className="text-lg text-gray-900 leading-relaxed">
              The platform is designed to support founders from zero to first traction.
            </p>
          </div>

          {/* Right Card - What Makes StartupUniv Different */}
          <div className="bg-[#FFF3E0] rounded-xl p-10">
            {/* Icon */}
            <svg className="w-10 h-10 mb-6 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>

            <h3 className="text-2xl font-serif font-normal mb-6 text-gray-900">What Makes StartupUniv Different.</h3>
            <hr className="border-gray-500 mb-6" />

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-1 text-[#FFB300] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg text-gray-900">Focus on execution outcomes, not certificates</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-1 text-[#FFB300] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg text-gray-900">Programs designed by industry practitioners, not only academics</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-1 text-[#FFB300] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg text-gray-900 lining-nums">Backed by organizations with 25+ years of delivery experience</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-1 text-[#FFB300] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg text-gray-900">Integrated access to education, mentoring, and incubation</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-1 text-[#FFB300] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg text-gray-900">Data-driven frameworks aligned with real startup failure patterns</span>
              </li>
            </ul>

            <p className="text-lg text-gray-900 leading-relaxed">
              StartupUniv is built to reduce failure caused by poor validation, weak business fundamentals, and lack of guidance.
            </p>
          </div>
        </div>
      </div>

      {/* Where Ideas Become Real Startups */}
      <div className="bg-[#FAF9F6] py-10 md:py-14">
        <div className="container mx-auto">
          <h2 className="text-fluid-h1 font-serif font-normal mb-16 text-left">Where Ideas Become Real Startups</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Card 1 - Startup Incubation (green) */}
            <div className="bg-[#F6F1E9] hover:bg-[#D6F8E6] transition-colors duration-300 border border-gray-200 rounded-xl p-10 group">
              <svg className="w-10 h-10 mb-8 text-[#2B2563]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
              </svg>

              <h3 className="text-2xl font-serif font-normal mb-4 text-[#2B2563]">Startup Incubation & Real Execution</h3>
              <hr className="border-[#2B2563] mb-6" />
              <p className="text-lg text-gray-800 leading-relaxed">
                We help founders turn ideas into legally registered, real startups from day one. Participants work on real challenges, build real products, and operate real businesses—not simulations.
              </p>
            </div>

            {/* Card 2 - Expert-Led Education */}
            <div className="bg-[#F6F1E9] hover:bg-[#D6F8E6] transition-colors duration-300 border border-gray-200 rounded-xl p-10 group">
              <svg className="w-10 h-10 mb-8 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>

              <h3 className="text-2xl font-serif font-normal mb-4 text-gray-900">Expert-Led Education & Mentorship</h3>
              <hr className="border-gray-400 mb-6" />
              <p className="text-lg text-gray-800 leading-relaxed">
                Learn entrepreneurship, product strategy, and operations directly from industry experts and successful founders, with structured mentorship that supports decision-making at every stage.
              </p>
            </div>

            {/* Card 3 - Market Validation */}
            <div className="bg-[#F6F1E9] hover:bg-[#D6F8E6] transition-colors duration-300 border border-gray-200 rounded-xl p-10 group">
              <svg className="w-10 h-10 mb-8 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
                <circle cx="18" cy="6" r="2" />
                <circle cx="13" cy="3" r="2" />
              </svg>

              <h3 className="text-2xl font-serif font-normal mb-4 text-gray-900">Market Validation with Real Insights</h3>
              <hr className="border-gray-400 mb-6" />
              <p className="text-lg text-gray-800 leading-relaxed">
                Ideas are tested against real market needs using customer feedback, data-driven experiments, and validation frameworks to ensure strong problem–solution fit before scaling.
              </p>
            </div>

            {/* Card 4 - Ecosystem Access */}
            <div className="bg-[#F6F1E9] hover:bg-[#D6F8E6] transition-colors duration-300 border border-gray-200 rounded-xl p-10 group">
              <svg className="w-10 h-10 mb-8 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c4-4 8-7.5 8-12a8 8 0 1 0-16 0c0 4.5 4 8 8 12z" />
                <path d="M12 2v8" />
                <path d="M8 6c0 2.2 1.8 4 4 4s4-1.8 4-4" />
              </svg>

              <h3 className="text-2xl font-serif font-normal mb-4 text-gray-900">Ecosystem Access for Growth</h3>
              <hr className="border-gray-400 mb-6" />
              <p className="text-lg text-gray-800 leading-relaxed">
                Gain direct access to investors, corporates, partners, and a strong startup network to unlock collaboration, growth opportunities, and long-term success.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* StartupUniv was developed to bridge these gaps */}
      <div className="bg-[#F8F8F8] py-10 md:py-14">
        <div className="container mx-auto">
          <h2 className="text-fluid-h1 font-serif font-normal mb-4 text-left">
            StartupUniv was developed to effectively bridge these gaps.
          </h2>
          <p className="text-xl text-gray-700 mb-12 lining-nums">
            India sees over 100,000 startup registrations annually, yet:
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {/* Card 1 - 90%+ */}
            <div className="bg-[#E3EEFF] rounded-xl p-8">
              <svg className="w-10 h-10 mb-8 text-[#2B2563]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>

              <p className="text-3xl font-bold text-[#2B2563] lining-nums">90%+</p>
              <p className="text-xl font-semibold text-gray-900 mb-4 lining-nums">Fail Within 5 Years</p>
              <p className="text-base text-gray-700 leading-relaxed">
                Most startups collapse due to poor execution, weak market fit, and lack of proper guidance—even when the idea is strong.
              </p>
            </div>

            {/* Card 2 - <10% */}
            <div className="bg-[#F5F5F0] rounded-xl p-8">
              <svg className="w-10 h-10 mb-8 text-[#2B2563]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>

              <p className="text-3xl font-bold text-[#2B2563] lining-nums">&lt;10%</p>
              <p className="text-xl font-semibold text-gray-900 mb-4">Have Real Mentorship</p>
              <p className="text-base text-gray-700 leading-relaxed">
                Only a small fraction of founders get structured, consistent mentorship to guide critical startup decisions.
              </p>
            </div>

            {/* Card 3 - 70% */}
            <div className="bg-[#FFF3E0] rounded-xl p-8">
              <svg className="w-10 h-10 mb-8 text-[#2B2563]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>

              <p className="text-3xl font-bold text-[#2B2563] lining-nums">70%</p>
              <p className="text-xl font-semibold text-gray-900 mb-4">Fail Due to Execution Gaps</p>
              <p className="text-base text-gray-700 leading-relaxed">
                Startups often build without validating real market needs, leading to low traction and early failure.
              </p>
            </div>
          </div>

          <p className="text-xl text-gray-900 font-medium">
            StartupUniv was created to address these gaps systematically.
          </p>
        </div>
      </div>

      {/* Ready to Start Your Entrepreneurial Journey CTA */}
      <div className="container mx-auto py-10 md:py-14">
        <div className="rounded-xl overflow-hidden">
          {/* Top section - yellow with text and buttons */}
          <div className="bg-[#FFE29A] px-10 py-8 md:py-12 text-center">
            <h2 className="text-fluid-h1 font-serif font-normal mb-10">
              Ready to Start Your Entrepreneurial Journey?
            </h2>
            <div className="flex gap-6 justify-center flex-wrap">
              <Link href="/plans">
                <button className="bg-[#2B2563] hover:bg-[#12333A] text-white px-12 py-4 rounded-full text-lg font-medium transition-colors">
                  Apply Now
                </button>
              </Link>
              <Link href="/contact">
                <button className="bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white px-12 py-4 rounded-full text-lg font-medium transition-colors">
                  Contact Us
                </button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
