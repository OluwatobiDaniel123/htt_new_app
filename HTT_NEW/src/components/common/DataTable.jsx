import React from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '@/components/common/EmptyState';

export default function DataTable({
  columns,
  rows = [],
  loading,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyIcon,
  emptyAction,
  onRowClick,
  rowTo,
  footer,
}) {
  const navigate = useNavigate();

  const handleRow = (row) => {
    if (onRowClick) return onRowClick(row);
    if (rowTo) return navigate(rowTo(row));
    return null;
  };

  const clickable = !!onRowClick || !!rowTo;

  return (
    <div className="htt-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-border/50 last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3.5">
                        <div className="h-3.5 w-full max-w-[140px] animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={clickable ? () => handleRow(row) : undefined}
                    className={`border-b border-border/50 last:border-0 transition-colors ${
                      clickable ? 'cursor-pointer hover:bg-muted/40' : ''
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-[13px] text-foreground/90 ${col.className || ''}`}
                      >
                        {col.render ? col.render(row) : row[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : null}
      {footer ? <div className="border-t border-border/70 px-4 py-2.5">{footer}</div> : null}
    </div>
  );
}