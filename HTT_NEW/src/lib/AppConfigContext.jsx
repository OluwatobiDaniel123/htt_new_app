import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { api, toUiRecord } from '@/api/client';

const AppConfigContext = createContext(null);

const permissionKeys = {
  players: { view: ['players.read'], full: ['players.create', 'players.update', 'players.delete'] },
  guardians: { view: ['guardians.read'], full: ['guardians.create', 'guardians.update', 'guardians.delete'] },
  registrations: { view: ['registrations.read'], full: ['registrations.create', 'registrations.update', 'registrations.approve'] },
  coaching_apprentices: { view: ['coaching_apprentices'], full: ['coaching_apprentices'] },
  centres: { view: ['centres.read'], full: ['centres.create', 'centres.update', 'centres.delete'] },
  programmes: { view: ['programmes.read'], full: ['programmes.create', 'programmes.update', 'programmes.delete'] },
  payments: { view: ['payments.read'], full: ['payments.record', 'payments.initialize', 'payments.refunds.request'] },
  finance: { view: ['payments.read'], full: ['payments.record', 'payments.refunds.request', 'payments.refunds.approve'] },
  notifications: { view: ['notifications.admin.read'], full: ['notifications.announce'] },
  staff: { view: ['staff'], full: ['staff.create', 'staff.update', 'staff.deactivate'] },
  'staff.assign_roles': { view: [], full: ['staff.assign_roles'] },
  roles: { view: ['roles'], full: ['roles.manage', 'permissions.manage'] },
  permissions: { view: ['permissions'], full: ['permissions.manage'] },
  reports: { view: ['reports.finance.read'], full: [] },
  dashboard: { view: ['dashboard'], full: [] },
  attendance: { view: ['attendance'], full: ['attendance'] },
  assessments: { view: ['assessments'], full: ['assessments'] },
  scholarships: { view: ['scholarships'], full: ['scholarships'] },
  funding: { view: ['funding'], full: ['funding'] },
  league: { view: ['league'], full: ['league'] },
  communications: { view: ['communications'], full: ['communications'] },
  enquiries: { view: ['communications'], full: ['communications'] },
  tasks: { view: ['communications'], full: ['communications'] },
  content: { view: ['content'], full: ['content'] },
  settings: { view: ['settings'], full: ['settings'] },
  audit: { view: ['audit'], full: ['audit'] },
  safeguarding: { view: ['safeguarding'], full: ['safeguarding.manage'] },
};

export const AppConfigProvider = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(false);
  const reloadSettings = useCallback(async () => {
    if (!user) { setSettings(null); setSettingsId(null); return null; }
    setLoading(true);
    try {
      const result = await api.get('/settings', { limit: 1 });
      const record = result?.items?.[0];
      setSettings(record ? toUiRecord(record) : null);
      setSettingsId(record?.id || null);
      return record || null;
    } finally { setLoading(false); }
  }, [user]);
  useEffect(() => { reloadSettings().catch(() => { setSettings(null); setSettingsId(null); }); }, [reloadSettings]);
  const permissions = user?.permissions || {};
  const roles = user?.roles || [];
  const role = roles.includes('admin') ? 'admin' : roles.includes('ceo') ? 'ceo' : roles[0] || 'user';
  const can = (moduleKey, level = 'view') => {
    const keys = permissionKeys[moduleKey]?.[level];
    if (!keys) return false;
    if (level === 'view' && moduleKey === 'notifications') return true;
    if (level === 'view') return keys.some((key) => permissions[key] === 'view' || permissions[key] === 'full');
    return keys.some((key) => permissions[key] === 'full');
  };
  const value = useMemo(() => ({
    user,
    role,
    settings,
    settingsId,
    loading,
    reloadSettings,
    permissions,
    can,
    isAdmin: role === 'admin' || role === 'ceo',
    currencyCode: 'NGN',
  }), [user, role, permissions, settings, settingsId, loading, reloadSettings]);

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
};

export const useAppConfig = () => {
  const context = useContext(AppConfigContext);
  if (!context) throw new Error('useAppConfig must be used inside AppConfigProvider');
  return context;
};
