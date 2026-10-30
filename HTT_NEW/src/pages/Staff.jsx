import React, { useEffect, useMemo, useState } from "react";
import { UserCog, Mail } from "lucide-react";
import { api } from "@/api/client";
import { useAppConfig } from "@/lib/AppConfigContext";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, initials, roleLabel } from "@/lib/constants";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/common/StatusBadge";
import FormDialog from "@/components/common/FormDialog";
import AccessDenied from "@/components/common/AccessDenied";
import { AddButton } from "@/components/common/TableBits";
import useCollection from "@/hooks/useCollection";

export default function Staff() {
  const { can } = useAppConfig();
  const { toast } = useToast();
  const users = useCollection("User", {}, {});
  const [editing, setEditing] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  useEffect(() => { api.get('/roles').then((data) => setAvailableRoles(data || [])).catch(() => setAvailableRoles([])); }, []);
  const roleOptions = useMemo(() => availableRoles.map((role) => ({ value: role.id, label: role.name })), [availableRoles]);

  if (!can("staff")) return <AccessDenied moduleName="staff management" />;
  const manage = can("staff", "full");
  const canAssignRoles = can("staff.assign_roles", "full");

  const rows = users.items;

  const columns = [
    {
      key: "full_name",
      header: "Staff member",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0B1F3A]/5 text-[11px] font-semibold text-[#0B1F3A]">
            {initials(row.full_name || row.email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">
              {row.full_name || "Unnamed staff member"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) => (
        <span className="text-[12.5px]">
          {row.role === "admin" || row.role === "ceo" ? (
            <StatusBadge
              value={row.role}
              map={{
                admin: { label: "System Administrator", tone: "navy" },
                ceo: { label: "CEO / Management", tone: "gold" },
              }}
            />
          ) : (row.roles || []).map((role) => role.name || roleLabel(role.key)).join(', ') || 'No staff role'}
        </span>
      ),
    },
    {
      key: "active",
      header: "Account",
      render: (row) => (
        <StatusBadge
          value={row.active === false ? "inactive" : "active"}
          map={{
            active: { label: "Active", tone: "green" },
            inactive: { label: "Deactivated", tone: "red" },
          }}
        />
      ),
    },
    {
      key: "created_date",
      header: "Joined",
      render: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDate(row.created_date)}
        </span>
      ),
    },
  ];

  const handleEdit = async (values) => {
    const payload = { phone: values.phone || null };
    const previousRoleIds = [...(editing.role_ids || [])].sort();
    const nextRoleIds = [...(values.role_ids || [])].sort();
    const rolesChanged = previousRoleIds.join(',') !== nextRoleIds.join(',');
    if (rolesChanged && !canAssignRoles) throw new Error('You do not have permission to assign staff roles.');
    if (rolesChanged) payload.roleIds = values.role_ids || [];
    await api.patch(`/staff/${editing.id}`, payload);
    if ((values.active !== false) !== (editing.active !== false)) {
      await api.patch(`/staff/${editing.id}/status`, { active: values.active !== false });
    }
    toast({ title: "Staff account updated" });
    users.reload();
  };

  const handleInvite = async (values) => {
    setInviting(true);
    try {
      const roleIds = values.role_ids || [];
      if (roleIds.length && !canAssignRoles) throw new Error('You do not have permission to assign staff roles.');
      const payload = { email: values.email, fullName: values.full_name };
      if (canAssignRoles) payload.roleIds = roleIds;
      const result = await api.post('/staff', payload);
      toast({ title: result.invitation === 'sent' ? "Invitation sent" : "Staff account created", description: result.invitation === 'sent' ? "They can activate their account using the invitation email." : "Email delivery is not configured; an administrator must complete the invitation setup." });
      users.reload();
    } finally {
      setInviting(false);
    }
  };
  return (
    <div>
      <PageHeader
        title="Staff & Users"
        description="Staff accounts, role assignment and activation. Changes are recorded in the audit log."
        actions={
          manage ? (
            <AddButton
              label="Invite staff"
              onClick={() => setInviteOpen(true)}
            />
          ) : null
        }
      />

      <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2.5 text-[12.5px] text-muted-foreground">
        <Mail className="mr-1.5 inline h-3.5 w-3.5" />
        Staff join by invitation only — there is no public sign-up route and no
        hard-coded administrator password. The first administrator is
        provisioned from the workspace owner account.
      </div>

      <DataTable
        columns={[
          ...columns,
          ...(manage
            ? [
                {
                  key: "__actions",
                  header: "",
                  width: 80,
                  render: (row) => (
                    <button
                      onClick={() => {
                        setEditing(row);
                        setEditOpen(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11.5px] font-medium hover:bg-muted"
                    >
                      <UserCog className="h-3 w-3" /> Manage
                    </button>
                  ),
                },
              ]
            : []),
        ]}
        rows={rows}
        loading={users.loading}
        emptyIcon={UserCog}
        emptyTitle="No staff accounts"
        emptyDescription="Invite a staff member to give them access to the admin system."
      />

      <FormDialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditing(null);
        }}
        title={`Manage ${editing?.full_name || editing?.email || "staff account"}`}
        description="Least privilege: grant only the access this person needs."
        fields={[
          {
            name: "role_ids",
            label: canAssignRoles ? "Roles" : "Roles (read only)",
            type: "multiselect",
            disabled: !canAssignRoles,
            colSpan: 2,
            options: roleOptions,
          },
          { name: "phone", label: "Phone", type: "tel" },
          {
            name: "active",
            label: "Account active",
            type: "checkbox",
            colSpan: 2,
          },
        ]}
        initial={
          editing
            ? {
                role_ids: editing.role_ids || [],
                phone: editing.phone || "",
                active: editing.active !== false,
              }
            : {}
        }
        onSubmit={handleEdit}
        submitLabel="Save account"
      />

      <FormDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite a staff member"
        description="An invitation email is sent. The selected staff role is assigned when the invitation is created."
        fields={[
          { name: "full_name", label: "Full name", required: true, colSpan: 2 },
          {
            name: "email",
            label: "Work email",
            type: "email",
            required: true,
            colSpan: 2,
          },
          {
            name: "role_ids",
            label: canAssignRoles ? "Staff roles" : "Staff roles (not assignable)",
            type: "multiselect",
            disabled: !canAssignRoles,
            colSpan: 2,
            options: roleOptions,
          },
        ]}
        onSubmit={handleInvite}
        submitLabel={inviting ? "Sending…" : "Send invitation"}
      />
    </div>
  );
}
