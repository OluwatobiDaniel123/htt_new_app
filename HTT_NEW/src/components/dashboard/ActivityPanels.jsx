import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, CalendarCheck, ArrowRight } from 'lucide-react';
import { formatDateTime, formatDate, labelize } from '@/lib/constants';
import EmptyState from '@/components/common/EmptyState';

export function ActivityFeed({ items }) {
  return (
    <section className="htt-surface overflow-hidden">
      <header className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold">Recent activity</h2>
        </div>
        <Link to="/audit-logs" className="text-[11.5px] font-medium text-[#0E7A4F] hover:underline">
          Audit log
        </Link>
      </header>
      {items.length === 0 ? (
        <EmptyState
          title="No activity recorded yet"
          description="Actions such as registration decisions and record changes appear here."
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0E7A4F]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] text-foreground">
                  <span className="font-medium">{entry.actor_name || entry.actor_email}</span>{' '}
                  <span className="text-muted-foreground">{labelize(entry.action)}</span>{' '}
                  <span className="font-medium">{entry.entity_name}</span>
                  {entry.record_label ? (
                    <span className="text-muted-foreground"> · {entry.record_label}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDateTime(entry.created_date)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function UpcomingOperations({ assessments, tasks }) {
  return (
    <section className="htt-surface overflow-hidden">
      <header className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold">Upcoming operations</h2>
        </div>
        <Link to="/assessments" className="text-[11.5px] font-medium text-[#0E7A4F] hover:underline">
          Assessments
        </Link>
      </header>
      {assessments.length === 0 && tasks.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          description="Scheduled assessments and follow-up tasks will appear here."
        />
      ) : (
        <div className="divide-y divide-border/60">
          {assessments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-foreground">{a.player_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {labelize(a.type)} assessment · {a.centre_name || 'No centre'}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] text-foreground/70">
                {formatDate(a.scheduled_at, 'dd MMM')}
              </span>
            </div>
          ))}
          {tasks.map((t) => (
            <Link
              key={t.id}
              to="/tasks"
              className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-foreground">{t.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  Follow-up · {t.contact_name || t.assigned_to || 'Unassigned'}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                {formatDate(t.due_date, 'dd MMM')}
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}