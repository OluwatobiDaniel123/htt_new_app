import React from "react";
import { GraduationCap } from "lucide-react";
import { useMemo } from "react";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";
import useCollection from "@/hooks/useCollection";
import { currency, labelize } from "@/lib/constants";

const AVAILABILITY = {
  open: { label: "Open", tone: "green" },
  waitlist: { label: "Waitlist", tone: "amber" },
  closed: { label: "Closed", tone: "red" },
};

const STATUS = {
  active: { label: "Active", tone: "green" },
  planned: { label: "Planned", tone: "gold" },
  archived: { label: "Archived", tone: "navy" },
};

export default function Programmes() {
  const centres = useCollection("Centre", {}, { sort: "name", limit: 100 });
  const centreOptions = useMemo(
    () => centres.items.map((centre) => ({ value: centre.id, label: centre.name })),
    [centres.items],
  );
  const fields = [
    { name: "slug", label: "Slug" },
    { name: "name", label: "Programme name", required: true },
    { name: "tagline", label: "Tagline" },
    { name: "code", label: "Code", placeholder: "e.g. FDN-810" },
    { name: "age_group", label: "Age group" },
    { name: "training_days", label: "Training days (one per line)", type: "string-array", colSpan: 2, rows: 2 },
    { name: "duration", label: "Duration" },
    { name: "price", label: "Display price" },
    { name: "benefits", label: "Benefits (one per line)", type: "string-array", colSpan: 2, rows: 3 },
    { name: "requirements", label: "Requirements (one per line)", type: "string-array", colSpan: 2, rows: 3 },
    { name: "equipment", label: "Equipment (one per line)", type: "string-array", colSpan: 2, rows: 3 },
    { name: "icon", label: "Icon" },
    { name: "featured", label: "Featured", type: "checkbox" },
    {
      name: "age_group_label",
      label: "Age group",
      required: true,
      placeholder: "e.g. Ages 8–10",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      colSpan: 2,
      rows: 2,
    },
    { name: "age_min", label: "Minimum age", type: "number", min: 0 },
    { name: "age_max", label: "Maximum age", type: "number", min: 0 },
    { name: "approved_fee", label: "Approved fee (₦)", type: "money" },
    { name: "capacity", label: "Capacity", type: "number", min: 0 },
    {
      name: "schedule",
      label: "Schedule",
      placeholder: "e.g. Tue & Thu 16:00–18:00",
    },
    {
      name: "assessments_required",
      label: "Assessment required before enrolment",
      type: "checkbox",
    },
    {
      name: "availability",
      label: "Availability",
      type: "select",
      options: Object.keys(AVAILABILITY).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "open",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: Object.keys(STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "active",
    },
    { name: "notes", label: "Notes", type: "textarea", colSpan: 2, rows: 2 },
    {
      name: "centre_ids",
      label: "Centres",
      type: "multiselect",
      options: centreOptions,
      colSpan: 2,
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Programme",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium text-foreground">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.description || row.code || ""}
          </p>
        </div>
      ),
    },
    {
      key: "age_group_label",
      header: "Age group",
      render: (row) => row.age_group_label || "—",
    },
    {
      key: "approved_fee",
      header: "Approved fee",
      render: (row) => (row.approved_fee ? currency(row.approved_fee) : "—"),
    },
    {
      key: "capacity",
      header: "Capacity",
      render: (row) => row.capacity ?? "—",
    },
    {
      key: "availability",
      header: "Availability",
      render: (row) => (
        <StatusBadge value={row.availability} map={AVAILABILITY} />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={STATUS} />,
    },
  ];

  return (
    <ResourcePage
      moduleKey="programmes"
      title="Programmes"
      description="Editable programme records. Fees and availability live in the database — nothing is hard-coded in the interface."
      entityLabel="programme"
      entity="Programme"
      fields={fields}
      columns={columns}
      searchFields={["name", "age_group_label"]}
      searchPlaceholder="Search programme…"
      filters={[
        {
          key: "status",
          label: "All statuses",
          options: Object.keys(STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
        {
          key: "availability",
          label: "All availability",
          options: Object.keys(AVAILABILITY).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
      ]}
      defaultValues={{
        featured: false,
        availability: "open",
        status: "active",
        assessments_required: true,
      }}
      emptyIcon={GraduationCap}
      emptyTitle="No programmes yet"
      emptyDescription="Add the Foundation, Technical and Advanced Youth Development programmes."
    />
  );
}
