import { Link } from "wouter";
import { Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

// Instagram Icon
const InstagramIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" rx="5" stroke="white" strokeWidth="2"/>
    <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="2"/>
    <circle cx="18" cy="6" r="1.5" fill="white"/>
  </svg>
);

// Facebook Icon
const FacebookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 2H15C13.6739 2 12.4021 2.52678 11.4645 3.46447C10.5268 4.40215 10 5.67392 10 7V10H7V14H10V22H14V14H17L18 10H14V7C14 6.73478 14.1054 6.48043 14.2929 6.29289C14.4804 6.10536 14.7348 6 15 6H18V2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// LinkedIn Icon
const LinkedInIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 8C17.5913 8 19.1174 8.63214 20.2426 9.75736C21.3679 10.8826 22 12.4087 22 14V21H18V14C18 13.4696 17.7893 12.9609 17.4142 12.5858C17.0391 12.2107 16.5304 12 16 12C15.4696 12 14.9609 12.2107 14.5858 12.5858C14.2107 12.9609 14 13.4696 14 14V21H10V14C10 12.4087 10.6321 10.8826 11.7574 9.75736C12.8826 8.63214 14.4087 8 16 8Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="2" y="9" width="4" height="12" stroke="white" strokeWidth="2"/>
    <circle cx="4" cy="4" r="2" stroke="white" strokeWidth="2"/>
  </svg>
);

// WhatsApp Icon
const WhatsAppIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="white"/>
    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Geometric Pattern Component for CTA section - matches Figma design
const GeometricPattern = () => {
  const blue = "#479BB1";
  const orange = "#F79467";
  const yellow = "#FFE29B";
  const tileWidth = 180;
  
  const PatternTile = ({ x }: { x: number }) => (
    <g>
      {/* Base orange background for the tile */}
      <rect x={x} y={0} width={tileWidth} height={200} fill={orange} />
      
      {/* Yellow section top-left with dots */}
      <rect x={x} y={0} width={60} height={80} fill={yellow} />
      {/* Blue dots grid on yellow */}
      {[...Array(6)].map((_, row) =>
        [...Array(5)].map((_, col) => (
          <circle
            key={`dot-${row}-${col}`}
            cx={x + 6 + col * 10}
            cy={6 + row * 11}
            r="2"
            fill={blue}
          />
        ))
      )}
      
      {/* Blue curved ribbon - S-curve shape */}
      <path 
        d={`M ${x + 50} 0 
            C ${x + 75} 0, ${x + 95} 25, ${x + 95} 55
            C ${x + 95} 85, ${x + 75} 105, ${x + 75} 135
            C ${x + 75} 165, ${x + 85} 185, ${x + 85} 200
            L ${x + 110} 200
            C ${x + 110} 185, ${x + 100} 165, ${x + 100} 135
            C ${x + 100} 105, ${x + 120} 85, ${x + 120} 55
            C ${x + 120} 25, ${x + 100} 0, ${x + 75} 0
            Z`}
        fill={blue}
      />
      
      {/* Yellow section bottom-right with concentric arcs */}
      <rect x={x + 110} y={100} width={70} height={100} fill={yellow} />
      
      {/* Concentric arcs (orange lines on yellow) from bottom-left corner */}
      {[10, 22, 34, 46, 58].map((r, i) => (
        <path
          key={`arc-${i}`}
          d={`M ${x + 110} ${200 - r} A ${r} ${r} 0 0 0 ${x + 110 + r} 200`}
          stroke={orange}
          strokeWidth="2"
          fill="none"
        />
      ))}
      
      {/* Blue dots on the yellow concentric arc section */}
      {[...Array(4)].map((_, row) =>
        [...Array(4)].map((_, col) => (
          <circle
            key={`dot2-${row}-${col}`}
            cx={x + 135 + col * 10}
            cy={108 + row * 10}
            r="2"
            fill={blue}
          />
        ))
      )}
    </g>
  );

  return (
    <svg className="w-full h-full" viewBox="0 0 1440 200" preserveAspectRatio="xMinYMin slice" fill="none" xmlns="http://www.w3.org/2000/svg">
      {[0, 180, 360, 540, 720, 900, 1080, 1260].map((x, i) => (
        <PatternTile key={i} x={x} />
      ))}
    </svg>
  );
};

