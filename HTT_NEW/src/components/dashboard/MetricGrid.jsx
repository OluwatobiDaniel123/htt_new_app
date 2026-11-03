import React from 'react';
import {
  Users,
  ClipboardList,
  MapPin,
  ClipboardCheck,
  BadgeCheck,
  Award,
  HeartHandshake,
  TrendingUp,
  MessageSquare,
  ListChecks,
} from 'lucide-react';
import StatCard from '@/components/common/StatCard';
import { currency, num } from '@/lib/constants';

export default function MetricGrid({ metrics, loading }) {
  const items = [
    {
      label: 'Registered players',
      value: num(metrics.registeredPlayers),
      hint: 'Active academy records',
      icon: Users,
      tone: 'navy',
      to: '/players',
    },
    {
      label: 'Registrations to review',
      value: num(metrics.pendingRegistrations),
      hint: 'Submitted or under review',
      icon: ClipboardList,
      tone: 'gold',
      to: '/registrations',
    },
    {
      label: 'Open centres',
      value: num(metrics.openCentres),
      hint: `${num(metrics.pendingCentres)} pending verification`,
      icon: MapPin,
      tone: 'green',
      to: '/centres',
    },
    {
      label: 'Upcoming assessments',
      value: num(metrics.upcomingAssessments),
      hint: 'Scheduled ahead',
      icon: ClipboardCheck,
      tone: 'sky',
      to: '/assessments',
    },
    {
      label: 'Active scholarships',
      value: num(metrics.activeScholarships),
      hint: `${num(metrics.pendingScholarships)} applications in review`,
      icon: BadgeCheck,
      tone: 'green',
      to: '/scholarships/active',
    },
    {
      label: 'Sponsorship received',
      value: currency(metrics.fundingReceived),
      hint: 'Funding transactions logged',
      icon: HeartHandshake,
      tone: 'green',
      to: '/funding',
    },
    {
      label: 'Funding still required',
      value: currency(metrics.fundingRequired),
      hint: 'Pledged but not received',
      icon: TrendingUp,
      tone: 'gold',
      to: '/funding',
    },
    {
      label: 'Unresolved enquiries',
      value: num(metrics.openEnquiries),
      hint: 'New, contacted or in progress',
      icon: MessageSquare,
      tone: 'sky',
      to: '/enquiries',
    },
    {
      label: 'Overdue follow-ups',
      value: num(metrics.overdueTasks),
      hint: 'Past their due date',
      icon: ListChecks,
      tone: 'rose',
      to: '/tasks',
    },
    {
      label: 'Scholarship target',
      value: `${num(metrics.activeScholarships)} / ${num(metrics.scholarshipTarget)}`,
      hint: 'Up to 20 players, subject to funding',
      icon: Award,
      tone: 'gold',
      to: '/scholarships',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <StatCard key={item.label} {...item} loading={loading} />
      ))}
    </div>
  );
}
