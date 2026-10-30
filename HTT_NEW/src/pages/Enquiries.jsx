import React, { useState } from "react";
import { MessageSquare, ListChecks } from "lucide-react";
import { api, fromUiRecord } from "@/api/client";
import { useAppConfig } from "@/lib/AppConfigContext";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, isOverdue, labelize } from "@/lib/constants";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";

const ENQUIRY_TYPES = {
  general: { label: "General", tone: "navy" },
  registration: { label: "Registration", tone: "sky" },
  assessment: { label: "Assessment request", tone: "purple" },
  callback: { label: "Callback request", tone: "blue" },
  partnership: { label: "Partnership", tone: "gold" },
  sponsorship: { label: "Sponsorship", tone: "green" },
  school_project: { label: "School project", tone: "amber" },
};

const ENQUIRY_STATUS = {
  new: { label: "New", tone: "blue" },
  contacted: { label: "Contacted", tone: "sky" },
  in_progress: { label: "In progress", tone: "amber" },
  resolved: { label: "Resolved", tone: "green" },
  closed: { label: "Closed", tone: "navy" },
};

const PRIORITY = {
  low: { label: "Low", tone: "navy" },
  medium: { label: "Medium", tone: "sky" },
  high: { label: "High", tone: "amber" },
  urgent: { label: "Urgent", tone: "red" },
};

export default function Enquiries() {
  const { user } = useAppConfig();
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);

  const fields = [
    { name: "contact_name", label: "Contact name", required: true },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "subject", label: "Subject" },
    {
      name: "type",
      label: "Enquiry type",
      type: "select",
      options: Object.keys(ENQUIRY_TYPES).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "general",
    },
    {
      name: "source",
      label: "Source",
      type: "select",
      options: [
        "website",
        "phone",
        "walk_in",
        "referral",
        "social",
        "event",
        "admin",
      ].map((v) => ({ value: v, label: labelize(v) })),
      defaultValue: "admin",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: Object.keys(ENQUIRY_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "new",
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
    { name: "assigned_to", label: "Assigned to (email)", type: "email" },
    { name: "next_follow_up", label: "Next follow-up", type: "date" },
    {
      name: "message",
      label: "Message",
      type: "textarea",
      colSpan: 2,
      rows: 3,
    },
    {
      name: "notes",
      label: "Internal notes",
      type: "textarea",
      colSpan: 2,
      rows: 2,
    },
    {
      name: "consent_to_contact",
      label: "Consent to contact granted",
      type: "checkbox",
      colSpan: 2,
    },
    {
      name: "opted_out",
      label: "Opted out of communications",
      type: "checkbox",
      colSpan: 2,
    },
  ];

  const columns = [
    {
      key: "contact_name",
      header: "Contact",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.contact_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.phone || row.email || "—"}
          </p>
        </div>
      ),
    },
    { key: "subject", header: "Subject", render: (row) => row.subject || "—" },
    {
      key: "type",
      header: "Type",
      render: (row) => <StatusBadge value={row.type} map={ENQUIRY_TYPES} />,
    },
    {
      key: "priority",
      header: "Priority",
      render: (row) => <StatusBadge value={row.priority} map={PRIORITY} />,
    },
    {
      key: "next_follow_up",
      header: "Follow-up",
      render: (row) =>
        row.next_follow_up ? (
          <span
            className={
              isOverdue(row.next_follow_up)
                ? "text-[12px] font-medium text-rose-600"
                : "text-[12px]"
            }
          >
            {formatDate(row.next_follow_up)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={ENQUIRY_STATUS} />,
    },
  ];

  const createTask = async (row) => {
    setBusy(row.id);
    try {
      const due = new Date();
      due.setDate(due.getDate() + 2);
      await api.post("/follow-up-tasks", fromUiRecord({
        title: `Follow up: ${row.subject || row.contact_name}`,
        enquiry_id: row.id,
        contact_name: row.contact_name,
        assigned_email: row.assigned_to || user?.email || undefined,
        due_date: due.toISOString().slice(0, 10),
        status: "open",
        priority: row.priority || "medium",
        notes: row.message || "",
      }));
      toast({
        title: "Follow-up task created",
        description: `Due ${due.toISOString().slice(0, 10)}`,
      });
    } catch (error) {
      toast({ title: error.message || "Could not create the task", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <ResourcePage
      moduleKey="communications"
      title="Enquiries & Leads"
      description="CRM-style enquiries from the website, phone and events, with assignment, priority and follow-up tracking."
      entityLabel="enquiry"
      entity="Enquiry"
      fields={fields}
      columns={columns}
      searchFields={["contact_name", "subject", "phone", "email"]}
      searchPlaceholder="Search contact or subject…"
      filters={[
        {
          key: "status",
          label: "All statuses",
          options: Object.keys(ENQUIRY_STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
        {
          key: "type",
          label: "All types",
          options: Object.keys(ENQUIRY_TYPES).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
      ]}
      defaultValues={{
        status: "new",
        priority: "medium",
        source: "admin",
        consent_to_contact: true,
      }}
      emptyIcon={MessageSquare}
      emptyTitle="No enquiries yet"
      emptyDescription="Enquiries submitted through the public website or logged by staff appear here."
      rowActions={(row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            createTask(row);
          }}
          disabled={busy === row.id}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-[#0E7A4F]/10 hover:text-[#0E7A4F] disabled:opacity-40"
          title="Create follow-up task"
        >
          <ListChecks className="h-3.5 w-3.5" />
        </button>
      )}
    />
  );
}
