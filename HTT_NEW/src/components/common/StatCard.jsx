import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  navy: 'bg-[#0B1F3A] text-white',
  green: 'bg-emerald-50 text-emerald-700',
  gold: 'bg-[#FBF5E6] text-[#8A6D20]',
  sky: 'bg-sky-50 text-sky-700',
  rose: 'bg-rose-50 text-rose-700',
};

/** @param {{label: React.ReactNode, value: React.ReactNode, hint: React.ReactNode, icon?: import("lucide-react").LucideIcon, tone?: string, to?: string, loading?: boolean}} props */
export default function StatCard({ label, value, hint, icon: Icon, tone = 'green', to, loading }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span className={cn('rounded-lg p-1.5', TONES[tone])}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {loading ? (
          <span className="h-7 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <span className="htt-tabular text-[26px] font-semibold leading-none tracking-tight text-foreground">
            {value}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="truncate text-[12px] text-muted-foreground">{hint}</p>
        {to ? <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" /> : null}
      </div>
    </>
  );

  const className =
    'htt-surface group block px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(15,35,64,0.07)]';

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
