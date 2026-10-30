import React from 'react';
import { HeartHandshake } from 'lucide-react';
import ResourcePage from '@/components/common/ResourcePage';
import StatusBadge from '@/components/common/StatusBadge';
import { labelize } from '@/lib/constants';

const SPONSOR_TYPES = {
  individual_player: { label: 'Individual player support', tone: 'sky' },
  scholarship_fund: { label: 'Scholarship fund', tone: 'green' },
  school_project: { label: 'HTT School Project', tone: 'gold' },
  corporate_partnership: { label: 'Corporate partnership', tone: 'purple' },
};

const SPONSOR_STATUS = {
  prospect: { label: 'Prospect', tone: 'amber' },
  active: { label: 'Active', tone: 'green' },
  paused: { label: 'Paused', tone: 'navy' },
  closed: { label: 'Closed', tone: 'red' },
};

export default function Sponsors() {
  const fields = [
    { name: 'name', label: 'Sponsor name', required: true },
    {
      name: 'type',
      label: 'Support category',
      type: 'select',
      options: Object.keys(SPONSOR_TYPES).map((v) => ({ value: v, label: labelize(v) })),
      defaultValue: 'scholarship_fund',
    },
    { name: 'contact_name', label: 'Primary contact' },
    { name: 'organisation', label: 'Organisation' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'address', label: 'Address', colSpan: 2 },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: Object.keys(SPONSOR_STATUS).map((v) => ({ value: v, label: labelize(v) })),
      defaultValue: 'prospect',
    },
    { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, rows: 2 },
  ];

  const columns = [
    {
      key: 'name',
      header: 'Sponsor',
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">{row.organisation || row.contact_name || '—'}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Category', render: (row) => <StatusBadge value={row.type} map={SPONSOR_TYPES} /> },
    {
      key: 'contact',
      header: 'Contact',
      render: (row) => (
        <div className="text-[11.5px]">
          <p>{row.email || '—'}</p>
          <p className="text-muted-foreground">{row.phone || '—'}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} map={SPONSOR_STATUS} /> },
  ];

  return (
    <ResourcePage
      moduleKey="funding"
      title="Sponsors"
      description="Sponsor and partner records. Pledged, received and outstanding amounts are tracked on funding records — sponsors never see children's private records."
      entityLabel="sponsor"
      entity="Sponsor"
      fields={fields}
      columns={columns}
      searchFields={['name', 'organisation', 'email']}
      searchPlaceholder="Search sponsor or organisation…"
      filters={[
        { key: 'type', label: 'All categories', options: Object.keys(SPONSOR_TYPES).map((v) => ({ value: v, label: labelize(v) })) },
        { key: 'status', label: 'All statuses', options: Object.keys(SPONSOR_STATUS).map((v) => ({ value: v, label: labelize(v) })) },
      ]}
      defaultValues={{ status: 'prospect', type: 'scholarship_fund' }}
      emptyIcon={HeartHandshake}
      emptyTitle="No sponsors recorded"
      emptyDescription="Add a sponsor once a relationship is confirmed, then log pledges and payments."
    />
  );
}