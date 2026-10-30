import React, { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import ResourcePage from '@/components/common/ResourcePage';
import StatusBadge from '@/components/common/StatusBadge';
import useCollection from '@/hooks/useCollection';
import { formatDate, labelize } from '@/lib/constants';

export const REG_STATUS = {
  submitted: { label: 'Submitted', tone: 'blue' },
  under_review: { label: 'Under review', tone: 'amber' },
  assessment_required: { label: 'Assessment required', tone: 'purple' },
  information_required: { label: 'More info required', tone: 'gold' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};

export const PAYMENT_STATUS = {
  unpaid: { label: 'Unpaid', tone: 'red' },
  partial: { label: 'Partial', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  not_required: { label: 'Not required', tone: 'navy' },
};

export default function Registrations() {
  const centres = useCollection('Centre', {}, { sort: 'name', limit: 100 });
  const programmes = useCollection('Programme', {}, { sort: 'name', limit: 100 });
  const centreOptions = useMemo(
    () => centres.items.map((c) => ({ value: c.id, label: c.name })),
    [centres.items]
  );
  const programmeOptions = useMemo(
    () => programmes.items.map((p) => ({ value: p.id, label: p.name })),
    [programmes.items]
  );

  const fields = [
    { name: 'child_name', label: 'Child full name', required: true },
    { name: 'child_date_of_birth', label: 'Child date of birth', type: 'date' },
    { name: 'guardian_name', label: 'Guardian name', required: true },
    { name: 'guardian_phone', label: 'Guardian phone', required: true, type: 'tel' },
    { name: 'guardian_email', label: 'Guardian email', type: 'email' },
    { name: 'guardian_address', label: 'Home address' },
    { name: 'centre_id', label: 'Selected centre', type: 'select', options: centreOptions },
    { name: 'programme_id', label: 'Selected programme', type: 'select', options: programmeOptions },
    {
      name: 'pathway',
      label: 'Pathway',
      type: 'select',
      options: [
        { value: 'paid_academy', label: 'Paid Academy' },
        { value: 'scholarship_assessment', label: 'Scholarship Assessment' },
      ],
      defaultValue: 'paid_academy',
    },
    { name: 'age_group', label: 'Age group', placeholder: 'e.g. 8-10' },
    { name: 'consent_data', label: 'Guardian consented to data processing', type: 'checkbox', colSpan: 2 },
    { name: 'consent_media', label: 'Guardian consented to media use', type: 'checkbox', colSpan: 2 },
    { name: 'consent_medical', label: 'Guardian consented to medical treatment', type: 'checkbox', colSpan: 2 },
    { name: 'internal_notes', label: 'Internal notes', type: 'textarea', colSpan: 2, rows: 2 },
  ];

  const columns = [
    {
      key: 'reference',
      header: 'Registration',
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium text-foreground">{row.child_name}</p>
          <p className="text-[11px] text-muted-foreground">{row.reference || 'No reference'}</p>
        </div>
      ),
    },
    {
      key: 'guardian_name',
      header: 'Guardian',
      render: (row) => (
        <div>
          <p className="text-[12.5px]">{row.guardian_name}</p>
          <p className="text-[11px] text-muted-foreground">{row.guardian_phone || 'No phone'}</p>
        </div>
      ),
    },
    { key: 'centre_name', header: 'Centre', render: (row) => row.centre_name || '—' },
    {
      key: 'pathway',
      header: 'Pathway',
      render: (row) => (
        <span className="text-[12px] text-foreground/80">
          {row.pathway === 'scholarship_assessment' ? 'Scholarship assessment' : 'Paid Academy'}
        </span>
      ),
    },
    {
      key: 'payment_status',
      header: 'Payment',
      render: (row) => <StatusBadge value={row.payment_status} map={PAYMENT_STATUS} />,
    },
    {
      key: 'document_status',
      header: 'Documents',
      render: (row) => <StatusBadge value={row.document_status} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge value={row.status} map={REG_STATUS} />,
    },
    {
      key: 'submitted_at',
      header: 'Submitted',
      render: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDate(row.submitted_at || row.created_date)}
        </span>
      ),
    },
  ];

  return (
    <ResourcePage
      moduleKey="registrations"
      title="Registrations"
      description="Review submitted registrations, verify documents and schedule assessments. Approving a registration provisions the player record."
      entityLabel="registration"
      entity="Registration"
      fields={fields}
      columns={columns}
      searchFields={['child_name', 'guardian_name', 'reference', 'guardian_phone']}
      searchPlaceholder="Search child, guardian or reference…"
      filters={[
        { key: 'status', label: 'All statuses', options: Object.keys(REG_STATUS).map((v) => ({ value: v, label: labelize(v) })) },
        { key: 'centre_id', label: 'All centres', options: centreOptions },
      ]}
      defaultValues={{ pathway: 'paid_academy', payment_status: 'unpaid', status: 'submitted' }}
      rowTo={(row) => `/registrations/${row.id}`}
      emptyIcon={ClipboardList}
      emptyTitle="No registrations yet"
      emptyDescription="Registrations submitted from the public website or captured by staff appear here for review."
    />
  );
}
