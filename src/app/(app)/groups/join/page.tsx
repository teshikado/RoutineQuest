"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Users } from "lucide-react";

function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function join(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Beitritt fehlgeschlagen.");
      return;
    }
    router.push(`/groups/${data.groupId}`);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time auto-submit from the ?code= query param on mount
    if (searchParams.get("code")) join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-sm mx-auto mt-10">
      <Card>
        <div className="text-center mb-4">
          <div className="h-12 w-12 rounded-full bg-[#171720] flex items-center justify-center mx-auto mb-3">
            <Users className="h-6 w-6 text-[#A855F7]" />
          </div>
          <h1 className="text-xl font-bold text-[#F8F7FC]">Gruppe beitreten</h1>
        </div>
        <form onSubmit={join} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="code">Einladungscode</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Beitreten…" : "Beitreten"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinPageInner />
    </Suspense>
  );
}
