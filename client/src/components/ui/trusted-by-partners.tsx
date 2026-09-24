"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const partners = [
  { name: "Red Hat", logo: null, customLogo: true },
  { name: "NSDC", logo: "/landing/home/partner-nsdc.png" },
  { name: "NASSCOM", logo: null, customLogo: true },
  { name: "VTU", logo: "/landing/home/partner-vtu.png" },
  { name: "AWS", logo: null, customLogo: true },
  { name: "JAIN", logo: null, customLogo: true },
  { name: "IBM", logo: null, customLogo: true },
  { name: "Cisco", logo: null, customLogo: true },
];

const AWSLogo = () => (
  <div className="w-[100px] h-16 flex items-center justify-center">
    <img src="/landing/home/partner-aws.png" alt="AWS" className="h-10 w-auto object-contain" loading="eager" decoding="async" />
  </div>
);

const IBMLogo = () => (
  <div className="w-[100px] h-16 flex items-center justify-center">
    <img src="/landing/home/partner-ibm.png" alt="IBM" className="h-10 w-auto object-contain" loading="eager" decoding="async" />
  </div>
);

const RedHatLogo = () => (
  <div className="w-[140px] h-20 flex items-center justify-center">
    <img src="/landing/home/partner-redhat.svg" alt="Red Hat" className="h-14 w-auto object-contain" loading="eager" decoding="async" />
  </div>
);

const NASSCOMLogo = () => (
  <div className="w-[100px] h-16 flex items-center justify-center">
    <img src="/landing/home/partner-nasscom.png" alt="NASSCOM" className="h-10 w-auto object-contain" loading="eager" decoding="async" />
  </div>
);

const JAINLogo = () => (
  <div className="w-[100px] h-16 flex items-center justify-center">
    <img src="/landing/home/partner-jain.png" alt="JAIN" className="h-10 w-auto object-contain" loading="eager" decoding="async" />
  </div>
);

const CiscoLogo = () => (
  <div className="w-[100px] h-16 flex items-center justify-center">
    <img src="/landing/home/partner-cisco.png" alt="Cisco" className="h-10 w-auto object-contain" loading="eager" decoding="async" />
  </div>
);

export function TrustedByPartnersSection() {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (name: string) => {
    setImageErrors((prev) => ({ ...prev, [name]: true }));
  };

  return (
    <section className="bg-[#FAF7F3] py-16 md:py-20 overflow-hidden">
      <div className="container mx-auto">
        <h2 className="text-fluid-h2 font-serif text-center text-gray-900 mb-12">
          Trusted by Industry Leaders
        </h2>
      </div>

      <div className="relative w-full overflow-hidden">
        <motion.div
          className="flex items-center gap-16 md:gap-24"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            x: { repeat: Infinity, repeatType: "loop", duration: 60, ease: "linear" },
          }}
          style={{ width: "fit-content" }}
        >
          {[...partners, ...partners, ...partners, ...partners].map((partner, index) => (
            <div key={index} className="flex flex-col items-center flex-shrink-0 min-w-[120px]">
              {partner.customLogo && partner.name === "Red Hat" ? (
                <RedHatLogo />
              ) : partner.customLogo && partner.name === "AWS" ? (
                <AWSLogo />
              ) : partner.customLogo && partner.name === "IBM" ? (
                <IBMLogo />
              ) : partner.customLogo && partner.name === "NASSCOM" ? (
                <NASSCOMLogo />
              ) : partner.customLogo && partner.name === "JAIN" ? (
                <JAINLogo />
              ) : partner.customLogo && partner.name === "Cisco" ? (
                <CiscoLogo />
              ) : partner.logo && !imageErrors[partner.name] ? (
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="h-20 md:h-24 w-auto object-contain"
                  loading="eager"
                  decoding="async"
                  onError={() => handleImageError(partner.name)}
                />
              ) : (
                <div className="h-20 w-24 flex items-center justify-center bg-[#12333A] text-white font-bold rounded text-lg">
                  {partner.name.substring(0, 4)}
                </div>
              )}
              <p className="text-sm text-gray-600 mt-3 uppercase tracking-wide font-medium">{partner.name}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
