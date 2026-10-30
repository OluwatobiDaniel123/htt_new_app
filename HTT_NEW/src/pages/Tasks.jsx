import React from "react";
import { ListChecks } from "lucide-react";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";
import { formatDate, isOverdue, labelize, todayISO } from "@/lib/constants";

const TASK_STATUS = {
  open: { label: "Open", tone: "blue" },
  in_progress: { label: "In progress", tone: "amber" },
  done: { label: "Done", tone: "green" },
  cancelled: { label: "Cancelled", tone: "navy" },
};

const PRIORITY = {
  low: { label: "Low", tone: "navy" },
  medium: { label: "Medium", tone: "sky" },
  high: { label: "High", tone: "amber" },
  urgent: { label: "Urgent", tone: "red" },
};

export default function Tasks() {
  const fields = [
    { name: "title", label: "Task", required: true },
    { name: "contact_name", label: "Related contact" },
    { name: "assigned_to", label: "Assigned to (email)", type: "email" },
    {
      name: "due_date",
      label: "Due date",
      type: "date",
      required: true,
      defaultValue: todayISO(),
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: Object.keys(TASK_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "open",
    },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      options: Object.keys(PRIORITY).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "medium",
    },
    { name: "notes", label: "Notes", type: "textarea", colSpan: 2, rows: 2 },
  ];

  const columns = [
    {
      key: "title",
      header: "Task",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.contact_name || row.assigned_to || "Unassigned"}
          </p>
        </div>
      ),
    },
    {
      key: "due_date",
      header: "Due",
      render: (row) => {
        const overdue =
          isOverdue(row.due_date) &&
          row.status !== "done" &&
          row.status !== "cancelled";
        return (
          <span
            className={`text-[12px] ${overdue ? "font-semibold text-rose-600" : ""}`}
          >
            {formatDate(row.due_date)}
            {overdue ? " · overdue" : ""}
          </span>
        );
      },
    },
    {
      key: "priority",
      header: "Priority",
      render: (row) => <StatusBadge value={row.priority} map={PRIORITY} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={TASK_STATUS} />,
    },
  ];

  return (
    <ResourcePage
      moduleKey="communications"
      title="Follow-up Tasks"
      description="Assigned follow-ups with due dates and overdue indicators. Tasks can be raised directly from an enquiry."
      entityLabel="task"
      entity="FollowUpTask"
      fields={fields}
      columns={columns}
      searchFields={["title", "contact_name", "assigned_to"]}
      searchPlaceholder="Search task or contact…"
      filters={[
        {
          key: "status",
          label: "All statuses",
          options: Object.keys(TASK_STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
        {
          key: "priority",
          label: "All priorities",
          options: Object.keys(PRIORITY).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
      ]}
      defaultValues={{ status: "open", priority: "medium" }}
      sort="due_date"
      emptyIcon={ListChecks}
      emptyTitle="No follow-up tasks"
      emptyDescription="Create a task from an enquiry, or add one directly with a due date."
    />
  );
}
