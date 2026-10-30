import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { X, ShieldAlert } from 'lucide-react';
import SidebarContent from '@/components/layout/SidebarContent';
import Topbar from '@/components/layout/Topbar';
import { useAppConfig } from '@/lib/AppConfigContext';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'htt_sidebar_collapsed';

export default function AppShell() {
  const { user, logout } = useAuth();
  const { loading } = useAppConfig();
  const [collapsed, setCollapsed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1'
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  if (user && user.active === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <span className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="text-[20px] font-semibold">Account deactivated</h1>
        <p className="mt-2 max-w-md text-[13px] text-muted-foreground">
          This staff account has been deactivated. Contact a System Administrator to restore
          access.
        </p>
        <button
          onClick={() => logout()}
          className="mt-5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium hover:bg-muted"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden shrink-0 border-r border-border/70 bg-white transition-[width] duration-200 md:block',
          collapsed ? 'w-[68px]' : 'w-[248px]'
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-[#0B1F3A]/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[268px] animate-in-up border-r border-border bg-white shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className={cn('transition-[padding] duration-200', collapsed ? 'md:pl-[68px]' : 'md:pl-[248px]')}>
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-5 md:px-7 md:py-7">
          {loading ? (
            <div className="flex justify-center py-24">
              <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-border border-t-[#0B1F3A]" />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}