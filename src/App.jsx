import { Toaster } from "@/components/ui/toaster"
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
import Lobby from '@/pages/Lobby';
import FindGame from '@/pages/FindGame';
import ConsoleBridge from '@/pages/ConsoleBridge';
import MatchDetail from '@/pages/MatchDetail';
import CreateMatch from '@/pages/CreateMatch';
import WalletPage from '@/pages/Wallet';
import MyWagers from '@/pages/MyWagers';
import PlayerDashboard from '@/pages/PlayerDashboard';
import Leaderboard from '@/pages/Leaderboard';
import Admin from '@/pages/Admin';
import CryptoSettings from '@/pages/CryptoSettings';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

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
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/find" element={<FindGame />} />
        <Route path="/console" element={<ConsoleBridge />} />
        <Route path="/match/:id" element={<MatchDetail />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/create" element={<CreateMatch />} />
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