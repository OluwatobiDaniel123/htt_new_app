import React, { useMemo } from "react";
import { MapPin } from "lucide-react";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";
import useCollection from "@/hooks/useCollection";
import { currency, labelize } from "@/lib/constants";

const CENTRE_STATUS = {
  pending_verification: { label: "Pending verification", tone: "amber" },
  open_for_registration: { label: "Open for registration", tone: "green" },
  assessments_open: { label: "Assessments open", tone: "blue" },
  coming_soon: { label: "Coming soon", tone: "gold" },
  temporarily_unavailable: { label: "Temporarily unavailable", tone: "red" },
};

const REVIEW_STATUS = {
  pending_verification: { label: "Pending verification", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
};

export default function Centres() {
  const programmes = useCollection(
    "Programme",
    {},
    { sort: "name", limit: 100 },
  );
  const programmeOptions = useMemo(
    () => programmes.items.map((p) => ({ value: p.id, label: p.name })),
    [programmes.items],
  );

  const fields = [
    { name: "slug", label: "Slug" },
    {
      name: "name",
      label: "Centre name",
      required: true,
      placeholder: "e.g. Ikeja Centre",
    },
    {
      name: "code",
      label: "Unique code",
      required: true,
      placeholder: "e.g. LAG-IKJ",
    },
    {
      name: "area",
      label: "Area / LGA",
      required: true,
      placeholder: "e.g. Ikeja",
    },
    { name: "address", label: "Address" },
    { name: "city", label: "City" },
    { name: "region", label: "Region" },
    { name: "map_embed", label: "Map embed", type: "textarea", colSpan: 2, rows: 2 },
    {
      name: "map_link",
      label: "Map link",
      placeholder: "https://maps.google.com/…",
    },
    { name: "lead_coach", label: "Lead coach (email)" },
    {
      name: "status",
      label: "Operational status",
      type: "select",
      options: Object.keys(CENTRE_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "pending_verification",
    },
    {
      name: "review_status",
      label: "Review status",
      type: "select",
      options: Object.keys(REVIEW_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "pending_verification",
    },
    {
      name: "proposed_area",
      label: "This is a proposed area, not yet an operating centre",
      type: "checkbox",
      colSpan: 2,
      defaultValue: true,
    },
    {
      name: "schedule",
      label: "Approved schedule",
      placeholder: "e.g. Sat 09:00–11:00",
    },
    { name: "approved_fee", label: "Approved fee (₦)", type: "money" },
    { name: "capacity", label: "Capacity", type: "number", min: 0 },
    { name: "contact_name", label: "Contact name" },
    { name: "contact_phone", label: "Contact phone", type: "tel" },
    { name: "contact_email", label: "Contact email", type: "email" },
    { name: "image", label: "Image URL" },
    {
      name: "coming_soon",
      label: "Coming soon",
      type: "checkbox",
    },
    {
      name: "programme_ids",
      label: "Programmes",
      type: "multiselect",
      options: programmeOptions,
      colSpan: 2,
    },
    {
      name: "operational_notes",
      label: "Operational notes",
      type: "textarea",
      colSpan: 2,
      rows: 2,
    },
    {
      name: "registration_available",
      label: "Accepting registrations",
      type: "checkbox",
      colSpan: 2,
      help: "Only enable once the centre is approved and operating.",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Centre",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium text-foreground">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.code} · {row.area || "Area not set"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={CENTRE_STATUS} />,
    },
    {
      key: "review_status",
      header: "Review",
      render: (row) => (
        <StatusBadge value={row.review_status} map={REVIEW_STATUS} />
      ),
    },
    {
      key: "lead_coach",
      header: "Lead coach",
      render: (row) => row.lead_coach || "—",
    },
    {
      key: "capacity",
      header: "Capacity",
      render: (row) => row.capacity ?? "—",
    },
    {
      key: "approved_fee",
      header: "Approved fee",
      render: (row) => (row.approved_fee ? currency(row.approved_fee) : "—"),
    },
  ];

  return (
    <ResourcePage
      moduleKey="centres"
      title="Centres"
      description="Database-driven centre directory. Proposed Lagos coverage areas start as Pending Verification — nothing is marked operational automatically."
      entityLabel="centre"
      entity="Centre"
      fields={fields}
      columns={columns}
      searchFields={["name", "code", "area"]}
      searchPlaceholder="Search centre, code or area…"
      filters={[
        {
          key: "status",
          label: "All statuses",
          options: Object.keys(CENTRE_STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
        {
          key: "review_status",
          label: "All reviews",
          options: Object.keys(REVIEW_STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
      ]}
      defaultValues={{
        coming_soon: false,
        status: "pending_verification",
        review_status: "pending_verification",
        proposed_area: true,
      }}
      emptyIcon={MapPin}
      emptyTitle="No centres yet"
      emptyDescription="Create a centre record, then verify it before opening registration."
    />
  );
}
