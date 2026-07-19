"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Circle,
  Copy,
  Minus,
  Pause,
  Play,
  Pencil,
  Trash2,
  StopCircle,
  LogOut,
  Crown,
  X as XIcon,
} from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DynamicIcon } from "@/components/ui/icon";
import { GroupRoutineForm, type GroupRoutineFormValues } from "@/components/groups/group-routine-form";
import { GroupRoutineLeaderboardPanel } from "@/components/groups/group-routine-leaderboard-panel";
import { GroupRoutineStatsPanel } from "@/components/groups/group-routine-stats-panel";
import { useToast } from "@/components/toast";
import { CATEGORY_META, DIFFICULTY_META, GROUP_ROUTINE_AWARD_META } from "@/lib/constants";
import { dateKey, todayDateOnly } from "@/lib/dates";
import type { GroupRoutineDetail } from "@/lib/group-routine-data";
import type { Category, Difficulty, GroupRoutineAwardType } from "@prisma/client";

const DAY_STATUS_CONFIG = {
  done: { icon: <Check className="h-4 w-4" />, className: "bg-[#34D399] text-white", label: "Erledigt" },
  open: { icon: <Circle className="h-3.5 w-3.5" />, className: "bg-[#111118] border-2 border-[#D8B4FE] text-[#D8B4FE]", label: "Noch offen" },
  missed: { icon: <XIcon className="h-4 w-4" />, className: "bg-[#3B1420] text-[#FB7185]", label: "Verpasst" },
  not_scheduled: { icon: <Minus className="h-3.5 w-3.5" />, className: "bg-[#171720] text-[#5F5B68]", label: "Heute nicht geplant" },
} as const;

type AwardsResponse = {
  weekKey: string | null;
  awards: { type: GroupRoutineAwardType; userId: string; username: string | null; avatarEmoji: string; meta: unknown }[];
};

