import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse ein."),
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen lang sein."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse ein."),
  password: z.string().min(1, "Bitte gib dein Passwort ein."),
});

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Der Benutzername muss mindestens 3 Zeichen lang sein.")
  .max(20, "Der Benutzername darf höchstens 20 Zeichen lang sein.")
  .regex(/^[a-zA-Z0-9_]+$/, "Nur Buchstaben, Zahlen und Unterstriche sind erlaubt.");

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse ein."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen lang sein."),
});

export const onboardingSchema = z.object({
  username: usernameSchema,
  avatarEmoji: z.string().min(1).max(8),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const routineSchema = z.object({
  title: z.string().trim().min(1, "Bitte gib einen Titel ein.").max(60),
  description: z.string().trim().max(300).optional().nullable(),
  category: z.enum([
    "FITNESS",
    "LEARNING",
    "HEALTH",
    "PRODUCTIVITY",
    "HOUSEHOLD",
    "RELAXATION",
    "PERSONAL_GOALS",
  ]),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  scheduledDays: z.array(z.number().int().min(1).max(7)).min(1, "Wähle mindestens einen Wochentag."),
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
  reminderEnabled: z.boolean().optional(),
});

export const groupSchema = z.object({
  name: z.string().trim().min(2, "Der Gruppenname muss mindestens 2 Zeichen lang sein.").max(40),
  description: z.string().trim().max(200).optional().nullable(),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  maxMembers: z.number().int().min(2).max(500).optional().nullable(),
  isPrivate: z.boolean().optional(),
});

// Kept as a plain (non-refined) object schema so `.partial()` stays usable for PATCH
// requests — Zod v4 does not support `.partial()` on a schema wrapped in `.refine()`.
// The goalType/goalTarget pairing is validated separately wherever it matters instead.
export const groupRoutineBaseSchema = z.object({
  title: z.string().trim().min(1, "Bitte gib einen Titel ein.").max(60),
  description: z.string().trim().max(300).optional().nullable(),
  category: z.enum([
    "FITNESS",
    "LEARNING",
    "HEALTH",
    "PRODUCTIVITY",
    "HOUSEHOLD",
    "RELAXATION",
    "PERSONAL_GOALS",
  ]),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  xpReward: z.number().int().min(5).max(500),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  scheduledDays: z.array(z.number().int().min(1).max(7)).min(1, "Wähle mindestens einen Wochentag."),
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable(),
  visibility: z.enum(["ALL_MEMBERS", "PARTICIPANTS_ONLY"]),
  mandatory: z.boolean().optional(),
  goalType: z.enum(["NONE", "WEEKLY"]).optional(),
  goalTarget: z.number().int().min(1).max(7).optional().nullable(),
});

export const groupRoutineSchema = groupRoutineBaseSchema.refine(
  (data) => data.goalType !== "WEEKLY" || (data.goalTarget ?? 0) > 0,
  { message: "Bitte gib eine Zielzahl für das Wochenziel an.", path: ["goalTarget"] }
);

export const participationResponseSchema = z.object({
  decision: z.enum(["JOIN", "DECLINE", "LATER"]),
});

// ---------- Day planning ----------

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ungültige Uhrzeit.");

const DAYPLAN_CATEGORIES = [
  "WORK", "TRADING", "LEARNING", "SPORT", "HEALTH", "LEISURE",
  "BREAK", "APPOINTMENT", "HOUSEHOLD", "SLEEP", "PERSONAL", "OTHER",
] as const;
const DAYPLAN_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
const DAYPLAN_STATUSES = ["PLANNED", "IN_PROGRESS", "DONE", "SKIPPED", "MOVED"] as const;
const DAYPLAN_RECURRENCE_TYPES = ["SINGLE_DAY", "EVERY_DAY", "WEEKDAYS", "WEEKEND", "CUSTOM_DAYS"] as const;

const dayPlanBaseSchema = z.object({
  title: z.string().trim().min(1, "Bitte gib einen Namen ein.").max(60),
  description: z.string().trim().max(300).optional().nullable(),
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  timeZone: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1),
  recurrenceType: z.enum(DAYPLAN_RECURRENCE_TYPES),
  recurrenceDays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  reminderMinutes: z.number().int().min(0).max(1440).optional().nullable(),
});

export const dayPlanSchema = dayPlanBaseSchema
  .refine((d) => d.endDate >= d.startDate, { message: "Das Enddatum darf nicht vor dem Startdatum liegen.", path: ["endDate"] })
  .refine((d) => d.recurrenceType !== "CUSTOM_DAYS" || (d.recurrenceDays?.length ?? 0) > 0, {
    message: "Wähle mindestens einen Wochentag.",
    path: ["recurrenceDays"],
  });

// Full DayPlan edit ("Tagesplan bearbeiten"): every field optional, since the user may only
// change e.g. the color. Cross-field range validation runs server-side in updateDayPlan().
// `syncFutureEntries` opts into reconciling already-materialized future occurrences with a
// changed date range/recurrence (see updateDayPlan in dayplan-service.ts) -- omitted/false
// keeps the original, more conservative "container fields only" behavior.
export const dayPlanUpdateSchema = dayPlanBaseSchema.partial().extend({
  archived: z.boolean().optional(),
  syncFutureEntries: z.boolean().optional(),
});

// Field-shape validation only (formats, required-ness). The actual "is this a valid
// start/end range" cross-field check -- which must account for blocks crossing
// midnight -- happens server-side in dayplan-service.ts's assertValidEntryRange, the one
// place that logic is allowed to live. `endDate`/`endsNextDay` are both optional here:
// callers may pass an explicit endDate, or just `endsNextDay: true` and let the service
// derive endDate = date + 1.
export const dayPlanEntryBaseSchema = z.object({
  title: z.string().trim().min(1, "Bitte gib einen Titel ein.").max(60),
  description: z.string().trim().max(300).optional().nullable(),
  date: dateKeySchema,
  endDate: dateKeySchema.optional(),
  startTime: timeSchema,
  endTime: timeSchema,
  endsNextDay: z.boolean().optional(),
  category: z.enum(DAYPLAN_CATEGORIES),
  priority: z.enum(DAYPLAN_PRIORITIES),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1),
  location: z.string().trim().max(120).optional().nullable(),
  link: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  reminderMinutes: z.number().int().min(0).max(1440).optional().nullable(),
  linkedRoutineId: z.string().optional().nullable(),
  linkedGroupRoutineId: z.string().optional().nullable(),
});

