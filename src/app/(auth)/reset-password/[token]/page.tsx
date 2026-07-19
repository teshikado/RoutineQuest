"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Zurücksetzen fehlgeschlagen.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="h-14 w-14 rounded-full bg-[#EAF7FC] flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-7 w-7 text-[#78D6B0]" />
        </div>
        <h1 className="text-xl font-bold text-[#183B56] mb-2">Passwort geändert</h1>
        <p className="text-sm text-[#5b7a91]">Du wirst zur Anmeldung weitergeleitet…</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-[#183B56] mb-1">Neues Passwort</h1>
      <p className="text-sm text-[#5b7a91] mb-6">Wähle ein neues, sicheres Passwort.</p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="password">Neues Passwort</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div>
          <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Wird gespeichert…" : "Passwort speichern"}
        </Button>
      </form>
      <p className="text-sm text-center text-[#5b7a91] mt-6">
        <Link href="/login" className="text-[#4FA8D8] font-semibold hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </>
  );
}
