import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { BarChart3, Users, ClipboardList, AlertCircle } from 'lucide-react';
import { useAppConfig } from '@/lib/AppConfigContext';
import { labelize } from '@/lib/constants';
import { api, toUiRecord } from '@/api/client';
import PageHeader from '@/components/common/PageHeader';
import StatCard from '@/components/common/StatCard';
import ChartPanel from '@/components/common/ChartPanel';
import AccessDenied from '@/components/common/AccessDenied';

export default function Reports() {
  const { can } = useAppConfig();
  const [loading, setLoading] = useState(true);
  const [playersByCentre, setPlayersByCentre] = useState([]);
  const [registrationsByStatus, setRegistrationsByStatus] = useState([]);
  const [checks, setChecks] = useState([]);
  const [counts, setCounts] = useState({ players: 0, registrations: 0, centres: 0, completedAssessments: 0 });

  useEffect(() => {
    let active = true;
    const load = async () => {
      let data;
      try { data = toUiRecord(await api.get('/reports/academy')); }
      catch (error) { if (active) setLoading(false); throw error; }
      if (!active) return;
      setPlayersByCentre(
        (data.players_by_centre || [])
          .filter((r) => r.centre?.name)
          .map((r) => ({ label: r.centre.name, count: Number(r.count || 0) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
      );
      setRegistrationsByStatus(
        (data.registrations_by_status || []).filter((r) => r.status).map((r) => ({ label: labelize(r.status), count: Number(r.count || 0) }))
      );
      setCounts(data.counts || { players: 0, registrations: 0, centres: 0, completed_assessments: 0 });
      setChecks([
        {
          label: 'Players without an assigned centre',
          value: data.checks.no_centre,
          hint: 'Assign a centre so coaching and attendance work correctly.',
          severity: 'warn',
        },
        {
          label: 'Centres pending verification',
          value: data.checks.pending_centres,
          hint: 'Only verified centres should accept registrations.',
          severity: 'warn',
        },
        {
          label: 'Registrations awaiting review',
          value: data.checks.pending_registrations,
          hint: 'Submitted or under review applications.',
          severity: 'warn',
        },
        {
          label: 'Documents awaiting verification',
          value: data.checks.pending_docs,
          hint: 'Registrations with unverified documents.',
          severity: 'warn',
        },
      ]);
      setLoading(false);
    };
    load().catch((error) => { if (active) console.error('Could not load report:', error.message); });
    return () => {
      active = false;
    };
  }, []);

  if (!can('reports')) return <AccessDenied moduleName="reports" />;

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Operational reporting built from live records. Every figure is a database count or aggregate."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Players" value={counts.players} hint="Active records" icon={Users} tone="navy" loading={loading} />
        <StatCard label="Registrations" value={counts.registrations} hint="All time" icon={ClipboardList} tone="gold" loading={loading} />
        <StatCard label="Completed assessments" value={counts.completedAssessments} hint="Recorded outcomes" icon={BarChart3} tone="green" loading={loading} />
        <StatCard label="Centres" value={counts.centres} hint="In the directory" icon={AlertCircle} tone="sky" loading={loading} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartPanel title="Players by centre" description="Registered player distribution">
          {playersByCentre.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
              No player records yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={playersByCentre} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill="#0B1F3A" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel title="Registrations by status" description="Review pipeline position">
          {registrationsByStatus.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
              No registrations yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={registrationsByStatus} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-16} textAnchor="end" height={52} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill="#0E7A4F" radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>

      <section className="htt-surface mt-4 overflow-hidden">
        <header className="border-b border-border/70 px-4 py-3">
          <h2 className="text-[13px] font-semibold">Data quality checks</h2>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Gaps that affect reporting accuracy and safeguarding compliance.
          </p>
        </header>
        <ul className="divide-y divide-border/60">
          {checks
            .filter((c) => !c.hidden)
            .map((check) => (
              <li key={check.label} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-[12.5px] font-medium">{check.label}</p>
                  <p className="text-[11.5px] text-muted-foreground">{check.hint}</p>
                </div>
                <span
                  className={`htt-tabular rounded-md px-2 py-0.5 text-[12px] font-semibold ${
                    check.severity === 'warn' && check.value > 0
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {check.value ?? '—'}
                </span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
