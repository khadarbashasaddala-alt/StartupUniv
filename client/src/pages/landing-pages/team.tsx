import { SiteLayout } from "@/components/layout/site-layout";
import { Badge } from "@/components/ui/badge";
import { Users, Award, Sparkles } from "lucide-react";
import { MentorBlog } from "@/components/ui/mentor-blog";
import { iTeamMember } from "@/components/ui/retro-team-carousel";

// Team member data - 10 members
// profileImage is empty until photos are added to /public/team/ folder
const teamMembers: iTeamMember[] = [
  {
    name: "John Doe",
    designation: "Senior Startup Mentor",
    description: "With over 15 years of experience in building and scaling startups, I help founders navigate the complex journey from idea to successful exit. My expertise lies in product-market fit, fundraising, and team building.",
    profileImage: "/team/mentor1.jpg", // Will be "/team/john-doe.jpg" when photo is added
    expertise: ["Startup Strategy", "Product Development", "Fundraising", "Team Building"],
    yearsOfExperience: 15,
    specialist: "Tech Entrepreneurship"
  },
  {
    name: "Jane Smith",
    designation: "Product Strategy Expert",
    description: "I specialize in helping startups build products that users love. My approach combines user research, data-driven decision making, and agile product development methodologies.",
    profileImage: "/team/mentor2.png",
    expertise: ["Product Strategy", "User Research", "UX Design", "Agile Development"],
    yearsOfExperience: 12,
    specialist: "Product Management"
  },
  {
    name: "Michael Chen",
    designation: "Financial Advisor & Investor",
    description: "Having raised over $50M in funding across multiple startups, I guide founders through the fundraising process, financial planning, and investor relations.",
    profileImage: "", // Will be "/team/michael-chen.jpg" when photo is added
    expertise: ["Fundraising", "Financial Planning", "Investor Relations", "Valuation"],
    yearsOfExperience: 18,
    specialist: "Finance & Investment"
  },
  {
    name: "Sarah Johnson",
    designation: "Marketing & Growth Specialist",
    description: "I help startups achieve rapid growth through data-driven marketing strategies, brand building, and customer acquisition. My campaigns have generated millions in revenue.",
    profileImage: "", // Will be "/team/sarah-johnson.jpg" when photo is added
    expertise: ["Digital Marketing", "Growth Hacking", "Brand Strategy", "Customer Acquisition"],
    yearsOfExperience: 14,
    specialist: "Growth Marketing"
  },
  {
    name: "David Kumar",
    designation: "Technology & Engineering Lead",
    description: "As a former CTO of multiple successful startups, I mentor technical founders on architecture, scaling, and building high-performing engineering teams.",
    profileImage: "", // Will be "/team/david-kumar.jpg" when photo is added
    expertise: ["Software Architecture", "Cloud Infrastructure", "DevOps", "Engineering Leadership"],
    yearsOfExperience: 16,
    specialist: "Technology Leadership"
  },
  {
    name: "Emily Rodriguez",
    designation: "Business Development Expert",
    description: "I specialize in helping startups establish strategic partnerships, enter new markets, and build sustainable business models. My network spans across industries globally.",
    profileImage: "", // Will be "/team/emily-rodriguez.jpg" when photo is added
    expertise: ["Business Development", "Strategic Partnerships", "Market Entry", "Business Modeling"],
    yearsOfExperience: 13,
    specialist: "Business Development"
  },
  {
    name: "Robert Williams",
    designation: "Legal & Compliance Advisor",
    description: "With expertise in startup law, IP protection, and regulatory compliance, I help founders navigate legal challenges and protect their innovations.",
    profileImage: "", // Will be "/team/robert-williams.jpg" when photo is added
    expertise: ["Startup Law", "IP Protection", "Regulatory Compliance", "Contract Negotiation"],
    yearsOfExperience: 11,
    specialist: "Legal & Compliance"
  },
  {
    name: "Lisa Anderson",
    designation: "HR & Talent Acquisition Specialist",
    description: "I help startups build world-class teams by developing hiring strategies, creating company culture, and implementing effective talent retention programs.",
    profileImage: "", // Will be "/team/lisa-anderson.jpg" when photo is added
    expertise: ["Talent Acquisition", "HR Strategy", "Company Culture", "Team Development"],
    yearsOfExperience: 10,
    specialist: "Human Resources"
  },
  {
    name: "James Wilson",
    designation: "Sales & Revenue Optimization",
    description: "I help startups build scalable sales processes, train sales teams, and optimize revenue operations. My strategies have helped companies achieve 10x revenue growth.",
    profileImage: "", // Will be "/team/james-wilson.jpg" when photo is added
    expertise: ["Sales Strategy", "Revenue Operations", "Sales Training", "Customer Success"],
    yearsOfExperience: 12,
    specialist: "Sales Excellence"
  },
  {
    name: "Maria Garcia",
    designation: "Operations & Scaling Expert",
    description: "I specialize in helping startups scale operations efficiently, optimize processes, and build systems that support rapid growth without breaking.",
    profileImage: "", // Will be "/team/maria-garcia.jpg" when photo is added
    expertise: ["Operations Management", "Process Optimization", "Scaling Strategies", "Systems Building"],
    yearsOfExperience: 14,
    specialist: "Operations & Scaling"
  },
];

export default function TeamPage() {
  return (
    <SiteLayout>
      {/* Hero Section */}
      <section className="bg-[#FAF7F3] pt-16 md:pt-20 lg:pt-24 pb-12 md:pb-16">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4 bg-red-600 text-white border-red-500 shadow-md">
              <Users className="w-3 h-3 mr-1" />
              Our Mentors
            </Badge>
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl text-gray-900 mb-4 leading-tight">
              Meet Our Expert Mentors
            </h1>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Learn from industry veterans and successful entrepreneurs who have built and scaled startups. Our mentors bring decades of combined experience to guide you on your journey.
            </p>
          </div>
        </div>
      </section>

      {/* Mentor Blog Section */}
      <div className="relative z-10">
      <MentorBlog
        mentors={teamMembers}
      />
      </div>

      {/* Info Section */}
      <section className="py-16 bg-[#FAF7F3]">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-red-600" />
              <span className="text-sm font-semibold text-red-600 uppercase tracking-wide">Expert Guidance</span>
            </div>
            <h2 className="text-fluid-h2 font-bold text-gray-900 mb-6">
              Why Choose Our Mentors?
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-8">
              Our mentors are carefully selected based on their track record of success, industry expertise, and commitment to helping startups succeed. Each mentor brings unique insights and practical experience to help you avoid common pitfalls and accelerate your growth.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-[#E3D9CC]">
                <Award className="w-8 h-8 text-red-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Proven Track Record</h3>
                <p className="text-sm text-gray-600">Mentors with successful exits and industry recognition</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-[#E3D9CC]">
                <Users className="w-8 h-8 text-red-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Diverse Expertise</h3>
                <p className="text-sm text-gray-600">Covering all aspects of startup building and scaling</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-[#E3D9CC]">
                <Sparkles className="w-8 h-8 text-red-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Personalized Guidance</h3>
                <p className="text-sm text-gray-600">One-on-one mentorship tailored to your startup's needs</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

