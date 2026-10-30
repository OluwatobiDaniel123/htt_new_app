import React from 'react';
import { labelize, STATUS_TONES } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function StatusBadge({ value, map, tone, className, dot = true }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-xs text-muted-foreground/70">—</span>;
  }
  const entry = map?.[value];
  const label = entry?.label || labelize(value);
  const resolvedTone = entry?.tone || tone || 'navy';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset',
        STATUS_TONES[resolvedTone] || STATUS_TONES.navy,
        className
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" /> : null}
      {label}
    </span>
  );
}