import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';
import { Link } from 'wouter';

interface Card {
  id: number;
  icon: LucideIcon;
  value: string;
  label: string;
  link?: string;
  image: string;
  alt: string;
}

interface CardStackProps {
  cards: Card[];
}

export default function CardStack({ cards: initialCards }: CardStackProps) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [isDark, setIsDark] = useState(false);
  const [dragDirection, setDragDirection] = useState<'up' | 'down' | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const dragX = useMotionValue(0);
  const rotateY = useTransform(dragX, [-200, 0, 200], [-15, 0, 15]);

  // Configuration
  const offset = 15; // Horizontal offset for side-by-side stacking
  const scaleStep = 0.06;
  const dimStep = 0.08; // Reduced dimming for clearer images
  const stiff = 170;
  const damp = 26;
  const borderRadius = 12;
  const swipeThreshold = 50;

  const spring = {
    type: 'spring' as const,
    stiffness: stiff,
    damping: damp
  };

  const moveToEnd = () => {
    setCards(prev => [...prev.slice(1), prev[0]]);
    setCurrentIndex((prev) => (prev + 1) % initialCards.length);
  };

  const moveToStart = () => {
    setCards(prev => [prev[prev.length - 1], ...prev.slice(0, -1)]);
    setCurrentIndex((prev) => (prev - 1 + initialCards.length) % initialCards.length);
  };

  const shuffleCards = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
  };

  const resetCards = () => {
    setCards(initialCards);
    setCurrentIndex(0);
  };

  const handleDragEnd = (_: any, info: any) => {
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (Math.abs(offset) > swipeThreshold || Math.abs(velocity) > 500) {
      if (offset < 0 || velocity < 0) {
        setDragDirection('up');
        setTimeout(() => {
          moveToEnd();
          setDragDirection(null);
        }, 150);
      } else {
        setDragDirection('down');
        setTimeout(() => {
          moveToStart();
          setDragDirection(null);
        }, 150);
      }
    }

    dragX.set(0);
  };

  // Theme configuration - Adapted to your red/beige theme
  const theme = {
    dark: {
      bg: 'bg-gradient-to-br from-red-600 via-red-700 to-red-800',
      text: 'text-white',
      textSecondary: 'text-red-100',
      toggleBg: 'bg-red-800/80 hover:bg-red-700/80',
      toggleBorder: 'border-red-700',
      infoBox: 'bg-red-900/90 border-red-700',
      shadowCard: '0 25px 50px rgba(220, 38, 38, 0.5)',
      shadowCardBack: '0 15px 30px rgba(220, 38, 38, 0.3)',
      cardBorder: 'border-2 border-red-700',
      controlBg: 'bg-red-800/80 hover:bg-red-700/80',
      cardInfoBg: 'bg-gradient-to-t from-red-900/90 to-transparent'
    },
    light: {
      bg: 'bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3]',
      text: 'text-gray-900',
      textSecondary: 'text-gray-600',
      toggleBg: 'bg-white/80 hover:bg-[#F5E6D3]/80',
      toggleBorder: 'border-[#E3D9CC]',
      infoBox: 'bg-white/90 border-[#E3D9CC]',
      shadowCard: '0 25px 50px rgba(212, 165, 116, 0.2)',
      shadowCardBack: '0 15px 30px rgba(212, 165, 116, 0.1)',
      cardBorder: 'border-2 border-[#E3D9CC]',
      controlBg: 'bg-white/80 hover:bg-[#F5E6D3]/80',
      cardInfoBg: 'bg-gradient-to-t from-[#F5E6D3]/90 to-transparent'
    }
  };

  const currentTheme = isDark ? theme.dark : theme.light;

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden max-h-full">

      {/* Navigation Buttons */}
      <motion.button
        onClick={moveToStart}
        className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full ${currentTheme.controlBg} border ${currentTheme.toggleBorder} backdrop-blur-sm transition-colors duration-200 z-20`}
        whileHover={{ scale: 1.1, x: -5 }}
        whileTap={{ scale: 0.9 }}
      >
        <ChevronLeft className={`w-4 h-4 sm:w-5 sm:h-5 ${currentTheme.text}`} />
      </motion.button>
      <motion.button
        onClick={moveToEnd}
        className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full ${currentTheme.controlBg} border ${currentTheme.toggleBorder} backdrop-blur-sm transition-colors duration-200 z-20`}
        whileHover={{ scale: 1.1, x: 5 }}
        whileTap={{ scale: 0.9 }}
      >
        <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${currentTheme.text}`} />
      </motion.button>

      {/* Card Stack Container - Side by Side Stacking */}
      <div className="relative w-full max-w-xs sm:max-w-md md:max-w-xl mx-auto lg:max-w-none h-full overflow-hidden z-10">
        <ul className="relative w-full h-full m-0 p-0 overflow-hidden" style={{ aspectRatio: '4/3' }}>
          <AnimatePresence>
            {cards.map(({ id, icon: Icon, value, label, link, image, alt }, i) => {
              const isFront = i === 0;
              const brightness = 1; // Full brightness - no dimming for clear images
              const baseZ = cards.length - i;

              return (
                <motion.li
                  key={id}
                  className={`absolute w-full h-full list-none overflow-hidden ${currentTheme.cardBorder} rounded-3xl`}
                  style={{
                    aspectRatio: '4/3',
                    borderRadius: `${borderRadius}px`,
                    cursor: isFront ? 'grab' : 'auto',
                    touchAction: 'none',
                    boxShadow: isFront
                      ? currentTheme.shadowCard
                      : currentTheme.shadowCardBack,
                    rotateY: isFront ? rotateY : 0,
                    transformPerspective: 1000
                  }}
                  animate={{
                    left: i === 0 ? '0%' : `${i * offset}%`,
                    scale: 1 - i * scaleStep,
                    zIndex: baseZ,
                    opacity: dragDirection && isFront ? 0 : (i === 0 ? 1 : 0),
                    x: 0
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    transition: { duration: 0.2 }
                  }}
                  transition={spring}
                  drag={isFront ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.7}
                  onDrag={(_, info) => {
                    if (isFront) {
                      dragX.set(info.offset.x);
                    }
                  }}
                  onDragEnd={handleDragEnd}
                  whileDrag={
                    isFront
                      ? {
                          zIndex: cards.length + 1,
                          cursor: 'grabbing',
                          scale: 1.05,
                        }
                      : {}
                  }
                  onHoverStart={() => isFront && setShowInfo(true)}
                  onHoverEnd={() => setShowInfo(false)}
                >
                  {link ? (
                    <Link href={link}>
                      <div className="w-full h-full relative cursor-pointer">
                      {/* Background Image */}
                      <img
                        src={image}
                        alt={alt}
                        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
                        draggable={false}
                        style={{ 
                          width: '100%', 
                          height: '100%',
                          objectFit: 'cover',
                          objectPosition: 'center'
                        }}
                      />
                      
                      {/* No overlay - images are clear */}

                      {/* Content Overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10">
                        {/* Icon */}
                        <div className="mb-3 sm:mb-4 flex items-center justify-center">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/40 backdrop-blur-sm flex items-center justify-center border-2 border-[#E3D9CC]/50 shadow-lg">
                            <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
                          </div>
                        </div>
                        
                        {/* Value */}
                        <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-1 sm:mb-2 drop-shadow-2xl">
                          {value}
                        </div>
                        
                        {/* Label */}
                        <div className="text-base sm:text-lg font-black text-white drop-shadow-xl">
                          {label}
                        </div>
                      </div>

                      {/* Card Info Overlay - Shows on hover */}
                      <motion.div
                        className={`absolute bottom-0 left-0 right-0 p-4 ${currentTheme.cardInfoBg}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ 
                          opacity: isFront && showInfo ? 1 : 0,
                          y: isFront && showInfo ? 0 : 20
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Know More
                          </span>
                          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                        </div>
                      </motion.div>
                    </div>
                  </Link>
                  ) : (
                    <div className="w-full h-full relative">
                      {/* Background Image */}
                      <img
                        src={image}
                        alt={alt}
                        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
                        draggable={false}
                        style={{ 
                          width: '100%', 
                          height: '100%',
                          objectFit: 'cover',
                          objectPosition: 'center'
                        }}
                      />
                      
                      {/* Content Overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10">
                        {/* Icon */}
                        <div className="mb-3 sm:mb-4 flex items-center justify-center">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/40 backdrop-blur-sm flex items-center justify-center border-2 border-[#E3D9CC]/50 shadow-lg">
                            <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
                          </div>
                        </div>
                        
                        {/* Value */}
                        <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-1 sm:mb-2 drop-shadow-2xl">
                          {value}
                        </div>
                        
                        {/* Label */}
                        <div className="text-base sm:text-lg font-black text-white drop-shadow-xl">
                          {label}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      {/* Progress Indicator */}
      <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 z-20">
        {initialCards.map((_, i) => (
          <motion.div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentIndex % initialCards.length
                ? 'bg-red-600 w-8'
                : 'bg-[#E3D9CC] w-1.5'
            }`}
            whileHover={{ scale: 1.2 }}
          />
        ))}
      </div>
    </div>
  );
}

