import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, Wallet, AlertCircle } from 'lucide-react';
import { api, fromUiRecord } from '@/api/client';
import { useAppConfig } from '@/lib/AppConfigContext';
import { useToast } from '@/components/ui/use-toast';
import { currency, formatDate, labelize, todayISO } from '@/lib/constants';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';
import ChartPanel from '@/components/common/ChartPanel';
import DataTable from '@/components/common/DataTable';
import FormDialog from '@/components/common/FormDialog';
import AccessDenied from '@/components/common/AccessDenied';
import { AddButton } from '@/components/common/TableBits';
import useCollection from '@/hooks/useCollection';

const CATEGORIES = ['individual_player', 'scholarship_fund', 'school_project', 'corporate_partnership'];
const sumOf = (rows, key) => rows.reduce((total, row) => total + Number(row?.[key] || 0), 0);

export default function FundingOverview() {
  const { can, settings } = useAppConfig();
  const { toast } = useToast();
  const [pledges, setPledges] = useState([]);
  const [received, setReceived] = useState([]);
  const [open, setOpen] = useState(false);
  const records = useCollection('FundingRecord', {}, { sort: '-record_date', limit: 50 });
  const sponsors = useCollection('Sponsor', {}, { sort: 'name', limit: 100 });

  const loadTotals = async () => {
    try {
      const rows = await api.get('/funding-summary');
      setPledges((rows || []).filter((row) => row.kind === 'pledge').map((row) => ({ category: row.category, sum_amount: Number(row.total_amount) })));
      setReceived((rows || []).filter((row) => row.kind === 'payment').map((row) => ({ category: row.category, sum_amount: Number(row.total_amount) })));
    } catch (error) {
      toast({ title: error.message || 'Could not load funding totals', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadTotals();
  }, []);

  const totalPledged = sumOf(pledges, 'sum_amount');
  const totalReceived = sumOf(received, 'sum_amount');

  const series = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        label: labelize(cat).replace('Htt', 'HTT'),
        pledged: pledges.find((p) => p.category === cat)?.sum_amount || 0,
        received: received.find((p) => p.category === cat)?.sum_amount || 0,
      })),
    [pledges, received]
  );

  if (!can('funding')) return <AccessDenied moduleName="funding" />;

  const columns = [
    {
      key: 'sponsor_name',
      header: 'Sponsor',
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.sponsor_name}</p>
          <p className="text-[11px] text-muted-foreground">{row.reference || 'No reference'}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => labelize(row.category) },
    { key: 'kind', header: 'Type', render: (row) => labelize(row.kind) },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => <span className="htt-tabular font-medium">{currency(row.amount)}</span>,
    },
    {
      key: 'record_date',
      header: 'Date',
      render: (row) => <span className="text-[12px]">{formatDate(row.record_date || row.created_date)}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => labelize(row.status) },
  ];

  const handleCreate = async (values) => {
    await api.post('/funding-records', fromUiRecord({ ...values, amount: Number(values.amount || 0) }));
    toast({ title: 'Funding record logged' });
    records.reload();
    loadTotals();
  };

  return (
    <div>
      <PageHeader
        title="Funding Overview"
        description="Pledged, received and outstanding sponsorship funding by category. Figures come from funding transactions only."
        actions={
          can('funding', 'full') ? (
            <AddButton label="Log funding" onClick={() => setOpen(true)} />
          ) : null
        }
      />

      {settings?.school_project_status && settings.school_project_status !== 'confirmed' ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[12.5px] text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            The HTT School Project is currently marked{' '}
            <strong>{labelize(settings.school_project_status)}</strong> — not an operational
            commitment. Update this in System Settings once management confirms it.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total pledged" value={currency(totalPledged)} hint="Confirmed and proposed pledges" icon={TrendingUp} tone="gold" />
        <StatCard label="Funding received" value={currency(totalReceived)} hint="Payment transactions logged" icon={Wallet} tone="green" />
        <StatCard
          label="Still required"
          value={currency(Math.max(totalPledged - totalReceived, 0))}
          hint="Pledged but not yet received"
          icon={AlertCircle}
          tone="rose"
        />
      </div>

      <div className="mt-4">
        <ChartPanel title="Pledged vs received" description="By sponsorship category" height="h-[260px]">
          {totalPledged + totalReceived === 0 ? (
            <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
              No funding recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v) => `₦${Number(v).toLocaleString()}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pledged" name="Pledged" fill="#C2A24C" radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="received" name="Received" fill="#0E7A4F" radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>

      <h2 className="mb-2 mt-5 text-[13px] font-semibold">Funding records</h2>
      <DataTable
        columns={columns}
        rows={records.items}
        loading={records.loading}
        emptyIcon={Wallet}
        emptyTitle="No funding records"
        emptyDescription="Log pledges and received payments to build the funding picture."
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Log funding"
        fields={[
          { name: 'sponsor_id', label: 'Sponsor', type: 'select', options: sponsors.items.map((sponsor) => ({ value: sponsor.id, label: sponsor.name })) },
          {
            name: 'category',
            label: 'Category',
            type: 'select',
            required: true,
            options: CATEGORIES.map((v) => ({ value: v, label: labelize(v) })),
            defaultValue: 'scholarship_fund',
          },
          {
            name: 'kind',
            label: 'Record type',
            type: 'select',
            required: true,
            options: [
              { value: 'pledge', label: 'Pledge' },
              { value: 'payment', label: 'Payment received' },
              { value: 'refund', label: 'Refund' },
            ],
            defaultValue: 'pledge',
          },
          { name: 'amount', label: 'Amount (₦)', type: 'money', required: true },
          { name: 'record_date', label: 'Date', type: 'date', defaultValue: todayISO() },
          { name: 'reference', label: 'Reference' },
          {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: ['pledged', 'confirmed', 'received', 'cancelled'].map((v) => ({ value: v, label: labelize(v) })),
            defaultValue: 'pledged',
          },
          { name: 'target_label', label: 'Target (e.g. player name)', colSpan: 2 },
          { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, rows: 2 },
        ]}
        onSubmit={handleCreate}
        submitLabel="Log funding"
      />
    </div>
  );
}
