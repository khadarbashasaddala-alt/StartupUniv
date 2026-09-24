"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Quote, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ===== Types and Interfaces =====

export interface iTeamMember {
  name: string;
  designation: string;
  description: string;
  profileImage: string; // Will be "/team/member-name.jpg" or empty string
  expertise: string[];
  yearsOfExperience: number;
  specialist: string;
}

interface iCarouselProps {
  items: React.ReactElement<{
    teamMember: iTeamMember;
    index: number;
    layout?: boolean;
    onCardClose: () => void;
  }>[];
  initialScroll?: number;
}

// ===== Custom Hooks =====

const useOutsideClick = (
  ref: React.RefObject<HTMLDivElement | null>,
  onOutsideClick: () => void,
) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      onOutsideClick();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [ref, onOutsideClick]);
};

// ===== Components =====

export const Carousel = ({ items, initialScroll = 0 }: iCarouselProps) => {
  const handleCardClose = (index: number) => {
    // No need to scroll on card close for vertical layout
  };

  return (
    <div className="relative w-full mt-10">
      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",
          "w-full px-4 max-w-7xl mx-auto"
        )}
      >
        {items.map((item, index) => {
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.5,
                  delay: 0.1 * index,
                  ease: "easeOut",
                  once: true,
                },
              }}
              key={`card-${index}`}
              className="rounded-3xl w-full"
            >
              {React.cloneElement(item, {
                onCardClose: () => {
                  return handleCardClose(index);
                },
              })}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export const TeamMemberCard = ({
  teamMember,
  index,
  layout = false,
  onCardClose = () => {},
  backgroundImage = "https://images.unsplash.com/photo-1528458965990-428de4b1cb0d?q=80&w=3129&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
}: {
  teamMember: iTeamMember;
  index: number;
  layout?: boolean;
  onCardClose?: () => void;
  backgroundImage?: string;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExpand = () => {
    return setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    onCardClose();
  };

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCollapse();
      }
    };

    if (isExpanded) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.body.dataset.scrollY = scrollY.toString();
    } else {
      const scrollY = parseInt(document.body.dataset.scrollY || "0", 10);
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo({ top: scrollY, behavior: "instant" });
    }

    window.addEventListener("keydown", handleEscapeKey);
    return () => {
      return window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isExpanded]);

  useOutsideClick(containerRef, handleCollapse);

  return (
    <>
      <AnimatePresence>
        {isExpanded && (
          <div className="fixed inset-0 h-screen overflow-hidden z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-red-600/20 backdrop-blur-lg h-full w-full fixed inset-0"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              ref={containerRef}
              layoutId={layout ? `card-${teamMember.name}` : undefined}
              className="max-w-5xl mx-auto bg-gradient-to-b from-[#FAF7F3] to-[#FEFBF8] h-full z-[60] p-4 md:p-10 rounded-3xl relative md:mt-10 overflow-y-auto"
            >
              <button
                className="sticky top-4 h-8 w-8 right-0 ml-auto rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 transition-colors"
                onClick={handleCollapse}
              >
                <X className="h-6 w-6 text-white absolute" />
              </button>

              <motion.p
                layoutId={layout ? `category-${teamMember.name}` : undefined}
                className="px-0 md:px-20 text-[rgba(31, 27, 29, 0.7)] text-lg text-gray-700 font-thin underline underline-offset-8"
              >
                {teamMember.designation}
              </motion.p>

              <motion.p
                layoutId={layout ? `title-${teamMember.name}` : undefined}
                className="px-0 md:px-20 text-2xl md:text-4xl font-normal italic text-[rgba(31, 27, 29, 0.7)] mt-4 text-gray-900 lowercase"
              >
                {teamMember.name}
              </motion.p>

              {/* Expertise Badges */}
              <div className="px-0 md:px-20 mt-6 mb-4">
                <div className="flex flex-wrap gap-2">
                  {teamMember.expertise.map((exp, idx) => (
                    <Badge
                      key={idx}
                      className="bg-red-600 text-white border-red-500 hover:bg-red-700"
                    >
                      {exp}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Years of Experience & Specialist */}
              <div className="px-0 md:px-20 mb-6 space-y-2">
                <div>
                  <span className="text-sm text-gray-600">Experience: </span>
                  <span className="font-semibold text-red-600">
                    {teamMember.yearsOfExperience} years
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Specialist in: </span>
                  <span className="text-lg font-semibold text-red-600">
                    {teamMember.specialist}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="py-8 text-[rgba(31, 27, 29, 0.7)] px-0 md:px-20 text-lg md:text-xl text-gray-700 leading-snug tracking-wide">
                <Quote className="h-6 w-6 text-red-600 mb-2" />
                {teamMember.description}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.button
        layoutId={layout ? `card-${teamMember.name}` : undefined}
        onClick={handleExpand}
        className=""
        whileHover={{
          scale: 1.05,
          transition: { duration: 0.3, ease: "easeOut" },
        }}
      >
        <div
          className="rounded-3xl bg-gradient-to-b from-[#FAF7F3] to-[#FEFBF8] h-[450px] md:h-[500px] w-full overflow-hidden flex flex-col items-center justify-center relative z-10 shadow-md border border-[#E3D9CC] transition-shadow duration-300 hover:shadow-xl"
        >
          <div className="absolute opacity-30" style={{ inset: "-1px 0 0" }}>
            <div className="absolute inset-0">
              <img
                className="block w-full h-full object-center object-cover"
                src={backgroundImage}
                alt="Background layer"
              />
            </div>
          </div>

          <ProfileImage
            src={teamMember.profileImage}
            alt={teamMember.name}
          />

          <motion.p
            layoutId={layout ? `title-${teamMember.name}` : undefined}
            className="text-[rgba(31, 27, 29, 0.7)] text-base md:text-lg font-normal text-center [text-wrap:balance] mt-3 lowercase px-3 text-gray-900"
          >
            {teamMember.description.length > 80
              ? `${teamMember.description.slice(0, 80)}...`
              : teamMember.description}
          </motion.p>

          <motion.p
            layoutId={layout ? `category-${teamMember.name}` : undefined}
            className="text-[rgba(31, 27, 29, 0.7)] text-lg md:text-xl font-thin italic text-center mt-3 lowercase text-gray-900"
          >
            {teamMember.name}.
          </motion.p>

          <motion.p
            layoutId={layout ? `category-${teamMember.name}` : undefined}
            className="text-[rgba(31, 27, 29, 0.7)] text-sm md:text-base font-thin italic text-center mt-1 lowercase underline underline-offset-8 decoration-1 text-gray-700"
          >
            {teamMember.designation.length > 25
              ? `${teamMember.designation.slice(0, 25)}...`
              : teamMember.designation}
          </motion.p>
        </div>
      </motion.button>
    </>
  );
};

const ProfileImage = ({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) => {
  const [isLoading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Check if image source is empty or invalid
  const isEmpty = !src || src.trim() === "";

  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setHasError(true);
    }
  }, [isEmpty]);

  const handleImageError = () => {
    setLoading(false);
    setHasError(true);
  };

  const handleImageLoad = () => {
    setLoading(false);
    setHasError(false);
  };

  return (
    <div className="w-[180px] h-[180px] md:w-[220px] md:h-[220px] overflow-hidden rounded-[1000px] border-[3px] border-solid border-[rgba(59,59,59,0.6)] aspect-[1/1] flex-none relative bg-[#E3D9CC] flex items-center justify-center">
      {isEmpty || hasError ? (
        <Users className="w-20 h-20 md:w-24 md:h-24 text-red-600" />
      ) : (
        <img
          className={cn(
            "transition duration-300 absolute top-0 inset-0 rounded-inherit object-cover z-50 w-full h-full",
            isLoading ? "blur-sm opacity-0" : "blur-0 opacity-100",
          )}
          onLoad={handleImageLoad}
          onError={handleImageError}
          src={src}
          loading="eager"
          decoding="async"
          alt={alt || "Profile image"}
        />
      )}
    </div>
  );
};

