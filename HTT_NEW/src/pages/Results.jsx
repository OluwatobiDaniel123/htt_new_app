import React from 'react';
import { Medal } from 'lucide-react';
import ResourcePage from '@/components/common/ResourcePage';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDateTime, labelize } from '@/lib/constants';

const FIXTURE_STATUS = {
  scheduled: { label: 'Scheduled', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  postponed: { label: 'Postponed', tone: 'amber' },
  cancelled: { label: 'Cancelled', tone: 'navy' },
};

export default function Results() {
  const fields = [
    { name: 'home_team_name', label: 'Home team', required: true },
    { name: 'away_team_name', label: 'Away team', required: true },
    { name: 'match_date', label: 'Kick-off', type: 'datetime', required: true },
    { name: 'home_score', label: 'Home score', type: 'number', min: 0 },
    { name: 'away_score', label: 'Away score', type: 'number', min: 0 },
    { name: 'venue', label: 'Venue' },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: Object.keys(FIXTURE_STATUS).map((v) => ({ value: v, label: labelize(v) })),
      defaultValue: 'completed',
    },
    { name: 'match_report', label: 'Match report', type: 'textarea', colSpan: 2, rows: 3 },
  ];

  const columns = [
    {
      key: 'teams',
      header: 'Result',
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">
            {row.home_team_name} <span className="htt-tabular">{row.home_score ?? 0}</span>
            <span className="text-muted-foreground"> – </span>
            <span className="htt-tabular">{row.away_score ?? 0}</span> {row.away_team_name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {row.season_name || 'No season'} · {row.age_category || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'match_date',
      header: 'Played',
      render: (row) => <span className="text-[12px]">{formatDateTime(row.match_date)}</span>,
    },
    { key: 'venue', header: 'Venue', render: (row) => row.venue || '—' },
    {
      key: 'match_report',
      header: 'Report',
      render: (row) => (
        <span className="line-clamp-2 max-w-[260px] text-[11.5px] text-muted-foreground">
          {row.match_report || '—'}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} map={FIXTURE_STATUS} /> },
  ];

  return (
    <ResourcePage
      moduleKey="league"
      title="Results"
      description="Record final scores and match reports. Standings are calculated from these results only."
      entityLabel="result"
      entity="Fixture"
      fields={fields}
      columns={columns}
      searchFields={['home_team_name', 'away_team_name']}
      searchPlaceholder="Search team…"
      filters={[
        { key: 'status', label: 'All statuses', options: Object.keys(FIXTURE_STATUS).map((v) => ({ value: v, label: labelize(v) })) },
      ]}
      defaultQuery={{ status: 'completed' }}
      defaultValues={{ status: 'completed' }}
      sort="-match_date"
      emptyIcon={Medal}
      emptyTitle="No results recorded"
      emptyDescription="Completed fixtures with scores appear here and feed the standings table."
    />
  );
}