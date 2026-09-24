import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { rolesConfig } from "@/lib/rolesConfig";

const roleLabels: Record<string, string> = {
  FOUNDER: "Founder",
  COFOUNDER: "Co-Founder",
  MENTOR: "Mentor",
  LEARNER: "Learner",
};

interface RolesResponsibilitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: string;
}

export function RolesResponsibilitiesModal({ isOpen, onClose, role }: RolesResponsibilitiesModalProps) {
  const config = rolesConfig[role];
  const { toast } = useToast();
  const label = roleLabels[role] || "Member";

  if (!config || !isOpen) return null;

  const handleClose = () => {
    onClose();
    toast({
      title: "Welcome back!",
      description: "You've successfully logged in.",
    });
  };

  return (
    <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-[hsl(36,33%,98%)]" />

      <div className="relative h-full flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl text-center">

          {/* Logo */}
          <img
            src="/logo.png"
            alt="StartupUniv"
            className="h-9 mx-auto mb-4"
          />

          {/* Greeting */}
          <h1 className="text-2xl font-bold text-[hsl(222,47%,11%)] mb-1 tracking-tight">
            Hello, {label}! 
          </h1>

          {/* Subtitle */}
          <p className="text-sm text-[hsl(215,16%,47%)] mb-1">
            {config.subtitle}
          </p>

          {/* Tagline */}
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[hsl(215,16%,47%)]/60 mb-5">
            {config.tagline}
          </p>

          {/* Responsibility list */}
          <div className="grid gap-2 text-left mb-6">
            {config.responsibilities.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3.5 px-4 py-3 rounded-lg bg-white border border-[hsl(214,32%,91%)]"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[hsl(221,50%,23%)] text-[11px] font-bold text-white shrink-0">
                  {index + 1}
                </span>
                <span className="text-[13px] font-medium text-[hsl(222,47%,11%)]">{item.text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Button
            onClick={handleClose}
            className="w-full max-w-sm mx-auto py-5 text-sm font-semibold rounded-lg bg-[hsl(221,50%,23%)] text-white hover:bg-[hsl(221,50%,28%)] shadow-sm transition-all duration-200"
          >
            Got it, let's go!
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
