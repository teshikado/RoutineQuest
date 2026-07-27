import type { DayPlanEntryCategory, DayPlanEntryPriority, DayPlanEntryStatus, DayPlanRecurrenceType, DayReviewMood } from "@prisma/client";

export const DAYPLAN_CATEGORY_META: Record<DayPlanEntryCategory, { label: string; icon: string; color: string }> = {
  WORK: { label: "Arbeit", icon: "Briefcase", color: "#38BDF8" },
  TRADING: { label: "Trading", icon: "TrendingUp", color: "#FACC15" },
  LEARNING: { label: "Lernen", icon: "BookOpen", color: "#A78BFA" },
  SPORT: { label: "Sport", icon: "Dumbbell", color: "#34D399" },
  HEALTH: { label: "Gesundheit", icon: "HeartPulse", color: "#FB7185" },
  LEISURE: { label: "Freizeit", icon: "Gamepad2", color: "#F472B6" },
  BREAK: { label: "Pause", icon: "Coffee", color: "#FB923C" },
  APPOINTMENT: { label: "Termine", icon: "CalendarClock", color: "#A855F7" },
  HOUSEHOLD: { label: "Haushalt", icon: "Home", color: "#5EEAD4" },
  SLEEP: { label: "Schlaf", icon: "Moon", color: "#818CF8" },
  PERSONAL: { label: "Persönlich", icon: "Star", color: "#D8B4FE" },
  OTHER: { label: "Sonstiges", icon: "Sparkles", color: "#8D8998" },
};

export const DAYPLAN_PRIORITY_META: Record<DayPlanEntryPriority, { label: string; color: string }> = {
  LOW: { label: "Niedrig", color: "#8D8998" },
  NORMAL: { label: "Normal", color: "#38BDF8" },
  HIGH: { label: "Hoch", color: "#FACC15" },
  CRITICAL: { label: "Sehr wichtig", color: "#FB7185" },
};

export const DAYPLAN_STATUS_META: Record<DayPlanEntryStatus, { label: string; icon: string }> = {
  PLANNED: { label: "Geplant", icon: "Circle" },
  IN_PROGRESS: { label: "Läuft gerade", icon: "PlayCircle" },
  DONE: { label: "Erledigt", icon: "CheckCircle2" },
  SKIPPED: { label: "Übersprungen", icon: "SkipForward" },
  MOVED: { label: "Verschoben", icon: "CornerDownRight" },
};

export const DAYPLAN_RECURRENCE_META: Record<DayPlanRecurrenceType, { label: string }> = {
  SINGLE_DAY: { label: "Nur dieser Tag" },
  EVERY_DAY: { label: "Jeden Tag im Zeitraum" },
  WEEKDAYS: { label: "Nur Werktage" },
  WEEKEND: { label: "Nur Wochenende" },
  CUSTOM_DAYS: { label: "Bestimmte Wochentage" },
};

export const DAY_REVIEW_MOOD_META: Record<DayReviewMood, { label: string; emoji: string }> = {
  GREAT: { label: "Sehr gut", emoji: "🤩" },
  GOOD: { label: "Gut", emoji: "🙂" },
  OKAY: { label: "Okay", emoji: "😐" },
  HARD: { label: "Anstrengend", emoji: "😓" },
  BAD: { label: "Nicht gut", emoji: "😞" },
};

export const REMINDER_OPTIONS = [
  { value: null, label: "Keine Erinnerung" },
  { value: 0, label: "Zur Startzeit" },
  { value: 5, label: "5 Minuten vorher" },
  { value: 10, label: "10 Minuten vorher" },
  { value: 15, label: "15 Minuten vorher" },
  { value: 30, label: "30 Minuten vorher" },
  { value: 60, label: "1 Stunde vorher" },
] as const;

export const DAYPLAN_COLORS = [
  "#A855F7",
  "#34D399",
  "#FACC15",
  "#FB7185",
  "#A78BFA",
  "#F472B6",
  "#38BDF8",
  "#FB923C",
];

export const DAYPLAN_ICONS = [
  "CalendarClock",
  "Briefcase",
  "TrendingUp",
  "BookOpen",
  "Dumbbell",
  "HeartPulse",
  "Gamepad2",
  "Coffee",
  "Home",
  "Moon",
  "Star",
  "Sparkles",
  "Target",
  "Clock",
  "Sun",
  "Rocket",
];

/** Presets shown when picking a DayPlan's date range. "custom" reveals a start/end date picker. */
export const DATE_RANGE_PRESETS = [
  { key: "today", label: "Nur heute" },
  { key: "single", label: "Ein bestimmter Tag" },
  { key: "week", label: "Eine Woche" },
  { key: "twoWeeks", label: "Zwei Wochen" },
  { key: "month", label: "Ein Monat" },
  { key: "threeMonths", label: "Drei Monate" },
  { key: "custom", label: "Benutzerdefinierter Zeitraum" },
] as const;

export type DateRangePresetKey = (typeof DATE_RANGE_PRESETS)[number]["key"];

/** Safety cap on how many days a single DayPlan may materialize entries for, to bound
 * request size and DB writes for very large custom ranges. */
export const MAX_DAYPLAN_RANGE_DAYS = 366;

export const MOVE_REASON_OPTIONS = [
  "Keine Zeit",
  "Termin dazwischen",
  "Aufgabe dauerte länger",
  "Nicht mehr notwendig",
] as const;

/** Fixed XP awarded per completed DayPlan entry when the user has opted into
 * "XP für Tagesplanung" and the entry is NOT linked to a Routine/GroupRoutine (linked
 * entries get their XP from the linked Routine/GroupRoutine's own completion instead,
 * so awarding it again here would double-count it). */
export const DAYPLAN_ENTRY_XP = 5;
