import React, { useEffect, useState } from 'react';
import { AlertCircle, Wallet } from 'lucide-react';
import { api, toUiRecord } from '@/api/client';
import { currency } from '@/lib/constants';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';
import AccessDenied from '@/components/common/AccessDenied';
import { useAppConfig } from '@/lib/AppConfigContext';
import DataTable from '@/components/common/DataTable';
import { TableFooter } from '@/components/common/TableBits';
import { labelize } from '@/lib/constants';

export default function OutstandingBalances() {
  const { can } = useAppConfig();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [balances, setBalances] = useState([]);
  const [balanceTotal, setBalanceTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingBalances, setLoadingBalances] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/payments/reports/summary').then((data) => { if (active) setSummary(data); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Balances are unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    api.get('/registrations/balances', { page: 1, limit: 50 }).then((data) => {
      if (!active) return;
      setBalances((data.items || []).map(toUiRecord));
      setBalanceTotal(data.total || 0);
      setPage(data.page || 1);
    }).catch((requestError) => { if (active) setError(requestError.message || 'Registration balances are unavailable.'); })
      .finally(() => { if (active) setLoadingBalances(false); });
    return () => { active = false; };
  }, []);

  const loadMore = async () => {
    const nextPage = page + 1;
    try {
      const data = await api.get('/registrations/balances', { page: nextPage, limit: 50 });
      setBalances((current) => [...current, ...(data.items || []).map(toUiRecord)]);
      setPage(data.page || nextPage);
    } catch (requestError) { setError(requestError.message || 'Could not load more balances.'); }
  };

  if (!can('reports')) return <AccessDenied moduleName="finance" />;
  return (
    <div>
      <PageHeader title="Outstanding Balances" description="Registration due amounts reconciled against successful payments and refunds." />
      {error ? <div role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total outstanding" value={currency(summary?.outstanding || 0)} hint="Approved registrations" icon={AlertCircle} tone="rose" loading={loading} />
        <StatCard label="Total due" value={currency(summary?.totalDue || 0)} hint="Approved registration amounts" icon={AlertCircle} tone="gold" loading={loading} />
        <StatCard label="Overpayments" value={currency(summary?.overpayments || 0)} hint="Collected above registration amounts" icon={AlertCircle} tone="navy" loading={loading} />
      </div>
      <DataTable columns={[
        { key: 'reference', header: 'Registration', render: (row) => <span className="font-medium">{row.reference}</span> },
        { key: 'child_name', header: 'Player', render: (row) => row.child_name || 'Restricted' },
        { key: 'centre_name', header: 'Centre', render: (row) => row.centre_name || '—' },
        { key: 'amount_due', header: 'Due', render: (row) => currency(row.amount_due, row.currency) },
        { key: 'amount_paid', header: 'Paid', render: (row) => currency(row.amount_paid, row.currency) },
        { key: 'outstanding', header: 'Outstanding', render: (row) => <span className="font-semibold">{currency(row.outstanding, row.currency)}</span> },
        { key: 'status', header: 'Status', render: (row) => labelize(row.payment_status) },
        { key: 'payment_details', header: 'Payments', render: (row) => `${row.payments?.length || 0} payment records` },
      ]} rows={balances.filter((row) => row.outstanding > 0)} loading={loadingBalances} emptyIcon={Wallet} emptyTitle="No outstanding balances" emptyDescription="Registrations with outstanding balances will appear here." footer={<TableFooter shown={balances.filter((row) => row.outstanding > 0).length} total={balanceTotal} hasMore={balances.length < balanceTotal} onLoadMore={loadMore} noun="registrations" />} />
    </div>
  );
}
