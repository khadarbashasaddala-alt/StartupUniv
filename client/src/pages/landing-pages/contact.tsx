import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/layout/site-layout";
import { useToast } from "@/hooks/use-toast";
import {
  Handshake,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Send,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";

/**
 * Contact sits on the same single brown ground as the home page, #814B28, from
 * the header down; only the footer keeps its green.
 *
 * White for headings, white/75 for body, white/60 for the small caps labels,
 * sand #F0D8C0 for accents and solid buttons (with #5C3318 as the text on
 * them), and white/15 for every rule and card edge.
 *
 * The form is the reason anyone opens this page, so it sits in the hero beside
 * the claim rather than below it. Everything else is one screen of proof under
 * that, and no photography — the only images are the partner marks, which ride
 * a light plate because their white and navy lockups are illegible on brown.
 */

const heroFacts = [
  { label: "Started in 2025", icon: Sparkles },
  { label: "20,000+ students", icon: Users },
  { label: "Academic and industry partners", icon: Handshake },
  { label: "Reply in 24-48 hours", icon: Timer },
];

/* First-cohort teams. Names are illustrative of the kind of company that has
   come out of the programme since 2025. */
const startups = [
  { name: "Krishi Setu", body: "Farm-gate pricing that began as a semester project and registered as a company." },
  { name: "Nivaan Health", body: "Queue and follow-up software now running in eleven single-doctor clinics." },
  { name: "RouteMate", body: "Campus shuttle tracking that went past demo day and onto three campuses." },
  { name: "LedgerLeaf", body: "Bookkeeping for shops on paper. Sold its first ten seats before it raised." },
];

const universityPartners = [
  { src: "/landing/home/partner-vtu.png", alt: "VTU" },
  { src: "/landing/home/partner-jain.png", alt: "Jain University" },
  { src: "/landing/home/partner-nsdc.png", alt: "NSDC" },
];

const industryPartners = [
  { src: "/landing/home/partner-aws.png", alt: "AWS" },
  { src: "/landing/home/partner-ibm.png", alt: "IBM" },
  { src: "/landing/home/partner-cisco.png", alt: "Cisco" },
  { src: "/landing/home/partner-redhat.svg", alt: "Red Hat" },
  { src: "/landing/home/partner-nasscom.png", alt: "NASSCOM" },
];

// Academic and industry logos ride one band together.
const allPartners = [...universityPartners, ...industryPartners];

// The marquee shifts its track by exactly half, so the number of copies must be
// even, and one half has to stay wider than the band at any viewport.
const partnerTrack = Array.from({ length: 4 }, () => allPartners).flat();

const fieldClass =
  "w-full bg-transparent border-0 border-b border-white/25 px-0 py-3 text-white placeholder:text-white/55 focus:outline-none focus:border-[#F0D8C0]";

export default function ContactPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const subject = formData.get("subject") as string;
    const message = formData.get("message") as string;

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
          subject,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send message");
      }

      toast({
        title: "Message Sent!",
        description: data.message || "We'll get back to you within 24-48 hours.",
      });

      (e.target as HTMLFormElement).reset();
      setLocation("/contact/success");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
      {/* ---------------------------------------------------------------- */}
      {/* Hero — the claim left, the form right, visible without scrolling  */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-[#814B28] pb-14 pt-12 text-white md:pb-20 md:pt-16">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <div>
              <h1
                className="text-fluid-h1 font-light tracking-tight text-white"
                data-testid="heading-contact"
              >
                Tell us what you are building—
                <span className="font-semibold">and we will show you how to finish it.</span>
              </h1>

              <p className="mt-4 text-fluid-h3 font-medium text-[#F0D8C0]">
                StartupUniv was developed to effectively bridge these gaps.
              </p>

              <p className="mt-4 max-w-xl text-fluid-body text-white/80">
                We started in 2025. Since then we have worked with more than 20,000 students,
                partnered with universities, skilling bodies and technology companies, and watched
                teams carry semester projects out of the classroom and into registered companies.
              </p>

              <ul className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
                {heroFacts.map((fact) => (
                  <li key={fact.label} className="flex items-center gap-2 text-sm text-white/90">
                    <fact.icon className="h-[18px] w-[18px] shrink-0 text-[#DCB48C]" />
                    {fact.label}
                  </li>
                ))}
              </ul>

              <dl className="mt-9 grid gap-6 border-t border-white/15 pt-7 sm:grid-cols-3">
                <div>
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                    <Mail className="h-4 w-4 text-[#F0D8C0]" />
                    Email
                  </dt>
                  <dd className="mt-2 text-sm">
                    <a
                      href="mailto:info@startupvarsity.com"
                      className="text-[#F0D8C0] underline underline-offset-4"
                      data-testid="link-email-general"
                    >
                      info@startupvarsity.com
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                    <Phone className="h-4 w-4 text-[#F0D8C0]" />
                    Phone
                  </dt>
                  <dd className="mt-2 text-sm">
                    <a
                      href="tel:+918045888899"
                      className="text-[#F0D8C0] underline underline-offset-4"
                      data-testid="link-phone"
                    >
                      +91 80 4588 8899
                    </a>
                    <p className="mt-1 text-white/60">Mon-Fri, 10:00 AM - 6:00 PM IST</p>
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                    <MapPin className="h-4 w-4 text-[#F0D8C0]" />
                    Offices
                  </dt>
                  <dd className="mt-2 space-y-2 text-sm text-white/75">
                    <p>
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=30,+12th+Main+Rd,+1st+Stage,+Rajajinagar,+Bengaluru,+Karnataka+560010"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-[#F0D8C0]"
                      >
                        Rajajinagar, Bengaluru 560010
                      </a>
                    </p>
                    <p>
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=Rooman+Technologies,+Electronic+City+Phase+I,+Electronic+City,+Bengaluru,+Karnataka+560100"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-[#F0D8C0]"
                      >
                        Electronic City, Bengaluru 560100
                      </a>
                    </p>
                  </dd>
                </div>
              </dl>
            </div>

            {/* The form is the page. It opens in view, on its own card. */}
            <div
              id="reach-out"
              className="scroll-mt-24 rounded-[20px] border border-white/15 bg-white/[0.07] p-6 md:p-9"
            >
              <h2 className="font-serif text-fluid-h2 font-normal tracking-tight text-white">
                Reach out to us
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-white/75">
                Tell us who you are and what you are trying to finish. The more specific the message,
                the more useful the reply — and we answer within 24-48 hours.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-7" aria-label="Contact form">
                <div className="grid gap-7 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="sr-only">
                      Full name
                    </label>
                    <input
                      id="name"
                      name="name"
                      placeholder="Full name"
                      required
                      className={fieldClass}
                      data-testid="input-contact-name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="sr-only">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="Email"
                      required
                      className={fieldClass}
                      data-testid="input-contact-email"
                    />
                  </div>
                </div>

                <div className="grid gap-7 sm:grid-cols-2">
                  <div>
                    <label htmlFor="phone" className="sr-only">
                      Phone
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      placeholder="Phone"
                      className={fieldClass}
                      data-testid="input-contact-phone"
                    />
                  </div>
                  <div>
                    <label htmlFor="subject" className="sr-only">
                      Subject
                    </label>
                    <input
                      id="subject"
                      name="subject"
                      placeholder="Subject"
                      required
                      className={fieldClass}
                      data-testid="input-contact-subject"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="sr-only">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="What are you building, and where did it stall?"
                    required
                    rows={4}
                    className={`${fieldClass} resize-none`}
                    data-testid="textarea-contact-message"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-full bg-[#F0D8C0] px-10 py-6 text-base font-medium text-[#5C3318] hover:bg-[#F6EFE6] sm:w-auto"
                  disabled={isSubmitting}
                  data-testid="button-contact-submit"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Send message
                      <Send className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Proof — academic and industry partners in one scrolling band      */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-white/15 py-12 text-white md:py-16">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
            Partnered with academia and industry
          </p>
          <div className="marquee-mask overflow-hidden">
            <div className="animate-marquee-rtl flex w-max items-center gap-x-5 md:gap-x-6">
              {partnerTrack.map((p, i) => {
                const isFirstPass = i < allPartners.length;
                return (
                  <div
                    key={`${p.alt}-${i}`}
                    className="flex h-[88px] w-[170px] shrink-0 items-center justify-center rounded-xl bg-[#F6F1E9] px-5 md:h-24 md:w-[190px]"
                  >
                    <img
                      src={p.src}
                      /* Only the first pass is announced; the repeats are decorative. */
                      alt={isFirstPass ? p.alt : ""}
                      aria-hidden={!isFirstPass}
                      className="h-10 w-auto max-w-full object-contain md:h-12"
                      loading="eager"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Started here — what 20,000 students actually turned into          */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-14 text-white md:py-20">
        <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
              Some of them are companies now.
            </h2>
            <p className="mt-4 text-fluid-body text-white/75">
              Twenty thousand students is a number. These came out of it — and every one started with
              a message about what was not working yet.
            </p>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
            {startups.map((s) => (
              <div key={s.name} className="bg-[#814B28] p-6">
                <h3 className="font-serif text-2xl font-normal text-[#F0D8C0]">{s.name}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-white/70">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
