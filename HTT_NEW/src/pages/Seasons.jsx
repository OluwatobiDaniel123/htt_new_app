import React from 'react';
import { CalendarDays } from 'lucide-react';
import ResourcePage from '@/components/common/ResourcePage';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDate, labelize } from '@/lib/constants';

const SEASON_STATUS = {
  planned: { label: 'Planned', tone: 'gold' },
  in_preparation: { label: 'In preparation', tone: 'amber' },
  active: { label: 'Active', tone: 'green' },
  completed: { label: 'Completed', tone: 'navy' },
};

export default function Seasons() {
  const fields = [
    { name: 'name', label: 'Season name', required: true, placeholder: 'e.g. 2027 Academy League' },
    { name: 'code', label: 'Code' },
    { name: 'start_date', label: 'Start date', type: 'date' },
    { name: 'end_date', label: 'End date', type: 'date' },
    {
      name: 'age_categories',
      label: 'Age categories',
      type: 'multiselect',
      colSpan: 2,
      options: ['8-10', '11-12', '13-14'].map((v) => ({ value: v, label: v })),
    },
    { name: 'points_win', label: 'Points for a win', type: 'number', defaultValue: 3 },
    { name: 'points_draw', label: 'Points for a draw', type: 'number', defaultValue: 1 },
    { name: 'points_loss', label: 'Points for a loss', type: 'number', defaultValue: 0 },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: Object.keys(SEASON_STATUS).map((v) => ({ value: v, label: labelize(v) })),
      defaultValue: 'planned',
    },
    { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, rows: 2 },
  ];

  const columns = [
    {
      key: 'name',
      header: 'Season',
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(row.start_date)} – {formatDate(row.end_date)}
          </p>
        </div>
      ),
    },
    {
      key: 'age_categories',
      header: 'Age categories',
      render: (row) => (row.age_categories || []).join(', ') || '—',
    },
    {
      key: 'points',
      header: 'Points (W/D/L)',
      render: (row) => `${row.points_win ?? 3} / ${row.points_draw ?? 1} / ${row.points_loss ?? 0}`,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} map={SEASON_STATUS} /> },
  ];

  return (
    <ResourcePage
      moduleKey="league"
      title="Seasons"
      description="The HTT Academy League remains Planned or In Preparation until management confirms launch. Points rules are configurable per season."
      entityLabel="season"
      entity="Season"
      fields={fields}
      columns={columns}
      searchFields={['name', 'code']}
      searchPlaceholder="Search season…"
      filters={[
        { key: 'status', label: 'All statuses', options: Object.keys(SEASON_STATUS).map((v) => ({ value: v, label: labelize(v) })) },
      ]}
      defaultValues={{ status: 'planned', points_win: 3, points_draw: 1, points_loss: 0 }}
      emptyIcon={CalendarDays}
      emptyTitle="No seasons created"
      emptyDescription="Create a season to begin preparing teams and fixtures."
    />
  );
}