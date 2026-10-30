import React from "react";
import { Handshake } from "lucide-react";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";
import { formatDate, isOverdue, labelize } from "@/lib/constants";

const ENQUIRY_STATUS = {
  new: { label: "New", tone: "blue" },
  contacted: { label: "Contacted", tone: "sky" },
  in_progress: { label: "In progress", tone: "amber" },
  resolved: { label: "Resolved", tone: "green" },
  closed: { label: "Closed", tone: "navy" },
};

export default function Partnerships() {
  const fields = [
    { name: "contact_name", label: "Contact name", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "subject", label: "Organisation / proposal" },
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
      options: ["low", "medium", "high", "urgent"].map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "medium",
    },
    { name: "assigned_to", label: "Assigned to (email)", type: "email" },
    { name: "next_follow_up", label: "Next follow-up", type: "date" },
    {
      name: "message",
      label: "Proposal details",
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
  ];

  const columns = [
    {
      key: "contact_name",
      header: "Contact",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.contact_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.email || row.phone || "—"}
          </p>
        </div>
      ),
    },
    { key: "subject", header: "Proposal", render: (row) => row.subject || "—" },
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
      key: "created_date",
      header: "Received",
      render: (row) => (
        <span className="text-[12px] text-muted-foreground">
          {formatDate(row.created_date)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={ENQUIRY_STATUS} />,
    },
  ];

  const transform = (values) => ({
    ...values,
    type: "partnership",
    source: values.source || "website",
  });

  return (
    <ResourcePage
      moduleKey="communications"
      title="Partnership Applications"
      description="Institutional and community partnership proposals, routed to the partnerships lead."
      entityLabel="application"
      entity="Enquiry"
      fields={fields}
      transform={transform}
      columns={columns}
      searchFields={["contact_name", "subject", "email"]}
      searchPlaceholder="Search contact or organisation…"
      filters={[
        {
          key: "status",
          label: "All statuses",
          options: Object.keys(ENQUIRY_STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
      ]}
      defaultQuery={{ type: "partnership" }}
      defaultValues={{ type: "partnership", status: "new", priority: "medium" }}
      emptyIcon={Handshake}
      emptyTitle="No partnership applications"
      emptyDescription="Partnership proposals submitted from the public website appear here."
    />
  );
}
