import { Toaster } from "@/components/ui/toaster"
import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';

// Performance: only the first screen (Home) is bundled with the initial
// load. Every other route is lazy-loaded, so the WebView startup bundle
// stays small and heavy libraries (charts, editors) load only when their
// screen is actually opened.
const Lobby = lazy(() => import('@/pages/Lobby'));
const FindGame = lazy(() => import('@/pages/FindGame'));
const ConsoleBridge = lazy(() => import('@/pages/ConsoleBridge'));
const MatchDetail = lazy(() => import('@/pages/MatchDetail'));
const CreateMatch = lazy(() => import('@/pages/CreateMatch'));
const WalletPage = lazy(() => import('@/pages/Wallet'));
const MyWagers = lazy(() => import('@/pages/MyWagers'));
const PlayerDashboard = lazy(() => import('@/pages/PlayerDashboard'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const Admin = lazy(() => import('@/pages/Admin'));
const CryptoSettings = lazy(() => import('@/pages/CryptoSettings'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const AccountDeletion = lazy(() => import('@/pages/AccountDeletion'));
const BoneCrusherLobby = lazy(() => import('@/pages/BoneCrusherLobby'));
const BoneCrusherTable = lazy(() => import('@/pages/BoneCrusherTable'));

function RouteLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background" role="status" aria-label="Loading">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin"></div>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/find" element={<FindGame />} />
          <Route path="/console" element={<ConsoleBridge />} />
          <Route path="/match/:id" element={<MatchDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/account-deletion" element={<AccountDeletion />} />

          <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
            <Route path="/create" element={<CreateMatch />} />
            <Route path="/poker/bone-crusher" element={<BoneCrusherLobby />} />
            <Route path="/poker/bone-crusher/:id" element={<BoneCrusherTable />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/bets" element={<MyWagers />} />
            <Route path="/dashboard" element={<PlayerDashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/crypto-settings" element={<CryptoSettings />} />
          </Route>
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
