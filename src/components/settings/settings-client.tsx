"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { DownloadAppSection } from "@/components/download-app-card";
import { useToast } from "@/components/toast";

type NotificationSetting = { type: string; label: string; description: string; enabled: boolean };

function NotificationSettings() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<NotificationSetting[] | null>(null);

  useEffect(() => {
    fetch("/api/notifications/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  async function toggle(type: string, enabled: boolean) {
    setSettings((prev) => prev!.map((s) => (s.type === type ? { ...s, enabled } : s)));
    await fetch("/api/notifications/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, enabled }),
    });
    showToast(enabled ? "Benachrichtigung aktiviert." : "Benachrichtigung deaktiviert.", "info");
  }

  if (!settings) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#171720]">
      {settings.map((s) => (
        <li key={s.type} className="flex items-center justify-between py-3 gap-4">
          <div>
            <div className="text-sm font-semibold text-[#F8F7FC]">{s.label}</div>
            <div className="text-xs text-[#C8C5D2]">{s.description}</div>
          </div>
          <button
            role="switch"
            aria-checked={s.enabled}
            aria-label={s.label}
            onClick={() => toggle(s.type, !s.enabled)}
            className={`relative h-6 w-11 rounded-full shrink-0 transition-colors ${
              s.enabled ? "bg-[#A855F7]" : "bg-[#292936]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                s.enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

function DayPlanningXpSetting() {
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/settings/dayplanning")
      .then((r) => r.json())
      .then((d) => setEnabled(d.xpForDayPlanning));
  }, []);

  async function toggle(next: boolean) {
    setEnabled(next);
    await fetch("/api/settings/dayplanning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xpForDayPlanning: next }),
    });
    showToast(next ? "XP für Tagesplanung aktiviert." : "XP für Tagesplanung deaktiviert.", "info");
  }

  if (enabled === null) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold text-[#F8F7FC]">XP für Tagesplanung aktivieren</div>
        <div className="text-xs text-[#C8C5D2]">
          Standardmäßig geben Tagesplan-Einträge keine XP. Bei Aktivierung geben eigenständige Zeitblöcke (ohne
          Routinen-Verknüpfung) beim Abhaken etwas XP. Mit einer Routine verbundene Einträge geben ihre XP weiterhin
          nur einmal über die Routine.
        </div>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label="XP für Tagesplanung"
        onClick={() => toggle(!enabled)}
        className={`relative h-6 w-11 rounded-full shrink-0 transition-colors ${enabled ? "bg-[#A855F7]" : "bg-[#292936]"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function PasswordSettings() {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Passwort konnte nicht geändert werden.");
      return;
    }
    showToast("Passwort geändert!", "success");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-sm" noValidate>
      <div>
        <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="newPassword">Neues Passwort</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={loading}>
        {loading ? "Wird gespeichert…" : "Passwort ändern"}
      </Button>
    </form>
  );
}

export function SettingsClient({ appVersion }: { appVersion: string }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-[#F8F7FC]">Einstellungen</h1>
        <p className="text-[#C8C5D2] mt-1">Verwalte dein Konto und deine Benachrichtigungen.</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Download className="h-4 w-4 text-[#A855F7]" />
          <CardTitle>Desktop-App</CardTitle>
        </div>
        <CardSubtitle className="mb-4">
          RoutineQuest gibt es auch als natives Programm für Windows und macOS (Apple Silicon &amp; Intel). Die
          Desktop-App lädt dieselbe RoutineQuest-Web-App wie hier im Browser — dafür wird eine Internetverbindung
          benötigt.
        </CardSubtitle>
        <DownloadAppSection />
        <p className="text-xs text-[#8D8998] mt-4">
          Aktuelle Version: <span className="text-[#C8C5D2] font-semibold">v{appVersion}</span> ·{" "}
          <a
            href="https://github.com/teshikado/RoutineQuest/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#A855F7] font-semibold hover:underline"
          >
            Versionshinweise ansehen
          </a>
        </p>
      </Card>

      <Card>
        <CardTitle>Benachrichtigungen</CardTitle>
        <CardSubtitle className="mb-2">Aktiviere oder deaktiviere einzelne Benachrichtigungsarten.</CardSubtitle>
        <NotificationSettings />
      </Card>

      <Card>
        <CardTitle className="mb-1">Tagesplanung</CardTitle>
        <CardSubtitle className="mb-4">Steuere, ob Tagesplan-Einträge zusätzlich XP geben.</CardSubtitle>
        <DayPlanningXpSetting />
      </Card>

      <Card>
        <CardTitle className="mb-1">Passwort ändern</CardTitle>
        <CardSubtitle className="mb-4">Wähle ein sicheres, einzigartiges Passwort.</CardSubtitle>
        <PasswordSettings />
      </Card>

      <Card>
        <CardTitle className="mb-1">Datenschutz</CardTitle>
        <CardSubtitle>
          Deine Routinen und deren Details sind immer privat. In Gruppen werden ausschließlich aggregierte
          Fortschrittswerte (XP, erledigte Aufgaben, Erfolgsquote, Streak, Level) geteilt – niemals Titel oder
          Beschreibungen deiner Routinen.
        </CardSubtitle>
        <CardSubtitle className="mt-3">
          Deine Tagesplanung (Zeitblöcke, Uhrzeiten, Orte, Notizen, Erinnerungen und deine private Tagesbewertung)
          ist ausschließlich für dich sichtbar und wird nie mit anderen Nutzern oder Gruppenmitgliedern geteilt. Nur
          wenn du einen Zeitblock ausdrücklich mit einer Gruppenroutine verbindest, fließt dessen Erledigung wie
          gewohnt in den gemeinsamen Gruppenfortschritt ein — dein Zeitplan selbst bleibt dabei privat. Tagesplan-Daten
          werden wie deine übrigen Kontodaten gespeichert und bei einer Kontolöschung mitgelöscht.
        </CardSubtitle>
        <CardSubtitle className="mt-3">
          Dein Held (Charaktertyp, Heldenname, Aussehen, Inventar, Ausrüstung, Haustier samt Entwicklungsstufe,
          Fleischbestand, Fleischtransaktionen, Fütterungsverlauf und Levelbelohnungen) ist ebenfalls ausschließlich
          für dich sichtbar und wird nicht automatisch mit anderen Nutzern oder Gruppenmitgliedern geteilt.
        </CardSubtitle>
        <CardSubtitle className="mt-3">
          Die vollständige Datenschutzerklärung findest du unter{" "}
          <Link href="/datenschutz" className="text-[#A855F7] font-semibold hover:underline">
            /datenschutz
          </Link>
          .
        </CardSubtitle>
      </Card>
    </div>
  );
}
