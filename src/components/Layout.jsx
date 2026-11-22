import { Outlet } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import MobileTabBar from '@/components/MobileTabBar';
import SiteFooter from '@/components/SiteFooter';

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar />
      {/* Bottom padding accounts for the fixed mobile tab bar plus the
          Android gesture bar (safe-area-inset-bottom). */}
      <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>
      {/* The footer is desktop-only: on mobile it duplicated the sticky
          footer the scan flags, and the tab bar already carries navigation. */}
      <div className="hidden md:block">
        <SiteFooter />
      </div>
      <MobileTabBar />
    </div>
  );
}
