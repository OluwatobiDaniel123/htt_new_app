import React from "react";
import { HandCoins } from "lucide-react";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";
import { currency, formatDate, isOverdue, labelize } from "@/lib/constants";

const ENQUIRY_STATUS = {
  new: { label: "New", tone: "blue" },
  contacted: { label: "Contacted", tone: "sky" },
  under_discussion: { label: "Under discussion", tone: "amber" },
  proposal_sent: { label: "Proposal sent", tone: "purple" },
  awaiting_payment: { label: "Awaiting payment", tone: "gold" },
  confirmed: { label: "Confirmed", tone: "green" },
  declined: { label: "Declined", tone: "red" },
  closed: { label: "Closed", tone: "navy" },
};

const CATEGORIES = {
  individual_player: { label: "Individual player support", tone: "sky" },
  scholarship_fund: { label: "Scholarship fund", tone: "green" },
  school_project: { label: "HTT School Project", tone: "gold" },
  corporate_partnership: { label: "Corporate partnership", tone: "purple" },
};

export default function SponsorshipEnquiries() {
  const fields = [
    { name: "contact_name", label: "Contact name", required: true },
    { name: "organisation", label: "Organisation" },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "tel" },
    {
      name: "category",
      label: "Interest",
      type: "select",
      options: Object.keys(CATEGORIES).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "scholarship_fund",
    },
    { name: "proposed_amount", label: "Proposed amount (₦)", type: "money" },
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
    { name: "assigned_to", label: "Assigned to (email)", type: "email" },
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
    { name: "next_follow_up", label: "Next follow-up", type: "date" },
    { name: "notes", label: "Notes", type: "textarea", colSpan: 2, rows: 2 },
  ];

  const columns = [
    {
      key: "contact_name",
      header: "Enquiry",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.contact_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.organisation || row.email || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Interest",
      render: (row) => <StatusBadge value={row.category} map={CATEGORIES} />,
    },
    {
      key: "proposed_amount",
      header: "Proposed",
      render: (row) =>
        row.proposed_amount ? currency(row.proposed_amount) : "—",
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

  return (
    <ResourcePage
      moduleKey="funding"
      title="Sponsorship Enquiries"
      description="Track sponsorship conversations from first contact through proposal, payment and confirmation."
      entityLabel="enquiry"
      entity="SponsorshipEnquiry"
      fields={fields}
      columns={columns}
      searchFields={["contact_name", "organisation", "email"]}
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
        {
          key: "category",
          label: "All interests",
          options: Object.keys(CATEGORIES).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
      ]}
      defaultValues={{
        status: "new",
        priority: "medium",
        category: "scholarship_fund",
      }}
      emptyIcon={HandCoins}
      emptyTitle="No sponsorship enquiries"
      emptyDescription="Enquiries submitted through the public website or logged by staff appear here."
    />
  );
}
