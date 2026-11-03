import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';
import { listCoachingApprentices } from '@/api/coachingApprentices';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/common/DataTable';
import EmptyState from '@/components/common/EmptyState';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import ListToolbar from '@/components/common/ListToolbar';
import { FilterSelect } from '@/components/common/TableBits';
import { useAppConfig } from '@/lib/AppConfigContext';
import { formatDate } from '@/lib/constants';

const PAGE_SIZE = 25;
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', tone: 'amber' },
  { value: 'under_review', label: 'Under Review', tone: 'blue' },
  { value: 'shortlisted', label: 'Shortlisted', tone: 'purple' },
  { value: 'accepted', label: 'Accepted', tone: 'green' },
  { value: 'declined', label: 'Declined', tone: 'red' },
];

const SUMMARY_CARDS = [
  { key: 'all', label: 'All applications', status: undefined, icon: Users, tone: 'navy' },
  { key: 'pending', label: 'Pending', status: 'pending', icon: Clock3, tone: 'gold' },
  { key: 'under_review', label: 'Under review', status: 'under_review', icon: Eye, tone: 'sky' },
  { key: 'shortlisted', label: 'Shortlisted', status: 'shortlisted', icon: Award, tone: 'gold' },
  { key: 'accepted', label: 'Accepted', status: 'accepted', icon: CheckCircle2, tone: 'green' },
  { key: 'declined', label: 'Declined', status: 'declined', icon: XCircle, tone: 'rose' },
];

const STATUS_MAP = Object.fromEntries(
  STATUS_OPTIONS.map(({ value, label, tone }) => [value, { label, tone }]),
);

const errorMessage = (error) => {
  if (error?.code === 'RECRUITMENT_STORAGE_UNAVAILABLE') {
    return `${error.message || 'Recruitment applications are temporarily unavailable.'} Ask an administrator to check recruitment storage setup.`;
  }
  return error?.message || 'Could not load coaching apprentice applications. Please retry.';
};

export default function CoachingApprentices() {
  const { can } = useAppConfig();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPage = useCallback(async () => {
    if (!can('coaching_apprentices')) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listCoachingApprentices({ page, limit: PAGE_SIZE, status: status || undefined });
      setItems(result.items || []);
      setPagination(result.pagination || null);
    } catch (requestError) {
      setItems([]);
      setPagination(null);
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [can, page, status]);

  const loadCounts = useCallback(async () => {
    if (!can('coaching_apprentices')) {
      setCountsLoading(false);
      return;
    }
    setCountsLoading(true);
    try {
      const results = await Promise.all(
        SUMMARY_CARDS.map(({ status: cardStatus }) =>
          listCoachingApprentices({ page: 1, limit: 1, status: cardStatus }),
        ),
      );
      setCounts(Object.fromEntries(SUMMARY_CARDS.map(({ key }, index) => [key, results[index].pagination?.total ?? null])));
    } catch {
      // Summary counts are supplemental; the list keeps its own error state.
      setCounts(null);
    } finally {
      setCountsLoading(false);
    }
  }, [can]);

  useEffect(() => { loadPage(); }, [loadPage, refreshKey]);
  useEffect(() => { loadCounts(); }, [loadCounts, refreshKey]);

  if (!can('coaching_apprentices')) {
    return <EmptyState title="Access denied" description="You do not have permission to view coaching apprentice applications." />;
  }

  const columns = [
    {
      key: 'fullName',
      header: 'Applicant',
      render: (row) => <span className="font-medium">{row.fullName}</span>,
    },
    {
      key: 'phoneNumber',
      header: 'Phone number',
      render: (row) => <a href={`tel:${row.phoneNumber}`} className="hover:text-primary hover:underline" onClick={(event) => event.stopPropagation()}>{row.phoneNumber}</a>,
    },
    {
      key: 'email',
      header: 'Email address',
      render: (row) => <a href={`mailto:${row.email}`} className="hover:text-primary hover:underline" onClick={(event) => event.stopPropagation()}>{row.email}</a>,
    },
    { key: 'location', header: 'Location' },
    {
      key: 'createdAt',
      header: 'Application date',
      render: (row) => <span className="text-[12px] text-muted-foreground">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge value={row.status} map={STATUS_MAP} />,
    },
    {
      key: 'actions',
      header: '',
      width: 70,
      render: (row) => (
        <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]">
          <Link to={`/coaching-apprentices/${encodeURIComponent(row.id)}`} aria-label={`View ${row.fullName}`}>
            <Eye className="h-3 w-3" /> View
          </Link>
        </Button>
      ),
    },
  ];

  const refresh = () => setRefreshKey((value) => value + 1);
  const totalPages = pagination?.totalPages || 0;

  return (
    <div>
      <PageHeader
        title="Coaching Apprentices"
        description="Manage and review Coaching Apprentice applications submitted through the public recruitment form."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading || countsLoading} className="h-9 gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading || countsLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {SUMMARY_CARDS.map(({ key, label, icon, tone }) => (
          <StatCard
            key={key}
            label={label}
            value={counts?.[key] ?? '—'}
            hint="Applications"
            icon={icon}
            tone={tone}
            loading={countsLoading}
          />
        ))}
      </div>

      <ListToolbar right={<span className="text-[12px] text-muted-foreground">{pagination ? `${pagination.total} applications` : ''}</span>}>
        <FilterSelect
          value={status}
          onChange={(nextStatus) => { setStatus(nextStatus); setPage(1); }}
          options={STATUS_OPTIONS.map(({ value, label }) => ({ value, label }))}
          placeholder="All statuses"
          className="w-full sm:w-[190px]"
        />
      </ListToolbar>

      {error ? (
        <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
          <span>{errorMessage(error)}</span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="h-8">Retry</Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        emptyIcon={ClipboardList}
        emptyTitle={status ? `No ${STATUS_MAP[status]?.label.toLowerCase()} applications` : 'No coaching apprentice applications'}
        emptyDescription={error ? 'Retry the request when recruitment storage is available.' : 'Applications submitted through the public recruitment form will appear here.'}
        footer={pagination ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
            <span>{pagination.total === 0 ? '0 applications' : `Page ${pagination.page} of ${pagination.totalPages} · ${pagination.total} applications`}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={loading || page <= 1}>Previous</Button>
              <Button variant="outline" size="sm" className="h-7" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={loading || page >= totalPages}>Next</Button>
            </div>
          </div>
        ) : null}
      />
    </div>
  );
}

