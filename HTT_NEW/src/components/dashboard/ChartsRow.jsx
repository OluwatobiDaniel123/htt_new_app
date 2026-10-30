import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import ChartPanel, { CHART_COLORS } from '@/components/common/ChartPanel';
import { labelize } from '@/lib/constants';

const axisProps = {
  tick: { fontSize: 10.5, fill: '#64748b' },
  axisLine: false,
  tickLine: false,
};

const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  boxShadow: '0 6px 20px rgba(15,35,64,0.08)',
};

export default function ChartsRow({ trend, distribution, pipeline, collections }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <ChartPanel title="Registration trend" description="Records created over the last 6 months">
        {trend.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0B1F3A"
                strokeWidth={2}
                dot={{ r: 3, fill: '#0E7A4F' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartPanel>

      <ChartPanel title="Player distribution" description="Registered players by centre">
        {distribution.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distribution}
                dataKey="value"
                nameKey="name"
                innerRadius="52%"
                outerRadius="82%"
                paddingAngle={2}
              >
                {distribution.map((entry, i) => (
                  <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartPanel>

      <ChartPanel title="Scholarship pipeline" description="Applications by workflow stage">
        {pipeline.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipeline} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} angle={-18} textAnchor="end" height={48} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#0E7A4F" radius={[4, 4, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartPanel>

      <ChartPanel title="Financial collections" description="Payment value by status">
        {collections.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={collections} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`₦${Number(v).toLocaleString()}`, 'Amount']}
              />
              <Bar dataKey="amount" fill="#C2A24C" radius={[4, 4, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartPanel>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center">
      <p className="text-[12px] text-muted-foreground">
        No records yet — this chart fills as data is entered.
      </p>
    </div>
  );
}

export const toPipelineSeries = (rows) =>
  (rows || [])
    .filter((r) => r && r.status)
    .map((r) => ({ label: labelize(r.status).replace(' ', '\n'), count: r.count || 0 }));