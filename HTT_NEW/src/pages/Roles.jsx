import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Save } from 'lucide-react';
import { api } from '@/api/client';
import { useAppConfig } from '@/lib/AppConfigContext';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/common/PageHeader';
import AccessDenied from '@/components/common/AccessDenied';
import { Button } from '@/components/ui/button';

export default function Roles() {
  const { can } = useAppConfig();
  const { toast } = useToast();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [roleId, setRoleId] = useState('');
  const [levels, setLevels] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const role = roles.find((item) => item.id === roleId);
  const editable = can('permissions', 'full') && role?.key !== 'ceo';

  const loadRolePermissions = async (id) => {
    if (!id) return;
    const assigned = await api.get(`/roles/${id}/permissions`);
    const next = {};
    for (const item of assigned || []) {
      const join = item.RolePermission || item.rolePermission || item.role_permissions || {};
      next[item.id] = join.accessLevel || join.access_level || item.accessLevel || 'view';
    }
    setLevels(next);
  };

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/roles'), api.get('/roles/permissions')]).then(async ([roleRows, permissionRows]) => {
      if (!active) return;
      setRoles(roleRows || []);
      setPermissions(permissionRows || []);
      const initial = (roleRows || []).find((item) => item.key !== 'ceo') || roleRows?.[0];
      if (initial) {
        setRoleId(initial.id);
        await loadRolePermissions(initial.id);
      }
    }).catch((requestError) => { if (active) setError(requestError.message || 'Could not load roles and permissions.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const changeRole = async (id) => {
    setRoleId(id);
    setError('');
    try { await loadRolePermissions(id); }
    catch (requestError) { setError(requestError.message || 'Could not load permissions for this role.'); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { permissions: Object.entries(levels).filter(([, accessLevel]) => accessLevel !== 'none').map(([permissionId, accessLevel]) => ({ permissionId, accessLevel })) };
      await api.put(`/roles/${roleId}/permissions`, body);
      toast({ title: 'Role permissions saved' });
    } catch (requestError) {
      toast({ title: requestError.message || 'Could not save permissions', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const orderedPermissions = useMemo(() => [...permissions].sort((a, b) => a.key.localeCompare(b.key)), [permissions]);
  if (!can('roles')) return <AccessDenied moduleName="roles and permissions" />;

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Permissions are loaded from and saved to the backend role catalog. The API enforces access independently of this interface."
        actions={editable ? <Button size="sm" onClick={save} disabled={saving || loading} className="h-9 gap-1.5 bg-[#0B1F3A] hover:bg-[#132E52]">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save permissions</Button> : null}
      />
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-[12.5px] text-muted-foreground">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p><strong>View</strong> grants read access. <strong>Manage</strong> grants write access where a route supports it. The backend prevents removal of essential administrator permissions.</p>
      </div>
      {error ? <div role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="role-select" className="text-sm font-medium">Role</label>
        <select id="role-select" value={roleId} onChange={(event) => changeRole(event.target.value)} className="h-9 min-w-56 rounded-md border border-border bg-card px-2 text-sm" disabled={loading}>
          {roles.map((item) => <option key={item.id} value={item.id}>{item.name}{item.systemRole ? ' (system)' : ''}</option>)}
        </select>
        {role?.key === 'ceo' ? <span className="text-xs text-muted-foreground">CEO permissions are read only.</span> : null}
      </div>
      <div className="htt-surface overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead><tr className="border-b border-border/70 bg-muted/30"><th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Permission</th><th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Access</th></tr></thead>
          <tbody>
            {orderedPermissions.map((permission) => (
              <tr key={permission.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2"><p className="text-[12.5px] font-medium">{permission.key}</p><p className="text-[11px] text-muted-foreground">{permission.description}</p></td>
                <td className="px-4 py-2"><select aria-label={`${permission.key} access`} value={levels[permission.id] || 'none'} onChange={(event) => setLevels((prev) => ({ ...prev, [permission.id]: event.target.value }))} disabled={!editable || loading} className="h-8 min-w-28 rounded-md border border-border bg-card px-2 text-xs disabled:opacity-60"><option value="none">No access</option><option value="view">View</option><option value="full">Manage</option></select></td>
              </tr>
            ))}
            {!loading && orderedPermissions.length === 0 ? <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-muted-foreground">No permissions are available. Apply the RBAC permission seed to the selected development database.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
