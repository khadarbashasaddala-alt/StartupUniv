import type { LucideIcon } from "lucide-react";
import { CalendarClock, Handshake, Rocket, Users } from "lucide-react";

/**
 * Shared furniture for the four plan pages — Plans, Founder, Co-founder and
 * Learner — so they read as one surface with the home and about pages.
 *
 * Everything sits on one flat brown ground, #814B28. On it: white for
 * headings, white/75 for body, white/60 for the small caps labels, sand
 * #F0D8C0 for accents and solid buttons (with #5C3318 as the text on them),
 * and white/15 for every rule and card edge.
 *
 * The partner logo band is the one thing that stays light on purpose, because
 * those marks ship with their own white and navy lockups and are illegible
 * directly on brown.
 */

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

export function PartnerMarquee({
  label = "Partnered with academia and industry",
}: {
  label?: string;
}) {
  return (
    <section className="border-y border-white/15 py-12 text-white md:py-16">
      <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
          {label}
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
                    loading="lazy"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* The four facts every plan page opens with, so the numbers are identical
   wherever a reader lands. Same set the about page states. */
export const PLAN_FACTS: { label: string; icon: LucideIcon }[] = [
  { label: "Started in 2025", icon: CalendarClock },
  { label: "20,000+ students", icon: Users },
  { label: "40+ startups started", icon: Rocket },
  { label: "9 partner organisations", icon: Handshake },
];

export function HeroFacts({ facts = PLAN_FACTS }: { facts?: { label: string; icon: LucideIcon }[] }) {
  return (
    <ul className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
      {facts.map((fact) => (
        <li key={fact.label} className="flex items-center gap-2 text-sm text-white/90">
          <fact.icon className="h-[18px] w-[18px] shrink-0 text-[#DCB48C]" />
          {fact.label}
        </li>
      ))}
    </ul>
  );
}

export function HeroChips({ chips }: { chips: string[] }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-3">
      {chips.map((chip) => (
        <li
          key={chip}
          className="rounded-full border border-[#DCB48C]/45 px-4 py-2 text-sm text-white/90"
        >
          {chip}
        </li>
      ))}
    </ul>
  );
}

export type Venture = {
  name: string;
  sector: string;
  route: "Founder" | "Co-founder" | "Learner";
  body: string;
};

/* Illustrative examples of what teams have carried out of a cohort. Same six
   the about page names, tagged with the plan their team came in on. */
export const VENTURES: Venture[] = [
  {
    name: "Sproutkart",
    sector: "Agri commerce",
    route: "Founder",
    body: "A farm-to-hostel produce marketplace that started as a third-semester project and now supplies eleven campus kitchens.",
  },
  {
    name: "Tarang Mobility",
    sector: "Electric mobility",
    route: "Founder",
    body: "Retrofit EV kits for campus shuttle fleets, built by a team that took their prototype all the way to a road-legal pilot.",
  },
  {
    name: "Vaanya Health",
    sector: "Digital health",
    route: "Co-founder",
    body: "Teleconsultation tooling for tier-three clinics, validated with real doctors before a single feature was shipped.",
  },
  {
    name: "Kagaz",
    sector: "Compliance",
    route: "Co-founder",
    body: "Paperwork and filing automation for small firms, sold to its first twelve customers during the cohort itself.",
  },
  {
    name: "Studyloop",
    sector: "Education",
    route: "Learner",
    body: "A peer tutoring marketplace that went from an idea on a whiteboard to a running product with paying users.",
  },
  {
    name: "Meshworks",
    sector: "IoT",
    route: "Learner",
    body: "Energy and occupancy monitoring for college buildings, now maintained under a support desk the team runs themselves.",
  },
];

export function VenturesBand({
  heading,
  intro,
  ventures = VENTURES,
}: {
  heading: string;
  intro: string;
  ventures?: Venture[];
}) {
  return (
    <section className="border-t border-white/15 py-16 text-white md:py-24">
      <div className="mx-auto max-w-[1300px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-2xl">
          <h2 className="font-serif text-fluid-h1 font-normal tracking-tight text-white">
            {heading}
          </h2>
          <p className="mt-4 text-fluid-body text-white/75">{intro}</p>
        </div>

        <div className="mt-11 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {ventures.map((v) => (
            <div key={v.name} className="border-t border-white/15 pt-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="font-serif text-2xl font-normal text-white">{v.name}</h3>
                <span className="rounded-full border border-[#F0D8C0]/40 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#F0D8C0]">
                  {v.route}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                {v.sector}
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-white/75">{v.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-white/60">
          Company names are illustrative of the work teams carry out of a cohort.
        </p>
      </div>
    </section>
  );
}
