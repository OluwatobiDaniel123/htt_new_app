import React, { useEffect, useMemo, useState } from "react";
import { useAppConfig } from "@/lib/AppConfigContext";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import MetricGrid from "@/components/dashboard/MetricGrid";
import ChartsRow from "@/components/dashboard/ChartsRow";
import {
  ActivityFeed,
  UpcomingOperations,
} from "@/components/dashboard/ActivityPanels";
import { api, toUiRecord } from "@/api/client";
import { labelize } from "@/lib/constants";

const defaultMetrics = {
  registeredPlayers: 0,
  pendingRegistrations: 0,
  openCentres: 0,
  pendingCentres: 0,
  upcomingAssessments: 0,
  activeScholarships: 0,
  pendingScholarships: 0,
  fundingReceived: 0,
  fundingRequired: 0,
  openEnquiries: 0,
  overdueTasks: 0,
  scholarshipTarget: 20,
};

const bucketByMonth = (items, dateField = 'created_date', months = 6) => {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - index - 1), 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: date.toLocaleString('en-NG', { month: 'short' }), count: 0 };
  });
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  items.forEach((item) => {
    const date = new Date(item?.[dateField]);
    if (Number.isNaN(date.getTime())) return;
    const bucket = byKey.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    if (bucket) bucket.count += 1;
  });
  return buckets;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { settings, can } = useAppConfig();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [recentRegs, setRecentRegs] = useState([]);
  const [playersByCentre, setPlayersByCentre] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [activity, setActivity] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await api.get('/dashboard/summary');
        if (!active) return;
        setMetrics({ ...defaultMetrics, ...(result.metrics || {}), scholarshipTarget: result.metrics?.scholarshipTarget || settings?.scholarship_target || 20 });
        setRecentRegs((result.recentRegistrations || []).map(toUiRecord));
        setPlayersByCentre((result.playersByCentre || []).map(toUiRecord));
        setPipeline((result.pipeline || []).map(toUiRecord));
        setAssessments((result.assessments || []).map(toUiRecord));
        setTasks((result.tasks || []).map(toUiRecord));
        setActivity(can("audit") ? (result.activity || []).map(toUiRecord) : []);
      } catch (error) {
        if (active) console.error('Could not load dashboard summary:', error.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [settings?.id, can("audit")]);

  const trend = useMemo(
    () => bucketByMonth(recentRegs, "created_date", 6),
    [recentRegs],
  );

  const distribution = useMemo(() => {
    const rows = playersByCentre
      .filter((r) => r.centre_name && r.count)
      .map((r) => ({ name: r.centre_name, value: r.count }))
      .sort((a, b) => b.value - a.value);
    if (rows.length <= 6) return rows;
    const top = rows.slice(0, 5);
    const other = rows.slice(5).reduce((sum, r) => sum + r.value, 0);
    return [...top, { name: "Other centres", value: other }];
  }, [playersByCentre]);

  const pipelineSeries = useMemo(
    () =>
      pipeline
        .filter((r) => r.status)
        .map((r) => ({ label: labelize(r.status), count: r.count || 0 })),
    [pipeline],
  );


  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageHeader
        eyebrow="HTT Academy Nigeria"
        title={`${greeting}${user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}`}
        description="Live operational picture across registrations, centres, scholarships and sponsorship."
      />
      <MetricGrid metrics={metrics} loading={loading} />
      <div className="mt-4">
        <ChartsRow
          trend={trend}
          distribution={distribution}
          pipeline={pipelineSeries}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <UpcomingOperations assessments={assessments} tasks={tasks} />
        {can("audit") ? (
          <ActivityFeed items={activity} />
        ) : (
          <section className="htt-surface flex items-center px-4 py-8 text-[12.5px] text-muted-foreground">
            Audit activity is restricted to management and system
            administrators.
          </section>
        )}
      </div>
    </div>
  );
}
