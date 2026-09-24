import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLANS_PAGE_ENABLED } from "@/lib/plans-flags";

export function SiteHeader() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plansDropdownOpen, setPlansDropdownOpen] = useState(false);
  const plansDropdownRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!plansDropdownOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!plansDropdownRef.current?.contains(target)) {
        setPlansDropdownOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPlansDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [plansDropdownOpen]);

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/";
    }
    return location.startsWith(path);
  };

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/sandbox", label: "Sandbox" },
    { href: "/program", label: "Programs" },
    { href: "/careers", label: "Careers" },
    { href: "/plans", label: "Plans", hasDropdown: true },
    { href: "/contact", label: "Contact Us" },
  ];

  const openPlansDropdown = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setPlansDropdownOpen(true);
  };

  const scheduleClosePlansDropdown = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setPlansDropdownOpen(false);
    }, 120);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="StartupUniv" className="h-6 md:h-7 w-auto" />
          </Link>

          {/* Desktop Navigation - right aligned */}
          <div className="hidden lg:flex items-center gap-8 ml-auto">
            <nav className="flex items-center gap-8">
              {navItems.map((item, index) => (
                <div key={item.label + index} className="relative">
                  {item.hasDropdown ? (
                    <div
                      ref={plansDropdownRef}
                      className="relative"
                      onMouseEnter={openPlansDropdown}
                      onMouseLeave={scheduleClosePlansDropdown}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setPlansDropdownOpen(false)}
                        className={cn(
                          "flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer",
                          isActive(item.href)
                            ? "text-[#17646E] border-b-2 border-[#17646E] pb-1"
                            : "text-[#12333A] hover:text-[#17646E]"
                        )}
                        aria-haspopup="menu"
                        aria-expanded={plansDropdownOpen}
                      >
                        {item.label}
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform",
                            plansDropdownOpen ? "rotate-180" : "rotate-0"
                          )}
                        />
                      </Link>
                      {plansDropdownOpen && (
                        <div className="absolute top-full left-0 z-50 pt-2" role="menu" aria-label="Plans menu">
                          <div className="w-[300px] bg-white border border-[#A7A7A7] shadow-lg">
                            {PLANS_PAGE_ENABLED ? (
                              <Link
                                href="/plans/founder"
                                onClick={() => setPlansDropdownOpen(false)}
                                className={cn(
                                  "flex h-[66px] items-center p-4 border-b border-[#A7A7A7]",
                                  "font-['Almarai',sans-serif] text-[16px] leading-[23px] tracking-[-0.08px]",
                                  "text-[#12333A] bg-white",
                                  "hover:bg-[#17646E] hover:text-white",
                                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17646E]/40 focus-visible:ring-inset"
                                )}
                                role="menuitem"
                              >
                                Founder
                              </Link>
                            ) : (
                              <span
                                className={cn(
                                  "flex h-[66px] items-center justify-between p-4 border-b border-[#A7A7A7]",
                                  "font-['Almarai',sans-serif] text-[16px] leading-[23px] tracking-[-0.08px]",
                                  "text-[#A7A7A7] bg-white cursor-not-allowed select-none"
                                )}
                                aria-disabled="true"
                                role="menuitem"
                              >
                                Founder
                                <span className="text-xs font-normal">Coming soon</span>
                              </span>
                            )}
                            {PLANS_PAGE_ENABLED ? (
                              <Link
                                href="/plans/cofounder"
                                onClick={() => setPlansDropdownOpen(false)}
                                className={cn(
                                  "flex h-[66px] items-center p-4 border-b border-[#A7A7A7]",
                                  "font-['Almarai',sans-serif] text-[16px] leading-[23px] tracking-[-0.08px]",
                                  "text-[#12333A] bg-white",
                                  "hover:bg-[#17646E] hover:text-white",
                                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17646E]/40 focus-visible:ring-inset"
                                )}
                                role="menuitem"
                              >
                                Co-Founder
                              </Link>
                            ) : (
                              <span
                                className={cn(
                                  "flex h-[66px] items-center justify-between p-4 border-b border-[#A7A7A7]",
                                  "font-['Almarai',sans-serif] text-[16px] leading-[23px] tracking-[-0.08px]",
                                  "text-[#A7A7A7] bg-white cursor-not-allowed select-none"
                                )}
                                aria-disabled="true"
                                role="menuitem"
                              >
                                Co-Founder
                                <span className="text-xs font-normal">Coming soon</span>
                              </span>
                            )}
                            {/* <Link
                              href="/plans/intern"
                              onClick={() => setPlansDropdownOpen(false)}
                              className={cn(
                                "flex h-[66px] items-center p-4",
                                "font-['Almarai',sans-serif] text-[16px] leading-[23px] tracking-[-0.08px]",
                                "text-[#12333A] bg-white",
                                "hover:bg-[#17646E] hover:text-white",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17646E]/40 focus-visible:ring-inset"
                              )}
                              role="menuitem"
                            >
                              Intern
                            </Link> */}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link href={item.href}>
                      <span
                        className={cn(
                          "text-sm font-medium transition-colors cursor-pointer",
                          isActive(item.href)
                            ? "text-[#17646E] border-b-2 border-[#17646E] pb-1"
                            : "text-[#12333A] hover:text-[#17646E]"
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  )}
                </div>
              ))}
            </nav>
            <Link href="/login">
              <Button className="bg-[#12333A] hover:bg-[#1B4752] text-white px-6 py-2 rounded-md text-sm font-medium">
                Login
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-800">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] bg-white p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SheetDescription className="sr-only">Navigation Menu</SheetDescription>
                
                  <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center">
                      <img src="/logo.png" alt="StartupUniv" className="h-6 w-auto" />
                    </Link>
                  </div>

                  <div className="flex-1 overflow-y-auto py-6 px-4">
                    <div className="flex flex-col gap-4">
                      {navItems.map((item, index) => (
                        <Link key={item.label + index} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                          <span
                            className={cn(
                              "block py-2 text-base font-medium transition-colors",
                              isActive(item.href) ? "text-[#12333A]" : "text-gray-700"
                            )}
                          >
                            {item.label}
                          </span>
                        </Link>
                      ))}
                      <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                        <Button className="w-full bg-[#12333A] hover:bg-[#1B4752] text-white mt-4">
                          Login
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

