import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { BlogPost } from "@shared/schema";
import { format } from "date-fns";
import { SiteLayout } from "@/components/layout/site-layout";

type BlogPostLike = Pick<BlogPost, "id" | "title" | "slug" | "excerpt" | "publishedAt" | "coverImage">;

const defaultPosts: BlogPostLike[] = [
  {
    id: "default-1",
    slug: "it-job-guaranteed-courses-complete-guide-2025",
    title: "IT Job-Guaranteed Courses: The Complete Guide (2025)",
    excerpt:
      "Explore the most up-to-date IT job-guaranteed courses, eligibility, career outcomes, and how to choose the right program in 2025.",
    publishedAt: new Date("2025-08-18"),
    coverImage: null,
  },
  {
    id: "default-2",
    slug: "it-job-guaranteed-courses-complete-guide-2025-2",
    title: "IT Job-Guaranteed Courses: The Complete Guide (2025)",
    excerpt:
      "Explore the most up-to-date IT job-guaranteed courses, eligibility, career outcomes, and how to choose the right program in 2025.",
    publishedAt: new Date("2025-08-18"),
    coverImage: null,
  },
  {
    id: "default-3",
    slug: "it-job-guaranteed-courses-complete-guide-2025-3",
    title: "IT Job-Guaranteed Courses: The Complete Guide (2025)",
    excerpt:
      "Explore the most up-to-date IT job-guaranteed courses, eligibility, career outcomes, and how to choose the right program in 2025.",
    publishedAt: new Date("2025-08-18"),
    coverImage: null,
  },
  {
    id: "default-4",
    slug: "it-job-guaranteed-courses-complete-guide-2025-4",
    title: "IT Job-Guaranteed Courses: The Complete Guide (2025)",
    excerpt:
      "Explore the most up-to-date IT job-guaranteed courses, eligibility, career outcomes, and how to choose the right program in 2025.",
    publishedAt: new Date("2025-08-18"),
    coverImage: null,
  },
  {
    id: "default-5",
    slug: "it-job-guaranteed-courses-complete-guide-2025-5",
    title: "IT Job-Guaranteed Courses: The Complete Guide (2025)",
    excerpt:
      "Explore the most up-to-date IT job-guaranteed courses, eligibility, career outcomes, and how to choose the right program in 2025.",
    publishedAt: new Date("2025-08-18"),
    coverImage: null,
  },
  {
    id: "default-6",
    slug: "it-job-guaranteed-courses-complete-guide-2025-6",
    title: "IT Job-Guaranteed Courses: The Complete Guide (2025)",
    excerpt:
      "Explore the most up-to-date IT job-guaranteed courses, eligibility, career outcomes, and how to choose the right program in 2025.",
    publishedAt: new Date("2025-08-18"),
    coverImage: null,
  },
];

const fallbackImages = [
  "/blog/blog-1.jpg",
  "/blog/blog-2.jpg",
  "/blog/blog-3.jpg",
  "/blog/blog-4.jpg",
  "/blog/blog-5.jpg",
  "/blog/blog-6.jpg",
];

export default function BlogPage() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
  });

  const displayPosts: BlogPostLike[] = posts && posts.length > 0 ? posts : defaultPosts;

  return (
    <SiteLayout hideCTA>
      <div className="mx-auto w-full max-w-[1300px] px-4 md:px-6 pt-10 md:pt-12 pb-16 md:pb-24">
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
          <div className="bg-[#CCCCFF] px-6 sm:px-10 lg:px-12 py-12 sm:py-14 lg:py-16 flex flex-col justify-center">
            <div className="max-w-[620px]">
              <h1 className="font-serif font-light text-[#000] text-[44px] leading-[1.15] tracking-[-1.5px] sm:text-[56px] sm:leading-[1.15] lg:text-[68px] lg:leading-[86px]">
                Inside the Startup Ecosystem
              </h1>
              <p className="mt-6 text-[#000] text-[18px] sm:text-[20px] lg:text-[21px] leading-[1.44] tracking-[-0.1px]">
                Deep dives into startup building, leadership, and market realities.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/plans"
                  className="inline-flex items-center justify-center rounded-full bg-[#17646E] px-9 py-4 text-[#FFFBF8] text-[18px] leading-[23px] tracking-[-0.09px] hover:opacity-95 transition-opacity"
                >
                  Apply Now
                </Link>
                <Link
                  href="/program"
                  className="inline-flex items-center justify-center rounded-full border border-[#17646E] px-9 py-4 text-[#17646E] text-[18px] leading-[23px] tracking-[-0.09px] hover:bg-[#17646E] hover:text-[#FFFBF8] transition-colors"
                >
                  Explore Programs
                </Link>
              </div>
            </div>
          </div>

          <div className="min-h-[360px] lg:min-h-[600px]">
            <img
              src="/blog/hero.jpg"
              alt="StartupUniv blog hero"
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        </section>

        {/* Blog grid */}
        <section className="mt-16 md:mt-24">
          <h2 className="font-serif font-light text-[#12333A] text-[34px] sm:text-[40px] md:text-[48px] leading-[1.4] tracking-[-0.2px] uppercase">
            The StartupUniv Blog
          </h2>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(isLoading ? defaultPosts : displayPosts).slice(0, 6).map((post, idx) => {
              const imageUrl = post.coverImage || fallbackImages[idx % fallbackImages.length];
              const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null;

              return (
                <article key={post.id} className="overflow-hidden">
                  <div className="h-[277px] w-full bg-[#EFE9E6]">
                    <img
                      src={imageUrl}
                      alt={post.title}
                      className="h-full w-full object-cover"
                      loading="eager"
                    />
                  </div>

                  <div className="bg-[#F6F1E9] px-6 py-8 h-[319px] flex flex-col">
                    <div className="flex-1">
                      <h3 className="font-serif font-light text-[#12333A] text-[28px] leading-[1.2] tracking-[-0.6px]">
                        {post.title}
                      </h3>
                      <div className="mt-2 font-serif font-light text-[#12333A] text-[18px] leading-[30px] tracking-[-0.6px]">
                        {publishedAt ? `Date • ${format(publishedAt, "MMMM d, yyyy")}` : ""}
                      </div>
                      <p className="mt-4 text-[#2B2B2B] text-[14px] sm:text-[16px] leading-[1.4]">
                        {post.excerpt || ""}
                      </p>
                    </div>

                    <div className="mt-6">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center justify-center rounded-full bg-[#17646E] px-9 py-2 text-[#F6F1E9] text-[18px] leading-[23px] tracking-[-0.09px] hover:opacity-95 transition-opacity"
                      >
                        Read More
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
