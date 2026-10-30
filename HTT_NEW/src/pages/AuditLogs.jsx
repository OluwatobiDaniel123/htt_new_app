import React, { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { formatDateTime, labelize } from "@/lib/constants";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import ListToolbar, { SearchInput } from "@/components/common/ListToolbar";
import { FilterSelect, TableFooter } from "@/components/common/TableBits";
import AccessDenied from "@/components/common/AccessDenied";
import useCollection from "@/hooks/useCollection";
import { useAppConfig } from "@/lib/AppConfigContext";

const ACTIONS = [
  "create",
  "update",
  "delete",
  "approve",
  "status_change",
  "record_payment",
  "verify_payment",
  "verify_document",
  "view_document",
  "permission_change",
  "approve_scholarship",
  "publish_content",
  "safeguarding_approve",
  "mark_attendance",
];

const ENTITIES = [
  "Registration",
  "Player",
  "Guardian",
  "Payment",
  "ScholarshipApplication",
  "Story",
  "User",
  "AttendanceSession",
  "Assessment",
  "SystemSettings",
];

export default function AuditLogs() {
  const { can } = useAppConfig();
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");

  const query = useMemo(() => {
    const q = {};
    if (action) q.action = action;
    if (entity) q.entity_name = entity;
    return q;
  }, [action, entity]);

  const { items, total, loading, hasMore, loadMore } = useCollection(
    "AuditLog",
    query,
    {
      sort: "-created_date",
      limit: 50,
    },
  );

  if (!can("audit")) return <AccessDenied moduleName="audit logs" />;

  const rows = items.filter((l) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (l.actor_name || "").toLowerCase().includes(term) ||
      (l.actor_email || "").toLowerCase().includes(term) ||
      (l.record_label || "").toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      key: "created_date",
      header: "When",
      render: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDateTime(row.created_date)}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (row) => (
        <div>
          <p className="text-[12.5px] font-medium">{row.actor_name || "—"}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.actor_email || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <span className="text-[12.5px]">{labelize(row.action)}</span>
      ),
    },
    {
      key: "entity_name",
      header: "Record type",
      render: (row) => row.entity_name || "—",
    },
    {
      key: "record_label",
      header: "Record",
      render: (row) => (
        <span className="text-[12px] text-foreground/80">
          {row.record_label || "—"}
        </span>
      ),
    },
    {
      key: "details",
      header: "Details",
      render: (row) => (
        <span className="line-clamp-2 max-w-[300px] text-[11.5px] text-muted-foreground">
          {row.details || "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Immutable trail of approvals, record changes, payment actions, permission changes and content approvals."
      />
      <ListToolbar
        right={
          <span className="text-[12px] text-muted-foreground">
            {total ?? 0} entries
          </span>
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search actor or record…"
          className="w-full sm:w-[260px]"
        />
        <FilterSelect
          value={action}
          onChange={setAction}
          options={ACTIONS.map((v) => ({ value: v, label: labelize(v) }))}
          placeholder="All actions"
          className="w-[170px]"
        />
        <FilterSelect
          value={entity}
          onChange={setEntity}
          options={ENTITIES.map((v) => ({ value: v, label: v }))}
          placeholder="All record types"
          className="w-[180px]"
        />
      </ListToolbar>
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyIcon={ScrollText}
        emptyTitle="No audit entries"
        emptyDescription="Recorded actions appear here as staff work in the system."
        footer={
          <TableFooter
            shown={rows.length}
            total={total}
            hasMore={hasMore}
            onLoadMore={loadMore}
            noun="entries"
          />
        }
      />
    </div>
  );
}
