import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { getCoachingApprentice, updateCoachingApprenticeStatus } from '@/api/coachingApprentices';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import DetailField, { DetailGrid, SectionCard } from '@/components/common/DetailField';
import EmptyState from '@/components/common/EmptyState';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { useToast } from '@/components/ui/use-toast';
import { useAppConfig } from '@/lib/AppConfigContext';
import { formatDateTime } from '@/lib/constants';

const STATUSES = [
  { value: 'pending', label: 'Pending', tone: 'amber' },
  { value: 'under_review', label: 'Under Review', tone: 'blue' },
  { value: 'shortlisted', label: 'Shortlisted', tone: 'purple' },
  { value: 'accepted', label: 'Accepted', tone: 'green' },
  { value: 'declined', label: 'Declined', tone: 'red' },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map(({ value, label, tone }) => [value, { label, tone }]));

const getErrorMessage = (error) => {
  if (error?.code === 'RECRUITMENT_STORAGE_UNAVAILABLE') {
    return `${error.message || 'Recruitment applications are temporarily unavailable.'} Ask an administrator to check recruitment storage setup.`;
  }
  return error?.message || 'Could not load this application. Please try again.';
};

export default function CoachingApprenticeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAppConfig();
  const { toast } = useToast();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextStatus, setNextStatus] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!can('coaching_apprentices')) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getCoachingApprentice(id);
      setApplication(result);
      setNextStatus(result.status || 'pending');
    } catch (requestError) {
      setApplication(null);
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [can, id]);

  useEffect(() => { load(); }, [load]);

  const saveStatus = async () => {
    const updated = await updateCoachingApprenticeStatus(id, nextStatus);
    // Update only after the backend confirms the status change.
    const confirmedStatus = updated.status || nextStatus;
    setApplication((current) => ({ ...current, ...updated, status: confirmedStatus }));
    setNextStatus(confirmedStatus);
    toast({ title: `Application marked ${STATUS_MAP[confirmedStatus]?.label || confirmedStatus}` });
  };

  if (!can('coaching_apprentices')) {
    return <EmptyState title="Access denied" description="You do not have permission to view coaching apprentice applications." />;
  }

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !application) {
    return (
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5">
          <Link to="/coaching-apprentices"><ArrowLeft className="h-3.5 w-3.5" /> Back to applications</Link>
        </Button>
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          {error ? getErrorMessage(error) : 'This application could not be found.'}
          <Button variant="outline" size="sm" onClick={load} className="ml-3 h-8">Retry</Button>
        </div>
      </div>
    );
  }

  const canManage = can('coaching_apprentices', 'full');
  const statusChanged = nextStatus !== application.status;

  return (
    <div>
      <PageHeader
        eyebrow="Coaching Apprentice Recruitment"
        title={application.fullName}
        description="Application details and review status."
        actions={<Button variant="ghost" size="sm" onClick={() => navigate('/coaching-apprentices')} className="h-9 gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back to applications</Button>}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title="Applicant details" description="Information submitted through the recruitment form.">
          <DetailGrid>
            <DetailField label="Full name" value={application.fullName} />
            <DetailField label="Phone number"><a className="text-primary hover:underline" href={`tel:${application.phoneNumber}`}>{application.phoneNumber}</a></DetailField>
            <DetailField label="Email address"><a className="break-all text-primary hover:underline" href={`mailto:${application.email}`}>{application.email}</a></DetailField>
            <DetailField label="Location" value={application.location} />
            <DetailField label="Application date" value={formatDateTime(application.createdAt)} />
          </DetailGrid>
        </SectionCard>

        <SectionCard title="Application status" description={canManage ? 'Choose a status and confirm the change.' : 'You have read-only access to this application.'}>
          <div className="space-y-4">
            <div>
              <p className="htt-label mb-1.5">Current status</p>
              <StatusBadge value={application.status} map={STATUS_MAP} />
            </div>
            {canManage ? (
              <div className="space-y-2">
                <label htmlFor="application-status" className="block text-[12px] font-medium text-foreground/80">Change status</label>
                <select
                  id="application-status"
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value)}
                  className="h-9 w-full rounded-lg border border-border/80 bg-card px-2.5 text-[12.5px] text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
                >
                  {STATUSES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!statusChanged} className="h-9 w-full gap-1.5 bg-[#0B1F3A] hover:bg-[#132E52]">
                  <Save className="h-3.5 w-3.5" /> Update status
                </Button>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
        }}
        title="Update application status?"
        description={<>Change this application from <strong>{STATUS_MAP[application.status]?.label || application.status}</strong> to <strong>{STATUS_MAP[nextStatus]?.label || nextStatus}</strong>.</>}
        confirmLabel="Confirm status change"
        onConfirm={saveStatus}
      />
    </div>
  );
}

