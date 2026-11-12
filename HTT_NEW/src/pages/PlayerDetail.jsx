import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  ClipboardCheck,
  Users,
  CalendarCheck,
} from "lucide-react";
import { getResource, saveResource } from "@/api/resources";
import { useAppConfig } from "@/lib/AppConfigContext";
import { useToast } from "@/components/ui/use-toast";
import { ageFromDob, formatDate, initials, labelize } from "@/lib/constants";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import DetailField, {
  DetailGrid,
  SectionCard,
} from "@/components/common/DetailField";
import FormDialog from "@/components/common/FormDialog";
import AccessDenied from "@/components/common/AccessDenied";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import useCollection from "@/hooks/useCollection";

const REG_STATUS = {
  pending: { label: "Pending approval", tone: "amber" },
  prospective: { label: "Prospective", tone: "amber" },
  registered: { label: "Registered", tone: "green" },
  waitlisted: { label: "Waitlisted", tone: "gold" },
  archived: { label: "Archived", tone: "navy" },
  rejected: { label: "Rejected", tone: "red" },
};

const ATTENDANCE_TONE = {
  present: { label: "Present", tone: "green" },
  late: { label: "Late", tone: "gold" },
  absent: { label: "Absent", tone: "red" },
  excused: { label: "Excused", tone: "navy" },
};

