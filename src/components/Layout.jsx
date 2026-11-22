import { Outlet } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import MobileTabBar from '@/components/MobileTabBar';
import SiteFooter from '@/components/SiteFooter';

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}