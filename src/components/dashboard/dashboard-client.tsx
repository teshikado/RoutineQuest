"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Plus, Users, ChevronRight, CalendarClock, PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicIcon } from "@/components/ui/icon";
import { RankBadge } from "@/components/ui/rank-badge";
import { Reveal, RevealGroup } from "@/components/ui/reveal";
import { EmptyRoutinesIllustration, EmptyGroupsIllustration } from "@/components/ui/illustrations";
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

/** One row of "Heute" -- a personal routine or a group routine, reduced to just what the
 * sort needs. `originalIndex` is the item's position in the server-provided board arrays
 * (personal routines first, then group routines) -- it never changes as items are
 * completed/undone, so it acts as the stable "ursprüngliche Reihenfolge" tiebreaker
 * required for both the open-without-time bucket and the whole completed bucket. */
type HeuteItem =
  | { kind: "personal"; key: string; completed: boolean; timeOfDay: string | null; originalIndex: number; data: TaskCardData }
  | { kind: "group"; key: string; completed: boolean; timeOfDay: string | null; originalIndex: number; data: GroupTaskCardData & { groupId: string } };

const GENERIC_SAVE_ERROR = "Die Aufgabe konnte nicht gespeichert werden. Bitte versuche es erneut.";
const GENERIC_UNDO_ERROR = "Die Erledigung konnte nicht rückgängig gemacht werden. Bitte versuche es erneut.";
const STALE_STATE_ERROR = "Diese Aufgabe wurde bereits aktualisiert. Bitte lade die Seite neu und versuche es erneut.";

/** A row in the flat, single-`.map()`-rendered "Heute" list -- either a task card or one of
 * the two synthetic marker rows (see renderRows in the component below). `kind` is the
 * actual discriminant (not `key`, which is just a plain string on the "task" variant). */
type RenderRow = { kind: "task"; key: string; item: HeuteItem } | { kind: "all-done"; key: string } | { kind: "done-divider"; key: string };

