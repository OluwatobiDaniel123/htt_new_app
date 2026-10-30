import React, { useMemo } from "react";
import { Shield } from "lucide-react";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";
import useCollection from "@/hooks/useCollection";
import { labelize } from "@/lib/constants";

const TEAM_STATUS = {
  planned: { label: "Planned", tone: "gold" },
  active: { label: "Active", tone: "green" },
  withdrawn: { label: "Withdrawn", tone: "red" },
};

export default function Teams() {
  const seasons = useCollection(
    "Season",
    {},
    { sort: "-created_date", limit: 50 },
  );
  const centres = useCollection("Centre", {}, { sort: "name", limit: 100 });
  const players = useCollection(
    "Player",
    { archived: false },
    { sort: "full_name", limit: 200 },
  );

  const seasonOptions = useMemo(
    () => seasons.items.map((s) => ({ value: s.id, label: s.name })),
    [seasons.items],
  );
  const centreOptions = useMemo(
    () => centres.items.map((c) => ({ value: c.id, label: c.name })),
    [centres.items],
  );
  const playerOptions = useMemo(
    () =>
      players.items.map((p) => ({
        value: p.id,
        label: `${p.full_name}${p.player_id ? ` · ${p.player_id}` : ""}`,
      })),
    [players.items],
  );

  const fields = [
    {
      name: "name",
      label: "Team name",
      required: true,
      placeholder: "e.g. Ikeja Lions U12",
    },
    {
      name: "age_category",
      label: "Age category",
      required: true,
      type: "select",
      options: ["8-10", "11-12", "13-14"].map((v) => ({ value: v, label: v })),
    },
    {
      name: "season_id",
      label: "Season",
      type: "select",
      required: true,
      options: seasonOptions,
    },
    {
      name: "centre_id",
      label: "Centre",
      type: "select",
      options: centreOptions,
    },
    { name: "coach_name", label: "Coach name" },
    { name: "coach_email", label: "Coach email", type: "email" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: Object.keys(TEAM_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "planned",
    },
    {
      name: "roster_ids",
      label: "Squad",
      type: "multiselect",
      colSpan: 2,
      options: playerOptions,
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Team",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.centre_name || "No centre"} · {row.season_name || "No season"}
          </p>
        </div>
      ),
    },
    {
      key: "age_category",
      header: "Age category",
      render: (row) => row.age_category || "—",
    },
    {
      key: "coach_name",
      header: "Coach",
      render: (row) => row.coach_name || row.coach_email || "—",
    },
    {
      key: "roster",
      header: "Squad size",
      render: (row) =>
        `${(row.roster || []).length} player${(row.roster || []).length === 1 ? "" : "s"}`,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={TEAM_STATUS} />,
    },
  ];

  const transform = (values) => {
    const season = seasons.items.find((s) => s.id === values.season_id);
    const centre = centres.items.find((c) => c.id === values.centre_id);
    const roster = (values.roster_ids || [])
      .map((id) => players.items.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({ player_id: p.id, player_name: p.full_name }));
    return {
      ...values,
      season_name: season?.name || "",
      centre_name: centre?.name || "",
      roster,
    };
  };

  return (
    <ResourcePage
      moduleKey="league"
      title="Teams"
      description="Centre-based teams and squads for the planned academy league."
      entityLabel="team"
      entity="Team"
      fields={fields}
      transform={transform}
      columns={columns}
      searchFields={["name", "coach_name"]}
      searchPlaceholder="Search team or coach…"
      filters={[
        {
          key: "status",
          label: "All statuses",
          options: Object.keys(TEAM_STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
        {
          key: "age_category",
          label: "All age groups",
          options: ["8-10", "11-12", "13-14"].map((v) => ({
            value: v,
            label: v,
          })),
        },
      ]}
      defaultValues={{ status: "planned" }}
      emptyIcon={Shield}
      emptyTitle="No teams yet"
      emptyDescription="Create centre teams once a season is in preparation."
    />
  );
}
