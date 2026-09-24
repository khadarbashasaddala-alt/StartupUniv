import { SiteLayout } from "@/components/layout/site-layout";
import AboutUsSection from "@/components/ui/about-us-section";

export default function AboutPage() {
  return (
    /* One flat brown ground for the whole page, exactly as the home page does,
       so the header, every section and the closing card read as one surface. */
    <SiteLayout hideCTA headerTheme="dark" surfaceClassName="bg-[#814B28]">
      <AboutUsSection />
    </SiteLayout>
  );
}
