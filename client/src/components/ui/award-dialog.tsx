import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trophy, Sparkles, CheckCircle2, TrendingUp, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Confetti particle component
const ConfettiParticle = ({ delay, x, color, index }: { delay: number; x: number; color: string; index: number }) => {
  const randomX = useMemo(() => Math.random() * 100 - 50, [index]);
  const randomX2 = useMemo(() => Math.random() * 100 - 50, [index]);
  
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{
        left: `${x}%`,
        backgroundColor: color,
      }}
      initial={{ y: -100, opacity: 1, rotate: 0 }}
      animate={{
        y: 1000,
        opacity: [1, 1, 0],
        rotate: 360,
        x: [0, randomX, randomX2],
      }}
      transition={{
        duration: 2 + Math.random(),
        delay,
        ease: "easeOut",
      }}
    />
  );
};

// Blast animation component
const BlastAnimation = ({ show }: { show: boolean }) => {
  const colors = ["#EF4444", "#F59E0B", "#EAB308", "#F97316", "#DC2626", "#FBBF24"];
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {particles.map((particle) => (
        <ConfettiParticle
          key={particle.id}
          delay={particle.delay}
          x={particle.x}
          color={particle.color}
          index={particle.id}
        />
      ))}
    </div>
  );
};

export function AwardDialog({ open, onOpenChange }: AwardDialogProps) {
  const [showBlast, setShowBlast] = useState(false);

  useEffect(() => {
    if (open) {
      setShowBlast(true);
      const timer = setTimeout(() => setShowBlast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <>
      <BlastAnimation show={showBlast} />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#FAF7F3] via-[#FEFBF8] to-white border-2 border-[#E3D9CC]">
          <DialogHeader>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="flex items-center justify-center mb-4"
            >
              <div className="text-6xl">🏆</div>
            </motion.div>
            <DialogTitle className="text-fluid-h2 font-bold text-center text-gray-900 mb-2">
              Mega Award & Funding Opportunity
            </DialogTitle>
            <DialogDescription className="text-center text-gray-700 text-lg">
              Celebrate excellence in entrepreneurship
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            {/* Selection Criteria */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border-2 border-[#E3D9CC] shadow-md"
            >
              <div className="flex items-start gap-3 mb-4">
                <Trophy className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
                <h3 className="text-xl font-bold text-gray-900">At the end of each semester:</h3>
              </div>
              <ul className="space-y-3 ml-9">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">One winner per industry is selected</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Evaluation based on product quality, execution, and team performance
                  </span>
                </li>
              </ul>
            </motion.div>

            {/* Winning Rewards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-red-50 via-[#FAF7F3] to-white rounded-xl p-6 border-2 border-red-200 shadow-lg"
            >
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
                <h3 className="text-xl font-bold text-gray-900">Winning Startup Receives:</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4 ml-9">
                <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-red-100">
                  <div className="text-2xl">💰</div>
                  <div>
                    <div className="font-bold text-red-600 text-lg">₹20 Lakh</div>
                    <div className="text-sm text-gray-600">Reward from StartupUniv</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-red-100">
                  <div className="text-2xl">🚀</div>
                  <div>
                    <div className="font-bold text-red-600 text-lg">Up to ₹1 Crore</div>
                    <div className="text-sm text-gray-600">Additional funding (equity or debt)</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-red-100 md:col-span-2">
                  <div className="text-2xl">🎯</div>
                  <div>
                    <div className="font-bold text-red-600 text-lg">Growth Opportunities</div>
                    <div className="text-sm text-gray-600">
                      Incubation, GTM, and enterprise opportunities
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Outcomes & Risk Mitigation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-[#FAF7F3] via-white to-red-50 rounded-xl p-6 border-2 border-[#E3D9CC] shadow-md"
            >
              <div className="flex items-start gap-3 mb-4">
                <Shield className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
                <h3 className="text-xl font-bold text-gray-900">Outcomes & Risk Mitigation</h3>
              </div>
              <ul className="space-y-3 ml-9 mb-6">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Teams that do not continue can transfer IP or talent to successful startups
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Co-Founders from unsuccessful teams can join other startups
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">
                    Participants gain 4 months of authentic startup experience
                  </span>
                </li>
              </ul>
              
              {/* Impact Statement */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-gradient-to-r from-red-50 to-[#FAF7F3] border-l-4 border-red-600 p-4 rounded-r-lg ml-9"
              >
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-800 leading-relaxed">
                    This shifts candidates from competing with <span className="font-bold text-red-600">8 million freshers</span> to a much smaller pool of <span className="font-bold text-red-600">experienced early-career professionals</span>—significantly improving employability and salary outcomes.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

