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

export const groupRoutineSchema = z
  .object({
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
  })
  .refine((data) => data.goalType !== "WEEKLY" || (data.goalTarget ?? 0) > 0, {
    message: "Bitte gib eine Zielzahl für das Wochenziel an.",
    path: ["goalTarget"],
  });

export const participationResponseSchema = z.object({
  decision: z.enum(["JOIN", "DECLINE", "LATER"]),
});

export const challengeSchema = z.object({
  title: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional().nullable(),
  type: z.enum(["TASKS_COUNT", "STREAK_DAYS", "XP_TOTAL", "PERFECT_WEEK"]),
  target: z.number().int().min(1),
  startDate: z.string(),
  endDate: z.string(),
});
