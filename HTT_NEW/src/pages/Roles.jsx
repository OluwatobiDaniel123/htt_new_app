import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Save } from 'lucide-react';
import { api } from '@/api/client';
import { useAppConfig } from '@/lib/AppConfigContext';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/common/PageHeader';
import AccessDenied from '@/components/common/AccessDenied';
import { Button } from '@/components/ui/button';
import {
  buildPermissionMatrixRows,
  matrixCellLevel,
  orderRolesForMatrix,
  readRolePermissionLevels,
  roleMatrixLabel,
  rolePermissionPayload,
  setMatrixCellLevel,
} from '@/lib/rolePermissionMatrix';

export default function Roles() {
  const { can } = useAppConfig();
  const { toast } = useToast();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [levelsByRole, setLevelsByRole] = useState({});
  const [dirtyRoleIds, setDirtyRoleIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editable = can('permissions', 'full');
  const rows = useMemo(() => buildPermissionMatrixRows(permissions), [permissions]);

  useEffect(() => {
    let active = true;
    const loadMatrix = async () => {
      setLoading(true);
      setError('');
      try {
        const [roleRows, permissionRows] = await Promise.all([
          api.get('/roles'),
          api.get('/roles/permissions'),
        ]);
        const orderedRoles = orderRolesForMatrix(roleRows || []);
        const assignments = await Promise.all(
          orderedRoles.map(async (role) => {
            const assigned = await api.get(`/roles/${role.id}/permissions`);
            return [role.id, readRolePermissionLevels(assigned || [])];
          }),
        );
        if (!active) return;
        setRoles(orderedRoles);
        setPermissions(permissionRows || []);
        setLevelsByRole(Object.fromEntries(assignments));
      } catch (requestError) {
        if (active) setError(requestError.message || 'Could not load roles and permissions.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMatrix();
    return () => { active = false; };
  }, []);

  const changeCell = (roleId, row, accessLevel) => {
    setLevelsByRole((current) => ({
      ...current,
      [roleId]: setMatrixCellLevel(current[roleId] || {}, row, accessLevel),
    }));
    setDirtyRoleIds((current) => new Set(current).add(roleId));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const writableRoles = roles.filter((role) => role.key !== 'ceo' && dirtyRoleIds.has(role.id));
    const results = await Promise.allSettled(
      writableRoles.map((role) => api.put(
        `/roles/${role.id}/permissions`,
        rolePermissionPayload(levelsByRole[role.id]),
      )),
    );
    const failedRoles = results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [`${roleMatrixLabel(writableRoles[index])}: ${result.reason?.message || 'Could not save permissions.'}`]
        : [],
    );
    const savedRoleIds = writableRoles.filter((_, index) => results[index].status === 'fulfilled').map((role) => role.id);
    setDirtyRoleIds((current) => new Set([...current].filter((roleId) => !savedRoleIds.includes(roleId))));
    if (failedRoles.length) {
      const message = `Some role permissions could not be saved. ${failedRoles.join(' ')}`;
      setError(message);
      toast({ title: 'Some permissions were not saved', description: failedRoles.join(' '), variant: 'destructive' });
    } else {
      toast({ title: 'Role permissions saved' });
    }
    setSaving(false);
  };

  if (!can('roles')) return <AccessDenied moduleName="roles and permissions" />;

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Permissions are loaded from and saved to the backend role catalog. The API enforces access independently of this interface."
        actions={editable ? (
          <Button size="sm" onClick={save} disabled={saving || loading || dirtyRoleIds.size === 0} className="h-9 gap-1.5 bg-[#0B1F3A] hover:bg-[#132E52]">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save permissions
          </Button>
        ) : null}
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-[12.5px] text-muted-foreground">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p><strong>View</strong> grants read access. <strong>Manage</strong> grants write access where a route supports it. The backend prevents removal of essential administrator permissions.</p>
      </div>

      {error ? <div role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div> : null}

      <div className="htt-surface overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30">
              <th scope="col" className="sticky left-0 z-10 min-w-[190px] bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Module</th>
              {roles.map((role) => (
                <th key={role.id} scope="col" className="min-w-[165px] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground" title={role.key === 'ceo' ? 'CEO permissions are read only' : undefined}>
                  {roleMatrixLabel(role)}{role.key === 'ceo' ? ' (Read only)' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={roles.length + 1} className="px-4 py-10 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading roles and permissions…</td></tr>
            ) : rows.map((row) => (
              <tr key={row.key} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                <th scope="row" className="sticky left-0 z-[1] bg-card px-4 py-2.5 text-left text-[12.5px] font-medium text-foreground">{row.label}</th>
                {roles.map((role) => {
                  const roleLevels = levelsByRole[role.id] || {};
                  const level = matrixCellLevel(row, roleLevels);
                  const disabled = !editable || saving || loading || role.key === 'ceo' || level === 'unavailable';
                  return (
                    <td key={role.id} className="px-3 py-2">
                      <select
                        aria-label={`${row.label} access for ${roleMatrixLabel(role)}`}
                        value={level}
                        onChange={(event) => changeCell(role.id, row, event.target.value)}
                        disabled={disabled}
                        className="h-8 w-full min-w-[145px] rounded-md border border-border bg-card px-2 text-xs text-foreground disabled:opacity-60"
                      >
                        {level === 'custom' ? <option value="custom" disabled>Custom permissions</option> : null}
                        {level === 'unavailable' ? <option value="unavailable" disabled>Not in catalog</option> : null}
                        <option value="none">No access</option>
                        <option value="view">View</option>
                        <option value="full">Manage</option>
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
            {!loading && permissions.length === 0 ? (
              <tr><td colSpan={roles.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">No permissions are available. Apply the RBAC permission seed to the selected development database.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
