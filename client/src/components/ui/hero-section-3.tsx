import React from "react";
import { Link } from "wouter";
import { Search, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
}

interface HeroSectionProps {
  backgroundImage: string;
  logoText?: string;
  navLinks?: NavLink[];
  versionText?: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  className?: string;
}

export default function HeroSection({
  backgroundImage,
  logoText = "Brand",
  navLinks = [],
  versionText = "",
  title = "",
  subtitle = "",
  ctaText = "Click",
  className,
}: HeroSectionProps) {
  return (
    <>
      <header className="absolute inset-x-0 top-0 p-6 md:p-8 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="text-3xl font-bold text-white">{logoText}</div>
          <nav className="hidden md:flex space-x-8 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white hover:text-gray-300 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center space-x-4">
            <button
              type="button"
              aria-label="Search"
              className="text-white hover:text-gray-300 transition-colors"
            >
              <Search className="h-6 w-6" />
            </button>
            <button className="border border-white rounded-full px-6 py-2 text-sm font-medium text-white hover:bg-white hover:text-black transition-colors">
              Join
            </button>
          </div>
        </div>
      </header>
      <main
        className={cn(
          "w-full bg-cover bg-center bg-no-repeat",
          className
        )}
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <div className="container mx-auto h-screen flex items-center px-6 md:px-8">
          <div className="w-full md:w-1/2 lg:w-2/5">
            <h1 className="text-fluid-hero font-bold mb-4 text-white">
              {title}
            </h1>
            <p className="text-md text-gray-300 max-w-md mb-8">{subtitle}</p>
            <button className="bg-white text-black font-bold px-8 py-3 rounded-md hover:bg-gray-200 transition-colors">
              {ctaText}
            </button>
          </div>
        </div>
      </main>
      <footer className="absolute inset-x-0 bottom-0 p-6 md:p-8">
        <div className="container mx-auto flex justify-between items-center">
          <div className="text-sm text-white">{versionText}</div>
          <button
            type="button"
            aria-label="Chat"
            className="bg-white/10 backdrop-blur-sm rounded-full h-12 w-12 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <MessageCircle className="h-6 w-6 text-white" />
          </button>
        </div>
      </footer>
    </>
  );
}

