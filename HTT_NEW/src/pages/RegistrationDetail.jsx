import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  Clock,
} from "lucide-react";
import { api } from "@/api/client";
import { getResource } from "@/api/resources";
import { useAppConfig } from "@/lib/AppConfigContext";
import { useToast } from "@/components/ui/use-toast";
import {
  formatDate,
  formatDateTime,
  currency,
  labelize,
} from "@/lib/constants";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import DetailField, {
  DetailGrid,
  SectionCard,
} from "@/components/common/DetailField";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import AccessDenied from "@/components/common/AccessDenied";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { REG_STATUS, PAYMENT_STATUS } from "@/pages/Registrations";

const DECISION_OPTIONS = [
  { status: "under_review", label: "Start review", tone: "amber" },
  {
    status: "assessment_required",
    label: "Assessment required",
    tone: "purple",
  },
  {
    status: "information_required",
    label: "Request more information",
    tone: "gold",
  },
  { status: "rejected", label: "Reject", tone: "red", destructive: true },
];

const frontendEnv =
  /** @type {{env?: {VITE_API_BASE_URL?: string}}} */ (import.meta);
const API_BASE_URL =
  frontendEnv.env?.VITE_API_BASE_URL || `${window.location.origin}/api/v1`;

export default function RegistrationDetail() {
  const { id } = useParams();
  const { can } = useAppConfig();
  const { toast } = useToast();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [profileImageLoading, setProfileImageLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [decision, setDecision] = useState(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState([]);
  const [existingPlayerId, setExistingPlayerId] = useState("");
  const [confirmNewPlayer, setConfirmNewPlayer] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getResource("Registration", id);
      if (!res?.id)
        throw new Error("The registration response did not contain a record.");

      setRecord(res);
      setNotes(res.internal_notes || "");

      setProfileImageUrl("");

      if (res.profile_image_asset_id) {
        setProfileImageLoading(true);

        try {
          const imageResponse = await api.get(
            `/registrations/${res.id}/profile-image`,
          );

          setProfileImageUrl(imageResponse?.url || "");
        } catch (error) {
          console.error("Unable to load registration profile image:", error);
        } finally {
          setProfileImageLoading(false);
        }
      }
    } catch (error) {
      setRecord(null);
      setLoadError(
        error?.message ||
          "An unexpected error occurred while loading this registration.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!can("registrations")) return <AccessDenied moduleName="registrations" />;

  if (!record) {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] font-medium">
          {loadError === "Registration not found."
            ? "Registration not found"
            : "Unable to load registration"}
        </p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          {loadError ||
            "The registration may have been deleted or you may not have access."}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/registrations">Back to registrations</Link>
          </Button>
        </div>
      </div>
    );
  }

  const manage = can("registrations", "full");
  const linked = !!record.linked_player_id;
  const approved = record.status === "approved";

  const applyStatus = async (status, note) => {
    const actions = {
      under_review: "start-review",
      assessment_required: "require-assessment",
      information_required: "request-changes",
      rejected: "reject",
    };
    const action = actions[status];
    if (!action)
      throw new Error("This registration status is not supported by the API.");
    await api.post(`/registrations/${record.id}/${action}`, { note });
    await load();
    toast({ title: `Registration marked ${labelize(status).toLowerCase()}` });
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      if (
        duplicateCandidates.length &&
        !existingPlayerId &&
        !confirmNewPlayer
      ) {
        throw new Error(
          "Select a matching player or explicitly confirm creating a new player.",
        );
      }
      const approval = {
        note: decisionNote,
        ...(existingPlayerId
          ? { existingPlayerId }
          : confirmNewPlayer
            ? { confirmNewPlayer: true }
            : {}),
      };
      const result = await api.post(
        `/registrations/${record.id}/approve`,
        approval,
      );
      toast({
        title: "Registration approved",
        description:
          result.officialPlayerId ||
          (result.playerId ? `Player ${result.playerId}` : undefined),
      });
      setApproveOpen(false);
      setDecisionNote("");
      setDuplicateCandidates([]);
      setExistingPlayerId("");
      setConfirmNewPlayer(false);
      await load();
    } catch (error) {
      if (error.code === "POSSIBLE_DUPLICATE_PLAYER") {
        setDuplicateCandidates(error.details?.candidates || []);
        throw new Error(
          "A possible matching player exists. Review the options below before continuing.",
        );
      }
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      await applyStatus(decision.status, decisionNote);
      setDecision(null);
      setDecisionNote("");
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.patch(`/registrations/${record.id}`, { internalNotes: notes });
      toast({ title: "Internal notes saved" });
      await load();
    } finally {
      setSavingNotes(false);
    }
  };

  const setDocumentStatus = async (index, status) => {
    const documents = (record.documents || []).map((doc, i) => ({
      ...(doc.id ? { id: doc.id } : {}),
      mediaAssetId: doc.media_asset_id || null,
      name: doc.name,
      status: i === index ? status : doc.status,
    }));
    await api.put(`/registrations/${record.id}/documents`, { documents });
    await load();
  };
  return (
    <div>
      <Link
        to="/registrations"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to registrations
      </Link>

      <PageHeader
        eyebrow={record.reference || "Registration"}
        title={record.child_name}
        description={`Guardian: ${record.guardian_name} · ${record.guardian_phone || "No phone"} · ${
          record.centre_name || "No centre selected"
        }`}
        actions={
          manage ? (
            <div className="flex flex-row p-4 items-center">
              <div className="p-4">
                {profileImageLoading ? (
                  <p className="text-[12.5px] text-muted-foreground">
                    Loading profile picture...
                  </p>
                ) : profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={`${record.child_name} profile`}
                    className="max-h-[100px] rounded-lg object-contain"
                  />
                ) : (
                  <p className="text-[12.5px] text-muted-foreground">
                    No profile picture available.
                  </p>
                )}
              </div>

              <div>
                {DECISION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.status}
                    size="sm"
                    variant="outline"
                    className="h-8 text-[12px]"
                    disabled={busy || record.status === opt.status}
                    onClick={() => {
                      setDecision(opt);
                      setDecisionNote("");
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-[#0E7A4F] text-[12px] hover:bg-[#0b6a44]"
                  disabled={
                    busy || approved || record.payment_status !== "paid"
                  }
                  onClick={() => {
                    setDuplicateCandidates([]);
                    setExistingPlayerId("");
                    setConfirmNewPlayer(false);
                    setApproveOpen(true);
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {approved
                    ? "Approved"
                    : record.payment_status !== "paid"
                      ? "Payment required"
                      : "Approve registration"}
                </Button>
              </div>
            </div>
          ) : (
            <StatusBadge value={record.status} map={REG_STATUS} />
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Application details">
            <DetailGrid>
              <DetailField label="Child" value={record.child_name} />
              <DetailField label="Gender" value={record.child_gender} />
              <DetailField
                label="Date of birth"
                value={formatDate(record.child_date_of_birth)}
              />
              <DetailField label="School" value={record.child_school} />
              <DetailField label="Class" value={record.child_class_name} />
              <DetailField
                label="Position"
                value={record.child_position_uuid}
              />
              <DetailField label="Age group" value={record.age_group} />
              <DetailField label="Pathway" value={labelize(record.pathway)} />
              <DetailField label="Centre" value={record.centre_name} />
              <DetailField label="Programme" value={record.programme_name} />
              <DetailField
                label="Submitted centre name"
                value={record.centre_name_snapshot}
              />
              <DetailField
                label="Submitted programme title"
                value={record.programme_title_snapshot}
              />
              <DetailField
                label="Submitted programme base fee"
                value={currency(record.programme_base_fee_submitted)}
              />
              <DetailField
                label="Submitted payment frequency"
                value={record.payment_frequency}
              />
              <DetailField
                label="Submitted payment fee"
                value={currency(record.payment_fee_submitted)}
              />
              <DetailField label="Guardian" value={record.guardian_name} />
              <DetailField
                label="Guardian relationship"
                value={record.guardian_relationship}
              />
              <DetailField
                label="Guardian contact"
                value={`${record.guardian_phone || "—"}${record.guardian_email ? ` · ${record.guardian_email}` : ""}`}
              />
              <DetailField label="Address" value={record.guardian_address} />
              <DetailField
                label="Alternative phone"
                value={record.guardian_alternative_phone}
              />
              <DetailField label="Source" value={labelize(record.source)} />
              <DetailField
                label="Submitted"
                value={formatDateTime(record.submitted_at)}
              />
              <DetailField
                label="Assigned reviewer"
                value={record.assigned_reviewer}
              />
            </DetailGrid>
          </SectionCard>

          <SectionCard title="Emergency contact">
            <DetailGrid>
              <DetailField
                label="Name"
                value={
                  record.emergency_contact?.full_name ||
                  record.emergency_contact_name
                }
              />
              <DetailField
                label="Phone"
                value={
                  record.emergency_contact?.phone ||
                  record.emergency_contact_phone
                }
              />
            </DetailGrid>
          </SectionCard>

          <SectionCard
            title="Documents"
            description="Uploaded registration documents and their review status."
          >
            {(record.documents || []).length === 0 ? (
              <p className="py-4 text-center text-[12.5px] text-muted-foreground">
                No documents attached yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {record.documents.map((doc, index) => (
                  <li
                    key={`${doc.name}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-left text-[12.5px] text-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge value={doc.status} />
                      {manage ? (
                        <>
                          <button
                            onClick={() => setDocumentStatus(index, "verified")}
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                            title="Mark verified"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDocumentStatus(index, "rejected")}
                            className="rounded p-1 text-rose-600 hover:bg-rose-50"
                            title="Reject document"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Internal notes"
            description="Visible to authorised staff only."
          >
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-[13px]"
              placeholder="Reviewer notes, verification outcomes, follow-up actions…"
              disabled={!manage}
            />
            {manage ? (
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[12px]"
                  onClick={saveNotes}
                  disabled={savingNotes}
                >
                  {savingNotes ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Save notes
                </Button>
              </div>
            ) : null}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Status">
            <div className="space-y-2">
              <StatusBadge value={record.status} map={REG_STATUS} />
              <DetailField
                label="Documents"
                value={labelize(record.document_status)}
              />
              <DetailField label="Payment status">
                <StatusBadge
                  value={record.payment_status}
                  map={PAYMENT_STATUS}
                />
              </DetailField>
              <DetailField
                label="Amount due"
                value={currency(record.amount_due)}
              />
              {(record.payment_records || []).map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-md border border-border/60 p-2 text-[11.5px]"
                >
                  <div className="flex justify-between gap-2">
                    <span>{payment.reference}</span>
                    <StatusBadge value={payment.status} />
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Requested {currency(payment.amount)} {payment.currency} ·{" "}
                    {labelize(payment.provider_status || "unverified")}
                  </p>
                  {payment.verified_at ? (
                    <p className="text-muted-foreground">
                      Verified {currency(payment.verified_amount)}{" "}
                      {payment.verified_currency} ·{" "}
                      {formatDateTime(payment.verified_at)}
                    </p>
                  ) : null}
                </div>
              ))}
              {linked ? (
                <Link
                  to={`/players/${record.linked_player_id}`}
                  className="mt-2 inline-flex text-[12px] font-medium text-[#0E7A4F] hover:underline"
                >
                  View player record
                  {record.player?.official_player_id
                    ? ` · ${record.player.official_player_id}`
                    : ""}
                </Link>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Consent captured">
            <ul className="space-y-1.5 text-[12.5px]">
              {[
                ["Data processing", record.consent_data],
                ["Media / photography", record.consent_media],
                ["Medical treatment", record.consent_medical],
              ].map(([label, value]) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span
                    className={
                      value ? "font-medium text-emerald-700" : "text-rose-600"
                    }
                  >
                    {value ? "Granted" : "Not granted"}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Status history">
            {(record.status_history || []).length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                No status changes recorded.
              </p>
            ) : (
              <ol className="space-y-3">
                {[...record.status_history].reverse().map((entry, i) => (
                  <li key={`${entry.at}-${i}`} className="flex gap-2.5">
                    <span className="mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-foreground">
                        {labelize(entry.status)}
                      </p>
                      {entry.note ? (
                        <p className="text-[11.5px] text-muted-foreground">
                          {entry.note}
                        </p>
                      ) : null}
                      <p className="text-[10.5px] text-muted-foreground/80">
                        {formatDateTime(entry.at)} · {entry.by}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={!!decision}
        onOpenChange={(v) => (!v ? setDecision(null) : null)}
        title={decision?.label || ""}
        description={
          <span className="block space-y-2">
            <span className="block">
              This changes the registration status and is recorded in the audit
              log.
            </span>
            <Textarea
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="Reason or note (optional)"
              rows={2}
              className="mt-2 text-[12.5px]"
            />
          </span>
        }
        confirmLabel={decision?.destructive ? "Reject registration" : "Confirm"}
        destructive={!!decision?.destructive}
        onConfirm={handleDecision}
      />

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve this registration?"
        description={
          <span className="block space-y-2">
            <span className="block">
              The existing pending player is activated, an official player ID is
              assigned, and the registration is marked approved. Confirmed
              registration payment is required.
            </span>
            <Textarea
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="Approval note (optional)"
              rows={2}
              className="mt-2 text-[12.5px]"
            />
            {duplicateCandidates.length ? (
              <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-[12px]">
                <p className="font-medium">
                  A possible existing player matched this registration.
                </p>
                {duplicateCandidates.map((candidate) => (
                  <label key={candidate.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="existing-player"
                      checked={existingPlayerId === candidate.id}
                      onChange={() => {
                        setExistingPlayerId(candidate.id);
                        setConfirmNewPlayer(false);
                      }}
                    />
                    Link to {candidate.playerCode || candidate.id}
                    {candidate.archived ? " (archived)" : ""}
                  </label>
                ))}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={confirmNewPlayer}
                    onChange={(event) => {
                      setConfirmNewPlayer(event.target.checked);
                      if (event.target.checked) setExistingPlayerId("");
                    }}
                  />
                  Create a new player despite the possible match
                </label>
              </div>
            ) : null}
          </span>
        }
        confirmLabel="Approve registration"
        onConfirm={handleApprove}
      />
    </div>
  );
}
