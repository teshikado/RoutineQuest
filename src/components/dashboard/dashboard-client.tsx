"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import {
  Flame,
  Plus,
  Users,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  CalendarClock,
  PartyPopper,
  GripVertical,
  ListOrdered,
  Check,
  Loader2,
  Undo2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicIcon } from "@/components/ui/icon";
import { RankBadge } from "@/components/ui/rank-badge";
import { Reveal, RevealGroup } from "@/components/ui/reveal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyRoutinesIllustration, EmptyGroupsIllustration } from "@/components/ui/illustrations";
import { TaskCard, type TaskCardData } from "@/components/dashboard/task-card";
import { GroupTaskCard, type GroupTaskCardData } from "@/components/dashboard/group-task-card";
import { LevelUpModal } from "@/components/dashboard/level-up-modal";
import { useToast } from "@/components/toast";
import { getLevelProgress, getRankForLevel } from "@/lib/xp";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { dateKey, todayDateOnly, formatLongDateDe, nowHHmmInTimeZone, isDayPlanEntryStillAhead } from "@/lib/dates";
import type { Difficulty, Category, DashboardItemType } from "@prisma/client";

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

type DashboardPlanEntry = {
  id: string;
  title: string;
  icon: string;
  color: string;
  startTime: string;
  endTime: string;
  endDateKey: string;
  status: "PLANNED" | "IN_PROGRESS" | "DONE" | "SKIPPED" | "MOVED";
  linkedRoutineId: string | null;
  linkedGroupRoutineId: string | null;
};

type ManualOrderEntry = { itemType: DashboardItemType; itemId: string; sortOrder: number };

/** One row of "Heute" -- a personal routine or a group routine, reduced to just what the
 * sort needs. `originalIndex` is the item's position in the server-provided board arrays
 * (personal routines first, then group routines) -- it never changes as items are
 * completed/undone, so it acts as the stable "ursprüngliche Reihenfolge" tiebreaker used
 * for the default (non-manual) sort. */
type HeuteItem =
  | { kind: "personal"; key: string; completed: boolean; timeOfDay: string | null; originalIndex: number; data: TaskCardData }
  | { kind: "group"; key: string; completed: boolean; timeOfDay: string | null; originalIndex: number; data: GroupTaskCardData & { groupId: string } };

const GENERIC_SAVE_ERROR = "Die Aufgabe konnte nicht gespeichert werden. Bitte versuche es erneut.";
const GENERIC_UNDO_ERROR = "Die Erledigung konnte nicht rückgängig gemacht werden. Bitte versuche es erneut.";
const STALE_STATE_ERROR = "Diese Aufgabe wurde bereits aktualisiert. Bitte lade die Seite neu und versuche es erneut.";
const GENERIC_ORDER_ERROR = "Die neue Reihenfolge konnte nicht gespeichert werden.";
const GENERIC_DAYPLAN_ERROR = "Der Tagesplan-Eintrag konnte nicht gespeichert werden. Bitte versuche es erneut.";

/** A row in the flat, single-`.map()`-rendered "Heute" list -- either a task card or one of
 * the two synthetic marker rows (see renderRows in the component below). `kind` is the
 * actual discriminant (not `key`, which is just a plain string on the "task" variant). */
type RenderRow = { kind: "task"; key: string; item: HeuteItem } | { kind: "all-done"; key: string } | { kind: "done-divider"; key: string };

