import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Wallet, TrendingUp, AlertCircle, RotateCcw } from 'lucide-react';
import { api } from '@/api/client';
import { useAppConfig } from '@/lib/AppConfigContext';
import { currency } from '@/lib/constants';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';
import ChartPanel from '@/components/common/ChartPanel';
import AccessDenied from '@/components/common/AccessDenied';

export default function FinancialReports() {
  const { can } = useAppConfig();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/payments/reports/summary').then((data) => {
      if (active) setSummary(data);
    }).catch((requestError) => {
      if (active) setError(requestError.message || 'Financial summary is unavailable.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (!can('reports')) return <AccessDenied moduleName="financial reports" />;
  const groups = (summary?.byProgrammeCentreMethod || []).map((item) => ({
    label: item.key.replaceAll(':', ' / '),
    gross: Number(item.successfulGross || 0),
    refunds: Number(item.refunds || 0),
    pending: Number(item.pending || 0),
    failed: Number(item.failed || 0),
  })).slice(0, 20);

  return (
    <div>
      <PageHeader title="Financial Reports" description="Totals are calculated by the backend from recorded payments, refunds and registration balances." />
      {error ? <div role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Confirmed payments" value={currency(summary?.successfulGross || 0)} hint={`${summary?.payments ?? 0} records`} icon={Wallet} tone="green" loading={loading} />
        <StatCard label="Net collected" value={currency(summary?.successfulNet || 0)} hint="After confirmed refunds" icon={TrendingUp} tone="navy" loading={loading} />
        <StatCard label="Outstanding" value={currency(summary?.outstanding || 0)} hint="Approved registration balances" icon={AlertCircle} tone="rose" loading={loading} />
        <StatCard label="Refunds" value={currency(summary?.refunds || 0)} hint="Confirmed refund totals" icon={RotateCcw} tone="gold" loading={loading} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartPanel title="Finance by programme, centre and method" description="Confirmed, pending, failed and refunded amounts">
          {groups.length === 0 ? <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">No finance groups are available.</div> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groups} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => currency(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="gross" name="Confirmed" fill="#0E7A4F" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#d79a22" radius={[4, 4, 0, 0]} />
                <Bar dataKey="refunds" name="Refunds" fill="#d45252" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
        <div className="htt-surface flex flex-col justify-center gap-3 p-5">
          <p className="text-sm font-semibold">Available report coverage</p>
          <p className="text-[12.5px] text-muted-foreground">Scholarship awards and sponsorship funding are not included because their REST modules are not implemented yet. The summary above uses the custom finance API only.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to="/transactions" className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/40">Transaction ledger</Link>
            <Link to="/receipts" className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/40">Receipts</Link>
            <Link to="/outstanding" className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/40">Outstanding balances</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
