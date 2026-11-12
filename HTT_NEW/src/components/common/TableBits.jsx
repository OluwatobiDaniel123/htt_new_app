import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

/** @param {{label?: string, onClick: () => void, disabled?: boolean, title?: string}} props */
export function AddButton({ label = 'New record', onClick, disabled, title }) {
  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-9 gap-1.5 bg-[#0B1F3A] text-[12.5px] hover:bg-[#132E52]"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

/** @param {{value?: string, onChange: (value: string) => void, options: Array<{value: string, label: string}>, placeholder: string, className?: string}} props */
export function FilterSelect({ value, onChange, options, placeholder, className = 'w-[170px]' }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 ${className} rounded-lg border border-border/80 bg-card px-2.5 text-[12.5px] text-foreground/85 shadow-none outline-none focus:border-ring focus:ring-1 focus:ring-ring/30`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** @param {{shown: number, total: number | null, hasMore: boolean, onLoadMore: () => void, noun?: string}} props */
export function TableFooter({ shown, total, hasMore, onLoadMore, noun = 'records' }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
      <span>
        Showing {shown} of {total ?? shown} {noun}
      </span>
      {hasMore ? (
        <Button size="sm" variant="outline" className="h-7 text-[12px]" onClick={onLoadMore}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}
