import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { cn } from "@/lib/utils";

interface SiteLayoutProps {
  children: React.ReactNode;
  hideCTA?: boolean;
  className?: string;
  mainClassName?: string;
  /** Pass "dark" when the page opens on a dark hero. */
  headerTheme?: "light" | "dark";
  /**
   * Replaces the default page ground. Pass one flat colour when a page should
   * read as a single surface — the default gradient ends warmer than it starts,
   * which shows up as banding between sections.
   */
  surfaceClassName?: string;
}

export function SiteLayout({
  children,
  hideCTA = false,
  className,
  mainClassName,
  headerTheme = "light",
  surfaceClassName,
}: SiteLayoutProps) {
  const surface =
    surfaceClassName ?? "bg-gradient-to-b from-[#FAF7F3] via-[#FEFBF8] to-[#F5E6D3]";

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col w-full max-w-full",
        surface,
        className
      )}
    >
      <SiteHeader theme={headerTheme} />
      <main
        className={cn(
          "flex-1 overflow-x-hidden w-full max-w-full",
          surface,
          mainClassName
        )}
      >
        {children}
      </main>
      <SiteFooter hideCTA={hideCTA} />
    </div>
  );
}
