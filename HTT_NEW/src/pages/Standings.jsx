import React, { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import ListToolbar from "@/components/common/ListToolbar";
import { FilterSelect } from "@/components/common/TableBits";
import AccessDenied from "@/components/common/AccessDenied";
import EmptyState from "@/components/common/EmptyState";
import useCollection from "@/hooks/useCollection";
import { useAppConfig } from "@/lib/AppConfigContext";
import { labelize } from "@/lib/constants";

export default function Standings() {
  const { can, settings } = useAppConfig();
  const seasons = useCollection(
    "Season",
    {},
    { sort: "-created_date", limit: 50 },
  );
  const [seasonId, setSeasonId] = useState("");

  const teams = useCollection("Team", seasonId ? { season_id: seasonId } : {}, {
    sort: "name",
    limit: 100,
  });
  const fixtures = useCollection(
    "Fixture",
    seasonId
      ? { season_id: seasonId, status: "completed" }
      : { status: "completed" },
    { limit: 200 },
  );

  const activeSeason = seasons.items.find((s) => s.id === seasonId);
  const pointsWin = activeSeason?.points_win ?? 3;
  const pointsDraw = activeSeason?.points_draw ?? 1;
  const pointsLoss = activeSeason?.points_loss ?? 0;

  const table = useMemo(() => {
    const rows = {};
    const ensure = (id, name) => {
      if (!rows[id]) {
        rows[id] = {
          id,
          name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          points: 0,
        };
      }
      return rows[id];
    };
    teams.items.forEach((t) => ensure(t.id, t.name));
    fixtures.items.forEach((f) => {
      const home = ensure(
        f.home_team_id || f.home_team_name,
        f.home_team_name || "Unknown",
      );
      const away = ensure(
        f.away_team_id || f.away_team_name,
        f.away_team_name || "Unknown",
      );
      const hs = Number(f.home_score ?? 0);
      const as = Number(f.away_score ?? 0);
      home.played += 1;
      away.played += 1;
      home.gf += hs;
      home.ga += as;
      away.gf += as;
      away.ga += hs;
      if (hs > as) {
        home.won += 1;
        home.points += pointsWin;
        away.lost += 1;
        away.points += pointsLoss;
      } else if (hs < as) {
        away.won += 1;
        away.points += pointsWin;
        home.lost += 1;
        home.points += pointsLoss;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += pointsDraw;
        away.points += pointsDraw;
      }
    });
    return Object.values(rows)
      .map((r) => ({ ...r, gd: r.gf - r.ga }))
      .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)
      .map((r, i) => ({ ...r, position: i + 1 }));
  }, [teams.items, fixtures.items, pointsWin, pointsDraw, pointsLoss]);

  if (!can("league")) return <AccessDenied moduleName="league standings" />;

  const columns = [
    {
      key: "position",
      header: "#",
      width: 48,
      render: (row) => (
        <span className="htt-tabular text-[12px] font-semibold text-muted-foreground">
          {row.position}
        </span>
      ),
    },
    {
      key: "name",
      header: "Team",
      render: (row) => (
        <span className="text-[13px] font-medium">{row.name}</span>
      ),
    },
    {
      key: "played",
      header: "P",
      render: (row) => <span className="htt-tabular">{row.played}</span>,
    },
    {
      key: "won",
      header: "W",
      render: (row) => <span className="htt-tabular">{row.won}</span>,
    },
    {
      key: "drawn",
      header: "D",
      render: (row) => <span className="htt-tabular">{row.drawn}</span>,
    },
    {
      key: "lost",
      header: "L",
      render: (row) => <span className="htt-tabular">{row.lost}</span>,
    },
    {
      key: "gf",
      header: "GF",
      render: (row) => <span className="htt-tabular">{row.gf}</span>,
    },
    {
      key: "ga",
      header: "GA",
      render: (row) => <span className="htt-tabular">{row.ga}</span>,
    },
    {
      key: "gd",
      header: "GD",
      render: (row) => (
        <span
          className={`htt-tabular ${row.gd > 0 ? "text-emerald-700" : row.gd < 0 ? "text-rose-600" : ""}`}
        >
          {row.gd > 0 ? `+${row.gd}` : row.gd}
        </span>
      ),
    },
    {
      key: "points",
      header: "Pts",
      render: (row) => (
        <span className="htt-tabular font-semibold">{row.points}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Standings"
        description="Calculated live from completed results using the points rules configured on the season."
      />

      {settings?.league_status !== "active" ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[12.5px] text-amber-800">
          The HTT Academy League is currently marked{" "}
          <strong>{labelize(settings?.league_status || "planned")}</strong>. No
          teams, fixtures or standings are pre-created.
        </div>
      ) : null}

      <ListToolbar>
        <FilterSelect
          value={seasonId}
          onChange={setSeasonId}
          options={seasons.items.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="All seasons"
          className="w-[220px]"
        />
        <span className="text-[12px] text-muted-foreground">
          Points: {pointsWin} win · {pointsDraw} draw · {pointsLoss} loss
        </span>
      </ListToolbar>

      {table.length === 0 ? (
        <div className="htt-surface">
          <EmptyState
            icon={Trophy}
            title="No standings available"
            description="Add teams and record completed results to build the table."
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={table}
          loading={teams.loading || fixtures.loading}
        />
      )}
    </div>
  );
}
