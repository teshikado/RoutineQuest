"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Plus, Users, CalendarClock, PlayCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicIcon } from "@/components/ui/icon";
import { Reveal, RevealGroup } from "@/components/ui/reveal";
import { EmptyGroupsIllustration } from "@/components/ui/illustrations";
import { GroupRoutineForm, type GroupRoutineFormValues } from "@/components/groups/group-routine-form";
import { useToast } from "@/components/toast";
import { CATEGORY_META, DIFFICULTY_META, WEEKDAY_LABELS } from "@/lib/constants";
import type { GroupRoutineListItem } from "@/lib/group-routine-data";
import type { Category, Difficulty } from "@prisma/client";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  JOINED: { label: "Dabei", className: "bg-[#34D399] text-white" },
  PENDING: { label: "Antwort ausstehend", className: "bg-[#FACC15] text-[#241a03]" },
  DECLINED: { label: "Abgelehnt", className: "bg-[#171720] text-[#C8C5D2]" },
  LEFT: { label: "Verlassen", className: "bg-[#171720] text-[#C8C5D2]" },
};

function formatShortDateDe(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function periodProgressLabel(routine: GroupRoutineListItem): string {
  if (routine.bucket === "upcoming") return `Startet am ${formatShortDateDe(routine.startDate)}`;
  if (routine.bucket === "ended") {
    return routine.totalDays !== null ? `Beendet · ${routine.totalDays} Tage insgesamt` : "Beendet";
  }
  const dayLabel = routine.totalDays !== null ? `Tag ${routine.dayNumber} von ${routine.totalDays}` : `Tag ${routine.dayNumber}`;
  if (routine.daysRemaining !== null) return `${dayLabel} · noch ${routine.daysRemaining} Tage`;
  return dayLabel;
}

function GroupRoutineCard({ routine, groupId }: { routine: GroupRoutineListItem; groupId: string }) {
  const catMeta = CATEGORY_META[routine.category as Category];
  const diffMeta = DIFFICULTY_META[routine.difficulty as Difficulty];
  const statusMeta = routine.myParticipation ? STATUS_LABELS[routine.myParticipation.status] : null;
  const isWeeklyTarget = routine.goalType === "WEEKLY";

  return (
    <Link href={`/groups/${groupId}/routines/${routine.id}`}>
      <Card interactive className="flex flex-col gap-3 h-full">
        <div className="flex items-start gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: routine.color + "22" }}
          >
            <DynamicIcon name={routine.icon} className="h-5 w-5" style={{ color: routine.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[#F8F7FC] truncate">{routine.title}</div>
            <div className="text-xs text-[#C8C5D2]">
              {catMeta.label} · <span style={{ color: diffMeta.color }}>+{routine.xpReward} XP</span>
            </div>
          </div>
          {routine.status === "PAUSED" && (
            <span className="text-[10px] font-bold text-[#C8C5D2] bg-[#171720] rounded-full px-2 py-0.5 shrink-0">
              Pausiert
            </span>
          )}
        </div>

        {routine.description && <p className="text-sm text-[#C8C5D2] line-clamp-2">{routine.description}</p>}

        {isWeeklyTarget ? (
          <span className="self-start text-[10px] font-bold text-[#A855F7] bg-[#171720] rounded-full px-2 py-1">
            {routine.goalTarget}× pro Woche (freie Tagwahl)
          </span>
        ) : (
          <div className="flex gap-1">
            {Object.entries(WEEKDAY_LABELS).map(([day, label]) => (
              <span
                key={day}
                className={clsx(
                  "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                  routine.scheduledDays.includes(Number(day))
                    ? "bg-[#A855F7] text-white"
                    : "bg-[#171720] text-[#5F5B68]"
                )}
              >
                {label[0]}
              </span>
            ))}
          </div>
        )}

        <div className="text-xs font-semibold text-[#A855F7]">{periodProgressLabel(routine)}</div>

        <div className="flex items-center justify-between pt-1 border-t border-[#171720] mt-1 flex-wrap gap-1.5">
          <span className="flex items-center gap-1 text-xs text-[#C8C5D2]">
            <Users className="h-3.5 w-3.5" /> {routine.participantCount}
          </span>
          {statusMeta && (
            <span className={clsx("text-[10px] font-bold rounded-full px-2 py-0.5", statusMeta.className)}>
              {statusMeta.label}
            </span>
          )}
          {routine.mandatory && (
            <span className="text-[10px] font-bold text-[#FB7185] bg-[#2A1219] rounded-full px-2 py-0.5">
              Verpflichtend
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

function RoutineSection({
  title,
  icon,
  routines,
  groupId,
  emptyHint,
}: {
  title: string;
  icon: React.ReactNode;
  routines: GroupRoutineListItem[];
  groupId: string;
  emptyHint?: string;
}) {
  if (routines.length === 0 && !emptyHint) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-extrabold text-[#F8F7FC] uppercase tracking-wide">
          {title} <span className="text-[#8D8998] font-semibold">({routines.length})</span>
        </h2>
      </div>
      {routines.length === 0 ? (
        <p className="text-sm text-[#8D8998] mb-2">{emptyHint}</p>
      ) : (
        <RevealGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" stagger={0.05}>
          {routines.map((routine) => (
            <GroupRoutineCard key={routine.id} routine={routine} groupId={groupId} />
          ))}
        </RevealGroup>
      )}
    </div>
  );
}

export function GroupRoutinesListClient({
  group,
  routines: initialRoutines,
  isLeader,
}: {
  group: { id: string; name: string; icon: string; color: string };
  routines: GroupRoutineListItem[];
  isLeader: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [routines, setRoutines] = useState(initialRoutines);
  const [formOpen, setFormOpen] = useState(false);

  async function handleCreate(values: GroupRoutineFormValues) {
    const res = await fetch(`/api/groups/${group.id}/routines`, {
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
    if (!res.ok) throw new Error(data.error ?? "Gruppenroutine konnte nicht erstellt werden.");
    setFormOpen(false);
    showToast("Gruppenroutine erstellt!", "success");
    router.refresh();
    setRoutines((r) => [
      {
        id: data.id,
        title: data.title,
        description: data.description,
        icon: data.icon,
        color: data.color,
        category: data.category,
        difficulty: data.difficulty,
        xpReward: data.xpReward,
        startDate: data.startDate,
        endDate: data.endDate,
        scheduledDays: data.scheduledDays,
        timeOfDay: data.timeOfDay,
        visibility: data.visibility,
        mandatory: data.mandatory,
        goalType: data.goalType,
        goalTarget: data.goalTarget,
        status: data.status,
        participantCount: 1,
        myParticipation: { status: "JOINED", joinedAt: new Date().toISOString() },
        bucket: new Date(data.startDate) > new Date() ? "upcoming" : "active",
        dayNumber: 1,
        totalDays: null,
        daysRemaining: null,
      },
      ...r,
    ]);
  }

  const active = routines.filter((r) => r.bucket === "active");
  const upcoming = routines.filter((r) => r.bucket === "upcoming");
  const ended = routines.filter((r) => r.bucket === "ended");

  return (
    <div className="space-y-8">
      <Reveal className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: group.color + "22" }}
          >
            <DynamicIcon name={group.icon} className="h-5 w-5" style={{ color: group.color }} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#F8F7FC]">Gruppenroutinen</h1>
            <p className="text-[#C8C5D2] mt-0.5">{group.name}</p>
          </div>
        </div>
        {isLeader && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Gruppenroutine erstellen
          </Button>
        )}
      </Reveal>

      {routines.length === 0 ? (
        <EmptyState
          illustration={<EmptyGroupsIllustration className="w-full" />}
          title="Noch keine Gruppenroutinen"
          description="Der Gruppenanführer kann hier gemeinsame Routinen erstellen, an denen alle Mitglieder teilnehmen können."
          action={
            isLeader && (
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" /> Gruppenroutine erstellen
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          <RoutineSection
            title="Aktive Routinen"
            icon={<PlayCircle className="h-4 w-4 text-[#34D399]" />}
            routines={active}
            groupId={group.id}
            emptyHint="Gerade läuft keine Gruppenroutine."
          />
          <RoutineSection
            title="Kommende Routinen"
            icon={<CalendarClock className="h-4 w-4 text-[#FACC15]" />}
            routines={upcoming}
            groupId={group.id}
          />
          <RoutineSection
            title="Beendete Routinen"
            icon={<CheckCircle2 className="h-4 w-4 text-[#8D8998]" />}
            routines={ended}
            groupId={group.id}
          />
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Gruppenroutine erstellen">
        <GroupRoutineForm onSubmit={handleCreate} onCancel={() => setFormOpen(false)} submitLabel="Erstellen" />
      </Modal>
    </div>
  );
}
