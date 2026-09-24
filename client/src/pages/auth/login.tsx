import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, LogIn, Eye, EyeOff } from "lucide-react";
import { ForgotPasswordModal } from "@/components/forgot-password-modal";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(loginEmail, loginPassword);
      // Don't show welcome toast here — if the roles welcome screen shows,
      // it will display the toast after the user clicks "Got it, let's go!"
      setLocation("/app");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check your credentials.";
      const isInvalidCredentials = message === "Invalid credentials" || message.toLowerCase().includes("invalid");
      const isServerError =
        message === "Login failed" ||
        message.startsWith("Something went wrong") ||
        message === "Please try again later or contact support.";
      toast({
        title: isInvalidCredentials ? "Couldn't sign you in" : "Something went wrong",
        description: isInvalidCredentials
          ? "Email or password is incorrect. Please try again."
          : isServerError
            ? "Please try again later or contact support."
            : message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white overflow-x-hidden">
      <div className="min-h-screen w-full max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-2">
        {/* Left collage (hidden on small screens) */}
        <div className="hidden lg:flex bg-[#f9fafb] p-8 items-center justify-center">
          <div className="w-full max-w-[584px]">
            <div className="grid grid-cols-2 gap-4 grid-rows-[208px_192px_176px]">
              <div className="overflow-hidden rounded-[16px]">
                <img
                  src="/auth/login/startup-team-collaboration.jpg"
                  alt="Startup team collaboration"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
              <div className="rounded-[16px] bg-[#17646E] text-white flex flex-col items-center justify-center gap-3 px-6">
                <div className="text-[48px] leading-[48px] font-semibold">100%</div>
                <p className="text-center text-sm leading-[22px] max-w-[220px]">
                  Dedicated resources per team to kickstart your startup journey.
                </p>
              </div>
              <div className="overflow-hidden rounded-[16px]">
                <img
                  src="/auth/login/business-meeting.jpg"
                  alt="Business meeting"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
              <div className="overflow-hidden rounded-[16px]">
                <img
                  src="/auth/login/brainstorming-session.jpg"
                  alt="Brainstorming session"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
              <div className="rounded-[16px] bg-[#479bb1] text-white flex flex-col items-center justify-center gap-3 px-6">
                <div className="text-[60px] leading-[60px] font-semibold">85%</div>
                <p className="text-center text-sm leading-[22px] max-w-[230px]">
                  of our teams successfully launch their startups and scale up.
                </p>
              </div>
              <div className="overflow-hidden rounded-[16px]">
                <img
                  src="/auth/login/working-on-laptop.jpg"
                  alt="Working on laptop"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right form */}
        <div className="flex items-center justify-center px-6 py-10 lg:px-8">
          <div className="w-full max-w-[448px]">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-[#4a5565] hover:text-[#17646E]"
              data-testid="link-back-home"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>

            <div className="mt-8">
              <div className="flex items-center gap-3">
                <img src="/favicon.png" alt="StartupUniv" className="h-10 w-10 shrink-0 object-contain" />
                <h1 className="text-[24px] leading-[32px] font-semibold text-[#0a0a0a]">
                  Login to <span className="text-[#17646E]">StartupUniv</span>
                </h1>
              </div>
              <p className="mt-4 text-sm leading-5 text-[#4a5565]">
                Welcome to StartupUniv, please enter your login details below to access your dashboard.
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-10 space-y-5">
              <div className="space-y-2">
                <label htmlFor="login-email" className="block text-sm text-[#0a0a0a]">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  id="login-email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="h-12 w-full rounded-[8px] bg-[#f3f3f5] px-3 text-sm text-[#0a0a0a] placeholder:text-[#717182] outline-none ring-1 ring-transparent focus:ring-[#17646E]"
                  placeholder="your.email@example.com"
                  required
                  data-testid="input-login-email"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="block text-sm text-[#0a0a0a]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    id="login-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="h-12 w-full rounded-[8px] bg-[#f3f3f5] px-3 pr-12 text-sm text-[#0a0a0a] placeholder:text-[#717182] outline-none ring-1 ring-transparent focus:ring-[#17646E]"
                    placeholder="••••••••"
                    required
                    data-testid="input-login-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a7282] hover:text-[#4a5565]"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-[#e31e24] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full rounded-[8px] bg-[#17646E] text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                data-testid="button-login"
              >
                {isLoading ? (
                  <span className="inline-flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center">
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </span>
                )}
              </button>
            </form>

            <ForgotPasswordModal open={showForgotPassword} onOpenChange={setShowForgotPassword} email={loginEmail} />

            <p className="mt-6 text-center text-xs leading-4 text-[#6a7282]">
              By signing in, you agree to our{" "}
              <Link href="/terms" className="text-[#e31e24] hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-[#e31e24] hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
