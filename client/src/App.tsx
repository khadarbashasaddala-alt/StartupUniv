import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ChatWidget } from "@/components/ChatWidget";

// Landing Pages
import NotFound from "@/pages/landing-pages/not-found";
import HomePage from "@/pages/landing-pages/home";
import ProgramPage from "@/pages/landing-pages/program";
import SandboxPage from "@/pages/landing-pages/sandbox";
import PlansPage from "@/pages/landing-pages/plans";
import FounderPlanPage from "@/pages/landing-pages/plan-details/founder";
import CoFounderPlanPage from "@/pages/landing-pages/plan-details/cofounder";
import InternPlanPage from "@/pages/landing-pages/plan-details/intern";
import TeamApplicationPage from "@/pages/landing-pages/team-application";
import TeamInvitePage from "@/pages/landing-pages/team-invite";
import ProblemsPage from "@/pages/landing-pages/problems";
import ApplyPage from "@/pages/landing-pages/apply";
import AboutPage from "@/pages/landing-pages/about";
import TeamPage from "@/pages/landing-pages/team";
import IncubationPage from "@/pages/landing-pages/incubation";
import FaqPage from "@/pages/landing-pages/faq";
// import BlogPage from "@/pages/landing-pages/blog";
// import BlogPostPage from "@/pages/landing-pages/blog-post";
import ContactPage from "@/pages/landing-pages/contact";
import ContactSuccessPage from "@/pages/landing-pages/contact-success";
import ForStudentsPage from "@/pages/landing-pages/for-students";
import ForProfessionalsPage from "@/pages/landing-pages/for-professionals";
import ForUniversitiesPage from "@/pages/landing-pages/for-universities";
import ForCorporatesPage from "@/pages/landing-pages/for-corporates";
import StudioPage from "@/pages/landing-pages/studio";
import PublicAssessmentPage from "@/pages/landing-pages/assessment";
import CareersPage from "@/pages/landing-pages/careers";
import TermsPage from "@/pages/landing-pages/terms";
import PrivacyPage from "@/pages/landing-pages/privacy";

// Auth Pages
import LoginPage from "@/pages/auth/login";

// Public Payment Page
import PublicPaymentPage from "@/pages/public-payment-page";

// App Portal
import AppIndex from "@/pages/app/index";

// Scroll to top on route change
function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function AppRoute() {
  const [location] = useLocation();
  if (location.startsWith("/app")) {
    return <ProtectedRoute component={AppIndex} />;
  }
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        {/* Marketing Site */}
        <Route path="/" component={HomePage} />
        <Route path="/sandbox" component={SandboxPage} />
        <Route path="/program" component={ProgramPage} />
        <Route path="/plans" component={PlansPage} />
        <Route path="/plans/founder" component={FounderPlanPage} />
        <Route path="/plans/cofounder" component={CoFounderPlanPage} />
        <Route path="/plans/intern" component={InternPlanPage} />
        <Route path="/plans/team-application" component={TeamApplicationPage} />
        <Route path="/plans/team-invite/:token" component={TeamInvitePage} />
        <Route path="/problems" component={ProblemsPage} />
        <Route path="/apply" component={ApplyPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/team" component={TeamPage} />
        <Route path="/incubation" component={IncubationPage} />
        <Route path="/faq" component={FaqPage} />
        {/* Blog (commented out)
      <Route path="/blog/:slug" component={BlogPostPage} />
      <Route path="/blog" component={BlogPage} />
      */}
        <Route path="/contact" component={ContactPage} />
        <Route path="/contact/success" component={ContactSuccessPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/careers" component={CareersPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/privacy" component={PrivacyPage} />

        {/* Audience Pages */}
        <Route path="/for-students" component={ForStudentsPage} />
        <Route path="/for-professionals" component={ForProfessionalsPage} />
        <Route path="/for-universities" component={ForUniversitiesPage} />
        <Route path="/for-corporates" component={ForCorporatesPage} />

        {/* Studio IDE (Protected) */}
        <Route path="/studio">
          {() => <ProtectedRoute component={StudioPage} />}
        </Route>

        {/* Public Assessment Page (No auth required) */}
        <Route path="/assessment/:token" component={PublicAssessmentPage} />

        {/* Public Payment Page (No auth required) */}
        <Route path="/payment/:id" component={PublicPaymentPage} />

        {/* App Portal (Protected) - catch all /app routes - must be before NotFound */}
        <Route>
          {() => <AppRoute />}
        </Route>

        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        defaultTheme="light"
        storageKey="sv-theme"
        defaultPalette="teal"
        paletteStorageKey="sv-palette"
      >
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <ChatWidget />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
