"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Plus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicIcon } from "@/components/ui/icon";
import { GroupRoutineForm, type GroupRoutineFormValues } from "@/components/groups/group-routine-form";
import { useToast } from "@/components/toast";
import { CATEGORY_META, DIFFICULTY_META, WEEKDAY_LABELS } from "@/lib/constants";
import type { GroupRoutineListItem } from "@/lib/group-routine-data";
import type { Category, Difficulty } from "@prisma/client";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  JOINED: { label: "Dabei", className: "bg-[#78D6B0] text-white" },
  PENDING: { label: "Antwort ausstehend", className: "bg-[#FFD166] text-[#183B56]" },
  DECLINED: { label: "Abgelehnt", className: "bg-[#F5F7FA] text-[#5b7a91]" },
  LEFT: { label: "Verlassen", className: "bg-[#F5F7FA] text-[#5b7a91]" },
};

function GroupRoutineCard({ routine, groupId }: { routine: GroupRoutineListItem; groupId: string }) {
  const catMeta = CATEGORY_META[routine.category as Category];
  const diffMeta = DIFFICULTY_META[routine.difficulty as Difficulty];
  const statusMeta = routine.myParticipation ? STATUS_LABELS[routine.myParticipation.status] : null;

  return (
    <Link href={`/groups/${groupId}/routines/${routine.id}`}>
      <Card className="flex flex-col gap-3 h-full hover:shadow-[0_4px_20px_rgba(24,59,86,0.08)] transition-shadow">
        <div className="flex items-start gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: routine.color + "22" }}
          >
            <DynamicIcon name={routine.icon} className="h-5 w-5" style={{ color: routine.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[#183B56] truncate">{routine.title}</div>
            <div className="text-xs text-[#5b7a91]">
              {catMeta.label} · <span style={{ color: diffMeta.color }}>+{routine.xpReward} XP</span>
            </div>
          </div>
          {routine.status !== "ACTIVE" && (
            <span className="text-[10px] font-bold text-[#5b7a91] bg-[#F5F7FA] rounded-full px-2 py-0.5 shrink-0">
              {routine.status === "PAUSED" ? "Pausiert" : "Beendet"}
            </span>
          )}
        </div>

        {routine.description && <p className="text-sm text-[#5b7a91] line-clamp-2">{routine.description}</p>}

        <div className="flex gap-1">
          {Object.entries(WEEKDAY_LABELS).map(([day, label]) => (
            <span
              key={day}
              className={clsx(
                "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                routine.scheduledDays.includes(Number(day))
                  ? "bg-[#4FA8D8] text-white"
                  : "bg-[#F5F7FA] text-[#c8d6e0]"
              )}
            >
              {label[0]}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#F5F7FA] mt-1">
          <span className="flex items-center gap-1 text-xs text-[#5b7a91]">
            <Users className="h-3.5 w-3.5" /> {routine.participantCount}
          </span>
          {statusMeta && (
            <span className={clsx("text-[10px] font-bold rounded-full px-2 py-0.5", statusMeta.className)}>
              {statusMeta.label}
            </span>
          )}
          {routine.mandatory && (
            <span className="text-[10px] font-bold text-[#FF8A80] bg-[#FFF0EE] rounded-full px-2 py-0.5">
              Verpflichtend
            </span>
          )}
        </div>
      </Card>
    </Link>
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
      },
      ...r,
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: group.color + "22" }}
          >
            <DynamicIcon name={group.icon} className="h-5 w-5" style={{ color: group.color }} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#183B56]">Gruppenroutinen</h1>
            <p className="text-[#5b7a91] mt-0.5">{group.name}</p>
          </div>
        </div>
        {isLeader && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Neue Gruppenroutine
          </Button>
        )}
      </div>

      {routines.length === 0 ? (
        <EmptyState
          icon="Users"
          title="Noch keine Gruppenroutinen"
          description="Der Gruppenanführer kann hier gemeinsame Routinen erstellen, an denen alle Mitglieder teilnehmen können."
          action={
            isLeader && (
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" /> Neue Gruppenroutine
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {routines.map((routine) => (
            <GroupRoutineCard key={routine.id} routine={routine} groupId={group.id} />
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Neue Gruppenroutine">
        <GroupRoutineForm onSubmit={handleCreate} onCancel={() => setFormOpen(false)} submitLabel="Erstellen" />
      </Modal>
    </div>
  );
}
