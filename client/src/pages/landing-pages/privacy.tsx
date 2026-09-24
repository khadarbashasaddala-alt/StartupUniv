import { SiteLayout } from "@/components/layout/site-layout";

export default function PrivacyPage() {
  return (
    <SiteLayout hideCTA>
      <section className="w-full px-4 md:px-8 lg:px-16 py-12 md:py-16 max-w-[1300px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-4 mb-12">
          <h1 className="text-fluid-h1 font-bold tracking-tight text-[#12333A]" style={{ fontFamily: "'Playfair Display', 'Georgia', 'Times New Roman', serif" }}>
            PRIVACY POLICY
          </h1>
          <p className="text-xs md:text-sm font-semibold tracking-widest text-[#12333A] uppercase whitespace-nowrap">
            Effective Date: January 1, 2026
          </p>
        </div>

        {/* Intro */}
        <div className="mb-10">
          <p className="text-sm md:text-base text-[#000000] leading-relaxed">
            At StartupUniv, We Value The Trust You Place In Us When You Share Your Personal, Financial, And Professional Information. This Privacy Policy Explains How We Collect, Use, Protect, And Share Information About Participants In Our Programs. It Also Outlines Our Approach To Intellectual Property, Equity Stakes, And Financial Terms Associated With The Startups Formed Under Our Ecosystem. By Enrolling In StartupUniv, You Agree To The Practices Described In This Policy.
          </p>
        </div>

        {/* Section 1 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">1. INFORMATION WE COLLECT</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p><strong>Personal Information:</strong> Name, Email, Phone Number, Address, Educational And Professional Background.</p>
            <p><strong>Financial Information:</strong> Enrollment Fees Processed Through Secure Gateways.</p>
            <p><strong>Program Data:</strong> Group Assignments, Project Submissions, Mentor Feedback, And Progress Reports.</p>
            <p><strong>Equity &amp; Stakeholder Data:</strong> Records Of Stake Allocation Among Founders, Co-Founders, Interns (If Opted), And StartupUniv.</p>
            <p><strong>Regulatory Information:</strong> Company Registration Details, Startup Resource Records, And Bank Account Records.</p>
            <p><strong>Website Usage Data:</strong> Cookies, Analytics, And Browsing Behaviour On Startupvarsity.Com.</p>
          </div>
        </div>

        {/* Section 2 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">2. HOW WE USE YOUR INFORMATION</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>To Process Applications And Payments Securely.</p>
            <p>To Form Groups Of 10 Participants And Assign Problem Statements.</p>
            <p>To Provide Startup Resources And Manage Startup Bank Accounts.</p>
            <p>To Register Startups And Handle Regulatory Compliance.</p>
            <p>To Allocate And Record Equity Stakes Among Stakeholders.</p>
            <p>To Connect Participants With Mentors And Expert Coaches.</p>
            <p>To Communicate Program Updates, Schedules, And Opportunities.</p>
          </div>
        </div>

        {/* Section 3 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">3. INFORMATION SHARING</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p><strong>Mentors &amp; Coaches:</strong> Limited Participant Information Is Shared To Enable Effective Guidance.</p>
            <p><strong>Financial Partners:</strong> Payment Processors And Banks Receive Necessary Financial Details.</p>
            <p><strong>Regulatory Authorities:</strong> Company Registration And Compliance Filings May Require Disclosure.</p>
            <p><strong>Stakeholders:</strong> Equity Distribution And IP Ownership Details Are Shared Transparently With All Involved Parties At The Start Of The Program.</p>
            <p><strong>No Third-Party Sales:</strong> We Do Not Sell Participant Data To Advertisers Or Unrelated Third Parties.</p>
          </div>
        </div>

        {/* Section 4 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">4. INTELLECTUAL PROPERTY (IP) &amp; CONTENT RIGHTS</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p><strong>Ownership:</strong> Software, Applications, And Content Created During The 4-Month Program Belong To The Startup Formed By The Group.</p>
            <p><strong>Equity Linkage:</strong> Founders, Co-Founders, And Interns (If Opted For Equity) Hold Stakes In The Startup. StartupUniv Also Retains A Stake.</p>
            <p><strong>Transparency:</strong> The Percentage Of Stake Held By Each Party Is Disclosed To All Stakeholders At The Beginning Of The Program.</p>
            <p><strong>Usage Rights:</strong> StartupUniv May Showcase Projects For Promotional And Educational Purposes, With Due Credit To The Team.</p>
          </div>
        </div>

        {/* Section 5 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">5. FINANCIAL TERMS</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p><strong>Enrollment Fees:</strong> Once Paid, Enrollment Fees Are Non-Refundable.</p>
            <p><strong>Equity Options:</strong> Founders And Co-Founders Receive Equity Stakes. Interns May Opt For Equity By Paying A Higher Enrollment Fee.</p>
            <p><strong>Startup Resources:</strong> Each Startup Group Receives Startup Resources, Managed Through A Dedicated Bank Account In The Startup's Name.</p>
            <p><strong>Regulatory Handling:</strong> StartupUniv Assists With Company Registration And Compliance So Teams Can Focus On Product Development.</p>
          </div>
        </div>

        {/* Section 6 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">6. DATA SECURITY</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>Secure Servers And Encrypted Payment Gateways.</p>
            <p>Restricted Access To Participant And Financial Data.</p>
            <p>Regular Audits To Maintain Compliance And Safeguard Information.</p>
          </div>
        </div>

        {/* Section 7 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">7. PARTICIPANT RIGHTS</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>Right To Access And Update Personal Information.</p>
            <p>Right To Request Deletion Of Data After Program Completion (Subject To Legal And Financial Record-Keeping Requirements).</p>
            <p>Right To Opt Out Of Non-Essential Communications.</p>
          </div>
        </div>

        {/* Section 8 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">8. DATA RETENTION</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>Personal And Financial Records Retained For The Duration Of The Program Plus 3 Years For Compliance.</p>
            <p>Equity And IP Records Retained Permanently As Part Of Startup Documentation.</p>
            <p>Project-Related Data May Be Archived For Alumni And Research Purposes.</p>
          </div>
        </div>

        {/* Section 9 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">9. COOKIES &amp; WEBSITE TRACKING</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>StartupUniv Uses Cookies To Improve User Experience.</p>
            <p>Analytics Tools May Track Website Usage But Do Not Identify Individuals.</p>
          </div>
        </div>

        {/* Section 10 */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-[#12333A] mb-1">10. CONTACT</h2>
          <hr className="border-t border-[#12333A]/20 mb-4" />
          <div className="space-y-1 text-sm md:text-base text-[#000000] leading-relaxed">
            <p>For Privacy-Related Queries, Please Contact:</p>
            <p className="mt-2">Info@startupvarsity.com</p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
