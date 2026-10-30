import React, { useMemo, useState } from 'react';
import { Award, BadgeCheck } from 'lucide-react';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import { currency, formatDate, labelize } from '@/lib/constants';
import ResourcePage from '@/components/common/ResourcePage';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import StatusBadge from '@/components/common/StatusBadge';
import useCollection from '@/hooks/useCollection';

export const SCHOLARSHIP_STATUS = {
  received: { label: 'Received', tone: 'blue' },
  eligibility_review: { label: 'Eligibility review', tone: 'amber' },
  assessment_scheduled: { label: 'Assessment scheduled', tone: 'purple' },
  assessed: { label: 'Assessed', tone: 'sky' },
  selection_panel: { label: 'Selection panel', tone: 'gold' },
  approved: { label: 'Approved', tone: 'green' },
  waitlisted: { label: 'Waitlisted', tone: 'gold' },
  declined: { label: 'Declined', tone: 'red' },
};

export default function ScholarshipApplications() {
  const { toast } = useToast();
  const players = useCollection('Player', { archived: false }, { sort: 'full_name', limit: 100 });
  const centres = useCollection('Centre', {}, { sort: 'name', limit: 100 });
  const programmes = useCollection('Programme', {}, { sort: 'name', limit: 100 });
  const [approving, setApproving] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const centreOptions = useMemo(
    () => centres.items.map((c) => ({ value: c.id, label: c.name })),
    [centres.items]
  );
  const programmeOptions = useMemo(
    () => programmes.items.map((p) => ({ value: p.id, label: p.name })),
    [programmes.items]
  );

  const fields = [
    { name: 'applicant_name', label: 'Applicant name', required: true },
    { name: 'guardian_name', label: 'Guardian name', required: true },
    { name: 'guardian_phone', label: 'Guardian phone', type: 'tel' },
    { name: 'guardian_email', label: 'Guardian email', type: 'email' },
    { name: 'player_id', label: 'Linked player', type: 'select', options: players.items.map((player) => ({ value: player.id, label: `${player.full_name} · ${player.player_id || player.id}` })) },
    { name: 'centre_id', label: 'Centre', type: 'select', options: centreOptions },
    { name: 'programme_id', label: 'Programme', type: 'select', options: programmeOptions },
    {
      name: 'status',
      label: 'Workflow stage',
      type: 'select',
      options: Object.keys(SCHOLARSHIP_STATUS).map((v) => ({ value: v, label: labelize(v) })),
      defaultValue: 'received',
    },
    { name: 'assessment_result', label: 'Assessment result', placeholder: 'e.g. 8.4/10' },
    { name: 'award_amount', label: 'Award amount (₦)', type: 'money' },
    { name: 'funding_secured', label: 'Funding secured (₦)', type: 'money' },
    { name: 'funding_required', label: 'Funding still required (₦)', type: 'money' },
    { name: 'start_date', label: 'Start date', type: 'date' },
    { name: 'end_date', label: 'End date', type: 'date' },
    { name: 'renewal_date', label: 'Renewal date', type: 'date' },
    { name: 'age_ok', label: 'Eligibility: age criteria met', type: 'checkbox', colSpan: 2 },
    { name: 'notes', label: 'Review notes', type: 'textarea', colSpan: 2, rows: 2 },
    { name: 'decision_notes', label: 'Selection decision notes', type: 'textarea', colSpan: 2, rows: 2 },
  ];

  const columns = [
    {
      key: 'applicant_name',
      header: 'Applicant',
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.applicant_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.reference || 'No reference'} · {row.centre_name || 'No centre'}
          </p>
        </div>
      ),
    },
    {
      key: 'guardian_name',
      header: 'Guardian',
      render: (row) => (
        <div>
          <p className="text-[12.5px]">{row.guardian_name}</p>
          <p className="text-[11px] text-muted-foreground">{row.guardian_phone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'award_amount',
      header: 'Award',
      render: (row) => (row.award_amount ? currency(row.award_amount) : '—'),
    },
    {
      key: 'funding',
      header: 'Funding',
      render: (row) => (
        <div className="text-[11.5px]">
          <p className="text-emerald-700">{currency(row.funding_secured)} secured</p>
          <p className="text-amber-700">{currency(row.funding_required)} required</p>
        </div>
      ),
    },
    { key: 'status', header: 'Stage', render: (row) => <StatusBadge value={row.status} map={SCHOLARSHIP_STATUS} /> },
    {
      key: 'created_date',
      header: 'Received',
      render: (row) => <span className="text-[12px] text-muted-foreground">{formatDate(row.created_date)}</span>,
    },
  ];

  const transform = (values) => ({
    ...values,
    reference: values.reference || `HTT-SCH-${Date.now().toString(36).toUpperCase()}`,
    centre_name: centres.items.find((c) => c.id === values.centre_id)?.name || '',
    programme_name: programmes.items.find((p) => p.id === values.programme_id)?.name || '',
    eligibility_checks: {
      age_ok: !!values.age_ok,
      residence_ok: !!values.residence_ok,
      financial_need_ok: !!values.financial_need_ok,
      documents_ok: !!values.documents_ok,
    },
    decision_history: values.decision_history || [
      { status: values.status || 'received', note: 'Application captured', at: new Date().toISOString(), by: 'admin' },
    ],
  });

  const handleApprove = async () => {
    const app = approving;
    const playerId = app.player_id || players.items.find((player) => player.full_name?.toLowerCase() === app.applicant_name?.toLowerCase())?.id;
    if (!playerId) throw new Error('Link the applicant to an existing player before approving the award.');
    await api.post(`/scholarship-applications/${app.id}/approve`, { playerId });
    toast({ title: 'Scholarship award activated' });
    setApproving(null);
    setRefreshKey((key) => key + 1);
  };

  return (
    <>
      <ResourcePage
        key={refreshKey}
        moduleKey="scholarships"
        title="Scholarship Applications"
        description="Full scholarship pipeline: eligibility review, assessment, selection panel and award decisions. Funding secured and required are tracked separately."
        entityLabel="application"
        entity="ScholarshipApplication"
        fields={fields}
        transform={transform}
        columns={columns}
        searchFields={['applicant_name', 'guardian_name', 'reference']}
        searchPlaceholder="Search applicant or reference…"
        filters={[
          {
            key: 'status',
            label: 'All stages',
            options: Object.keys(SCHOLARSHIP_STATUS).map((v) => ({ value: v, label: labelize(v) })),
          },
        ]}
        defaultValues={{ status: 'received' }}
        emptyIcon={Award}
        emptyTitle="No scholarship applications"
        emptyDescription="Applications submitted from the public website or captured by staff appear here."
        rowActions={(row) =>
          row.status !== 'approved' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setApproving(row);
              }}
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-[#0E7A4F]/10 hover:text-[#0E7A4F]"
              title="Approve and create award"
            >
              <BadgeCheck className="h-3.5 w-3.5" />
            </button>
          ) : null
        }
      />

      <ConfirmDialog
        open={!!approving}
        onOpenChange={(v) => (!v ? setApproving(null) : null)}
        title="Approve this scholarship?"
        description={`An active award of ${currency(approving?.award_amount)} will be created for ${
          approving?.applicant_name || 'this applicant'
        }. Approving does not guarantee funding — record secured funding separately.`}
        confirmLabel="Approve & activate"
        onConfirm={handleApprove}
      />
    </>
  );
}