export default function PlayerDetail() {
  const { id } = useParams();
  const { can } = useAppConfig();
  const { toast } = useToast();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const centres = useCollection("Centre", {}, { sort: "name", limit: 100 });
  const programmes = useCollection(
    "Programme",
    {},
    { sort: "name", limit: 100 },
  );
  const assessments = useCollection(
    "Assessment",
    { player_id: id },
    { sort: "-scheduled_at", limit: 20 },
  );
  const attendance = useCollection(
    "AttendanceRecord",
    { player_id: id },
    { sort: "-session_date", limit: 20 },
  );
  const links = useCollection("GuardianLink", { player_id: id }, { limit: 10 });

  const load = async () => {
    try {
      setPlayer(await getResource("Player", id));
    } catch {
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    load();
  }, [id]);

  const centreOptions = useMemo(
    () => centres.items.map((c) => ({ value: c.id, label: c.name })),
    [centres.items],
  );
  const programmeOptions = useMemo(
    () => programmes.items.map((p) => ({ value: p.id, label: p.name })),
    [programmes.items],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!can("players")) return <AccessDenied moduleName="player records" />;
  if (!player) {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] font-medium">Player not found</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/players">Back to players</Link>
        </Button>
      </div>
    );
  }

  const manage = can("players", "full");
  const attended = attendance.items.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const attendanceRate = attendance.items.length
    ? Math.round((attended / attendance.items.length) * 100)
    : null;

  const fields = [
    { name: "full_name", label: "Full name", required: true },
    {
      name: "date_of_birth",
      label: "Date of birth",
      type: "date",
      required: true,
    },
    {
      name: "centre_id",
      label: "Centre",
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
      options: Object.keys(REG_STATUS).map((v) => ({
        value: v,
        label: labelize(v),
      })),
    },
    {
      name: "scholarship_status",
      label: "Scholarship status",
      type: "select",
      options: ["none", "applicant", "active", "declined"].map((v) => ({
        value: v,
        label: labelize(v),
      })),
    },
    {
      name: "document_verification",
      label: "Document verification",
      type: "select",
      options: ["pending", "verified", "rejected"].map((v) => ({
        value: v,
        label: labelize(v),
      })),
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
      label: "Match experience",
      type: "textarea",
      colSpan: 2,
      rows: 2,
    },
  ];

  const handleSave = async (values) => {
    const centre = centres.items.find((c) => c.id === values.centre_id);
    const programme = programmes.items.find(
      (p) => p.id === values.programme_id,
    );
    await saveResource("Player", player.id, {
      ...values,
      centre_name: centre?.name || "",
      programme_name: programme?.name || "",
      match_appearances: Number(values.match_appearances || 0),
    });
    toast({ title: "Player updated" });
    await load();
  };

  return (
    <div>
      <Link
        to="/players"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to players
      </Link>

      <PageHeader
        eyebrow={player.player_id || "Player"}
        title={player.full_name}
        description={`${player.centre_name || "No centre"} · ${player.programme_name || "No programme"} · ${
          ageFromDob(player.date_of_birth) ?? "—"
        } years`}
        actions={
          manage ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[12px]"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit player
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Player profile">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B1F3A] text-[13px] font-semibold text-white">
                {initials(player.full_name)}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  value={player.registration_status}
                  map={REG_STATUS}
                />
                <StatusBadge value={player.document_verification} />
                <StatusBadge value={player.scholarship_status} />
              </div>
            </div>
            <DetailGrid>
              <DetailField
                label="Official player ID"
                value={player.official_player_id || "Not assigned"}
              />
              <DetailField
                label="Legacy player code"
                value={player.player_code}
              />
              <DetailField
                label="Date of birth"
                value={formatDate(player.date_of_birth)}
              />
              <DetailField label="Age group" value={player.age_group} />
              <DetailField label="Centre" value={player.centre_name} />
              <DetailField label="Programme" value={player.programme_name} />
              <DetailField
                label="Primary guardian"
                value={player.primary_guardian_name}
              />
              <DetailField
                label="Match appearances"
                value={player.match_appearances ?? 0}
              />
              <DetailField label="School (restricted)" value={player.school} />
              <DetailField
                label="Record created"
                value={formatDate(player.created_date)}
              />
            </DetailGrid>
          </SectionCard>

          <SectionCard
            title="Development notes"
            description="Internal coaching notes and milestones."
          >
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground/85">
              {player.development_notes || "No development notes recorded yet."}
            </p>
          </SectionCard>

          <SectionCard
            title="Assessment history"
            description="Latest assessments recorded for this player."
          >
            {assessments.loading ? (
              <p className="py-3 text-[12.5px] text-muted-foreground">
                Loading…
              </p>
            ) : assessments.items.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No assessments yet"
                description="Scheduled and completed assessments appear here."
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {assessments.items.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div>
                      <p className="text-[12.5px] font-medium">
                        {labelize(a.type)} assessment
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(a.scheduled_at)} ·{" "}
                        {a.coach_name || a.coach_email || "Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.overall_rating ? (
                        <span className="htt-tabular rounded-md bg-muted px-2 py-0.5 text-[11.5px] font-medium">
                          {a.overall_rating}/10
                        </span>
                      ) : null}
                      <StatusBadge value={a.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Attendance history">
            {attendance.loading ? (
              <p className="py-3 text-[12.5px] text-muted-foreground">
                Loading…
              </p>
            ) : attendance.items.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No attendance recorded"
                description="Session attendance marked by coaches appears here."
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {attendance.items.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span className="text-[12.5px]">
                      {formatDate(r.session_date)}
                    </span>
                    <StatusBadge value={r.status} map={ATTENDANCE_TONE} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Attendance rate">
            <p className="htt-tabular text-[28px] font-semibold leading-none">
              {attendanceRate === null ? "—" : `${attendanceRate}%`}
            </p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Based on {attendance.items.length} recorded session
              {attendance.items.length === 1 ? "" : "s"}
            </p>
          </SectionCard>

          <SectionCard title="Guardians">
            {links.items.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No guardian linked"
                description="Guardians are linked when a registration is approved."
              />
            ) : (
              <ul className="space-y-4">
                {links.items.map((l) => {
                  const guardian = l.guardian || {};

                  return (
                    <li
                      key={l.id || guardian.id}
                      className="rounded-lg border p-3 space-y-3"
                    >
                      {/* Guardian name and relationship */}
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Guardian Name
                        </p>
                        <p className="text-sm font-semibold">
                          {guardian.full_name ||
                            l.guardian_name ||
                            "Unknown guardian"}
                        </p>
                      </div>

                      {/* Contact information */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            Phone number
                          </p>
                          <p className="text-[12.5px] font-medium">
                            {guardian.phone || "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            Email address
                          </p>
                          <p className="text-[12.5px] font-medium break-all">
                            {guardian.email || "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            Relationship
                          </p>
                          <p className="text-[12.5px] font-medium">
                            {labelize(l.relationship)}
                            {l.is_primary && " · Primary contact"}
                            {l.is_emergency_contact && " · Emergency contact"}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {player.safeguarding_notes ? (
            <SectionCard
              title="Safeguarding notes"
              description="Restricted — management and safeguarding leads only."
            >
              <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-foreground/85">
                {player.safeguarding_notes}
              </p>
            </SectionCard>
          ) : null}
        </div>
      </div>

      <FormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit player record"
        fields={fields}
        initial={player}
        onSubmit={handleSave}
        submitLabel="Save changes"
      />
    </div>
  );
}
