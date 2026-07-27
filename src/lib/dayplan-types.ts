import type { DayPlanEntryCategory, DayPlanEntryPriority, DayPlanEntryStatus, DayPlanRecurrenceType, DayReviewMood } from "@prisma/client";

/** Client-side shape of a DayPlanEntry as it comes back over JSON (Prisma DateTime fields
 * are serialized to ISO strings). `date` is always a UTC-midnight instant representing a
 * calendar day -- use `entryDateKey()` below to read it as "YYYY-MM-DD", never `new
 * Date(entry.date)` + local getters. */
export type DayPlanEntryDTO = {
  id: string;
  userId: string;
  dayPlanId: string | null;
  seriesId: string | null;
  title: string;
  description: string | null;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  category: DayPlanEntryCategory;
  priority: DayPlanEntryPriority;
  status: DayPlanEntryStatus;
  color: string;
  icon: string;
  location: string | null;
  link: string | null;
  notes: string | null;
  reminderMinutes: number | null;
  linkedRoutineId: string | null;
  linkedGroupRoutineId: string | null;
  moveReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DayPlanDTO = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  timeZone: string;
  color: string;
  icon: string;
  recurrenceType: DayPlanRecurrenceType;
  recurrenceDays: number[];
  reminderMinutes: number | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DayPlanTemplateEntryDTO = {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  category: DayPlanEntryCategory;
  priority: DayPlanEntryPriority;
  color: string;
  icon: string;
  location: string | null;
  link: string | null;
  notes: string | null;
  reminderMinutes: number | null;
  sortOrder: number;
};

export type DayPlanTemplateDTO = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  entries: DayPlanTemplateEntryDTO[];
  createdAt: string;
  updatedAt: string;
};

export type DayReviewDTO = {
  id: string;
  userId: string;
  date: string;
  mood: DayReviewMood | null;
  note: string | null;
} | null;

export type LinkableRoutine = { id: string; title: string; icon: string; color: string; scheduledDays: number[] };
export type LinkableGroupRoutine = { id: string; title: string; icon: string; color: string; scheduledDays: number[]; groupName: string };

/** `entry.date` is a UTC-midnight-anchored ISO string (RoutineQuest's date-only convention,
 * see src/lib/dates.ts) -- the first 10 characters are always the correct "YYYY-MM-DD" in
 * every timezone, so no Date parsing/local-getter conversion is needed or safe here. */
export function entryDateKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}
