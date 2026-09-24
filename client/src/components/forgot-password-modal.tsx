import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, KeyRound, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string; // Email from login form
}

type Step = "otp" | "password";

export function ForgotPasswordModal({ open, onOpenChange, email }: ForgotPasswordModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("otp");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);

  // Start resend cooldown timer
  const startResendCooldown = () => {
    setResendCooldown(60); // 60 seconds
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Auto-send OTP when modal opens
  const sendOTP = async () => {
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address in the login form",
        variant: "destructive",
      });
      onOpenChange(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send OTP");
      }

      toast({
        title: "OTP Sent",
        description: `A 6-digit OTP has been sent to ${email}. Please check your email.`,
      });
      setOtpSent(true);
      startResendCooldown();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-send OTP when modal opens
  useEffect(() => {
    if (open && !otpSent && email && email.includes("@")) {
      sendOTP();
    } else if (open && (!email || !email.includes("@"))) {
      toast({
        title: "Email Required",
        description: "Please enter your email address in the login form first",
        variant: "destructive",
      });
      // Close modal if email is not valid
      setTimeout(() => onOpenChange(false), 2000);
    }
  }, [open, email]);

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a 6-digit OTP",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid OTP");
      }

      toast({
        title: "OTP Verified",
        description: "Please enter your new password",
      });
      setStep("password");
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Invalid OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords match",
        variant: "destructive",
      });
      return;
    }

    // Password policy: at least one number and one special character
    if (!/\d/.test(newPassword) || !/[^\w\s]/.test(newPassword)) {
      toast({
        title: "Password Requirements",
        description: "Password must include at least one number and one special character",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      toast({
        title: "Password Reset Successful",
        description: "Your password has been reset. Please login with your new password.",
      });
      
      // Reset form and close modal
      setStep("otp");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setOtpSent(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    await sendOTP();
  };

  const handleBack = () => {
    if (step === "password") {
      setStep("otp");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleClose = () => {
    setStep("otp");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setResendCooldown(0);
    setOtpSent(false);
    onOpenChange(false);
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep("otp");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setResendCooldown(0);
      setOtpSent(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "otp" && <KeyRound className="h-5 w-5" />}
            {step === "password" && <Lock className="h-5 w-5" />}
            {step === "otp" && "Verify OTP"}
            {step === "password" && "Reset Password"}
          </DialogTitle>
          <DialogDescription>
            {step === "otp" && `Enter the 6-digit OTP sent to ${email}`}
            {step === "password" && "Enter your new password"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`h-2 w-8 rounded ${step === "otp" ? "bg-red-600" : "bg-green-500"}`} />
            <div className={`h-2 w-8 rounded ${step === "password" ? "bg-red-600" : "bg-gray-300"}`} />
          </div>

          {/* Step 1: OTP */}
          {step === "otp" && (
            <div className="space-y-4">
              {isLoading && !otpSent && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-red-600" />
                  <span className="ml-2 text-sm text-muted-foreground">Sending OTP...</span>
                </div>
              )}
              {otpSent && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-otp">Enter OTP</Label>
                    <Input
                      id="forgot-otp"
                      type="text"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setOtp(value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6) {
                          handleVerifyOTP();
                        }
                      }}
                      disabled={isLoading}
                      className="text-center text-2xl tracking-widest"
                      maxLength={6}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Enter the 6-digit code sent to {email}
                    </p>
                  </div>
                  <Button
                    onClick={handleVerifyOTP}
                    disabled={isLoading || otp.length !== 6}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Verify OTP
                      </>
                    )}
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={isLoading || resendCooldown > 0}
                      className="text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {resendCooldown > 0
                        ? `Resend OTP in ${resendCooldown}s`
                        : "Resend OTP"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: New Password */}
          {step === "password" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with a number and special character
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newPassword && confirmPassword) {
                        handleResetPassword();
                      }
                    }}
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                onClick={handleResetPassword}
                disabled={isLoading || !newPassword || !confirmPassword}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Reset Password
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

