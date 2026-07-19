"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Flame, Plus, Users, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicIcon } from "@/components/ui/icon";
import { TaskCard, type TaskCardData } from "@/components/dashboard/task-card";
import { GroupTaskCard, type GroupTaskCardData } from "@/components/dashboard/group-task-card";
import { LevelUpModal } from "@/components/dashboard/level-up-modal";
import { useToast } from "@/components/toast";
import { getLevelProgress, getRankForLevel } from "@/lib/xp";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { dateKey, todayDateOnly, formatLongDateDe } from "@/lib/dates";
import type { Difficulty, Category } from "@prisma/client";

type BoardItem = {
  routine: {
    id: string;
    title: string;
    description: string | null;
    icon: string;
    color: string;
    difficulty: Difficulty;
    category: Category;
    timeOfDay: string | null;
  };
  completed: boolean;
  completion: { createdAt: string | Date } | null;
};

type GroupBoardItem = {
  groupRoutine: {
    id: string;
    title: string;
    description: string | null;
    icon: string;
    color: string;
    xpReward: number;
    timeOfDay: string | null;
  };
  group: { id: string; name: string; icon: string; color: string };
  completed: boolean;
  completion: { createdAt: string | Date } | null;
};

export function DashboardClient({
  data,
}: {
  data: {
    user: {
      username: string | null;
      totalXp: number;
      currentStreak: number;
      longestStreak: number;
    };
    board: BoardItem[];
    groupBoard: GroupBoardItem[];
    weekMini: { dateKey: string; scheduled: number; done: number }[];
    groups: { id: string; name: string; icon: string; color: string; memberCount: number }[];
  };
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const [board, setBoard] = useState<TaskCardData[]>(
    data.board.map((b) => ({
      routine: b.routine,
      completed: b.completed,
      canUndo: b.completed
        ? // eslint-disable-next-line react-hooks/purity -- one-time initial value from the server-rendered completion timestamp
          Date.now() - new Date(b.completion?.createdAt ?? 0).getTime() < 10 * 60 * 1000
        : false,
    }))
  );
  const [groupBoard, setGroupBoard] = useState<(GroupTaskCardData & { groupId: string })[]>(
    data.groupBoard.map((b) => ({
      groupRoutine: b.groupRoutine,
      group: b.group,
      groupId: b.group.id,
      completed: b.completed,
      canUndo: b.completed
        ? // eslint-disable-next-line react-hooks/purity -- one-time initial value from the server-rendered completion timestamp
          Date.now() - new Date(b.completion?.createdAt ?? 0).getTime() < 10 * 60 * 1000
        : false,
    }))
  );
  const [levelUp, setLevelUp] = useState<{ level: number; rankedUp: boolean } | null>(null);

  const progress = useMemo(() => getLevelProgress(data.user.totalXp), [data.user.totalXp]);
  const rank = useMemo(() => getRankForLevel(progress.level), [progress.level]);

  const doneCount = board.filter((b) => b.completed).length + groupBoard.filter((b) => b.completed).length;
  const totalCount = board.length + groupBoard.length;
  const dayRatio = totalCount > 0 ? doneCount / totalCount : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";
  const today = todayDateOnly();
  const todayKey = dateKey(today);

  async function handleToggle(routineId: string) {
    const idx = board.findIndex((b) => b.routine.id === routineId);
    if (idx === -1) return;

    try {
      const res = await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routineId, date: todayKey }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast(result.error ?? "Etwas ist schiefgelaufen.", "error");
        return;
      }

      setBoard((prev) =>
        prev.map((b) =>
          b.routine.id === routineId
            ? { ...b, completed: result.action === "completed", canUndo: result.canUndo }
            : b
        )
      );

      if (result.action === "completed") {
        showToast(`+${result.xpDelta} XP – Stark durchgezogen!`, "xp");
      } else {
        showToast("Aufgabe wieder geöffnet.", "info");
      }

      if (result.leveledUp) {
        setTimeout(() => setLevelUp({ level: result.level, rankedUp: result.rankedUp }), 600);
      }

      router.refresh();
    } catch {
      showToast("Verbindungsfehler. Bitte versuche es erneut.", "error");
    }
  }

  async function handleGroupToggle(groupRoutineId: string) {
    const idx = groupBoard.findIndex((b) => b.groupRoutine.id === groupRoutineId);
    if (idx === -1) return;
    const groupId = groupBoard[idx].groupId;

    try {
      const res = await fetch(`/api/groups/${groupId}/routines/${groupRoutineId}/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayKey }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast(result.error ?? "Etwas ist schiefgelaufen.", "error");
        return;
      }

      setGroupBoard((prev) =>
        prev.map((b) =>
          b.groupRoutine.id === groupRoutineId
            ? { ...b, completed: result.action === "completed", canUndo: result.canUndo }
            : b
        )
      );

      if (result.action === "completed") {
        showToast(`Gruppenroutine geschafft – +${result.xpDelta} XP!`, "xp");
      } else {
        showToast("Aufgabe wieder geöffnet.", "info");
      }

      if (result.leveledUp) {
        setTimeout(() => setLevelUp({ level: result.level, rankedUp: result.rankedUp }), 600);
      }

      router.refresh();
    } catch {
      showToast("Verbindungsfehler. Bitte versuche es erneut.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <LevelUpModal
        open={!!levelUp}
        onClose={() => setLevelUp(null)}
        level={levelUp?.level ?? 1}
        rankedUp={levelUp?.rankedUp ?? false}
      />

      <div>
        <h1 className="text-2xl font-extrabold text-[#183B56]">
          {greeting}, {data.user.username}!
        </h1>
        <p className="text-[#5b7a91] mt-1">
          {formatLongDateDe(today)} · Du hast heute bereits {doneCount} von {totalCount} Aufgaben erledigt.
          {progress.xpRemaining > 0 && ` Noch ${progress.xpRemaining} XP bis Level ${progress.level + 1}.`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DynamicIcon name={rank.icon} className="h-5 w-5" style={{ color: rank.color }} />
              <span className="font-bold text-[#183B56]">
                Level {progress.level} · {rank.name}
              </span>
            </div>
            <span className="text-xs text-[#5b7a91]">
              {progress.xpIntoLevel} / {progress.xpForNextLevel} XP
            </span>
          </div>
          <ProgressBar ratio={progress.progressRatio} colorClass="bg-[#FFD166]" />
          <p className="text-xs text-[#5b7a91] mt-2">{rank.description}</p>
        </Card>

        <Card className="flex flex-col items-center justify-center text-center">
          <Flame
            className={clsx("h-8 w-8 mb-1", data.user.currentStreak > 0 && "animate-flame")}
            style={{ color: data.user.currentStreak > 0 ? "#FFD166" : "#c8d6e0" }}
          />
          <div className="text-2xl font-extrabold text-[#183B56]">{data.user.currentStreak}</div>
          <div className="text-xs text-[#5b7a91]">Tage Streak · Rekord {data.user.longestStreak}</div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[#183B56]">Heute</h2>
          <span className="text-sm font-semibold text-[#4FA8D8]">{Math.round(dayRatio * 100)}%</span>
        </div>
        <ProgressBar ratio={dayRatio} className="mb-4" />

        {board.length === 0 && groupBoard.length === 0 ? (
          <EmptyState
            icon="CalendarX"
            title="Heute ist nichts geplant"
            description="Für heute sind keine Routinen vorgesehen. Erstelle eine neue Routine oder genieße deinen freien Tag."
            action={
              <Link href="/routines?create=1">
                <Button size="sm">
                  <Plus className="h-4 w-4" /> Neue Routine
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {board.map((item) => (
              <TaskCard key={item.routine.id} data={item} onToggle={handleToggle} />
            ))}
            {groupBoard.map((item) => (
              <GroupTaskCard key={item.groupRoutine.id} data={item} onToggle={handleGroupToggle} />
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#183B56]">Diese Woche</h2>
            <Link href="/week" className="text-xs font-semibold text-[#4FA8D8] flex items-center hover:underline">
              Wochenplan <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {data.weekMini.map((d, i) => {
              const ratio = d.scheduled > 0 ? d.done / d.scheduled : null;
              const isToday = d.dateKey === todayKey;
              return (
                <div key={d.dateKey} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-[#9db3c2] font-semibold">{WEEKDAY_LABELS[i + 1]}</span>
                  <div
                    className={clsx(
                      "h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold",
                      isToday && "ring-2 ring-[#4FA8D8]",
                      ratio === null
                        ? "bg-[#F5F7FA] text-[#c8d6e0]"
                        : ratio >= 1
                        ? "bg-[#78D6B0] text-white"
                        : ratio > 0
                        ? "bg-[#FFD166] text-[#183B56]"
                        : "bg-[#FFE0DC] text-[#e2564c]"
                    )}
                  >
                    {ratio === null ? "–" : `${d.done}/${d.scheduled}`}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#183B56]">Gruppen</h2>
            <Link href="/groups" className="text-xs font-semibold text-[#4FA8D8] flex items-center hover:underline">
              Alle ansehen <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.groups.length === 0 ? (
            <EmptyState
              icon="Users"
              title="Noch in keiner Gruppe"
              description="Tritt einer Gruppe bei oder erstelle deine eigene, um gemeinsam Fortschritte zu feiern."
              action={
                <Link href="/groups">
                  <Button size="sm" variant="secondary">
                    <Users className="h-4 w-4" /> Gruppe finden
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {data.groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-[#F5F7FA] transition-colors"
                  >
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: g.color + "22" }}
                    >
                      <DynamicIcon name={g.icon} className="h-4 w-4" style={{ color: g.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#183B56] truncate">{g.name}</div>
                      <div className="text-xs text-[#5b7a91]">{g.memberCount} Mitglieder</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