export function SiteFooter({ hideCTA = true }: { hideCTA?: boolean } = {}) {
  type FooterLink = { label: string; href: string; external?: boolean };

  const quickLinks: FooterLink[] = [
    { label: "Home", href: "/" },
    { label: "About us", href: "/about" },
    { label: "Programs", href: "/program" },
    { label: "Sandbox", href: "/sandbox" },
  ];

  const quickLinksRight: FooterLink[] = [
    { label: "Careers", href: "/careers" },
    { label: "Contact Us", href: "/contact" },
    { label: "FAQ", href: "/faq" },
    { label: "Privacy Policy", href: "/privacy" },
  ];

  return (
    <>
      {!hideCTA && (
        <>
          {/* CTA Section */}
          <section className="bg-[#F5D77E] py-10 md:py-14">
            <div className="container mx-auto text-center">
              <h2 className="text-fluid-h1 font-serif italic text-gray-900 mb-8">
                Ready to Start Your Entrepreneurial Journey?
              </h2>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/plans">
                  <Button className="bg-[#12333A] hover:bg-[#1B4752] text-white px-8 py-6 rounded-full text-lg font-medium">
                    Apply Now
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" className="border-2 border-[#12333A] text-[#12333A] hover:bg-[#12333A] hover:text-white px-8 py-6 rounded-full text-lg font-medium bg-white">
                    Contact Us
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="bg-[#12333A] text-white">
        {/* Social Media Bar */}
        <div className="container mx-auto py-6 border-b border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-white text-sm">Follow us</span>
            <div className="flex items-center gap-4">
              <a href="https://www.instagram.com/startup_varsity/" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                <InstagramIcon />
              </a>
              <a href="https://www.facebook.com/startupvarsity" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                <FacebookIcon />
              </a>
              <a href="https://www.linkedin.com/company/starupvarsity/" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                <LinkedInIcon />
              </a>
              <a href="https://wa.me/919739119739" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                <WhatsAppIcon />
              </a>
            </div>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="container mx-auto py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {/* Contact Info */}
            <div>
              <h3 className="text-fluid-h3 font-serif italic text-white mb-6">
                Let's Get in touch
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-white" />
                  <a href="tel:+918045888899" className="text-white hover:underline">
                    +91 8045888899
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-white" />
                  <a href="mailto:info@startupvarsity.com" className="text-white hover:underline">
                    info@startupvarsity.com
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-white mt-0.5" />
                  <span className="text-white space-y-2 block">
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=30,+12th+Main+Rd,+1st+Stage,+Rajajinagar,+Bengaluru,+Karnataka+560010"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      30, 12th Main Rd, 1st Stage, Rajajinagar,<br />
                      Bengaluru, Karnataka 560010
                    </a>
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=Rooman+Technologies,+Electronic+City+Phase+I,+Electronic+City,+Bengaluru,+Karnataka+560100"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      Rooman Technologies, Electronic City Phase I, Electronic City,<br />
                      Bengaluru, Karnataka 560100
                    </a>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="lg:col-span-2">
              <h3 className="text-xl font-bold text-white mb-6">
                Quick Links:
              </h3>
              <div className="grid grid-cols-2 gap-8">
                <ul className="space-y-3">
                  {quickLinks.map((link) => (
                    <li key={link.href + link.label}>
                      <Link href={link.href}>
                        <span className="text-white hover:underline cursor-pointer">
                          {link.label}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <ul className="space-y-3">
                  {quickLinksRight.map((link) => (
                    <li key={link.href + link.label}>
                      {link.external ? (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-white hover:underline">
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href}>
                          <span className="text-white hover:underline cursor-pointer">
                            {link.label}
                          </span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="container mx-auto py-6 border-t border-white/20">
          <p className="text-white text-sm">
            © 2026 StartupUniv. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
