import { SiteLayout } from "@/components/layout/site-layout";

export default function TermsPage() {
  return (
    <SiteLayout hideCTA>
      <section className="w-full px-4 md:px-8 lg:px-16 py-12 md:py-16 max-w-[1300px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-4 mb-12">
          <h1 className="text-fluid-h1 font-bold tracking-tight text-[#12333A]" style={{ fontFamily: "'Playfair Display', 'Georgia', 'Times New Roman', serif" }}>
            TERMS &amp; CONDITIONS
          </h1>
          <p className="text-xs md:text-sm font-semibold tracking-widest text-[#12333A] uppercase whitespace-nowrap">
            Effective Date: January 1, 2026
          </p>
        </div>

        {/* Section 1 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">1. INTRODUCTION</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <p className="text-sm md:text-base text-[#000000] leading-relaxed">
            Welcome To StartupUniv. These Terms And Conditions ("Terms") Govern Your Access To And Use Of StartupUniv's Entrepreneurship-As-A-Service (EaaS) Platform, Including Our Website, Services, Programs, And Any Related Content (Collectively, The "Services"). By Accessing Or Using Our Services, You Agree To Be Bound By These Terms. If You Do Not Agree To These Terms, Please Do Not Use Our Services.
          </p>
        </div>

        {/* Section 2 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">2. DEFINITIONS</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>"StartupUniv," "We," "Us," Or "Our" Refers To StartupUniv Private Limited And Its Affiliates.</p>
            <p>"Participant," "You," Or "Your" Refers To Any Individual Who Registers For, Accesses, Or Uses Our Services.</p>
            <p>"Startup Company" Refers To The Legal Entity Incorporated Through The StartupUniv Program.</p>
            <p>"Startup Resources" Refers To The Initial Resources And Support Provided To Startup Companies.</p>
            <p>"EaaS Platform" Refers To StartupUniv's Entrepreneurship-As-A-Service Platform And All Associated Tools, Resources, And Services.</p>
          </div>
        </div>

        {/* Section 3 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">3. ELIGIBILITY</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>You Must Be At Least 18 Years Of Age To Register For And Use Our Services.</p>
            <p>You Must Provide Accurate, Current, And Complete Information During The Registration Process.</p>
            <p>StartupUniv Reserves The Right To Refuse Registration Or Terminate Access At Its Sole Discretion.</p>
            <p>Participation In The Program Is Subject To Availability And Selection Criteria As Determined By StartupUniv.</p>
          </div>
        </div>

        {/* Section 4 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">4. PROGRAM PARTICIPATION</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>Participants Are Required To Actively Engage In All Assigned Program Activities, Including Workshops, Mentorship Sessions, And Milestones.</p>
            <p>Each Participant Must Contribute To Their Team's Startup Project As Outlined In Their Role (Founder, Co-Founder, Or Intern).</p>
            <p>StartupUniv May Modify Program Content, Schedules, And Requirements At Any Time With Reasonable Notice.</p>
            <p>Failure To Meet Program Requirements May Result In Removal From The Program Without Refund.</p>
          </div>
        </div>

        {/* Section 5 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">5. STARTUP RESOURCES AND SUPPORT</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>Startup Resources Will Be Provided To Qualifying Startup Companies Upon Successful Incorporation And Fulfillment Of Program Milestones.</p>
            <p>The Provision Of Startup Resources Is Subject To The Startup Company Meeting All Eligibility Criteria And Compliance Requirements.</p>
            <p>StartupUniv Reserves The Right To Withhold Or Recall Startup Resources If The Startup Company Fails To Meet Agreed-Upon Milestones Or Violates These Terms.</p>
            <p>Startup Resources Are Intended Solely For Business Operations And May Not Be Used For Personal Expenses.</p>
          </div>
        </div>

        {/* Section 6 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">6. EQUITY AND OWNERSHIP</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>Equity Will Be Issued Upon Successful Completion Of The Program And Continued Participation In The Project.</p>
            <p>The Equity Distribution Among Team Members Will Be As Per The Agreement Signed At The Time Of Team Formation.</p>
            <p>StartupUniv May Retain A Percentage Of Equity In The Startup Company As Outlined In The Participation Agreement.</p>
            <p>Any Changes To Equity Distribution Must Be Approved By All Relevant Parties And Documented In Writing.</p>
          </div>
        </div>

        {/* Section 7 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">7. INTELLECTUAL PROPERTY</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>All Intellectual Property Created During The Program By Participants Shall Be Owned By The Startup Company, Subject To The Terms Of The Participation Agreement.</p>
            <p>StartupUniv Retains Ownership Of Its Platform, Branding, Curriculum, And Proprietary Materials.</p>
            <p>Participants May Not Use StartupUniv's Intellectual Property Without Prior Written Consent.</p>
            <p>Any Pre-Existing Intellectual Property Brought Into The Program By Participants Remains The Property Of The Original Owner.</p>
          </div>
        </div>

        {/* Section 8 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">8. CONFIDENTIALITY</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>Participants Agree To Maintain The Confidentiality Of All Proprietary Information Shared During The Program.</p>
            <p>Confidential Information Includes But Is Not Limited To Business Plans, Financial Data, Technical Know-How, And Any Other Information Marked As Confidential.</p>
            <p>This Confidentiality Obligation Survives The Termination Of Participation In The Program.</p>
          </div>
        </div>

        {/* Section 9 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">9. LIMITATION OF LIABILITY</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>StartupUniv Shall Not Be Liable For Any Indirect, Incidental, Special, Consequential, Or Punitive Damages Arising Out Of Or Related To Your Use Of The Services.</p>
            <p>StartupUniv Does Not Guarantee The Success Of Any Startup Company Or The Return On Any Investment.</p>
            <p>Our Total Liability To You For All Claims Arising Out Of These Terms Shall Not Exceed The Amount You Paid To StartupUniv In The Preceding 12 Months.</p>
          </div>
        </div>

        {/* Section 10 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">10. TERMINATION</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>StartupUniv May Terminate Or Suspend Your Access To The Services At Any Time, With Or Without Cause, With Or Without Notice.</p>
            <p>You May Terminate Your Participation By Providing Written Notice To StartupUniv, Subject To Any Obligations Under The Participation Agreement.</p>
            <p>Upon Termination, All Rights Granted To You Under These Terms Will Immediately Cease.</p>
            <p>Sections Relating To Intellectual Property, Confidentiality, Limitation Of Liability, And Governing Law Shall Survive Termination.</p>
          </div>
        </div>

        {/* Section 11 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">11. GOVERNING LAW</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>These Terms Shall Be Governed By And Construed In Accordance With The Laws Of India.</p>
            <p>Any Disputes Arising Out Of Or In Connection With These Terms Shall Be Subject To The Exclusive Jurisdiction Of The Courts In Bangalore, Karnataka, India.</p>
          </div>
        </div>

        {/* Section 12 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">12. CONTACT US</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>If You Have Any Questions About These Terms And Conditions, Please Contact Us At:</p>
            <p className="mt-2">StartupUniv Private Limited</p>
            <p>Email: info@startupvarsity.com</p>
            <p>Website: www.startupvarsity.com</p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

