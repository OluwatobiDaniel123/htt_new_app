import React from 'react';
import { cn } from '@/lib/utils';

export default function ChartPanel({ title, description, actions, children, className, height = 'h-[230px]' }) {
  return (
    <section className={cn('htt-surface overflow-hidden', className)}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </header>
      <div className={cn('px-2 py-3', height)}>{children}</div>
    </section>
  );
}

export const CHART_COLORS = ['#0B1F3A', '#0E7A4F', '#C2A24C', '#3B7EA1', '#B4553F', '#6B7A8F'];