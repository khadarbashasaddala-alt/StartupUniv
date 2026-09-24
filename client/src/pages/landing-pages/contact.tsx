import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/layout/site-layout";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Phone,
  Send,
  Mail,
  MapPin,
} from "lucide-react";

const HERO_IMAGE_SRC = "/contact/chat-hero.jpg";

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
    <SiteLayout>
      {/* Page Body (Navbar/Footer are from SiteLayout) */}
      <div className="bg-[#FFFBF8]">
        {/* Hero */}
        <section className="py-10 md:py-14">
          <div className="container mx-auto">
            <div className="mx-auto max-w-[1300px]">
              <div className="grid lg:grid-cols-2 overflow-hidden bg-white">
                <div className="bg-[#B3D4F2] px-6 py-12 md:px-10 md:py-16 flex items-center">
                  <div className="max-w-xl">
                    <h1 className="font-serif font-normal text-[#12333A] text-4xl md:text-6xl leading-tight tracking-[-0.04em]" data-testid="heading-contact">
                      Let&apos;s Start Your Entrepreneurship Journey
                    </h1>
                    <p className="mt-6 text-[#12333A] text-base md:text-lg leading-relaxed max-w-lg">
                      Have questions? Ready to build? We&apos;re here to help you take the first step.
                    </p>
                    <div className="mt-8">
                      <a href="#reach-out">
                        <Button
                          size="lg"
                          className="bg-[#17646E] hover:bg-[#17646E]/90 text-[#FFFBF8] rounded-full px-9 py-6 text-base"
                        >
                          Talk to Our Team
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="relative min-h-[320px] md:min-h-[480px] lg:min-h-[600px]">
                  <img
                    src={HERO_IMAGE_SRC}
                    alt="Support team"
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Info Tiles */}
        <section className="pb-10 md:pb-14">
          <div className="container mx-auto">
            <div className="mx-auto max-w-[1300px] grid gap-6 md:grid-cols-3">
              <div className="bg-[#E8F4FF] p-6">
                <div className="border-b border-black py-2 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-black" />
                  <h2 className="font-serif text-black text-lg">Visit Us</h2>
                </div>
                <div className="mt-5 text-[#12333A] text-sm leading-relaxed">
                  <p>
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=30,+12th+Main+Rd,+1st+Stage,+Rajajinagar,+Bengaluru,+Karnataka+560010"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      30, 12th Main Rd, 1st Stage, Rajajinagar,<br />
                      Bengaluru, Karnataka 560010
                    </a>
                  </p>
                  <p className="mt-3">
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=Rooman+Technologies,+Electronic+City+Phase+I,+Electronic+City,+Bengaluru,+Karnataka+560100"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      Rooman Technologies, Electronic City Phase I, Electronic City,<br />
                      Bengaluru, Karnataka 560100
                    </a>
                  </p>
                  <p className="mt-3">Monday - Saturday: 10:00 AM - 6:00 PM IST</p>
                </div>
              </div>

              <div className="bg-[#F6F1E9] p-6">
                <div className="border-b border-black py-2 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-black" />
                  <h2 className="font-serif text-black text-lg">Email Us</h2>
                </div>
                <div className="mt-5 text-[#12333A] text-sm leading-relaxed">
                  <p>General inquiries</p>
                  <a
                    href="mailto:info@startupvarsity.com"
                    className="underline underline-offset-4"
                    data-testid="link-email-general"
                  >
                    info@startupvarsity.com
                  </a>
                </div>
              </div>

              <div className="bg-[#F6F1E9] p-6">
                <div className="border-b border-black py-2 flex items-center gap-2">
                  <Phone className="h-5 w-5 text-black" />
                  <h2 className="font-serif text-black text-lg">Call Us</h2>
                </div>
                <div className="mt-5 text-[#12333A] text-sm leading-relaxed">
                  <p>Mon-Fri 10am-6pm IST</p>
                  <a
                    href="tel:+918045888899"
                    className="underline underline-offset-4"
                    data-testid="link-phone"
                  >
                    +91 80 4588 8899
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Reach Out Form */}
        <section className="pb-14 md:pb-20" id="reach-out">
          <div className="container mx-auto">
            <div className="mx-auto max-w-[1300px] overflow-hidden bg-white">
              <div className="grid">
                <div className="bg-[#FFDAA0] px-6 py-12 md:px-12 md:py-16">
                  <div className="max-w-3xl">
                    <h2 className="font-serif text-[#12333A] text-fluid-h1 tracking-[-0.04em]">
                      Reach Out To Us
                    </h2>
                    <p className="mt-4 text-[#12333A] text-base md:text-lg leading-relaxed">
                      Fill out the form below and we&apos;ll get back to you within 24-48 hours.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-10 space-y-8" aria-label="Contact form">
                    <div className="grid gap-8 md:grid-cols-2">
                      <div>
                        <label htmlFor="name" className="sr-only">Full name</label>
                        <input
                          id="name"
                          name="name"
                          placeholder="Fullname"
                          required
                          className="w-full bg-transparent border-0 border-b border-[#A7A7A7] px-0 py-3 text-[#12333A] placeholder:text-[#606060] focus:outline-none focus:border-[#12333A]"
                          data-testid="input-contact-name"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="sr-only">Email</label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="Email"
                          required
                          className="w-full bg-transparent border-0 border-b border-[#A7A7A7] px-0 py-3 text-[#12333A] placeholder:text-[#606060] focus:outline-none focus:border-[#12333A]"
                          data-testid="input-contact-email"
                        />
                      </div>
                    </div>

                    <div className="grid gap-8 md:grid-cols-2">
                      <div>
                        <label htmlFor="phone" className="sr-only">Phone</label>
                        <input
                          id="phone"
                          name="phone"
                          placeholder="Phone"
                          className="w-full bg-transparent border-0 border-b border-[#A7A7A7] px-0 py-3 text-[#12333A] placeholder:text-[#606060] focus:outline-none focus:border-[#12333A]"
                          data-testid="input-contact-phone"
                        />
                      </div>
                      <div>
                        <label htmlFor="subject" className="sr-only">Subject</label>
                        <input
                          id="subject"
                          name="subject"
                          placeholder="Subject"
                          required
                          className="w-full bg-transparent border-0 border-b border-[#A7A7A7] px-0 py-3 text-[#12333A] placeholder:text-[#606060] focus:outline-none focus:border-[#12333A]"
                          data-testid="input-contact-subject"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="sr-only">Message</label>
                      <textarea
                        id="message"
                        name="message"
                        placeholder="Message"
                        required
                        rows={3}
                        className="w-full resize-none bg-transparent border-0 border-b border-[#A7A7A7] px-0 py-3 text-[#12333A] placeholder:text-[#606060] focus:outline-none focus:border-[#12333A]"
                        data-testid="textarea-contact-message"
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        size="lg"
                        className="bg-[#17646E] hover:bg-[#17646E]/90 text-[#FFFBF8] rounded-full px-10 py-6 w-full md:w-auto"
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
                            Send Message
                            <Send className="h-4 w-4" />
                          </span>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
