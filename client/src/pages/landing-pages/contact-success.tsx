import { Link } from "wouter";
import { Check } from "lucide-react";

import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";

const SUPPORT_PHONE_DISPLAY = "+91 80 4588 8899";
const SUPPORT_PHONE_TEL = "+918045888899";

export default function ContactSuccessPage() {
  return (
    <SiteLayout>
      <div className="bg-[#FFFBF8]">
        <section className="container mx-auto pt-10 pb-14 md:pt-14 md:pb-20">
          <div className="mx-auto flex min-h-[60vh] max-w-[700px] flex-col items-center justify-center">
            <div className="w-full rounded-xl bg-white shadow-[0px_4px_24px_0px_rgba(0,0,0,0.08)]">
              <div className="flex flex-col items-center px-6 py-12 md:px-12">
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[#CEFFDB]">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#17646E] bg-transparent">
                    <Check className="h-10 w-10 text-[#17646E]" strokeWidth={3} aria-hidden />
                  </div>
                </div>

                <h1 className="mt-10 text-center font-serif text-4xl font-light leading-tight tracking-[-0.04em] text-[#12333A] md:text-[56px]">
                  Thank you for reaching out!
                </h1>

                <p className="mt-6 text-center font-sans text-xl font-bold leading-snug text-[#17646E] md:text-2xl">
                  Your form has been successfully submitted.
                </p>

                <p className="mt-4 text-center font-sans text-base leading-relaxed text-[rgba(44,43,73,0.83)] md:text-xl">
                  Our team will review the details and get back to you shortly.
                </p>

                <div className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link href="/">
                    <Button className="h-[66px] w-full rounded-full bg-[#17646E] px-10 text-[18px] font-normal text-white hover:bg-[#17646E]/90 sm:w-auto">
                      Back to Home
                    </Button>
                  </Link>
                  <Link href="/program">
                    <Button
                      variant="outline"
                      className="h-[66px] w-full rounded-full border-[1.6px] border-[#17646E] px-10 text-[18px] font-normal text-[#17646E] [--button-outline:#17646E] hover:bg-[#17646E]/5 sm:w-auto"
                    >
                      Explore Programs
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-10 text-center text-sm text-[rgba(44,43,73,0.7)] md:text-base">
              Need immediate assistance? Call us at{" "}
              <a className="font-bold text-[#17646E]" href={`tel:${SUPPORT_PHONE_TEL}`}>
                {SUPPORT_PHONE_DISPLAY}
              </a>
            </p>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
