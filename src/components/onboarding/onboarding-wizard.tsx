"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import clsx from "clsx";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { DynamicIcon } from "@/components/ui/icon";
import { RoutineForm, type RoutineFormValues } from "@/components/routines/routine-form";
import { CATEGORY_META, DIFFICULTY_META } from "@/lib/constants";

const AVATAR_EMOJIS = ["🙂", "😄", "🚀", "🔥", "🌟", "🐱", "🐶", "🦉", "🌸", "🍀", "⚡", "🎯"];
const AVATAR_COLORS = ["#A855F7", "#34D399", "#FACC15", "#FB7185", "#A78BFA", "#F472B6"];

type Routine = { id: string; title: string; category: string; icon: string; color: string; difficulty: string };

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const [username, setUsername] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState(AVATAR_EMOJIS[0]);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showRoutineForm, setShowRoutineForm] = useState(true);

  const checkUsername = useCallback(async (value: string) => {
    if (value.trim().length < 3) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`);
    const data = await res.json();
    setUsernameStatus(data.available ? "available" : data.error ? "invalid" : "taken");
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (username) checkUsername(username);
      else setUsernameStatus("idle");
    }, 400);
    return () => clearTimeout(handle);
  }, [username, checkUsername]);

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (usernameStatus !== "available") {
      setError("Bitte wähle einen verfügbaren Benutzernamen.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, avatarEmoji, avatarColor }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Etwas ist schiefgelaufen.");
      return;
    }
    setStep(2);
  }

  async function addRoutine(values: RoutineFormValues) {
    const res = await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        description: values.description || null,
        timeOfDay: values.timeOfDay || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Routine konnte nicht erstellt werden.");
    }
    const routine = await res.json();
    setRoutines((r) => [...r, routine]);
    setShowRoutineForm(false);
  }

  async function removeRoutine(id: string) {
    await fetch(`/api/routines/${id}`, { method: "DELETE" });
    setRoutines((r) => r.filter((rt) => rt.id !== id));
  }

  return (
    <div className="w-full max-w-lg rounded-2xl bg-[#111118] shadow-xl p-7">
      <div className="flex items-center gap-2.5 mb-6">
        <Image
          src="/logo/logo-mark-sm.png"
          alt="RoutineQuest"
          width={32}
          height={24}
          style={{ filter: "drop-shadow(0 0 6px rgba(168,85,247,0.5))" }}
        />
        <div className="text-lg font-extrabold text-[#F8F7FC]">RoutineQuest</div>
        <div className="ml-auto flex gap-1.5">
          <div className={clsx("h-1.5 w-6 rounded-full", step >= 1 ? "bg-[#A855F7]" : "bg-[#171720]")} />
          <div className={clsx("h-1.5 w-6 rounded-full", step >= 2 ? "bg-[#A855F7]" : "bg-[#171720]")} />
        </div>
      </div>

      {step === 1 && (
        <>
          <h1 className="text-xl font-bold text-[#F8F7FC] mb-1">Willkommen! Wie sollen wir dich nennen?</h1>
          <p className="text-sm text-[#C8C5D2] mb-6">Wähle einen eindeutigen Benutzernamen und einen Avatar.</p>

          <form onSubmit={submitProfile} className="space-y-5" noValidate>
            <div className="flex justify-center">
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center text-4xl shadow-inner"
                style={{ backgroundColor: avatarColor + "33" }}
              >
                {avatarEmoji}
              </div>
            </div>

            <div>
              <Label>Avatar</Label>
              <div className="flex flex-wrap gap-2 justify-center mb-3">
                {AVATAR_EMOJIS.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => setAvatarEmoji(emoji)}
                    aria-pressed={avatarEmoji === emoji}
                    className={clsx(
                      "h-10 w-10 rounded-full flex items-center justify-center text-xl border-2 transition-transform",
                      avatarEmoji === emoji ? "border-[#A855F7] scale-110" : "border-transparent bg-[#171720]"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                {AVATAR_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => setAvatarColor(color)}
                    aria-label={`Farbe ${color}`}
                    aria-pressed={avatarColor === color}
                    className={clsx(
                      "h-7 w-7 rounded-full border-2 transition-transform",
                      avatarColor === color ? "border-[#F8F7FC] scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="username">Benutzername</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="z. B. alex_routine"
                required
              />
              {usernameStatus === "checking" && (
                <p className="text-xs text-[#C8C5D2] mt-1.5">Verfügbarkeit wird geprüft…</p>
              )}
              {usernameStatus === "available" && (
                <p className="text-xs text-[#34D399] mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verfügbar
                </p>
              )}
              {usernameStatus === "taken" && (
                <p className="text-xs text-[#FB7185] mt-1.5">Dieser Benutzername ist bereits vergeben.</p>
              )}
              {usernameStatus === "invalid" && username.length > 0 && (
                <p className="text-xs text-[#FB7185] mt-1.5">
                  Mindestens 3 Zeichen, nur Buchstaben, Zahlen und Unterstriche.
                </p>
              )}
            </div>

            <FieldError>{error}</FieldError>

            <Button type="submit" className="w-full" disabled={loading || usernameStatus !== "available"}>
              {loading ? "Wird gespeichert…" : "Weiter"}
            </Button>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-xl font-bold text-[#F8F7FC] mb-1">Erstelle deine erste Routine</h1>
          <p className="text-sm text-[#C8C5D2] mb-6">
            Lege mindestens eine wiederkehrende Aufgabe an. Du kannst später jederzeit weitere hinzufügen.
          </p>

          {routines.length > 0 && (
            <ul className="space-y-2 mb-4">
              {routines.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-[#292936] p-3"
                >
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: r.color + "22" }}
                  >
                    <DynamicIcon name={r.icon} className="h-4 w-4" style={{ color: r.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#F8F7FC] truncate">{r.title}</div>
                    <div className="text-xs text-[#C8C5D2]">
                      {CATEGORY_META[r.category as keyof typeof CATEGORY_META]?.label} ·{" "}
                      {DIFFICULTY_META[r.difficulty as keyof typeof DIFFICULTY_META]?.label}
                    </div>
                  </div>
                  <button
                    onClick={() => removeRoutine(r.id)}
                    aria-label="Entfernen"
                    className="text-[#C8C5D2] hover:text-[#FB7185] p-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showRoutineForm ? (
            <RoutineForm onSubmit={addRoutine} submitLabel="Routine hinzufügen" />
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setShowRoutineForm(true)}>
              Weitere Routine hinzufügen
            </Button>
          )}

          <Button
            className="w-full mt-4"
            disabled={routines.length === 0}
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
          >
            Fertig – zum Dashboard
          </Button>
        </>
      )}
    </div>
  );
}
