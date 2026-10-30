import React, { useMemo, useState } from "react";
import { CalendarCheck, ClipboardCheck } from "lucide-react";
import { api, fromUiRecord } from "@/api/client";
import { useAppConfig } from "@/lib/AppConfigContext";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, labelize, todayISO } from "@/lib/constants";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import ListToolbar, { SearchInput } from "@/components/common/ListToolbar";
import {
  AddButton,
  FilterSelect,
  TableFooter,
} from "@/components/common/TableBits";
import StatusBadge from "@/components/common/StatusBadge";
import FormDialog from "@/components/common/FormDialog";
import AccessDenied from "@/components/common/AccessDenied";
import AttendanceDialog from "@/components/attendance/AttendanceDialog";
import useCollection from "@/hooks/useCollection";

const SESSION_STATUS = {
  scheduled: { label: "Scheduled", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "navy" },
};

export default function Attendance() {
  const { user, can } = useAppConfig();
  const { toast } = useToast();
  const centres = useCollection("Centre", {}, { sort: "name", limit: 100 });
  const programmes = useCollection(
    "Programme",
    {},
    { sort: "name", limit: 100 },
  );
  const [search, setSearch] = useState("");
  const [centreFilter, setCentreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [marking, setMarking] = useState(null);

  const query = useMemo(() => {
    const q = {};
    if (centreFilter) q.centre_id = centreFilter;
    if (statusFilter) q.status = statusFilter;
    return q;
  }, [centreFilter, statusFilter]);

  const { items, total, loading, hasMore, loadMore, reload } = useCollection(
    "AttendanceSession",
    query,
    { sort: "-session_date", limit: 50 },
  );

  const centreOptions = useMemo(
    () => centres.items.map((c) => ({ value: c.id, label: c.name })),
    [centres.items],
  );
  const programmeOptions = useMemo(
    () => programmes.items.map((p) => ({ value: p.id, label: p.name })),
    [programmes.items],
  );

  if (!can("attendance")) return <AccessDenied moduleName="attendance" />;
  const manage = can("attendance", "full");

  const filtered = items.filter((s) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (s.centre_name || "").toLowerCase().includes(term) ||
      (s.programme_name || "").toLowerCase().includes(term) ||
      (s.coach_email || "").toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      key: "session_date",
      header: "Session",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">
            {formatDate(row.session_date)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {row.programme_name || "All programmes"}
          </p>
        </div>
      ),
    },
    {
      key: "centre_name",
      header: "Centre",
      render: (row) => row.centre_name || "—",
    },
    {
      key: "coach_email",
      header: "Coach",
      render: (row) => row.coach_email || "—",
    },
    {
      key: "attendance",
      header: "Present / Absent",
      render: (row) => (
        <span className="htt-tabular text-[12.5px]">
          <span className="text-emerald-700">{row.present_count || 0}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-rose-600">{row.absent_count || 0}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={SESSION_STATUS} />,
    },
    ...(manage
      ? [
          {
            key: "__mark",
            header: "",
            width: 130,
            render: (row) => (
              <button
                onClick={() => setMarking(row)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11.5px] font-medium hover:bg-muted"
              >
                <ClipboardCheck className="h-3.5 w-3.5" /> Mark
              </button>
            ),
          },
        ]
      : []),
  ];

  const handleCreate = async (values) => {
    await api.post("/attendance-sessions", fromUiRecord({
      centre_id: values.centre_id,
      programme_id: values.programme_id || null,
      session_date: values.session_date,
      coach_id: user?.id || null,
      status: "scheduled",
      notes: values.notes || null,
    }));
    toast({ title: "Training session created" });
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Create training sessions, mark players present, absent, late or excused, and review attendance history."
        actions={
          manage ? (
            <AddButton
              label="New session"
              onClick={() => setCreateOpen(true)}
            />
          ) : null
        }
      />

      <ListToolbar
        right={
          <span className="text-[12px] text-muted-foreground">
            {total ?? 0} sessions
          </span>
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search centre, programme or coach…"
          className="w-full sm:w-[280px]"
        />
        <FilterSelect
          value={centreFilter}
          onChange={setCentreFilter}
          options={centreOptions}
          placeholder="All centres"
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={Object.keys(SESSION_STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          }))}
          placeholder="All statuses"
          className="w-[150px]"
        />
      </ListToolbar>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        emptyIcon={CalendarCheck}
        emptyTitle="No training sessions yet"
        emptyDescription="Create a session for a centre and date, then mark attendance."
        footer={
          <TableFooter
            shown={filtered.length}
            total={total}
            hasMore={hasMore}
            onLoadMore={loadMore}
            noun="sessions"
          />
        }
      />

      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New training session"
        description="Attendance can only be marked for players registered at the selected centre."
        fields={[
          {
            name: "centre_id",
            label: "Centre",
            type: "select",
            required: true,
            options: centreOptions,
          },
          {
            name: "programme_id",
            label: "Programme",
            type: "select",
            options: programmeOptions,
          },
          {
            name: "session_date",
            label: "Session date",
            type: "date",
            required: true,
            defaultValue: todayISO(),
          },
          {
            name: "coach_email",
            label: "Coach email",
            type: "email",
            defaultValue: user?.email || "",
          },
          {
            name: "notes",
            label: "Session notes",
            type: "textarea",
            colSpan: 2,
            rows: 2,
          },
        ]}
        onSubmit={handleCreate}
        submitLabel="Create session"
      />

      <AttendanceDialog
        session={marking}
        open={!!marking}
        onOpenChange={(v) => (!v ? setMarking(null) : null)}
        onSaved={reload}
      />
    </div>
  );
}