function timeOfDayMinutes(t: string | null): number {
  if (!t) return Number.POSITIVE_INFINITY;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Open tasks first (timed ones by time ascending, then untimed, ties broken by original
 * order), completed tasks after -- always in their original daily order. Never mutates the
 * input arrays; always sorts a copy. */
function sortHeuteItems(items: HeuteItem[]): HeuteItem[] {
  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.completed) {
      const byTime = timeOfDayMinutes(a.timeOfDay) - timeOfDayMinutes(b.timeOfDay);
      if (byTime !== 0) return byTime;
    }
    return a.originalIndex - b.originalIndex;
  });
}

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
    nextPlanEntry: { id: string; title: string; icon: string; color: string; startTime: string; endTime: string } | null;
    dayPlanStats: { total: number; done: number; open: number };
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
  // Announced via an aria-live region (see the sr-only div below) -- screen reader users get
  // the same "moved to Erledigt" / "moved back up" information sighted users get for free
  // from the reorder animation.
  const [announcement, setAnnouncement] = useState("");

  const progress = useMemo(() => getLevelProgress(data.user.totalXp), [data.user.totalXp]);
  const rank = useMemo(() => getRankForLevel(progress.level), [progress.level]);

  const doneCount = board.filter((b) => b.completed).length + groupBoard.filter((b) => b.completed).length;
  const totalCount = board.length + groupBoard.length;
  const dayRatio = totalCount > 0 ? doneCount / totalCount : 0;

  // Personal routines keep their board position, group routines continue right after --
  // this fixed base order is the "ursprüngliche Reihenfolge" used as the stable tiebreaker
  // below (see sortHeuteItems), so it must stay derived from the arrays' own indices, never
  // from anything that changes when a task is completed/undone.
  const heuteItems: HeuteItem[] = useMemo(
    () => [
      ...board.map((b, i): HeuteItem => ({ kind: "personal", key: `personal-${b.routine.id}`, completed: b.completed, timeOfDay: b.routine.timeOfDay, originalIndex: i, data: b })),
      ...groupBoard.map((b, i): HeuteItem => ({ kind: "group", key: `group-${b.groupRoutine.id}`, completed: b.completed, timeOfDay: b.groupRoutine.timeOfDay, originalIndex: board.length + i, data: b })),
    ],
    [board, groupBoard]
  );
  const sortedHeuteItems = useMemo(() => sortHeuteItems(heuteItems), [heuteItems]);
  const openHeuteItems = sortedHeuteItems.filter((i) => !i.completed);
  const doneHeuteItems = sortedHeuteItems.filter((i) => i.completed);

  // One single flat array, rendered through one single `.map()` below -- this is what
  // actually matters for a task card to keep its React identity (and therefore its local
  // `burst`/glow animation state) as it crosses from the open group to the done group.
  // Two separate `.map()` calls (open items, then done items) look identical on screen but
  // are NOT equivalent for reconciliation: nested arrays as children don't reliably key-match
  // across the two lists, so a card moving between them was silently remounting -- its
  // completion glow (driven by that local state) never had a chance to render. A single flat
  // list has no such boundary: every card's key is matched positionally against the *whole*
  // list, so moving from index 2 to index 5 is just a position change, not a remount.
  const renderRows = useMemo(() => {
    const rows: RenderRow[] = openHeuteItems.map((item) => ({ kind: "task" as const, key: item.key, item }));
    if (openHeuteItems.length === 0 && doneHeuteItems.length > 0) rows.push({ kind: "all-done", key: "all-done" });
    if (doneHeuteItems.length > 0) rows.push({ kind: "done-divider", key: "done-divider" });
    for (const item of doneHeuteItems) rows.push({ kind: "task", key: item.key, item });
    return rows;
  }, [openHeuteItems, doneHeuteItems]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";
  const today = todayDateOnly();
  const todayKey = dateKey(today);

  async function handleToggle(routineId: string) {
    const idx = board.findIndex((b) => b.routine.id === routineId);
    if (idx === -1) {
      showToast(STALE_STATE_ERROR, "error");
      return;
    }
    const previous = board[idx];
    const optimisticCompleted = !previous.completed;
    const genericError = previous.completed ? GENERIC_UNDO_ERROR : GENERIC_SAVE_ERROR;

    // 1. Optimistic: flip locally right away so the checkbox, strikethrough, and reorder
    // into the "Erledigt" group all happen instantly, before the server confirms anything.
    setBoard((prev) => prev.map((b) => (b.routine.id === routineId ? { ...b, completed: optimisticCompleted, canUndo: optimisticCompleted } : b)));

    let res: Response;
    try {
      res = await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routineId, date: todayKey }),
      });
    } catch {
      // A rejected fetch (offline, DNS failure, ...) never carries a server message --
      // never surface the raw technical error text to the user.
      setBoard((prev) => prev.map((b) => (b.routine.id === routineId ? previous : b)));
      showToast(genericError, "error");
      return;
    }

    const result = await res.json().catch(() => null);
    if (!res.ok || !result) {
      // 3. Roll back completely: same completed flag, same position, and a clear,
      // server-provided (or generic) error -- never left half-applied.
      setBoard((prev) => prev.map((b) => (b.routine.id === routineId ? previous : b)));
      showToast(result?.error ?? genericError, "error");
      return;
    }

    // 2. Reconcile with the authoritative server result (canUndo's exact 10-minute
    // window is only known server-side).
    setBoard((prev) =>
      prev.map((b) => (b.routine.id === routineId ? { ...b, completed: result.action === "completed", canUndo: result.canUndo } : b))
    );

    if (result.action === "completed") {
      showToast(`+${result.xpDelta} XP – Stark durchgezogen!`, "xp");
      setAnnouncement(`${previous.routine.title} wurde als erledigt markiert und in den erledigten Bereich verschoben.`);
    } else {
      showToast("Aufgabe wieder geöffnet.", "info");
      setAnnouncement(`${previous.routine.title} wurde wieder geöffnet und nach oben verschoben.`);
    }

    if (result.leveledUp) {
      setTimeout(() => setLevelUp({ level: result.level, rankedUp: result.rankedUp }), 600);
    }

    // Refreshes server-rendered numbers this component doesn't own locally (total XP /
    // level bar, streak, week mini, group leaderboards) without resetting the board
    // state above, since that lives in useState and isn't re-derived from props.
    router.refresh();
  }

  async function handleGroupToggle(groupRoutineId: string) {
    const idx = groupBoard.findIndex((b) => b.groupRoutine.id === groupRoutineId);
    if (idx === -1) {
      showToast(STALE_STATE_ERROR, "error");
      return;
    }
    const groupId = groupBoard[idx].groupId;
    const previous = groupBoard[idx];
    const optimisticCompleted = !previous.completed;
    const genericError = previous.completed ? GENERIC_UNDO_ERROR : GENERIC_SAVE_ERROR;

    setGroupBoard((prev) => prev.map((b) => (b.groupRoutine.id === groupRoutineId ? { ...b, completed: optimisticCompleted, canUndo: optimisticCompleted } : b)));

    let res: Response;
    try {
      res = await fetch(`/api/groups/${groupId}/routines/${groupRoutineId}/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayKey }),
      });
    } catch {
      setGroupBoard((prev) => prev.map((b) => (b.groupRoutine.id === groupRoutineId ? previous : b)));
      showToast(genericError, "error");
      return;
    }

    const result = await res.json().catch(() => null);
    if (!res.ok || !result) {
      setGroupBoard((prev) => prev.map((b) => (b.groupRoutine.id === groupRoutineId ? previous : b)));
      showToast(result?.error ?? genericError, "error");
      return;
    }

    setGroupBoard((prev) =>
      prev.map((b) => (b.groupRoutine.id === groupRoutineId ? { ...b, completed: result.action === "completed", canUndo: result.canUndo } : b))
    );

    if (result.action === "completed") {
      showToast(`Gruppenroutine geschafft – +${result.xpDelta} XP!`, "xp");
      setAnnouncement(`${previous.groupRoutine.title} wurde als erledigt markiert und in den erledigten Bereich verschoben.`);
    } else {
      showToast("Aufgabe wieder geöffnet.", "info");
      setAnnouncement(`${previous.groupRoutine.title} wurde wieder geöffnet und nach oben verschoben.`);
    }

    if (result.leveledUp) {
      setTimeout(() => setLevelUp({ level: result.level, rankedUp: result.rankedUp }), 600);
    }

    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <LevelUpModal
        open={!!levelUp}
        onClose={() => setLevelUp(null)}
        level={levelUp?.level ?? 1}
        rankedUp={levelUp?.rankedUp ?? false}
      />

      <Reveal>
        <h1 className="text-2xl font-extrabold text-[#F8F7FC]">
          {greeting}, {data.user.username}!
        </h1>
        <p className="text-[#C8C5D2] mt-1">
          {formatLongDateDe(today)} · Du hast heute bereits {doneCount} von {totalCount} Aufgaben erledigt.
          {progress.xpRemaining > 0 && ` Noch ${progress.xpRemaining} XP bis Level ${progress.level + 1}.`}
        </p>
      </Reveal>

      <RevealGroup className="grid grid-cols-1 sm:grid-cols-3 gap-4" stagger={0.06}>
        <Card className="sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <RankBadge icon={rank.icon} color={rank.color} size="sm" />
              <span className="font-bold text-[#F8F7FC]">
                Level {progress.level} · {rank.name}
              </span>
            </div>
            <span className="text-xs font-semibold text-[#C8C5D2] tabular-nums">
              {progress.xpIntoLevel} / {progress.xpForNextLevel} XP
            </span>
          </div>
          <ProgressBar
            ratio={progress.progressRatio}
            gradient="linear-gradient(90deg, #FACC15, #FDE68A)"
            shine
            height="h-3.5"
          />
          <p className="text-xs text-[#C8C5D2] mt-2">{rank.description}</p>
        </Card>

        <Card className="flex flex-col items-center justify-center text-center">
          <Flame
            className={clsx("h-8 w-8 mb-1", data.user.currentStreak > 0 && "animate-flame")}
            style={{ color: data.user.currentStreak > 0 ? "#FACC15" : "#5F5B68" }}
          />
          <div className="text-2xl font-extrabold text-[#F8F7FC] tabular-nums">{data.user.currentStreak}</div>
          <div className="text-xs text-[#C8C5D2]">Tage Streak · Rekord {data.user.longestStreak}</div>
        </Card>
      </RevealGroup>

      <Reveal delay={0.05}>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#F8F7FC]">Heute</h2>
            <span className="text-sm font-semibold text-[#A855F7] tabular-nums">{Math.round(dayRatio * 100)}%</span>
          </div>
          <ProgressBar ratio={dayRatio} className="mb-4" gradient="linear-gradient(90deg, #A855F7, #34D399)" />

          {board.length === 0 && groupBoard.length === 0 ? (
            <EmptyState
              illustration={<EmptyRoutinesIllustration className="w-full" />}
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
              <AnimatePresence initial={false}>
                {renderRows.map((row) => {
                  if (row.kind === "all-done") {
                    return (
                      <motion.div
                        key="all-done"
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-[#C8C5D2]"
                      >
                        <PartyPopper className="h-4 w-4 text-[#FACC15]" />
                        Alles für heute geschafft.
                      </motion.div>
                    );
                  }
                  if (row.kind === "done-divider") {
                    return (
                      <motion.div
                        key="done-divider"
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-2 pt-1 pb-0.5"
                      >
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F5B68]">Erledigt</span>
                        <span className="text-[11px] text-[#5F5B68] tabular-nums">· {doneHeuteItems.length} erledigt</span>
                        <div className="h-px flex-1 bg-[#292936]" />
                      </motion.div>
                    );
                  }
                  const { item } = row;
                  return (
                    <motion.div key={item.key} layout transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                      {item.kind === "personal" ? (
                        <TaskCard data={item.data} onToggle={handleToggle} />
                      ) : (
                        <GroupTaskCard data={item.data} onToggle={handleGroupToggle} />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </Reveal>

      <Reveal delay={0.08}>
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-[#F8F7FC] flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-[#A855F7]" /> Dein nächster Termin
            </h2>
            <Link href="/dayplanning" className="text-xs font-semibold text-[#A855F7] flex items-center hover:underline underline-offset-2">
              Tagesplan öffnen <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.nextPlanEntry ? (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: data.nextPlanEntry.color + "22" }}>
                <DynamicIcon name={data.nextPlanEntry.icon} className="h-4 w-4" style={{ color: data.nextPlanEntry.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#F8F7FC] truncate">{data.nextPlanEntry.title}</div>
                <div className="text-xs text-[#C8C5D2] tabular-nums">
                  {data.nextPlanEntry.startTime}–{data.nextPlanEntry.endTime} Uhr
                </div>
              </div>
              <div className="text-xs text-[#8D8998] text-right shrink-0">
                {data.dayPlanStats.open} offen · {data.dayPlanStats.done}/{data.dayPlanStats.total}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#C8C5D2]">
              {data.dayPlanStats.total > 0 ? "Für heute ist alles erledigt oder übersprungen." : "Für heute ist noch nichts eingeplant."}
            </p>
          )}
        </Card>
      </Reveal>

      <RevealGroup className="grid grid-cols-1 sm:grid-cols-2 gap-4" stagger={0.06}>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#F8F7FC]">Diese Woche</h2>
            <Link
              href="/week"
              className="text-xs font-semibold text-[#A855F7] flex items-center hover:underline underline-offset-2"
            >
              Wochenplan <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {data.weekMini.map((d, i) => {
              const ratio = d.scheduled > 0 ? d.done / d.scheduled : null;
              const isToday = d.dateKey === todayKey;
              return (
                <div key={d.dateKey} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-[#8D8998] font-semibold">{WEEKDAY_LABELS[i + 1]}</span>
                  <div
                    className={clsx(
                      "h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold transition-transform duration-200 hover:scale-110",
                      isToday && "ring-2 ring-[#A855F7] ring-offset-1",
                      ratio === null
                        ? "bg-[#171720] text-[#5F5B68]"
                        : ratio >= 1
                        ? "bg-[#34D399] text-[#052015] shadow-[var(--shadow-mint)]"
                        : ratio > 0
                        ? "bg-[#FACC15] text-[#241a03]"
                        : "bg-[#3B1420] text-[#FB7185]"
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
            <h2 className="font-bold text-[#F8F7FC]">Gruppen</h2>
            <Link
              href="/groups"
              className="text-xs font-semibold text-[#A855F7] flex items-center hover:underline underline-offset-2"
            >
              Alle ansehen <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.groups.length === 0 ? (
            <EmptyState
              illustration={<EmptyGroupsIllustration className="w-full" />}
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
                    className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-[#171720] transition-all duration-200 hover:translate-x-0.5"
                  >
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: g.color + "22" }}
                    >
                      <DynamicIcon name={g.icon} className="h-4 w-4" style={{ color: g.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#F8F7FC] truncate">{g.name}</div>
                      <div className="text-xs text-[#C8C5D2]">{g.memberCount} Mitglieder</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </RevealGroup>
    </div>
  );
}
