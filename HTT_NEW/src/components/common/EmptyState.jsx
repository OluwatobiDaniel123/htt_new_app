import React from 'react';
import { cn } from '@/lib/utils';

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon ? (
        <span className="mb-3 rounded-xl border border-border/80 bg-muted/40 p-2.5 text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </span>
      ) : null}
      <p className="text-[14px] font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}