export function GroupRoutineDetailClient({ detail }: { detail: GroupRoutineDetail }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [participation, setParticipation] = useState(detail.myParticipation);
  const [todayStatus, setTodayStatus] = useState(detail.todayStatus);

  // `detail` is server-fetched and changes after router.refresh() (e.g. right after
  // responding to the invite), but local state doesn't re-derive from new props on its
  // own — resync it here so the day board reflects the just-updated participation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resyncing local state from fresh server props, not a render-time computation
    setParticipation(detail.myParticipation);
    setTodayStatus(detail.todayStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.todayStatus, detail.myParticipation?.status, detail.myParticipation?.joinedAt]);
  const [editOpen, setEditOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [burst, setBurst] = useState(false);
  const [awards, setAwards] = useState<AwardsResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const catMeta = CATEGORY_META[detail.category as Category];
  const diffMeta = DIFFICULTY_META[detail.difficulty as Difficulty];
  const todayKey = dateKey(todayDateOnly());

  useEffect(() => {
    fetch(`/api/groups/${detail.groupId}/routines/${detail.id}/awards`)
      .then((res) => res.json())
      .then(setAwards)
      .catch(() => {});
  }, [detail.groupId, detail.id]);

  async function respond(decision: "JOIN" | "DECLINE" | "LATER") {
    const res = await fetch(`/api/groups/${detail.groupId}/routines/${detail.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Aktion fehlgeschlagen.", "error");
      return;
    }
    setParticipation({
      status: data.status,
      joinedAt: data.joinedAt,
      currentStreak: data.currentStreak,
      longestStreak: data.longestStreak,
    });
    if (decision === "JOIN") showToast("Du nimmst jetzt teil!", "success");
    else if (decision === "DECLINE") showToast("Teilnahme abgelehnt.", "info");
    else showToast("Du kannst später entscheiden.", "info");
    router.refresh();
  }

  async function handleLeave() {
    const res = await fetch(`/api/groups/${detail.groupId}/routines/${detail.id}/leave`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Verlassen fehlgeschlagen.", "error");
      return;
    }
    setParticipation({ status: data.status, joinedAt: data.joinedAt, currentStreak: data.currentStreak, longestStreak: data.longestStreak });
    setLeaveOpen(false);
    showToast("Du hast die Gruppenroutine verlassen.", "success");
    router.refresh();
  }

  async function handleToggleToday() {
    if (!burst) setBurst(true);
    const res = await fetch(`/api/groups/${detail.groupId}/routines/${detail.id}/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: todayKey }),
    });
    const result = await res.json();
    setTimeout(() => setBurst(false), 900);
    if (!res.ok) {
      showToast(result.error ?? "Etwas ist schiefgelaufen.", "error");
      return;
    }
    setTodayStatus(result.action === "completed" ? "done" : "open");
    if (participation) {
      setParticipation({ ...participation, currentStreak: result.currentStreak });
    }
    setRefreshKey((k) => k + 1);
    if (result.action === "completed") {
      showToast(`Gruppenroutine geschafft – +${result.xpDelta} XP!`, "xp");
    } else {
      showToast("Aufgabe wieder geöffnet.", "info");
    }
    router.refresh();
  }

  async function handleEdit(values: GroupRoutineFormValues) {
    const res = await fetch(`/api/groups/${detail.groupId}/routines/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        xpReward: Number(values.xpReward),
        description: values.description || null,
        timeOfDay: values.timeOfDay || null,
        endDate: values.endDate || null,
        goalTarget: values.goalType === "WEEKLY" ? Number(values.goalTarget) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Aktualisierung fehlgeschlagen.");
    setEditOpen(false);
    showToast("Gruppenroutine aktualisiert!", "success");
    router.refresh();
  }

  async function handleDuplicate(values: GroupRoutineFormValues) {
    const res = await fetch(`/api/groups/${detail.groupId}/routines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        xpReward: Number(values.xpReward),
        description: values.description || null,
        timeOfDay: values.timeOfDay || null,
        endDate: values.endDate || null,
        goalTarget: values.goalType === "WEEKLY" ? Number(values.goalTarget) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Duplizieren fehlgeschlagen.");
    setDuplicateOpen(false);
    showToast("Neue Gruppenroutine aus Duplikat erstellt!", "success");
    router.push(`/groups/${detail.groupId}/routines/${data.id}`);
  }

  async function handlePauseToggle() {
    const res = await fetch(`/api/groups/${detail.groupId}/routines/${detail.id}/pause`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Aktion fehlgeschlagen.", "error");
      return;
    }
    showToast(data.status === "PAUSED" ? "Routine pausiert." : "Routine fortgesetzt.", "success");
    router.refresh();
  }

  async function handleEnd() {
    const res = await fetch(`/api/groups/${detail.groupId}/routines/${detail.id}/end`, { method: "POST" });
    const data = await res.json();
    setEndOpen(false);
    if (!res.ok) {
      showToast(data.error ?? "Beenden fehlgeschlagen.", "error");
      return;
    }
    showToast("Gruppenroutine beendet.", "success");
    router.refresh();
  }

  async function handleDelete() {
    const res = await fetch(`/api/groups/${detail.groupId}/routines/${detail.id}`, { method: "DELETE" });
    setDeleteOpen(false);
    if (!res.ok) {
      showToast("Löschen fehlgeschlagen.", "error");
      return;
    }
    showToast("Gruppenroutine gelöscht.", "success");
    router.push(`/groups/${detail.groupId}/routines`);
  }

  const needsResponse = !detail.mandatory && (!participation || participation.status === "PENDING");
  const canRejoin = !detail.mandatory && participation && (participation.status === "DECLINED" || participation.status === "LEFT");
  const dayCfg = DAY_STATUS_CONFIG[todayStatus];
  const championAward = awards?.awards.find((a) => a.type === "CHAMPION") ?? null;
  const otherAwards = awards?.awards.filter((a) => a.type !== "CHAMPION") ?? [];

  return (
    <div className="space-y-6">
      <Link
        href={`/groups/${detail.groupId}/routines`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#C8C5D2] hover:text-[#A855F7]"
      >
        <ArrowLeft className="h-4 w-4" /> Alle Gruppenroutinen
      </Link>

      <Card>
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: detail.color + "22" }}
          >
            <DynamicIcon name={detail.icon} className="h-7 w-7" style={{ color: detail.color }} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#F8F7FC]">{detail.title}</h1>
              <span
                className="flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5"
                style={{ backgroundColor: detail.group.color + "1a", color: detail.group.color }}
              >
                <DynamicIcon name={detail.group.icon} className="h-3 w-3" />
                {detail.group.name}
              </span>
              {detail.status !== "ACTIVE" && (
                <span className="text-xs font-bold text-[#C8C5D2] bg-[#171720] rounded-full px-2 py-0.5">
                  {detail.status === "PAUSED" ? "Pausiert" : "Beendet"}
                </span>
              )}
              {detail.mandatory && (
                <span className="text-xs font-bold text-[#FB7185] bg-[#2A1219] rounded-full px-2 py-0.5">
                  Verpflichtend
                </span>
              )}
            </div>
            {detail.description && <p className="text-sm text-[#C8C5D2] mt-1">{detail.description}</p>}
            <p className="text-xs text-[#8D8998] mt-1">
              {catMeta.label} · <span style={{ color: diffMeta.color }}>+{detail.xpReward} XP</span>
            </p>
          </div>
          {detail.isLeader && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Bearbeiten
              </Button>
              {detail.status !== "ENDED" && (
                <Button variant="secondary" size="sm" onClick={handlePauseToggle}>
                  {detail.status === "PAUSED" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {detail.status === "PAUSED" ? "Fortsetzen" : "Pausieren"}
                </Button>
              )}
              {detail.status !== "ENDED" && (
                <Button variant="secondary" size="sm" onClick={() => setEndOpen(true)}>
                  <StopCircle className="h-4 w-4" /> Beenden
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setDuplicateOpen(true)}>
                <Copy className="h-4 w-4" /> Duplizieren
              </Button>
              {detail.canDelete && (
                <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Löschen
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {needsResponse && (
        <Card className="border-2 border-[#D8B4FE]">
          <CardTitle>Machst du mit?</CardTitle>
          <CardSubtitle className="mb-4">
            Der Gruppenanführer hat dich zu &quot;{detail.title}&quot; eingeladen.
          </CardSubtitle>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => respond("JOIN")}>Teilnehmen</Button>
            <Button variant="secondary" onClick={() => respond("LATER")}>
              Später entscheiden
            </Button>
            <Button variant="ghost" onClick={() => respond("DECLINE")}>
              Ablehnen
            </Button>
          </div>
        </Card>
      )}

      {canRejoin && (
        <Card>
          <p className="text-sm text-[#C8C5D2] mb-3">
            {participation?.status === "DECLINED"
              ? "Du hast diese Gruppenroutine abgelehnt."
              : "Du hast diese Gruppenroutine verlassen."}
          </p>
          <Button size="sm" onClick={() => respond("JOIN")}>
            Doch teilnehmen
          </Button>
        </Card>
      )}

      {participation?.status === "JOINED" && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle>Heute</CardTitle>
            {!detail.mandatory && (
              <button
                onClick={() => setLeaveOpen(true)}
                className="flex items-center gap-1 text-xs font-semibold text-[#C8C5D2] hover:text-[#FB7185]"
              >
                <LogOut className="h-3.5 w-3.5" /> Teilnahme beenden
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold", dayCfg.className)}>
              {dayCfg.icon} {dayCfg.label}
            </span>
            <div className="text-xs text-[#C8C5D2]">
              🔥 {participation.currentStreak} Tage Streak · Rekord {participation.longestStreak}
            </div>
            {todayStatus !== "not_scheduled" && (
              <div className="relative ml-auto">
                <AnimatePresence>
                  {burst && (
                    <motion.div
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 0, y: -30 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="absolute -top-6 right-0 text-xs font-bold text-[#FACC15] pointer-events-none"
                    >
                      +{detail.xpReward} XP
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  onClick={handleToggleToday}
                  className={clsx(
                    "h-11 w-11 rounded-full flex items-center justify-center border-2 transition-all",
                    todayStatus === "done"
                      ? "bg-[#34D399] border-[#34D399] text-white scale-105"
                      : "border-[#D8B4FE] text-transparent hover:bg-[#171720]"
                  )}
                  aria-pressed={todayStatus === "done"}
                  aria-label="Heute abhaken"
                >
                  <Check className="h-5 w-5" style={{ opacity: todayStatus === "done" ? 1 : 0.15, color: todayStatus === "done" ? "white" : "#D8B4FE" }} />
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {championAward && (
        <Card className="border-2" style={{ borderColor: "#FACC15", backgroundColor: "#2A2107" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <Crown className="h-8 w-8 text-[#FACC15] shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold text-[#F8F7FC]">
                {championAward.username ?? "Ein Mitglied"} ist diese Woche Routine-Champion!
              </div>
              <div className="text-sm text-[#C8C5D2]">Herzlichen Glückwunsch zur konsequentesten Teilnahme.</div>
            </div>
            {otherAwards.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {otherAwards.map((a) => {
                  const meta = GROUP_ROUTINE_AWARD_META[a.type];
                  return (
                    <span
                      key={`${a.type}-${a.userId}`}
                      className="flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1"
                      style={{ backgroundColor: meta.color + "22", color: meta.color }}
                      title={`${meta.label}: ${a.username ?? ""}`}
                    >
                      <DynamicIcon name={meta.icon} className="h-3 w-3" />
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      <GroupRoutineLeaderboardPanel groupId={detail.groupId} routineId={detail.id} refreshKey={refreshKey} />
      <GroupRoutineStatsPanel groupId={detail.groupId} routineId={detail.id} refreshKey={refreshKey} />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Gruppenroutine bearbeiten">
        <GroupRoutineForm
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
          submitLabel="Speichern"
          initialValues={{
            title: detail.title,
            description: detail.description ?? "",
            category: detail.category as Category,
            icon: detail.icon,
            color: detail.color,
            difficulty: detail.difficulty as Difficulty,
            xpReward: String(detail.xpReward),
            startDate: detail.startDate.slice(0, 10),
            endDate: detail.endDate ? detail.endDate.slice(0, 10) : "",
            scheduledDays: detail.scheduledDays,
            timeOfDay: detail.timeOfDay ?? "",
            visibility: detail.visibility,
            mandatory: detail.mandatory,
            goalType: detail.goalType,
            goalTarget: detail.goalTarget ? String(detail.goalTarget) : "3",
          }}
        />
      </Modal>

      <Modal open={duplicateOpen} onClose={() => setDuplicateOpen(false)} title="Gruppenroutine duplizieren">
        <GroupRoutineForm
          onSubmit={handleDuplicate}
          onCancel={() => setDuplicateOpen(false)}
          submitLabel="Duplikat erstellen"
          initialValues={{
            title: `${detail.title} (Kopie)`,
            description: detail.description ?? "",
            category: detail.category as Category,
            icon: detail.icon,
            color: detail.color,
            difficulty: detail.difficulty as Difficulty,
            xpReward: String(detail.xpReward),
            startDate: dateKey(todayDateOnly()),
            endDate: "",
            scheduledDays: detail.scheduledDays,
            timeOfDay: detail.timeOfDay ?? "",
            visibility: detail.visibility,
            mandatory: detail.mandatory,
            goalType: detail.goalType,
            goalTarget: detail.goalTarget ? String(detail.goalTarget) : "3",
          }}
        />
      </Modal>

      <ConfirmDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={handleEnd}
        title="Gruppenroutine beenden?"
        description="Die Routine wird für alle Mitglieder beendet. Bisherige Statistiken bleiben erhalten."
        confirmLabel="Beenden"
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Gruppenroutine löschen?"
        description={`"${detail.title}" wird aus der Liste entfernt. Vergangene Statistiken bleiben erhalten.`}
      />

      <ConfirmDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={handleLeave}
        title="Teilnahme beenden?"
        description="Du kannst jederzeit wieder teilnehmen, dein Beitrittsdatum wird dann neu gesetzt."
        confirmLabel="Verlassen"
      />
    </div>
  );
}