export const dayPlanEntrySchema = dayPlanEntryBaseSchema;

export const dayPlanEntryUpdateSchema = dayPlanEntryBaseSchema.partial().extend({
  status: z.enum(DAYPLAN_STATUSES).optional(),
  scope: z.enum(["THIS", "FOLLOWING", "ALL"]).optional(),
  sortOrder: z.number().int().min(0).optional(),
  includeCustomized: z.boolean().optional(),
});

// A recurring block's "template" edit: same shape as an entry, minus the absolute
// date/endDate fields (a series occupies many dates, so this only edits the *shape* every
// future, not-yet-customized occurrence shares -- see updateSeriesBlock).
export const seriesBlockUpdateSchema = dayPlanEntryBaseSchema
  .omit({ date: true, endDate: true })
  .partial()
  .extend({ includeCustomized: z.boolean().optional() });

export const seriesBlockDeleteQuerySchema = z.object({
  includeCustomized: z.enum(["true", "false"]).optional(),
});

export const restoreOccurrenceSchema = z.object({
  date: dateKeySchema,
});

export const reorderSeriesBlocksSchema = z.object({
  seriesIds: z.array(z.string().min(1)).min(1).max(50),
});

export const dashboardOrderSaveSchema = z.object({
  items: z
    .array(
      z.object({
        itemType: z.enum(["PERSONAL_ROUTINE", "GROUP_ROUTINE"]),
        itemId: z.string().min(1),
        sortOrder: z.number().int().min(0).max(9999),
      })
    )
    .min(1)
    .max(200),
});

export const dayPlanEntryMoveSchema = z.object({
  date: dateKeySchema,
  startTime: timeSchema,
  endDate: dateKeySchema.optional(),
  endTime: timeSchema.optional(),
  reason: z.string().trim().max(120).optional().nullable(),
});

export const quickAddEntrySchema = z.object({
  title: z.string().trim().min(1, "Bitte gib einen Titel ein.").max(60),
  date: dateKeySchema,
  startTime: timeSchema,
  durationMinutes: z.number().int().min(5).max(720),
});

export const dayPlanTemplateSchema = z.object({
  name: z.string().trim().min(1, "Bitte gib einen Namen ein.").max(60),
  description: z.string().trim().max(300).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1),
  entries: z
    .array(
      z
        .object({
          title: z.string().trim().min(1).max(60),
          description: z.string().trim().max(300).optional().nullable(),
          startTime: timeSchema,
          endTime: timeSchema,
          category: z.enum(DAYPLAN_CATEGORIES),
          priority: z.enum(DAYPLAN_PRIORITIES),
          color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          icon: z.string().min(1),
          location: z.string().trim().max(120).optional().nullable(),
          link: z.string().trim().max(500).optional().nullable(),
          notes: z.string().trim().max(1000).optional().nullable(),
          reminderMinutes: z.number().int().min(0).max(1440).optional().nullable(),
        })
        // Templates have no absolute date, so endTime <= startTime means "ends the next
        // day" (see templateEntryEndsNextDay in dayplan-service.ts) -- only exact equality
        // (zero/negative duration either way) is actually invalid here.
        .refine((d) => d.startTime !== d.endTime, { message: "Start- und Endzeit dürfen nicht identisch sein.", path: ["endTime"] })
    )
    .max(50),
});

export const applyTemplateSchema = z
  .object({
    startDate: dateKeySchema,
    endDate: dateKeySchema.optional(),
    recurrenceType: z.enum(DAYPLAN_RECURRENCE_TYPES).default("SINGLE_DAY"),
    recurrenceDays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
    path: ["endDate"],
  });

export const dayReviewSchema = z.object({
  date: dateKeySchema,
  mood: z.enum(["GREAT", "GOOD", "OKAY", "HARD", "BAD"]).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

// ---------- Held (hero) ----------

export const heroCharacterSchema = z.object({
  heroName: z.string().trim().max(24).optional().nullable(),
  characterType: z.enum(["MALE", "FEMALE"]),
  skinTone: z.enum(["very-light", "light", "medium", "dark", "very-dark"]),
  hairColor: z.enum(["black", "brown", "blonde", "red", "gray", "purple"]),
  hairStyle: z.enum(["kurz", "lang"]),
});

export const heroPetSelectSchema = z.object({
  species: z.enum(["WOLF", "SNAKE", "LION", "TIGER", "BEAR", "EAGLE", "PANTHER"]),
});

export const heroItemActionSchema = z.object({
  itemId: z.string().min(1),
});
