import React, { useMemo } from "react";
import { Users } from "lucide-react";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";
import useCollection from "@/hooks/useCollection";
import { ageFromDob, formatDate, initials, labelize } from "@/lib/constants";

const REGISTRATION_STATUS = {
  prospective: { label: "Prospective", tone: "amber" },
  registered: { label: "Registered", tone: "green" },
  waitlisted: { label: "Waitlisted", tone: "gold" },
  archived: { label: "Archived", tone: "navy" },
};

const SCHOLARSHIP_STATUS = {
  none: { label: "None", tone: "navy" },
  applicant: { label: "Applicant", tone: "amber" },
  active: { label: "Active", tone: "green" },
  declined: { label: "Declined", tone: "red" },
};

const DOC_STATUS = {
  pending: { label: "Pending", tone: "amber" },
  verified: { label: "Verified", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};

export default function Players() {
  const centres = useCollection("Centre", {}, { sort: "name", limit: 100 });
  const programmes = useCollection(
    "Programme",
    {},
    { sort: "name", limit: 100 },
  );

  const centreOptions = useMemo(
    () =>
      centres.items.map((c) => ({
        value: c.id,
        label: `${c.name} (${c.code || c.area})`,
      })),
    [centres.items],
  );
  const programmeOptions = useMemo(
    () => programmes.items.map((p) => ({ value: p.id, label: p.name })),
    [programmes.items],
  );

  const fields = [
    {
      name: "full_name",
      label: "Full name",
      required: true,
      placeholder: "e.g. Chidi Okonkwo",
    },
    {
      name: "date_of_birth",
      label: "Date of birth",
      type: "date",
      required: true,
    },
    {
      name: "age_group",
      label: "Age group",
      type: "select",
      options: [
        { value: "8-10", label: "Ages 8â€“10" },
        { value: "11-12", label: "Ages 11â€“12" },
        { value: "13-14", label: "Ages 13â€“14" },
        { value: "other", label: "Other" },
      ],
    },
    {
      name: "centre_id",
      label: "Assigned centre",
      type: "select",
      options: centreOptions,
    },
    {
      name: "programme_id",
      label: "Programme",
      type: "select",
      options: programmeOptions,
    },
    {
      name: "registration_status",
      label: "Registration status",
      type: "select",
      options: Object.keys(REGISTRATION_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "registered",
    },
    {
      name: "scholarship_status",
      label: "Scholarship status",
      type: "select",
      options: Object.keys(SCHOLARSHIP_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "none",
    },
    {
      name: "document_verification",
      label: "Document verification",
      type: "select",
      options: Object.keys(DOC_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "pending",
    },
    {
      name: "match_appearances",
      label: "Match appearances",
      type: "number",
      min: 0,
    },
    { name: "school", label: "School (restricted)", colSpan: 2 },
    {
      name: "development_notes",
      label: "Development notes",
      type: "textarea",
      colSpan: 2,
      rows: 3,
    },
    {
      name: "match_notes",
      label: "Match experience notes",
      type: "textarea",
      colSpan: 2,
      rows: 2,
    },
  ];

  const columns = [
    {
      key: "full_name",
      header: "Player",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B1F3A]/5 text-[11px] font-semibold text-[#0B1F3A]">
            {initials(row.full_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground">
              {row.full_name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {row.player_id || "No ID"} Â·{" "}
              {ageFromDob(row.date_of_birth) ?? "â€”"} yrs
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "centre_name",
      header: "Centre",
      render: (row) =>
        row.centre_name || (
          <span className="text-muted-foreground">Unassigned</span>
        ),
    },
    {
      key: "programme_name",
      header: "Programme",
      render: (row) => row.programme_name || "â€”",
    },
    { key: "age_group", header: "Band", render: (row) => row.age_group || "â€”" },
    {
      key: "registration_status",
      header: "Status",
      render: (row) => (
        <StatusBadge
          value={row.registration_status}
          map={REGISTRATION_STATUS}
        />
      ),
    },
    {
      key: "scholarship_status",
      header: "Scholarship",
      render: (row) => (
        <StatusBadge value={row.scholarship_status} map={SCHOLARSHIP_STATUS} />
      ),
    },
    {
      key: "document_verification",
      header: "Documents",
      render: (row) => (
        <StatusBadge value={row.document_verification} map={DOC_STATUS} />
      ),
    },
    {
      key: "created_date",
      header: "Added",
      render: (row) => (
        <span className="text-muted-foreground">
          {formatDate(row.created_date)}
        </span>
      ),
    },
  ];

  const transform = (values) => {
    const centre = centres.items.find((c) => c.id === values.centre_id);
    const programme = programmes.items.find(
      (p) => p.id === values.programme_id,
    );
    return {
      ...values,
      centre_name: centre?.name || "",
      programme_name: programme?.name || "",
      player_id: values.player_id || `HTT-P-${String(Date.now()).slice(-6)}`,
      match_appearances: Number(values.match_appearances || 0),
    };
  };

  return (
    <ResourcePage
      moduleKey="players"
      title="Players"
      description="Every academy player record with centre, programme, verification and safeguarding flags."
      entityLabel="player"
      entity="Player"
      fields={fields}
      transform={transform}
      columns={columns}
      searchFields={["full_name", "player_id"]}
      searchPlaceholder="Search by name or player IDâ€¦"
      filters={[
        {
          key: "registration_status",
          label: "All statuses",
          options: Object.keys(REGISTRATION_STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
        {
          key: "age_group",
          label: "All age bands",
          options: ["8-10", "11-12", "13-14", "other"].map((v) => ({
            value: v,
            label: v,
          })),
        },
        { key: "centre_id", label: "All centres", options: centreOptions },
      ]}
      defaultValues={{
        registration_status: "registered",
        scholarship_status: "none",
        document_verification: "pending",
      }}
      rowTo={(row) => `/players/${row.id}`}
      emptyIcon={Users}
      emptyTitle="No players yet"
      emptyDescription="Approving a registration creates a player record, or add one directly here."
      sort="-created_date"
    />
  );
}
