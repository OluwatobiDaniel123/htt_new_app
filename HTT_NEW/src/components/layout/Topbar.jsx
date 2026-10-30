import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, ChevronDown, User } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { useAppConfig } from '@/lib/AppConfigContext';
import { roleLabel, initials } from '@/lib/constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Topbar({ onOpenMobile }) {
  const { user, logout } = useAuth();
  const { role } = useAppConfig();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    api.get('/notifications/unread-count')
      .then((count) => active && setUnread(Number(count) || 0))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/70 bg-white/85 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMobile}
          className="rounded-md p-1.5 text-foreground/70 hover:bg-muted md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden items-center gap-2 text-[12px] text-muted-foreground md:flex">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            Internal staff system
          </span>
          <span className="hidden lg:inline">Enquiries 8–10 · 11–12 · 13–14 age bands</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          to="/notifications"
          className="relative rounded-md p-2 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg border border-border/80 px-2 py-1.5 transition-colors hover:bg-muted/60">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0B1F3A] text-[11px] font-semibold text-white">
                {initials(user?.full_name || user?.email || 'H')}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-[150px] truncate text-[12.5px] font-medium text-foreground">
                  {user?.full_name || user?.email}
                </span>
                <span className="block text-[10.5px] text-muted-foreground">{roleLabel(role)}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-[12px]">
              <p className="font-medium">{user?.full_name || 'Staff member'}</p>
              <p className="truncate text-[11px] font-normal text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[12.5px]" onSelect={() => navigate('/staff')}>
              <User className="mr-2 h-3.5 w-3.5" /> My staff profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[12.5px] text-rose-600 focus:text-rose-600"
              onSelect={() => logout()}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
