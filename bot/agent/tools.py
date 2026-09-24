from langchain_core.tools import tool
from typing import Literal


@tool
def get_program_details(
    topic: Literal["overview", "phases", "plans", "funding", "who_can_join"]
) -> str:
    """Get detailed information about the StartUpVarsity program.
    Use when the user asks about the program, cohort, pricing plans, funding, timeline, or who can join.

    Topics:
    - overview: General program info, cohort details, features & benefits
    - phases: 3-phase journey breakdown (Learn / Build / Launch) with weekly timeline
    - plans: Pricing plans — Founder, Co-Founder, Intern (With Equity / For Experience)
    - funding: Seed funding, follow-on investment, and equity distribution scenarios
    - who_can_join: Types of participants — Visionary, Passionate Founder/Co-Founder, Learner Intern
    """

    details = {
        "overview": """**StartupVarsity Program — Overview (Cohort 2025)**

India's first Entrepreneurship-as-a-Service platform, helping founders build real, market-ready startups with funding, mentorship, and hands-on experience.

**Cohort Details:**
- Start Date: January 2026
- Duration: 4 months
- Format: Bangalore + Remote (Hybrid)
- Cohort Size: 100 seats (limited for quality)
- Program Fee: ₹1,00,000 (one-time learning investment)

**Program Features & Benefits:**
1. **Funding** — ₹10 Lakh seed capital deposited in Week 1; up to ₹1 Crore in follow-on funding for high-potential startups
2. **Workspace** — Fully equipped collaborative workspace to work alongside co-founders and interns
3. **Launch Support** — Hands-on support to launch, reach early customers, and validate in real market conditions
4. **Mentorship** — Guidance from experienced founders and industry experts throughout the program

**What happens on Day 1 (Week 1):**
- Company is incorporated (LLP / Private Limited)
- Bank account opened in the company's name
- ₹10 Lakh seed capital deposited
- Equity formally allocated
- Roles and responsibilities assigned
- Operations begin immediately

Apply at: startupvarsity.com/apply""",

        "phases": """**StartupVarsity — 4-Month Journey in 3 Phases**

**Phase 1: Learn (Weeks 1–8)**
Participants learn entrepreneurship and design thinking, conduct market research, validate ideas through 100+ customer interviews, and build strong business models.

Weekly breakdown:
- Week 1: Company incorporated, ₹10L seed capital deposited, equity allocated, operations begin
- Weeks 2–3: Team formation & orientation, mentor assignment, program kickoff
- Weeks 4–8: Entrepreneurship fundamentals, customer discovery & validation, market research deep-dives, product thinking sessions

**Phase 2: Build (Weeks 9–20)**
Teams form, assign roles, run MVP development sprints, test with real customers, and iterate toward their first 10–50 paying customers.

Weekly breakdown:
- Weeks 9–12: Immersion Week 1 — intensive on-site bootcamp, expert masterclasses, prototype development sprint
- Weeks 13–18: Build Phase — product development sprints, weekly mentor check-ins, technical workshops, user testing & iteration
- Weeks 19–20: Immersion Week 2 — go-to-market strategy, pitch preparation, investor relations basics, legal & compliance

**Phase 3: Launch (Weeks 21–24)**
Startups receive ₹7.5L in seed funding, prepare for investor pitches, execute go-to-market strategies, and showcase at Demo Day in front of 50+ investors.

- Product launch preparation
- Demo Day presentations to 50+ investors
- Investor meetings
- Post-program planning

**Key Takeaways / What You'll Learn:**
- Problem Discovery: Customer interviews, problem validation, market sizing, competitive analysis
- Product Development: MVP methodology, agile practices, technical architecture, DevOps basics
- Team Building: Co-founder dynamics, hiring & culture, remote collaboration, conflict resolution
- Go-to-Market: Growth strategies, sales fundamentals, marketing essentials, partnership development""",

        "plans": """**StartupVarsity — Plans & Pricing**

**1. FOUNDER Plan**
- Fee: ₹5,00,000
- Equity: 40% equity share
- Stipend: ₹25,000/month
- For: Aspiring startup founders (lead the startup as Primary Founder)
- What you get:
  • Lead the startup as the Primary Founder
  • Mentorship to refine ideas & execution
  • Team support to build product, ops & marketing
  • Guidance on business model, go-to-market & investors
  • Prototype, test & validate before full-time commitment
  • Network with founders, mentors & industry experts
  • Access funding or pre-incubator resources
  • Official Founder recognition in the startup ecosystem
- Apply: startupvarsity.com/apply?plan=founder

**2. Co-Founder Plan**
- Fee: ₹3,00,000
- Equity: 20% equity share
- Stipend: ₹20,000/month
- For: Early-stage active contributors
- What you get:
  • Join as Co-Founder with shared ownership
  • Mentorship to refine ideas & execution
  • Team support to build product, ops & marketing
  • Guidance on business model, go-to-market & investors
  • Prototype, test & validate before commitment
  • Network with founders, mentors & industry experts
  • Access funding or pre-incubator resources
  • Official Co-Founder recognition in the startup ecosystem
- Apply: startupvarsity.com/apply?plan=cofounder

**3. Intern Plan — With Equity (Premium)**
- Fee: ₹1,50,000
- Equity: 5% equity share
- Stipend: ₹15,000/month
- Apply: startupvarsity.com/apply?plan=learner&tier=premium

**4. Intern Plan — For Experience (Basic)**
- Fee: ₹1,00,000
- Stipend: ₹10,000/month (experience-based, no equity)
- Apply: startupvarsity.com/apply?plan=learner&tier=basic

**All Intern Plans include:**
- Hands-on experience in real startup operations
- Mentorship from experienced founders
- Learn product, marketing, operations & business strategy
- Work on live products or functional prototypes
- Exposure to startup culture and decision-making
- Network with founders and core team members
- Recognition through certificate or equity
- Flexible involvement based on interest and role

**Note:** Equity is issued upon successful completion of the program and continued participation in the project.""",

        "funding": """**StartupVarsity — Funding & Equity Structure**

**Seed Funding:**
- ₹10 Lakh seed capital deposited in Week 1 (Day 1 of program)
- ₹7.5 Lakh additional seed funding released at Phase 3 (Launch phase, Weeks 21–24)
- Up to ₹1 Crore in follow-on funding available for high-potential startups

**How Equity is Distributed — 3 Common Scenarios:**

Scenario 1 — 2 Founders + 8 Learners + 1 Mentor:
  • 2 Founders × 40% each = 80% total
  • Remaining 20% held by Learners, Mentor & StartupVarsity

Scenario 2 — 1 Founder + 2 Co-founders + 7 Learners + 1 Mentor:
  • 1 Founder: 40%
  • 2 Co-founders: 20% each = 40%
  • Learners + Mentor + StartupVarsity: 20%

Scenario 3 — 1 Founder + 1 Co-founder + 4 Premium Learners + 1 Mentor:
  • 1 Founder: 40%
  • 1 Co-Founder: 20%
  • 4 Premium Learners: 5% each = 20%
  • Mentor + StartupVarsity: 20%

**Equity Issuance Terms:**
Equity is issued upon successful completion of the program and continued participation in the project. This ensures commitment and aligns interests for long-term success.

**Plans & Equity Summary:**
- Founder Plan (₹5L): 40% equity + ₹25,000/month stipend
- Co-Founder Plan (₹3L): 20% equity + ₹20,000/month stipend
- Intern With Equity (₹1.5L): 5% equity + ₹15,000/month stipend
- Intern For Experience (₹1L): No equity + ₹10,000/month stipend""",

        "who_can_join": """**Who Can Join StartupVarsity?**

**1. The Visionary — Aspiring First-Time Founder**
For: Professionals with 5–50 years of experience who are well-settled in their current job/business.
- Want to test an entrepreneurial idea safely without leaving their job
- Can build a team & prototype, then decide on full-time transition
- 4-month program lets them explore entrepreneurship at low risk
- Passion for entrepreneurship but prefer a safe first step
→ Best fit for: FOUNDER or Co-Founder Plan

**2. Passionate Founder / Co-Founder**
For: Fresh graduates or professionals with 1–5 years of experience.
- Have an innovative idea ready to execute
- Ready to start their entrepreneurial journey full-on
- Passion, vision, and willingness to act matter more than years of experience
- Ambitious young minds turning ideas into real solutions
→ Best fit for: FOUNDER Plan or Co-Founder Plan

**3. Learner / Intern**
For: Students and early-career individuals seeking hands-on startup experience.
- Want to work alongside innovative founders
- Ready to contribute to a startup's growth
- Seeking exposure, skill development, and portfolio building
- Want to be part of a founding journey
- Outcomes: Worked on a real startup, shipped production-ready product, experience with real customers, strong portfolio + execution credibility
→ Best fit for: Intern Plan (With Equity or For Experience)

**Summary:**
| Role | Experience | Plan |
|------|-----------|------|
| Visionary | 5–50 years, established professional | Founder |
| Passionate Founder | Fresh grad to 5 years | Founder / Co-Founder |
| Learner Intern | Student / early career | Intern |

Apply at: startupvarsity.com/apply""",
    }

    return details.get(
        topic,
        "Topic not found. Available topics: overview, phases, plans, funding, who_can_join"
    )


