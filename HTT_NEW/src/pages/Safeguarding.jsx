import React, { useMemo } from 'react';
import { ShieldCheck, Lock, FileCheck2, Clock } from 'lucide-react';
import ResourcePage from '@/components/common/ResourcePage';
import StatusBadge from '@/components/common/StatusBadge';
import useCollection from '@/hooks/useCollection';
import { formatDate, labelize } from '@/lib/constants';

const CONSENT_STATUS = {
  granted: { label: 'Granted', tone: 'green' },
  pending: { label: 'Pending', tone: 'amber' },
  withdrawn: { label: 'Withdrawn', tone: 'red' },
};

const CONSENT_TYPES = {
  media_photography: { label: 'Media — photography', tone: 'sky' },
  media_video: { label: 'Media — video', tone: 'sky' },
  data_processing: { label: 'Data processing', tone: 'navy' },
  medical: { label: 'Medical treatment', tone: 'green' },
  travel: { label: 'Travel consent', tone: 'gold' },
};

export default function Safeguarding() {
  const players = useCollection('Player', { archived: false }, { sort: 'full_name', limit: 200 });
  const playerOptions = useMemo(
    () => players.items.map((p) => ({ value: p.id, label: p.full_name })),
    [players.items]
  );

  const fields = [
    {
      name: 'consent_type',
      label: 'Consent type',
      type: 'select',
      required: true,
      options: Object.keys(CONSENT_TYPES).map((v) => ({ value: v, label: labelize(v) })),
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: Object.keys(CONSENT_STATUS).map((v) => ({ value: v, label: labelize(v) })),
      defaultValue: 'granted',
    },
    { name: 'player_id', label: 'Player', type: 'select', options: playerOptions },
    { name: 'player_name', label: 'Player name', required: true },
    { name: 'guardian_name', label: 'Guardian granting consent' },
    { name: 'granted_at', label: 'Granted on', type: 'date' },
    { name: 'expires_at', label: 'Expires on', type: 'date' },
    { name: 'document_uri', label: 'Signed form reference (private file)' },
    { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, rows: 2 },
  ];

  const columns = [
    {
      key: 'player_name',
      header: 'Player',
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.player_name}</p>
          <p className="text-[11px] text-muted-foreground">{row.guardian_name || 'Guardian not recorded'}</p>
        </div>
      ),
    },
    { key: 'consent_type', header: 'Consent', render: (row) => <StatusBadge value={row.consent_type} map={CONSENT_TYPES} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} map={CONSENT_STATUS} /> },
    {
      key: 'granted_at',
      header: 'Granted',
      render: (row) => <span className="text-[12px]">{formatDate(row.granted_at)}</span>,
    },
    {
      key: 'expires_at',
      header: 'Expires',
      render: (row) => <span className="text-[12px]">{formatDate(row.expires_at)}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Lock, title: 'Private document storage', text: 'Uploaded files are stored privately and opened only through short-lived signed links.' },
          { icon: FileCheck2, title: 'Guardian consent records', text: 'Media, data, medical and travel consent are recorded per child with dates.' },
          { icon: ShieldCheck, title: 'Media approval gate', text: 'Content featuring children cannot be published without explicit safeguarding approval.' },
          { icon: Clock, title: 'Approved retention', text: 'Archived records follow the retention period configured in system settings.' },
        ].map((item) => (
          <div key={item.title} className="htt-surface px-4 py-3">
            <item.icon className="h-4 w-4 text-[#0E7A4F]" />
            <p className="mt-2 text-[12.5px] font-semibold">{item.title}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>

      <ResourcePage
        moduleKey="safeguarding"
        title="Safeguarding & Consent"
        description="Consent records per child. Opening a signed consent document is written to the audit log."
        entityLabel="consent record"
        entity="ConsentRecord"
        fields={fields}
        columns={columns}
        searchFields={['player_name', 'guardian_name']}
        searchPlaceholder="Search player or guardian…"
        filters={[
          { key: 'status', label: 'All statuses', options: Object.keys(CONSENT_STATUS).map((v) => ({ value: v, label: labelize(v) })) },
          { key: 'consent_type', label: 'All consent types', options: Object.keys(CONSENT_TYPES).map((v) => ({ value: v, label: labelize(v) })) },
        ]}
        defaultValues={{ status: 'granted', subject_type: 'player' }}
        emptyIcon={ShieldCheck}
        emptyTitle="No consent records"
        emptyDescription="Consent records are created when a registration is approved, or added manually here."
      />
    </div>
  );
}