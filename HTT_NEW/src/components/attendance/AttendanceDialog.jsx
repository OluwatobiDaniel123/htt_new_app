import React, { useEffect, useState } from "react";
import { api, toUiRecord } from "@/api/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const OPTIONS = [
  { value: "present", label: "Present", active: "bg-emerald-600 text-white" },
  { value: "late", label: "Late", active: "bg-amber-500 text-white" },
  { value: "absent", label: "Absent", active: "bg-rose-600 text-white" },
  { value: "excused", label: "Excused", active: "bg-slate-600 text-white" },
];

export default function AttendanceDialog({
  session,
  open,
  onOpenChange,
  onSaved,
}) {
  const { toast } = useToast();
  const [players, setPlayers] = useState([]);
  const [existing, setExisting] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [playerRes, recordRes] = await Promise.all([
          api.get("/players", {
            centreId: session.centre_id,
            archived: "false",
            registrationStatus: "registered",
            limit: 100,
          }),
          api.get(`/attendance-sessions/${session.id}/records`),
        ]);
        if (!active) return;
        const list = (playerRes?.items || []).map(toUiRecord);
        const records = (recordRes?.items || []).map(toUiRecord);
        const nextMarks = {};
        list.forEach((p) => {
          const found = records.find((r) => r.player_id === p.id);
          nextMarks[p.id] = found ? found.status : "present";
        });
        setPlayers(list);
        setExisting(records);
        setMarks(nextMarks);
        setLoading(false);
      } catch (error) {
        if (!active) return;
        setPlayers([]);
        setExisting([]);
        setMarks({});
        setLoading(false);
        toast({
          title: error.message || "Could not load attendance",
          variant: "destructive",
        });
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [open, session?.id]);

  const save = async () => {
    setSaving(true);
    try {
      const records = players.map((player) => ({
        playerId: player.id,
        status: marks[player.id] || "present",
      }));
      await api.put(`/attendance-sessions/${session.id}/records`, { records });
      const present = records.filter(
        (item) => item.status === "present" || item.status === "late",
      ).length;
      const absent = records.filter((item) => item.status === "absent").length;
      toast({
        title: "Attendance saved",
        description: `${present} present · ${absent} absent`,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: error.message || "Could not save attendance",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (!saving ? onOpenChange(v) : null)}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[17px]">Mark attendance</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            {session?.centre_name || "Centre"} ·{" "}
            {session?.programme_name || "All programmes"} ·{" "}
            {session?.session_date}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : players.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-muted-foreground">
            No active players are registered at this centre yet.
          </p>
        ) : (
          <div className="max-h-[52vh] divide-y divide-border/60 overflow-y-auto">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium">
                    {p.full_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.player_id || "No ID"}
                  </p>
                </div>
                <div className="flex gap-1">
                  {OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setMarks((prev) => ({ ...prev, [p.id]: opt.value }))
                      }
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        marks[p.id] === opt.value
                          ? opt.active
                          : "bg-muted text-foreground/70 hover:bg-muted/70"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#0B1F3A] hover:bg-[#132E52]"
            onClick={save}
            disabled={saving || loading || players.length === 0}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save attendance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
