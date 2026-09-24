import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import type { BlogPost } from "@shared/schema";
import { format } from "date-fns";
import { SiteLayout } from "@/components/layout/site-layout";

const fallbackPost: Pick<BlogPost, "id" | "title" | "slug" | "excerpt" | "content" | "publishedAt" | "coverImage"> = {
  id: "fallback",
  slug: "it-job-guaranteed-courses-complete-guide-2025",
  title: "IT Job-Guaranteed Courses: The Complete Guide (2025)",
  excerpt:
    "Explore the most up-to-date IT job-guaranteed courses, eligibility, career outcomes, and how to choose the right program in 2025.",
  content: [
    "TOP 5 IT JOB-GUARANTEED COURSES YOU SHOULD CONSIDER\n",
    "1. Full Stack Web Development Bootcamp: This intensive program covers both front-end and back-end development, equipping students with skills in HTML, CSS, JavaScript, and server-side languages. Graduates often find roles as full stack developers in just a few months.\n\n2. Data Science and Analytics Program: Focused on data manipulation, statistical analysis, and machine learning, this course prepares participants for high-demand roles in data science. With real-world projects and mentorship, students gain hands-on experience that employers value.",
    "WHY CHOOSE JOB-GUARANTEED COURSES?\n",
    "Opting for job-guaranteed courses can provide a safety net for aspiring tech professionals. These programs often include tailored resume workshops, interview preparation sessions, and networking opportunities with industry leaders. By choosing a course with job placement assurances, learners can transition from education to employment with confidence and support.",
    "IT JOB-GUARANTEED COURSES: YOUR PATH TO A SECURE TECH CAREER\n",
    "The tech industry is booming, offering a wealth of exciting and lucrative career opportunities. However, breaking into this competitive field can be daunting. Fortunately, several IT job-guaranteed courses promise not only comprehensive training but also job placement assistance, significantly increasing your chances of landing your dream tech role. This guide explores these courses and helps you choose the right path for your career aspirations.",
  ].join("\n\n"),
  publishedAt: new Date("2025-08-18"),
  coverImage: null,
};

function splitContentIntoSections(content: string) {
  const blocks = content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  // Heuristic: treat ALL-CAPS-ish short lines as headings.
  const sections: Array<{ heading?: string; body: string }> = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isHeading =
      block.length <= 120 &&
      /^[A-Z0-9][A-Z0-9\s:&-]+$/.test(block.replace(/\s+/g, " "));

    if (isHeading) {
      const body = blocks[i + 1] ?? "";
      sections.push({ heading: block, body });
      i++;
    } else {
      sections.push({ body: block });
    }
  }

  return sections;
}

export default function BlogPostPage() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug;

  const { data: post, isLoading } = useQuery<BlogPost>({
    queryKey: slug ? [`/api/blog/${slug}`] : ["/api/blog/"],
    enabled: !!slug,
  });

  const displayPost = post || fallbackPost;
  const publishedAt = displayPost.publishedAt ? new Date(displayPost.publishedAt) : null;
  const effectiveDate = publishedAt ? format(publishedAt, "MMMM d, yyyy") : "January 1, 2026";

  const sections = splitContentIntoSections(displayPost.content || "");

  return (
    <SiteLayout hideCTA>
      <div className="mx-auto w-full max-w-[1300px] px-4 md:px-6 pt-10 md:pt-12 pb-16 md:pb-24">
        <div className="bg-white p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="font-serif font-light text-[#12333A] text-[34px] sm:text-[40px] md:text-[48px] leading-[1.4] tracking-[-0.2px] uppercase">
              The StartupUniv Blog
            </h1>
            <div className="text-[#12333A] text-[14px] sm:text-[16px] leading-[1.4] uppercase">
              Effective Date: {effectiveDate}
            </div>
          </div>

          {/* Featured block */}
          <div className="mt-10 flex flex-col md:flex-row bg-[#B3D4F2]">
            <div className="w-full md:w-[319px] bg-white">
              <img
                src={displayPost.coverImage || "/blog/featured.jpg"}
                alt={displayPost.title}
                className="h-[319px] w-full object-cover"
                loading="eager"
              />
            </div>
            <div className="flex-1 bg-white px-6 py-8">
              <h2 className="font-serif font-light text-[#12333A] text-[26px] sm:text-[30px] leading-[1.2] tracking-[-0.6px]">
                {displayPost.title}
              </h2>
              <div className="mt-2 font-serif font-light text-[#12333A] text-[18px] sm:text-[20px] leading-[30px] tracking-[-0.6px]">
                {publishedAt ? `Date • ${format(publishedAt, "MMMM d, yyyy")}` : ""}
              </div>
              <p className="mt-4 text-[#2B2B2B] text-[14px] sm:text-[16px] leading-[1.4] max-w-[520px]">
                {displayPost.excerpt || ""}
              </p>

              <div className="mt-6">
                <Link
                  href="/blog"
                  className="text-[#17646E] text-[14px] sm:text-[16px] underline underline-offset-4"
                >
                  Back to Blog
                </Link>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="mt-12 space-y-10">
            {isLoading && !post ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : null}

            {sections.map((section, idx) => (
              <section key={idx}>
                {section.heading ? (
                  <div className="border-b border-black pb-2">
                    <h3 className="font-['Almarai',sans-serif] text-[#12333A] text-[20px] sm:text-[22px] md:text-[24px] leading-[1.4] tracking-[-0.2px] uppercase">
                      {section.heading}
                    </h3>
                  </div>
                ) : null}

                <p className="mt-4 text-[#12333A] text-[16px] sm:text-[18px] leading-[1.6] whitespace-pre-wrap capitalize">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
