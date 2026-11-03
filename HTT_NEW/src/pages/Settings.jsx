import React, { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { api, fromUiRecord } from "@/api/client";
import { useAppConfig } from "@/lib/AppConfigContext";
import { useToast } from "@/components/ui/use-toast";
import { labelize } from "@/lib/constants";
import PageHeader from "@/components/common/PageHeader";
import AccessDenied from "@/components/common/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULTS = {
  academy_name: "HTT Academy Nigeria",
  contact_email: "",
  contact_phone: "",
  currency: "NGN",
  registration_prefix: "HTT-REG",
  player_id_prefix: "HTT-P",
  retention_years: 7,
  league_status: "planned",
  school_project_status: "proposed",
  scholarship_target: 20,
};

export default function Settings() {
  const { can, settings, settingsId, reloadSettings } = useAppConfig();
  const { toast } = useToast();
  const [values, setValues] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setValues({ ...DEFAULTS, ...settings });
  }, [settings]);

  if (!can("settings")) return <AccessDenied moduleName="system settings" />;
  const manage = can("settings", "full");

  const set = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        academy_name: values.academy_name,
        contact_email: values.contact_email,
        contact_phone: values.contact_phone,
        currency: values.currency,
        registration_prefix: values.registration_prefix,
        player_id_prefix: values.player_id_prefix,
        retention_years: Number(values.retention_years || 7),
        league_status: values.league_status,
        school_project_status: values.school_project_status,
        scholarship_target: Number(values.scholarship_target || 20),
      };
      if (settingsId) {
        await api.patch(`/settings/${settingsId}`, fromUiRecord(payload));
      } else {
        await api.post("/settings", fromUiRecord(payload));
      }
      toast({ title: "Settings saved" });
      await reloadSettings();
    } catch (error) {
      toast({ title: error.message || "Could not save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, props = {}) => (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-medium text-foreground/80">
        {label}
      </Label>
      <Input
        value={values[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
        disabled={!manage}
        className="h-9 text-[13px]"
        {...props}
      />
    </div>
  );

  const selectField = (label, key, options) => (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-medium text-foreground/80">
        {label}
      </Label>
      <Select
        value={values[key]}
        onValueChange={(v) => set(key, v)}
        disabled={!manage}
      >
        <SelectTrigger className="h-9 text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-[13px]">
              {labelize(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="System Settings"
        description="Academy identity, numbering, retention and the operational status of the league and school project."
        actions={
          manage ? (
            <Button
              size="sm"
              onClick={save}
              disabled={saving}
              className="h-9 gap-1.5 bg-[#0B1F3A] hover:bg-[#132E52]"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save settings
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="htt-surface p-4 lg:col-span-2">
          <h2 className="mb-3 text-[13px] font-semibold">Academy profile</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("Academy name", "academy_name")}
            {field("Contact email", "contact_email", { type: "email" })}
            {field("Contact phone", "contact_phone")}
            {field("Currency", "currency")}
            {field("Registration reference prefix", "registration_prefix")}
            {field("Player ID prefix", "player_id_prefix")}
            {field("Record retention (years)", "retention_years", {
              type: "number",
              min: 1,
            })}
            {field("Scholarship target (players)", "scholarship_target", {
              type: "number",
              min: 0,
            })}
          </div>

          <h2 className="mb-3 mt-6 text-[13px] font-semibold">
            Operational status
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {selectField("HTT Academy League", "league_status", [
              "planned",
              "in_preparation",
              "active",
            ])}
            {selectField("HTT School Project", "school_project_status", [
              "proposed",
              "planned",
              "confirmed",
            ])}
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Neither the league nor the school project is presented as
            operational until management confirms it here.
          </p>
        </section>

      </div>

      <section className="htt-surface mt-4 p-4">
        <h2 className="text-[13px] font-semibold">
          Initial administrator provisioning
        </h2>
        <p className="mt-1.5 max-w-3xl text-[12px] leading-relaxed text-muted-foreground">
          There is no public administrator sign-up route and no default
          password. The workspace owner account is the first System
          Administrator; additional staff are invited from Staff &amp; Users,
          then assigned a role. Platform-level access level stays "user" for
          everyone except the owner, while the app role controls what each
          person can see and do.
        </p>
      </section>
    </div>
  );
}
