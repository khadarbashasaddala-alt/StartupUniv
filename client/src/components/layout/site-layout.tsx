import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { cn } from "@/lib/utils";

interface SiteLayoutProps {
  children: React.ReactNode;
  hideCTA?: boolean;
  className?: string;
  mainClassName?: string;
}

export function SiteLayout({ children, hideCTA = false, className, mainClassName }: SiteLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col bg-gradient-to-b from-[#FAF7F3] via-[#FEFBF8] to-[#F5E6D3] w-full max-w-full",
        className
      )}
    >
      <SiteHeader />
      <main
        className={cn(
          "flex-1 bg-gradient-to-b from-[#FAF7F3] via-[#FEFBF8] to-[#F5E6D3] overflow-x-hidden w-full max-w-full",
          mainClassName
        )}
      >
        {children}
      </main>
      <SiteFooter hideCTA={hideCTA} />
    </div>
  );
}
