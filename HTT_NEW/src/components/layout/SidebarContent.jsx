import React from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV_GROUPS } from '@/components/layout/navConfig';
import { useAppConfig } from '@/lib/AppConfigContext';
import { cn } from '@/lib/utils';

export function Brand({ collapsed }) {
  return (
    <div className={cn('flex items-center gap-2.5 px-4 py-4', collapsed && 'justify-center px-0')}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0B1F3A] text-[13px] font-bold text-white">
        HTT
      </span>
      {!collapsed ? (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-heading text-[13.5px] font-bold text-[#0B1F3A]">HTT Academy</p>
          <p className="truncate text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Nigeria · Admin
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function SidebarContent({ collapsed, onNavigate, onToggleCollapse }) {
  const { can } = useAppConfig();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/70">
        <Brand collapsed={collapsed} />
        {onToggleCollapse ? (
          <button
            onClick={onToggleCollapse}
            className="mr-2 hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:block"
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => can(item.module));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-3">
              {!collapsed ? (
                <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground/80">
                  {group.label}
                </p>
              ) : (
                <div className="mx-2 mb-2 border-t border-border/60" />
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          cn(
                            'group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium transition-all duration-150',
                            collapsed && 'justify-center px-0',
                            isActive
                              ? 'bg-[#0B1F3A] text-white shadow-sm'
                              : 'text-foreground/70 hover:bg-muted/70 hover:text-foreground'
                          )
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="border-t border-border/70 px-4 py-3">
          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            Internal operations system. Child data is restricted and audited.
          </p>
        </div>
      ) : null}
    </div>
  );
}