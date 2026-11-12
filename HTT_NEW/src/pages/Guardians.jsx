import React from 'react';
import { UserRound } from 'lucide-react';
import ResourcePage from '@/components/common/ResourcePage';
import StatusBadge from '@/components/common/StatusBadge';
import { labelize } from '@/lib/constants';

const ACCOUNT_STATUS = {
  active: { label: 'Active', tone: 'green' },
  inactive: { label: 'Inactive', tone: 'navy' },
};

const CONSENT_STATUS = {
  pending: { label: 'Pending', tone: 'amber' },
  partial: { label: 'Partial', tone: 'gold' },
  granted: { label: 'Granted', tone: 'green' },
  withdrawn: { label: 'Withdrawn', tone: 'red' },
};

export default function Guardians() {

  const fields = [
    { name: 'full_name', label: 'Full name', required: true },
    { name: 'phone', label: 'Phone number', required: true, type: 'tel', placeholder: '080…' },
    { name: 'email', label: 'Email address', type: 'email' },
    {
      name: 'preferred_contact',
      label: 'Preferred contact',
      type: 'select',
      options: ['phone', 'whatsapp', 'email', 'sms'].map((v) => ({ value: v, label: labelize(v) })),
    },
    {
      name: 'account_status',
      label: 'Account status',
      type: 'select',
      options: Object.keys(ACCOUNT_STATUS).map((v) => ({ value: v, label: labelize(v) })),
      defaultValue: 'active',
    },
    {
      name: 'consent_status',
      label: 'Consent status',
      type: 'select',
      options: Object.keys(CONSENT_STATUS).map((v) => ({ value: v, label: labelize(v) })),
      defaultValue: 'pending',
    },
    { name: 'address', label: 'Home address', colSpan: 2 },
    {
      name: 'communication_preferences',
      label: 'Communication preferences',
      type: 'multiselect',
      colSpan: 2,
      options: ['email', 'sms', 'whatsapp', 'phone'].map((v) => ({ value: v, label: labelize(v) })),
    },
    { name: 'notes', label: 'Internal notes', type: 'textarea', colSpan: 2, rows: 2 },
  ];

  const columns = [
    {
      key: 'full_name',
      header: 'Guardian',
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium text-foreground">{row.full_name}</p>
          <p className="text-[11px] text-muted-foreground">{row.email || 'No email on file'}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    {
      key: 'preferred_contact',
      header: 'Preferred contact',
      render: (row) => (row.preferred_contact ? labelize(row.preferred_contact) : '—'),
    },
    {
      key: 'account_status',
      header: 'Account',
      render: (row) => <StatusBadge value={row.account_status} map={ACCOUNT_STATUS} />,
    },
    {
      key: 'consent_status',
      header: 'Consent',
      render: (row) => <StatusBadge value={row.consent_status} map={CONSENT_STATUS} />,
    },
  ];

  return (
    <ResourcePage
      moduleKey="guardians"
      title="Parents & Guardians"
      description="Guardian contact records, consent status and communication preferences. Duplicate phone numbers are blocked."
      entityLabel="guardian"
      entity="Guardian"
      fields={fields}
      columns={columns}
      searchFields={['full_name', 'phone', 'email']}
      searchPlaceholder="Search by name, phone or email…"
      filters={[
        {
          key: 'account_status',
          label: 'All accounts',
          options: Object.keys(ACCOUNT_STATUS).map((v) => ({ value: v, label: labelize(v) })),
        },
        {
          key: 'consent_status',
          label: 'All consent states',
          options: Object.keys(CONSENT_STATUS).map((v) => ({ value: v, label: labelize(v) })),
        },
      ]}
      emptyIcon={UserRound}
      emptyTitle="No guardians recorded"
      emptyDescription="Guardians are linked to one or more children and hold consent and media permissions."
    />
  );
}
