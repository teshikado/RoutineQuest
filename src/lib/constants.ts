import type { Category, Difficulty, GroupRoutineAwardType, NotificationType } from "@prisma/client";

export const BRAND = {
  babyBlue: "#A7D8F0",
  iceBlue: "#EAF7FC",
  buttonBlue: "#4FA8D8",
  headingBlue: "#183B56",
  white: "#FFFFFF",
  grayLight: "#F5F7FA",
  mint: "#78D6B0",
  xpYellow: "#FFD166",
  coral: "#FF8A80",
} as const;

export const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  FITNESS: { label: "Fitness", icon: "Dumbbell" },
  LEARNING: { label: "Lernen", icon: "BookOpen" },
  HEALTH: { label: "Gesundheit", icon: "HeartPulse" },
  PRODUCTIVITY: { label: "Produktivität", icon: "Target" },
  HOUSEHOLD: { label: "Haushalt", icon: "Home" },
  RELAXATION: { label: "Entspannung", icon: "Moon" },
  PERSONAL_GOALS: { label: "Persönliche Ziele", icon: "Star" },
};

export const DIFFICULTY_META: Record<Difficulty, { label: string; xp: number; color: string }> = {
  EASY: { label: "Leicht", xp: 10, color: BRAND.mint },
  MEDIUM: { label: "Mittel", xp: 20, color: BRAND.buttonBlue },
  HARD: { label: "Schwer", xp: 30, color: BRAND.coral },
};

export const XP_BONUS = {
  DAILY_COMPLETE: 25,
  STREAK_MILESTONE: 100,
  PERFECT_WEEK: 250,
};

export const STREAK_MIN_RATIO = 0.7;

export const ROUTINE_COLORS = [
  "#4FA8D8",
  "#78D6B0",
  "#FFD166",
  "#FF8A80",
  "#A78BFA",
  "#F472B6",
  "#38BDF8",
  "#FB923C",
];

export const ROUTINE_ICONS = [
  "Sparkles",
  "Dumbbell",
  "BookOpen",
  "HeartPulse",
  "Target",
  "Home",
  "Moon",
  "Star",
  "Droplet",
  "Sun",
  "Utensils",
  "PenLine",
  "Bike",
  "Brain",
  "Coffee",
  "Music",
];

// 1 = Monday ... 7 = Sunday (ISO weekday)
export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
  7: "So",
};

export const WEEKDAY_LABELS_LONG: Record<number, string> = {
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
  7: "Sonntag",
};

export type RankDef = {
  key: string;
  name: string;
  minLevel: number;
  maxLevel: number | null;
  icon: string;
  description: string;
  color: string;
};

export const RANKS: RankDef[] = [
  {
    key: "NEULING",
    name: "Routine-Neuling",
    minLevel: 1,
    maxLevel: 4,
    icon: "Sparkle",
    description: "Der erste Schritt wurde gemacht.",
    color: "#A7D8F0",
  },
  {
    key: "ZIELSTARTER",
    name: "Zielstarter",
    minLevel: 5,
    maxLevel: 9,
    icon: "ArrowUp",
    description: "Die ersten Routinen werden aufgebaut.",
    color: "#4FA8D8",
  },
  {
    key: "DURCHZIEHER",
    name: "Durchzieher",
    minLevel: 10,
    maxLevel: 19,
    icon: "ShieldCheck",
    description: "Der Nutzer zeigt echte Beständigkeit.",
    color: "#78D6B0",
  },
  {
    key: "FOKUS_PRO",
    name: "Fokus-Pro",
    minLevel: 20,
    maxLevel: 34,
    icon: "Target",
    description: "Disziplin und Fokus werden zur Gewohnheit.",
    color: "#183B56",
  },
  {
    key: "CHAMPION",
    name: "Routine-Champion",
    minLevel: 35,
    maxLevel: 49,
    icon: "Crown",
    description: "Der Nutzer gehört zu den besonders konsequenten Mitgliedern.",
    color: "#FFD166",
  },
  {
    key: "LEGENDE",
    name: "Gewohnheits-Legende",
    minLevel: 50,
    maxLevel: null,
    icon: "Gem",
    description: "Routinen wurden zu einem festen Teil des Lebens.",
    color: "#A78BFA",
  },
];

export const NOTIFICATION_META: Record<NotificationType, { label: string; description: string }> = {
  ROUTINE_REMINDER: {
    label: "Anstehende Routinen",
    description: "Erinnerung an geplante Routinen des Tages.",
  },
  STREAK_AT_RISK: {
    label: "Gefährdete Erfolgsserie",
    description: "Warnung, wenn deine Streak heute noch nicht gesichert ist.",
  },
  GROUP_INVITE: {
    label: "Neue Gruppeneinladung",
    description: "Benachrichtigung bei neuen Einladungen zu Gruppen.",
  },
  LEVEL_UP: {
    label: "Levelaufstieg",
    description: "Benachrichtigung, wenn du ein neues Level erreichst.",
  },
  RANK_UP: {
    label: "Rangaufstieg",
    description: "Benachrichtigung, wenn du einen neuen Rang erreichst.",
  },
  WEEKLY_REPORT: {
    label: "Wöchentlicher Fortschrittsbericht",
    description: "Zusammenfassung deiner Woche.",
  },
  GROUP_ROUTINE_ADDED: {
    label: "Neue Gruppenroutine",
    description: "Benachrichtigung, wenn der Gruppenanführer eine neue gemeinsame Routine startet.",
  },
  GROUP_ROUTINE_CHAMPION: {
    label: "Gruppenroutine-Champion",
    description: "Ankündigung des wöchentlichen Champions und der Auszeichnungen.",
  },
};

export const GROUP_ROUTINE_CHAMPION_BONUS_XP = 150;

export type AwardDef = { label: string; description: string; icon: string; color: string };

export const GROUP_ROUTINE_AWARD_META: Record<GroupRoutineAwardType, AwardDef> = {
  CHAMPION: {
    label: "Routine-Champion",
    description: "Die konsequenteste Teilnahme dieser Woche.",
    icon: "Crown",
    color: BRAND.xpYellow,
  },
  STREAK_MEISTER: {
    label: "Streak-Meister",
    description: "Die längste Erfolgsserie dieser Woche.",
    icon: "Flame",
    color: BRAND.coral,
  },
  COMEBACK_STAR: {
    label: "Comeback-Star",
    description: "Die größte Verbesserung gegenüber der Vorwoche.",
    icon: "TrendingUp",
    color: BRAND.mint,
  },
  TEAMPLAYER: {
    label: "Teamplayer",
    description: "Besonders aktive Teilnahme in dieser Woche.",
    icon: "Users",
    color: BRAND.buttonBlue,
  },
  PERFECT_WOCHE: {
    label: "Perfekte Woche",
    description: "Alle geplanten Tage dieser Woche erledigt.",
    icon: "Sparkles",
    color: "#A78BFA",
  },
};

