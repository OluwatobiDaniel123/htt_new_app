import {
  LayoutDashboard,
  Users,
  UserRound,
  ClipboardList,
  ClipboardCheck,
  CalendarCheck,
  MapPin,
  GraduationCap,
  Award,
  BadgeCheck,
  HeartHandshake,
  HandCoins,
  TrendingUp,
  Shield,
  CalendarDays,
  Swords,
  Medal,
  MessageSquare,
  ListChecks,
  Newspaper,
  Image,
  Handshake,
  Bell,
  UserCog,
  KeyRound,
  BarChart3,
  ScrollText,
  ShieldCheck,
  Settings,
} from 'lucide-react';

export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, module: 'dashboard', end: true }],
  },
  {
    label: 'Academy Operations',
    items: [
      { label: 'Players', to: '/players', icon: Users, module: 'players' },
      { label: 'Parents & Guardians', to: '/guardians', icon: UserRound, module: 'guardians' },
      { label: 'Registrations', to: '/registrations', icon: ClipboardList, module: 'registrations' },
      { label: 'Coaching Apprentices', to: '/coaching-apprentices', icon: UserRound, module: 'coaching_apprentices' },
      { label: 'Assessments', to: '/assessments', icon: ClipboardCheck, module: 'assessments' },
      { label: 'Attendance', to: '/attendance', icon: CalendarCheck, module: 'attendance' },
      { label: 'Centres', to: '/centres', icon: MapPin, module: 'centres' },
      { label: 'Programmes', to: '/programmes', icon: GraduationCap, module: 'programmes' },
    ],
  },
  {
    label: 'Scholarships & Funding',
    items: [
      { label: 'Scholarship Applications', to: '/scholarships', icon: Award, module: 'scholarships' },
      { label: 'Active Scholarships', to: '/scholarships/active', icon: BadgeCheck, module: 'scholarships' },
      { label: 'Sponsors', to: '/sponsors', icon: HeartHandshake, module: 'funding' },
      { label: 'Sponsorship Enquiries', to: '/sponsorship-enquiries', icon: HandCoins, module: 'funding' },
      { label: 'Funding Overview', to: '/funding', icon: TrendingUp, module: 'funding' },
    ],
  },
  {
    label: 'League Management',
    items: [
      { label: 'Teams', to: '/teams', icon: Shield, module: 'league' },
      { label: 'Seasons', to: '/seasons', icon: CalendarDays, module: 'league' },
      { label: 'Fixtures', to: '/fixtures', icon: Swords, module: 'league' },
      { label: 'Results', to: '/results', icon: Medal, module: 'league' },
      { label: 'Standings', to: '/standings', icon: TrophyIcon, module: 'league' },
    ],
  },
  {
    label: 'Communications & Content',
    items: [
      { label: 'Enquiries & Leads', to: '/enquiries', icon: MessageSquare, module: 'communications' },
      { label: 'Follow-up Tasks', to: '/tasks', icon: ListChecks, module: 'communications' },
      { label: 'News & Stories', to: '/stories', icon: Newspaper, module: 'content' },
      { label: 'Media Approval', to: '/media-approval', icon: Image, module: 'content' },
      { label: 'Partnership Applications', to: '/partnerships', icon: Handshake, module: 'communications' },
      { label: 'Notifications', to: '/notifications', icon: Bell, module: 'dashboard' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Staff & Users', to: '/staff', icon: UserCog, module: 'staff' },
      { label: 'Roles & Permissions', to: '/roles', icon: KeyRound, module: 'roles' },
      { label: 'Reports', to: '/reports', icon: BarChart3, module: 'reports' },
      { label: 'Audit Logs', to: '/audit-logs', icon: ScrollText, module: 'audit' },
      { label: 'Safeguarding & Consent', to: '/safeguarding', icon: ShieldCheck, module: 'safeguarding' },
      { label: 'System Settings', to: '/settings', icon: Settings, module: 'settings' },
    ],
  },
];

function TrophyIcon(props) {
  return <Medal {...props} />;
}
