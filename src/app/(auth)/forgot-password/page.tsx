"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="h-14 w-14 rounded-full bg-[#171720] flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-7 w-7 text-[#A855F7]" />
        </div>
        <h1 className="text-xl font-bold text-[#F8F7FC] mb-2">E-Mail unterwegs</h1>
        <p className="text-sm text-[#C8C5D2] mb-6">
          Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link zum Zurücksetzen
          gesendet. Der Link ist eine Stunde gültig.
        </p>
        <Link href="/login" className="text-[#A855F7] font-semibold text-sm hover:underline">
          Zurück zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-[#F8F7FC] mb-1">Passwort vergessen?</h1>
      <p className="text-sm text-[#C8C5D2] mb-6">
        Gib deine E-Mail-Adresse ein, wir senden dir einen Link zum Zurücksetzen.
      </p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Wird gesendet…" : "Link senden"}
        </Button>
      </form>
      <p className="text-sm text-center text-[#C8C5D2] mt-6">
        <Link href="/login" className="text-[#A855F7] font-semibold hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </>
  );
}