@tool
def get_application_steps() -> str:
    """Get step-by-step instructions on how to apply to StartUpVarsity.
    Use when the user asks how to apply, enroll, register, or get started."""
    return """**How to Apply to StartUpVarsity (Cohort 2025 — Jan 2026)**

1. Visit startupvarsity.com/apply (or startupvarsity.com/plans to compare plans first)
2. Choose your plan:
   - FOUNDER Plan (₹5L | 40% equity | ₹25K/month stipend)
   - Co-Founder Plan (₹3L | 20% equity | ₹20K/month stipend)
   - Intern With Equity (₹1.5L | 5% equity | ₹15K/month stipend)
   - Intern For Experience (₹1L | no equity | ₹10K/month stipend)
3. Fill out the application form
4. Pay the program fee (one-time investment)
5. Get onboarded into your cohort
6. Week 1: Your company is incorporated, bank account opened, ₹10L seed capital deposited — and you begin!

**Cohort Details:**
- Starts: January 2026
- Duration: 4 months
- Format: Bangalore + Remote (Hybrid)
- Seats: Only 100 — apply early!

For team applications (applying with a co-founder/intern group), visit: startupvarsity.com/team-application

Questions? Contact us at hello@startupvarsity.com or call 8045888899"""


@tool
def check_eligibility(background: str) -> str:
    """Recommend the right StartUpVarsity plan based on the user's background.
    Use when the user describes themselves and wants to know which plan or role suits them best."""

    b = background.lower()

    # Experienced professional / visionary
    if any(w in b for w in ["years of experience", "working professional", "manager", "director", "senior",
                             "cxo", "ceo", "vp", "head of", "established", "settled", "business owner",
                             "entrepreneur", "10 years", "15 years", "20 years", "decade"]):
        return (
            "You sound like a perfect **Visionary** — someone with experience who wants to test an idea safely. "
            "The **FOUNDER Plan** (₹5L | 40% equity | ₹25K/month stipend) is ideal: you build a team, prototype your idea, "
            "and decide about full-time commitment after 4 months — all without quitting your current job. "
            "The program starts January 2026 in Bangalore (Hybrid). Apply at startupvarsity.com/apply?plan=founder"
        )

    # Fresh grad or young professional wanting to be a founder
    if any(w in b for w in ["fresh graduate", "fresher", "recent graduate", "just graduated",
                             "1 year", "2 years", "3 years", "4 years", "5 years",
                             "want to start", "have an idea", "startup idea", "founder", "build a startup"]):
        return (
            "You're a great fit for the **Passionate Founder / Co-Founder** track! "
            "If you want to lead: **FOUNDER Plan** (₹5L | 40% equity | ₹25K/month stipend). "
            "If you're joining an existing founding team: **Co-Founder Plan** (₹3L | 20% equity | ₹20K/month stipend). "
            "The program starts January 2026 — apply at startupvarsity.com/apply"
        )

    # Student or someone wanting experience
    if any(w in b for w in ["student", "college", "university", "btech", "bsc", "mba student",
                             "degree", "intern", "internship", "learn", "experience", "skill",
                             "portfolio", "exposure"]):
        return (
            "You're perfect for the **Learner / Intern** track! You'll work on real startups and gain hands-on experience. "
            "Two options:\n"
            "- **With Equity** (₹1.5L | 5% equity | ₹15K/month stipend)\n"
            "- **For Experience** (₹1L | no equity | ₹10K/month stipend)\n"
            "Apply at startupvarsity.com/apply?plan=learner"
        )

    # Co-founder seeker
    if any(w in b for w in ["co-founder", "cofounder", "join a startup", "contribute", "partner"]):
        return (
            "The **Co-Founder Plan** sounds right for you! "
            "Fee: ₹3,00,000 | Equity: 20% | Stipend: ₹20,000/month. "
            "You join as a Co-Founder with shared ownership and full mentorship + team support. "
            "Apply at startupvarsity.com/apply?plan=cofounder"
        )

    return (
        "StartUpVarsity has plans for founders, co-founders, and learner interns. "
        "Could you tell me a bit more about yourself? For example:\n"
        "- Are you an experienced professional wanting to test a startup idea?\n"
        "- A fresh graduate or young professional ready to build a startup?\n"
        "- A student or early-career person looking for hands-on startup experience?\n"
        "I'll point you to the perfect plan!"
    )


@tool
def get_contact_info() -> str:
    """Get StartUpVarsity contact details for human support.
    Use when the user wants to speak to someone, needs direct help, or has a complex query."""
    return """**Reach the StartUpVarsity Team**

- Email: hello@startupvarsity.com
- Phone / WhatsApp: 8045888899
- Apply: startupvarsity.com/apply
- Plans & Pricing: startupvarsity.com/plans
- Program Details: startupvarsity.com/program
- Team Application: startupvarsity.com/team-application
- Contact form: startupvarsity.com/contact

Our team typically responds within a few hours on business days.
For urgent queries, calling or WhatsApp is fastest."""
