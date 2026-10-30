import React, { useMemo } from "react";
import { Swords } from "lucide-react";
import ResourcePage from "@/components/common/ResourcePage";
import StatusBadge from "@/components/common/StatusBadge";
import useCollection from "@/hooks/useCollection";
import { formatDateTime, labelize } from "@/lib/constants";

const FIXTURE_STATUS = {
  scheduled: { label: "Scheduled", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  postponed: { label: "Postponed", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "navy" },
};

export default function Fixtures() {
  const seasons = useCollection(
    "Season",
    {},
    { sort: "-created_date", limit: 50 },
  );
  const teams = useCollection("Team", {}, { sort: "name", limit: 100 });

  const seasonOptions = useMemo(
    () => seasons.items.map((s) => ({ value: s.id, label: s.name })),
    [seasons.items],
  );
  const teamOptions = useMemo(
    () => teams.items.map((t) => ({ value: t.id, label: t.name })),
    [teams.items],
  );

  const fields = [
    {
      name: "season_id",
      label: "Season",
      type: "select",
      options: seasonOptions,
    },
    {
      name: "age_category",
      label: "Age category",
      type: "select",
      options: ["8-10", "11-12", "13-14"].map((v) => ({ value: v, label: v })),
    },
    {
      name: "home_team_id",
      label: "Home team",
      type: "select",
      required: true,
      options: teamOptions,
    },
    {
      name: "away_team_id",
      label: "Away team",
      type: "select",
      required: true,
      options: teamOptions,
    },
    { name: "match_date", label: "Kick-off", type: "datetime", required: true },
    { name: "venue", label: "Venue" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: Object.keys(FIXTURE_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "scheduled",
    },
    {
      name: "match_report",
      label: "Match report",
      type: "textarea",
      colSpan: 2,
      rows: 2,
    },
  ];

  const columns = [
    {
      key: "teams",
      header: "Fixture",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">
            {row.home_team_name}{" "}
            <span className="text-muted-foreground">vs</span>{" "}
            {row.away_team_name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {row.season_name || "No season"} · {row.age_category || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "match_date",
      header: "Kick-off",
      render: (row) => (
        <span className="text-[12px]">{formatDateTime(row.match_date)}</span>
      ),
    },
    { key: "venue", header: "Venue", render: (row) => row.venue || "—" },
    {
      key: "score",
      header: "Score",
      render: (row) =>
        row.status === "completed" ? (
          <span className="htt-tabular font-medium">
            {row.home_score ?? 0} – {row.away_score ?? 0}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status} map={FIXTURE_STATUS} />,
    },
  ];

  const transform = (values) => {
    const home = teams.items.find((t) => t.id === values.home_team_id);
    const away = teams.items.find((t) => t.id === values.away_team_id);
    const season = seasons.items.find((s) => s.id === values.season_id);
    if (home && away && home.id === away.id) {
      throw new Error("A team cannot play itself. Choose two different teams.");
    }
    return {
      ...values,
      home_team_name: home?.name || "",
      away_team_name: away?.name || "",
      season_name: season?.name || "",
      age_category: values.age_category || home?.age_category || "",
    };
  };

  return (
    <ResourcePage
      moduleKey="league"
      title="Fixtures"
      description="Database-backed fixture scheduling. No fixtures are pre-generated — add them once the league is confirmed."
      entityLabel="fixture"
      entity="Fixture"
      fields={fields}
      transform={transform}
      columns={columns}
      searchFields={["home_team_name", "away_team_name", "venue"]}
      searchPlaceholder="Search team or venue…"
      filters={[
        {
          key: "status",
          label: "All statuses",
          options: Object.keys(FIXTURE_STATUS).map((v) => ({
            value: v,
            label: labelize(v),
          })),
        },
      ]}
      defaultValues={{ status: "scheduled" }}
      sort="-match_date"
      emptyIcon={Swords}
      emptyTitle="No fixtures scheduled"
      emptyDescription="Fixtures appear here once teams and a season exist."
    />
  );
}