function timeOfDayMinutes(t: string | null): number {
  if (!t) return Number.POSITIVE_INFINITY;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function heuteItemTitle(item: HeuteItem): string {
  return item.kind === "personal" ? item.data.routine.title : item.data.groupRoutine.title;
}
function heuteItemIcon(item: HeuteItem): string {
  return item.kind === "personal" ? item.data.routine.icon : item.data.groupRoutine.icon;
}
function heuteItemColor(item: HeuteItem): string {
  return item.kind === "personal" ? item.data.routine.color : item.data.groupRoutine.color;
}

/** `personal-<routineId>` / `group-<groupRoutineId>` -> the itemType/itemId pair the
 * DashboardItemOrder API expects. The prefix never appears inside a cuid, so splitting on
 * the first "-" is unambiguous. */
function keyToItemRef(key: string): { itemType: ManualOrderEntry["itemType"]; itemId: string } {
  const sep = key.indexOf("-");
  const prefix = key.slice(0, sep);
  const itemId = key.slice(sep + 1);
  return { itemType: prefix === "personal" ? "PERSONAL_ROUTINE" : "GROUP_ROUTINE", itemId };
}

/** Open tasks first (a stored manual position wins if the user has customized it; items
 * without one fall back to timed-ascending-then-untimed, ties broken by original order),
 * completed tasks after -- always in their original daily order regardless of any manual
 * position (see Hauptaufgabe Teil 1 Punkt 4: completed items are never manually reorderable
 * or shown out of their normal place). Never mutates the input arrays; always sorts a copy. */
function sortHeuteItems(items: HeuteItem[], manualOrder: Map<string, number>): HeuteItem[] {
  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.completed) {
      const aOrder = manualOrder.get(a.key);
      const bOrder = manualOrder.get(b.key);
      if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
      // A manually positioned item always sorts before one the user never touched -- new
      // routines/group routines created after the user last customized their order simply
      // fall in at the end of the open list (Teil 1 Punkt 7) without disturbing the
      // existing manual positions.
      if (aOrder !== undefined || bOrder !== undefined) return aOrder !== undefined ? -1 : 1;
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
    todayPlanEntries: DashboardPlanEntry[];
    manualOrder: ManualOrderEntry[];
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
  // the same "moved to Erledigt" / "moved back up" / "verschoben an Position N" information
  // sighted users get for free from the reorder animation.
  const [announcement, setAnnouncement] = useState("");

  // ---------- Teil 1: manual "Heute" ordering ----------
  const [manualOrder, setManualOrder] = useState<Map<string, number>>(
    () => new Map(data.manualOrder.map((m) => [`${m.itemType === "PERSONAL_ROUTINE" ? "personal" : "group"}-${m.itemId}`, m.sortOrder]))
  );
  const [orderEditing, setOrderEditing] = useState(false);
  const [editOrder, setEditOrder] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resettingOrder, setResettingOrder] = useState(false);
  const editOrderRef = useRef<string[]>([]);
  const draggingKeyRef = useRef<string | null>(null);
  useEffect(() => {
    editOrderRef.current = editOrder;
  }, [editOrder]);

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
  const heuteItemsByKey = useMemo(() => new Map(heuteItems.map((i) => [i.key, i])), [heuteItems]);
  const sortedHeuteItems = useMemo(() => sortHeuteItems(heuteItems, manualOrder), [heuteItems, manualOrder]);
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

  // ---------- Teil 1: manual order editing ----------

  function handleEnterOrderEditing() {
    setEditOrder(openHeuteItems.map((i) => i.key));
    setOrderEditing(true);
  }

  function handleCancelOrder() {
    setOrderEditing(false);
  }

  function moveEditItem(fromIndex: number, direction: -1 | 1) {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= editOrder.length) return;
    const next = [...editOrder];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    setEditOrder(next);
    const item = heuteItemsByKey.get(next[toIndex]);
    if (item) setAnnouncement(`${heuteItemTitle(item)} wurde an Position ${toIndex + 1} verschoben.`);
  }

  function handleDragStart(key: string) {
    draggingKeyRef.current = key;
  }
  function handleDragEnd() {
    const key = draggingKeyRef.current;
    draggingKeyRef.current = null;
    if (!key) return;
    const index = editOrderRef.current.indexOf(key);
    if (index === -1) return;
    const item = heuteItemsByKey.get(key);
    if (item) setAnnouncement(`${heuteItemTitle(item)} wurde an Position ${index + 1} verschoben.`);
  }

  async function handleSaveOrder() {
    const items: ManualOrderEntry[] = editOrder.map((key, i) => {
      const ref = keyToItemRef(key);
      return { itemType: ref.itemType, itemId: ref.itemId, sortOrder: i };
    });
    const previousManualOrder = manualOrder;
    const nextManualOrder = new Map(editOrder.map((key, i) => [key, i]));

    // Optimistic: show the new order immediately and leave edit mode right away; roll back
    // to the previous manual order (and re-show the error) only if the save actually fails.
    setManualOrder(nextManualOrder);
    setOrderEditing(false);
    setSavingOrder(true);

    let ok = false;
    try {
      const res = await fetch("/api/dashboard/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }

    setSavingOrder(false);
    if (ok) {
      showToast("Reihenfolge erfolgreich gespeichert.", "success");
    } else {
      setManualOrder(previousManualOrder);
      showToast(GENERIC_ORDER_ERROR, "error");
    }
  }

  async function handleConfirmResetOrder() {
    setResettingOrder(true);
    const previousManualOrder = manualOrder;
    setManualOrder(new Map());

    let ok = false;
    try {
      const res = await fetch("/api/dashboard/order", { method: "DELETE" });
      ok = res.ok;
    } catch {
      ok = false;
    }

    setResettingOrder(false);
    setResetConfirmOpen(false);
    if (ok) {
      setOrderEditing(false);
      showToast("Reihenfolge zurückgesetzt.", "success");
    } else {
      setManualOrder(previousManualOrder);
      showToast("Die Reihenfolge konnte nicht zurückgesetzt werden.", "error");
    }
  }

  // ---------- Teil 2: next day-plan entry, completable right from the dashboard ----------
  const [planEntries, setPlanEntries] = useState<DashboardPlanEntry[]>(data.todayPlanEntries);
  const [dayPlanBusyId, setDayPlanBusyId] = useState<string | null>(null);
  const dayPlanInFlightRef = useRef<Set<string>>(new Set());
  // The entry the user just completed via this widget, if any -- shown with a brief
  // "Rückgängig" affordance (Teil 2 Punkt 15) that fades away on its own after a few
  // seconds, rather than a persistent control for whichever entry happens to be done.
  const [recentlyCompletedEntryId, setRecentlyCompletedEntryId] = useState<string | null>(null);
  const recentlyCompletedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (recentlyCompletedTimeoutRef.current) clearTimeout(recentlyCompletedTimeoutRef.current);
    };
  }, []);

  // Plain derived values, like `openHeuteItems`/`doneHeuteItems` above -- cheap filters
  // over an already-local array don't need manual memoization. "now" is deliberately read
  // fresh on every render so the widget reflects the current entry right after a toggle.
  const nowHHmm = nowHHmmInTimeZone();
  const nextPlanEntry = planEntries.find((e) => isDayPlanEntryStillAhead(e.status, e.endDateKey, e.endTime, todayKey, nowHHmm)) ?? null;
  const dayPlanStats = {
    total: planEntries.length,
    done: planEntries.filter((e) => e.status === "DONE").length,
    open: planEntries.filter((e) => e.status !== "DONE" && e.status !== "SKIPPED").length,
  };
  const recentlyCompletedEntry =
    (recentlyCompletedEntryId && planEntries.find((e) => e.id === recentlyCompletedEntryId && e.status === "DONE")) || null;

  async function handleDayPlanToggle(entryId: string) {
    if (dayPlanInFlightRef.current.has(entryId)) return;
    dayPlanInFlightRef.current.add(entryId);
    setDayPlanBusyId(entryId);

    const previousEntry = planEntries.find((e) => e.id === entryId);
    if (!previousEntry) {
      dayPlanInFlightRef.current.delete(entryId);
      setDayPlanBusyId(null);
      showToast(STALE_STATE_ERROR, "error");
      return;
    }
    const optimisticStatus = previousEntry.status === "DONE" ? "PLANNED" : "DONE";
    setPlanEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: optimisticStatus } : e)));

    let res: Response;
    try {
      res = await fetch(`/api/dayplan-entries/${entryId}/complete`, { method: "POST" });
    } catch {
      setPlanEntries((prev) => prev.map((e) => (e.id === entryId ? previousEntry : e)));
      showToast(GENERIC_DAYPLAN_ERROR, "error");
      dayPlanInFlightRef.current.delete(entryId);
      setDayPlanBusyId(null);
      return;
    }

    const result = await res.json().catch(() => null);
    if (!res.ok || !result) {
      setPlanEntries((prev) => prev.map((e) => (e.id === entryId ? previousEntry : e)));
      showToast(result?.error ?? GENERIC_DAYPLAN_ERROR, "error");
      dayPlanInFlightRef.current.delete(entryId);
      setDayPlanBusyId(null);
      return;
    }

    const newStatus: DashboardPlanEntry["status"] = result.entry.status;
    setPlanEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: newStatus } : e)));

    if (newStatus === "DONE") {
      const suffix = result.xpDelta > 0 ? ` +${result.xpDelta} XP` : "";
      showToast(`Tagesplan-Eintrag erledigt.${suffix}`, result.xpDelta > 0 ? "xp" : "success");
      setAnnouncement(`${previousEntry.title} wurde als erledigt markiert.`);

      if (recentlyCompletedTimeoutRef.current) clearTimeout(recentlyCompletedTimeoutRef.current);
      setRecentlyCompletedEntryId(entryId);
      recentlyCompletedTimeoutRef.current = setTimeout(() => setRecentlyCompletedEntryId(null), 8000);

      // toggleEntryComplete only ever touches the linked routine's/group-routine's own
      // completion on the *completing* path (never on undo, see dayplan-service.ts) -- so
      // board/groupBoard are only ever mirrored here, keeping this dashboard's "Heute"
      // list in sync without a second network round trip.
      if (result.linkedAction === "routine" && previousEntry.linkedRoutineId) {
        setBoard((prev) => prev.map((b) => (b.routine.id === previousEntry.linkedRoutineId ? { ...b, completed: true, canUndo: true } : b)));
      } else if (result.linkedAction === "groupRoutine" && previousEntry.linkedGroupRoutineId) {
        setGroupBoard((prev) => prev.map((b) => (b.groupRoutine.id === previousEntry.linkedGroupRoutineId ? { ...b, completed: true, canUndo: true } : b)));
      }

      if (result.leveledUp) {
        setTimeout(() => setLevelUp({ level: result.level, rankedUp: result.rankedUp }), 600);
      }
    } else {
      showToast("Tagesplan-Eintrag wieder geöffnet.", "info");
      setAnnouncement(`${previousEntry.title} wurde wieder geöffnet.`);
      if (recentlyCompletedEntryId === entryId) {
        if (recentlyCompletedTimeoutRef.current) clearTimeout(recentlyCompletedTimeoutRef.current);
        setRecentlyCompletedEntryId(null);
      }
    }

    dayPlanInFlightRef.current.delete(entryId);
    setDayPlanBusyId(null);
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

      <ConfirmDialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleConfirmResetOrder}
        title="Reihenfolge zurücksetzen"
        description="Möchtest du deine persönliche Reihenfolge wirklich zurücksetzen? Offene Aufgaben werden danach wieder nach Uhrzeit sortiert."
        confirmLabel="Zurücksetzen"
        danger={false}
        loading={resettingOrder}
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
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="font-bold text-[#F8F7FC]">Heute</h2>
            <div className="flex items-center gap-3">
              {!orderEditing && openHeuteItems.length > 1 && (
                <button
                  type="button"
                  onClick={handleEnterOrderEditing}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#A855F7] hover:text-[#C084FC] rounded-lg px-2 py-1 -mr-2 hover:bg-[#171720] transition-colors focus-visible:outline-none"
                >
                  <ListOrdered className="h-3.5 w-3.5" /> Reihenfolge ändern
                </button>
              )}
              <span className="text-sm font-semibold text-[#A855F7] tabular-nums">{Math.round(dayRatio * 100)}%</span>
            </div>
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
          ) : orderEditing ? (
            <div className="space-y-3">
              <p className="text-xs text-[#8D8998]">Ziehe die Aufgaben am Griff oder nutze die Pfeile, um die Reihenfolge zu ändern.</p>
              <Reorder.Group axis="y" values={editOrder} onReorder={setEditOrder} className="space-y-2">
                {editOrder.map((key, index) => {
                  const item = heuteItemsByKey.get(key);
                  if (!item) return null;
                  return (
                    <OrderableRow
                      key={key}
                      item={item}
                      isFirst={index === 0}
                      isLast={index === editOrder.length - 1}
                      onMoveUp={() => moveEditItem(index, -1)}
                      onMoveDown={() => moveEditItem(index, 1)}
                      onDragStart={() => handleDragStart(key)}
                      onDragEnd={handleDragEnd}
                    />
                  );
                })}
              </Reorder.Group>

              {doneHeuteItems.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F5B68]">Erledigt</span>
                    <span className="text-[11px] text-[#5F5B68] tabular-nums">· {doneHeuteItems.length} erledigt</span>
                    <div className="h-px flex-1 bg-[#292936]" />
                  </div>
                  {doneHeuteItems.map((item) =>
                    item.kind === "personal" ? (
                      <TaskCard key={item.key} data={item.data} onToggle={handleToggle} />
                    ) : (
                      <GroupTaskCard key={item.key} data={item.data} onToggle={handleGroupToggle} />
                    )
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setResetConfirmOpen(true)}
                  className="text-xs font-semibold text-[#8D8998] hover:text-[#FB7185] transition-colors rounded-lg px-1 py-1 focus-visible:outline-none"
                >
                  Reihenfolge zurücksetzen
                </button>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={handleCancelOrder}>
                    Abbrechen
                  </Button>
                  <Button size="sm" onClick={handleSaveOrder} loading={savingOrder}>
                    Speichern
                  </Button>
                </div>
              </div>
            </div>
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
          {nextPlanEntry ? (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: nextPlanEntry.color + "22" }}>
                <DynamicIcon name={nextPlanEntry.icon} className="h-4 w-4" style={{ color: nextPlanEntry.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#F8F7FC] truncate">{nextPlanEntry.title}</div>
                <div className="text-xs text-[#C8C5D2] tabular-nums">
                  {nextPlanEntry.startTime}–{nextPlanEntry.endTime} Uhr
                </div>
              </div>
              <div className="text-xs text-[#8D8998] text-right shrink-0">
                {dayPlanStats.open} offen · {dayPlanStats.done}/{dayPlanStats.total}
              </div>
              <button
                type="button"
                onClick={() => handleDayPlanToggle(nextPlanEntry.id)}
                disabled={dayPlanBusyId === nextPlanEntry.id}
                aria-pressed={false}
                aria-label={`${nextPlanEntry.title} als erledigt markieren`}
                className="group h-9 w-9 rounded-full flex items-center justify-center border-2 border-[#D8B4FE] hover:bg-[#171720] transition-all disabled:opacity-60 shrink-0 focus-visible:outline-none"
              >
                {dayPlanBusyId === nextPlanEntry.id ? (
                  <Loader2 className="h-4 w-4 text-[#A855F7] animate-spin" />
                ) : (
                  <Check className="h-4 w-4 text-[#A855F7] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-sm text-[#C8C5D2]">
                {dayPlanStats.total > 0 ? "Tagesplanung für heute abgeschlossen." : "Für heute ist noch nichts eingeplant."}
              </p>
              {dayPlanStats.total > 0 && (
                <p className="text-xs text-[#8D8998] tabular-nums">
                  {dayPlanStats.done} von {dayPlanStats.total} erledigt
                </p>
              )}
            </div>
          )}
          <AnimatePresence>
            {recentlyCompletedEntry && (
              <motion.div
                key="dayplan-undo"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-2 pt-2 border-t border-[#292936] flex items-center justify-between gap-2"
              >
                <span className="text-xs text-[#8D8998] truncate">„{recentlyCompletedEntry.title}“ erledigt</span>
                <button
                  type="button"
                  onClick={() => handleDayPlanToggle(recentlyCompletedEntry.id)}
                  disabled={dayPlanBusyId === recentlyCompletedEntry.id}
                  className="flex items-center gap-1 rounded-full bg-[#171720] border border-[#292936] px-2.5 py-1 text-[11px] font-semibold text-[#C8C5D2] hover:text-[#A855F7] shrink-0 disabled:opacity-60"
                >
                  <Undo2 className="h-3 w-3" />
                  Rückgängig
                </button>
              </motion.div>
            )}
          </AnimatePresence>
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

/** One draggable row in the "Reihenfolge ändern" edit mode -- a read-only preview of the
 * open item (icon/title/time) plus a drag handle and Nach-oben/Nach-unten buttons. Deliberately
 * NOT the full TaskCard/GroupTaskCard: rendering the real completion toggle here would risk
 * firing it by accident while the user is trying to drag or tap an adjacent control. */
function OrderableRow({
  item,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
}: {
  item: HeuteItem;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const title = heuteItemTitle(item);
  const icon = heuteItemIcon(item);
  const color = heuteItemColor(item);

  return (
    <Reorder.Item
      value={item.key}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: "0 10px 28px rgba(168,85,247,0.35)", zIndex: 10 }}
      className="flex items-center gap-2 rounded-2xl border border-[#292936] bg-[#111118] p-3"
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label={`${title} verschieben, ziehen zum Ändern der Position`}
        title="Ziehen zum Verschieben"
        className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg text-[#8D8998] hover:text-[#A855F7] hover:bg-[#171720] cursor-grab active:cursor-grabbing touch-none focus-visible:outline-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "22" }}>
        <DynamicIcon name={icon} className="h-4 w-4" style={{ color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#F8F7FC] truncate">{title}</div>
        {item.timeOfDay && <div className="text-xs text-[#C8C5D2] tabular-nums">{item.timeOfDay}</div>}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label={`${title} nach oben verschieben`}
          title="Nach oben"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#A855F7] hover:bg-[#171720] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label={`${title} nach unten verschieben`}
          title="Nach unten"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-[#C8C5D2] hover:text-[#A855F7] hover:bg-[#171720] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </Reorder.Item>
  );
}
