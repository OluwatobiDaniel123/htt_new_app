import React, { useMemo, useState } from "react";
import { ClipboardCheck, Star } from "lucide-react";
import { api, fromUiRecord } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime, labelize } from "@/lib/constants";
import ResourcePage from "@/components/common/ResourcePage";
import FormDialog from "@/components/common/FormDialog";
import StatusBadge from "@/components/common/StatusBadge";
import useCollection from "@/hooks/useCollection";

export const ASSESSMENT_STATUS = {
  scheduled: { label: "Scheduled", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "navy" },
  no_show: { label: "No show", tone: "red" },
};

const CRITERIA = [
  { key: "technical_ability", label: "Technical ability" },
  { key: "tactical_understanding", label: "Tactical understanding" },
  { key: "teamwork", label: "Teamwork" },
  { key: "attitude", label: "Attitude" },
  { key: "development_potential", label: "Development potential" },
];

export default function Assessments() {
  const { toast } = useToast();
  const players = useCollection(
    "Player",
    { archived: false },
    { sort: "full_name", limit: 200 },
  );
  const centres = useCollection("Centre", {}, { sort: "name", limit: 100 });
  const [scoring, setScoring] = useState(null);

  const playerOptions = useMemo(
    () =>
      players.items.map((p) => ({
        value: p.id,
        label: `${p.full_name}${p.player_id ? ` · ${p.player_id}` : ""}`,
      })),
    [players.items],
  );
  const centreOptions = useMemo(
    () => centres.items.map((c) => ({ value: c.id, label: c.name })),
    [centres.items],
  );

  const fields = [
    {
      name: "player_id",
      label: "Player",
      type: "select",
      required: true,
      options: playerOptions,
    },
    {
      name: "type",
      label: "Assessment type",
      type: "select",
      options: ["trial", "periodic", "scholarship"].map((v) => ({
        value: v,
        label: labelize(v),
      })),
      defaultValue: "trial",
    },
    {
      name: "scheduled_at",
      label: "Scheduled date & time",
      type: "datetime",
      required: true,
    },
    {
      name: "centre_id",
      label: "Centre",
      type: "select",
      options: centreOptions,
    },
    { name: "coach_name", label: "Assigned coach" },
    { name: "coach_email", label: "Coach email", type: "email" },
  ];

  const transform = (values) => {
    const player = players.items.find((p) => p.id === values.player_id);
    const centre = centres.items.find((c) => c.id === values.centre_id);

    return {
      ...values,
      scheduled_at: values.scheduled_at
        ? new Date(values.scheduled_at).toISOString()
        : values.scheduled_at,
      player_name: player?.full_name || "",
      centre_name: centre?.name || player?.centre_name || "",
      status: values.status || "scheduled",
    };
  };

  const scoreFields = [
    {
      name: "status",
      label: "Outcome",
      type: "select",
      options: [
        { value: "completed", label: "Completed" },
        { value: "no_show", label: "No show" },
        { value: "cancelled", label: "Cancelled" },
      ],
      defaultValue: "completed",
    },
    ...CRITERIA.map((c) => ({
      key: c.key,
      name: `score_${c.key}`,
      label: c.label,
      type: "number",
      min: 1,
      max: 10,
      step: 1,
    })),
    {
      name: "feedback",
      label: "Feedback",
      type: "textarea",
      colSpan: 2,
      rows: 3,
    },
    {
      name: "improvement_targets",
      label: "Improvement targets",
      type: "textarea",
      colSpan: 2,
      rows: 2,
    },
  ];

  const handleScore = async (values) => {
    const criteria = {};
    CRITERIA.forEach((c) => {
      const v = values[`score_${c.key}`];
      if (v !== "" && v !== undefined) criteria[c.key] = Number(v);
    });
    const scores = Object.values(criteria);
    const overall = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
        10
      : undefined;
    await api.patch(
      `/assessments/${scoring.id}`,
      fromUiRecord({
        status: values.status,
        criteria_scores: criteria,
        overall_rating: overall,
        feedback: values.feedback || "",
        improvement_targets: values.improvement_targets
          ? values.improvement_targets.split("\n").filter(Boolean)
          : [],
        completed_at:
          values.status === "completed" ? new Date().toISOString() : undefined,
      }),
    );
    toast({ title: "Assessment saved" });
  };

  const columns = [
    {
      key: "player_name",
      header: "Player",
      render: (row) => (
        <div>
          <p className="text-[13px] font-medium">{row.player_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {labelize(row.type)} · {row.centre_name || "No centre"}
          </p>
        </div>
      ),
    },
    {
      key: "scheduled_at",
      header: "Scheduled",
      render: (row) => (
        <span className="text-[12px]">{formatDateTime(row.scheduled_at)}</span>
      ),
    },
    {
      key: "coach",
      header: "Coach",
      render: (row) => row.coach_name || row.coach_email || "—",
    },
    {
      key: "overall_rating",
      header: "Overall",
      render: (row) =>
        row.overall_rating ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#FBF5E6] px-2 py-0.5 text-[11.5px] font-medium text-[#8A6D20]">
            <Star className="h-3 w-3" /> {row.overall_rating}/10
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge value={row.status} map={ASSESSMENT_STATUS} />
      ),
    },
  ];

  return (
    <>
      <ResourcePage
        moduleKey="assessments"
        title="Assessments"
        description="Schedule assessments, assign coaches and record technical, tactical, teamwork, attitude and development scores."
        entityLabel="assessment"
        entity="Assessment"
        fields={fields}
        transform={transform}
        columns={columns}
        searchFields={["player_name", "coach_name"]}
        searchPlaceholder="Search player or coach…"
        filters={[
          {
            key: "status",
            label: "All statuses",
            options: Object.keys(ASSESSMENT_STATUS).map((v) => ({
              value: v,
              label: labelize(v),
            })),
          },
          {
            key: "type",
            label: "All types",
            options: ["trial", "periodic", "scholarship"].map((v) => ({
              value: v,
              label: labelize(v),
            })),
          },
        ]}
        defaultValues={{ type: "trial", status: "scheduled" }}
        sort="-scheduled_at"
        emptyIcon={ClipboardCheck}
        emptyTitle="No assessments scheduled"
        emptyDescription="Schedule an assessment to begin recording player development."
        rowActions={(row) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setScoring(row);
            }}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-[#0E7A4F]/10 hover:text-[#0E7A4F]"
            title="Record scores"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        )}
      />

      <FormDialog
        open={!!scoring}
        onOpenChange={(v) => (!v ? setScoring(null) : null)}
        title={`Record assessment — ${scoring?.player_name || ""}`}
        description="Scores are out of 10. The overall rating is the average of the criteria recorded."
        fields={scoreFields}
        initial={
          scoring
            ? {
                status:
                  scoring.status === "scheduled" ? "completed" : scoring.status,
                ...CRITERIA.reduce(
                  (acc, c) => ({
                    ...acc,
                    [`score_${c.key}`]: scoring.criteria_scores?.[c.key] ?? "",
                  }),
                  {},
                ),
                feedback: scoring.feedback || "",
                improvement_targets: scoring.improvement_targets || "",
              }
            : {}
        }
        onSubmit={handleScore}
        submitLabel="Save assessment"
      />
    </>
  );
}
