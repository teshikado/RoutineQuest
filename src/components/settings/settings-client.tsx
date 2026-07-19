"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
    <ul className="divide-y divide-[#F5F7FA]">
      {settings.map((s) => (
        <li key={s.type} className="flex items-center justify-between py-3 gap-4">
          <div>
            <div className="text-sm font-semibold text-[#183B56]">{s.label}</div>
            <div className="text-xs text-[#5b7a91]">{s.description}</div>
          </div>
          <button
            role="switch"
            aria-checked={s.enabled}
            aria-label={s.label}
            onClick={() => toggle(s.type, !s.enabled)}
            className={`relative h-6 w-11 rounded-full shrink-0 transition-colors ${
              s.enabled ? "bg-[#4FA8D8]" : "bg-[#dbeaf3]"
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

export function SettingsClient() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-[#183B56]">Einstellungen</h1>
        <p className="text-[#5b7a91] mt-1">Verwalte dein Konto und deine Benachrichtigungen.</p>
      </div>

      <Card>
        <CardTitle>Benachrichtigungen</CardTitle>
        <CardSubtitle className="mb-2">Aktiviere oder deaktiviere einzelne Benachrichtigungsarten.</CardSubtitle>
        <NotificationSettings />
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
      </Card>
    </div>
  );
}
