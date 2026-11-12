import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import { AppConfigProvider } from "@/lib/AppConfigContext";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ScrollToTop from "./components/ScrollToTop";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Players from "@/pages/Players";
import PlayerDetail from "@/pages/PlayerDetail";
import Guardians from "@/pages/Guardians";
import Registrations from "@/pages/Registrations";
import RegistrationDetail from "@/pages/RegistrationDetail";
import CoachingApprentices from "@/pages/CoachingApprentices";
import CoachingApprenticeDetail from "@/pages/CoachingApprenticeDetail";
import Assessments from "@/pages/Assessments";
import Attendance from "@/pages/Attendance";
import Centres from "@/pages/Centres";
import Programmes from "@/pages/Programmes";
import ScholarshipApplications from "@/pages/ScholarshipApplications";
import ActiveScholarships from "@/pages/ActiveScholarships";
import Sponsors from "@/pages/Sponsors";
import SponsorshipEnquiries from "@/pages/SponsorshipEnquiries";
import FundingOverview from "@/pages/FundingOverview";
import Seasons from "@/pages/Seasons";
import Teams from "@/pages/Teams";
import Fixtures from "@/pages/Fixtures";
import Results from "@/pages/Results";
import Standings from "@/pages/Standings";
import Enquiries from "@/pages/Enquiries";
import Tasks from "@/pages/Tasks";
import Stories from "@/pages/Stories";
import MediaApproval from "@/pages/MediaApproval";
import Partnerships from "@/pages/Partnerships";
import Notifications from "@/pages/Notifications";
import Staff from "@/pages/Staff";
import Roles from "@/pages/Roles";
import Reports from "@/pages/Reports";
import AuditLogs from "@/pages/AuditLogs";
import Safeguarding from "@/pages/Safeguarding";
import Settings from "@/pages/Settings";
import PaymentCallback from "@/pages/PaymentCallback";

const AuthenticatedApp = () => {
  const { pathname } = useLocation();
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } =
    useAuth();

  if (pathname === "/payment/callback") return <PaymentCallback />;

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === "user_not_registered") {
      return <UserNotRegisteredError />;
    } else if (authError.type === "auth_required") {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        element={
          <ProtectedRoute
            unauthenticatedElement={<Navigate to="/login" replace />}
          />
        }
      >
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />

          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/guardians" element={<Guardians />} />
          <Route path="/registrations" element={<Registrations />} />
          <Route path="/registrations/:id" element={<RegistrationDetail />} />
          <Route path="/coaching-apprentices" element={<CoachingApprentices />} />
          <Route path="/coaching-apprentices/:id" element={<CoachingApprenticeDetail />} />
          <Route path="/assessments" element={<Assessments />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/centres" element={<Centres />} />
          <Route path="/programmes" element={<Programmes />} />

          <Route path="/scholarships" element={<ScholarshipApplications />} />
          <Route path="/scholarships/active" element={<ActiveScholarships />} />
          <Route path="/sponsors" element={<Sponsors />} />
          <Route
            path="/sponsorship-enquiries"
            element={<SponsorshipEnquiries />}
          />
          <Route path="/funding" element={<FundingOverview />} />

          <Route path="/seasons" element={<Seasons />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/fixtures" element={<Fixtures />} />
          <Route path="/results" element={<Results />} />
          <Route path="/standings" element={<Standings />} />

          <Route path="/enquiries" element={<Enquiries />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/media-approval" element={<MediaApproval />} />
          <Route path="/partnerships" element={<Partnerships />} />
          <Route path="/notifications" element={<Notifications />} />

          <Route path="/staff" element={<Staff />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/safeguarding" element={<Safeguarding />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AppConfigProvider>
            <AuthenticatedApp />
          </AppConfigProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
