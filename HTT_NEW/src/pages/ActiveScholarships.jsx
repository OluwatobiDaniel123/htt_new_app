import React from "react";
import { BadgeCheck } from "lucide-react";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";
import { currency, formatDate, labelize } from "@/lib/constants";

const AWARD_STATUS = {
  active: { label: "Active", tone: "green" },
  paused: { label: "Paused", tone: "amber" },
  completed: { label: "Completed", tone: "navy" },
  withdrawn: { label: "Withdrawn", tone: "red" },
};

export default function ActiveScholarships() {
  const fields = [
    { name: "player_name", label: "Player", required: true },
    {
      name: "award_amount",
      label: "Award amount (₦)",
      type: "money",
      required: true,
    },
    { name: "programme_name", label: "Programme" },
    { name: "centre_name", label: "Centre" },
    { name: "funding_secured", label: "Funding secured (₦)", type: "money" },
    {
      name: "funding_required",
      label: "Funding still required (₦)",
      type: "money",
    },
    { name: "start_date", label: "Start date", type: "date" },
    { name: "end_date", label: "End date", type: "date" },
    { name: "renewal_date", label: "Renewal date", type: "date" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: Object.keys(AWARD_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "active",
    },
    {
      name: "benefit_description",
      label: "Benefit provided",
      type: "textarea",
      colSpan: 2,
      rows: 2,
    },
    { name: "notes", label: "Notes", type: "textarea", colSpan: 2, rows: 2 },
  ];

  const columns = [
    {
      key: "player_name",
      header: "Player",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.player_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.centre_name || "No centre"}
          </p>
        </div>
      ),
    },
    {
      key: "programme_name",
      header: "Programme",
      render: (row) => row.programme_name || "—",
    },
    {
      key: "award_amount",
      header: "Award",
      render: (row) => (
        <span className="htt-tabular">{currency(row.award_amount)}</span>
      ),
    },
    {
      key: "funding",
      header: "Funding position",
      render: (row) => {
        const secured = Number(row.funding_secured || 0);
        const required = Number(row.funding_required || 0);
        return (
          <div className="text-[11.5px]">
            <p className="text-emerald-700">{currency(secured)} secured</p>
            <p
              className={
                required > 0 ? "text-amber-700" : "text-muted-foreground"
              }
            >
              {required > 0 ? `${currency(required)} required` : "Fully funded"}
            </p>
          </div>
        );
      },
    },
    {
      key: "renewal_date",
      header: "Renewal",
      render: (row) => (
        <span className="text-[12px]">{formatDate(row.renewal_date)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={AWARD_STATUS} />,
    },
  ];

  return (
    <ResourcePage
      moduleKey="scholarships"
      title="Active Scholarships"
      description="Approved awards with start, end and renewal dates. The initial target is up to 20 players, subject to confirmed funding."
      entityLabel="award"
      entity="ScholarshipAward"
      fields={fields}
      columns={columns}
      searchFields={["player_name", "programme_name", "centre_name"]}
      searchPlaceholder="Search player or programme…"
      filters={[
        {
          key: "status",
          label: "All statuses",
          options: Object.keys(AWARD_STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
      ]}
      defaultQuery={{ status: "active" }}
      defaultValues={{ status: "active" }}
      emptyIcon={BadgeCheck}
      emptyTitle="No active scholarships"
      emptyDescription="Approving a scholarship application creates an active award."
    />
  );
}
