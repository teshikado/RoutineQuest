"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, LogIn, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Label, FieldError } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicIcon } from "@/components/ui/icon";
import { GroupForm, type GroupFormValues } from "@/components/groups/group-form";
import { useToast } from "@/components/toast";

type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  memberCount: number;
  role: string;
  isPrivate: boolean;
};

function JoinGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
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
    showToast(`Du bist "${data.groupName}" beigetreten!`, "success");
    onClose();
    router.push(`/groups/${data.groupId}`);
  }

  return (
    <Modal open={open} onClose={onClose} title="Gruppe beitreten">
      <form onSubmit={handleJoin} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="code">Einladungscode</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="z. B. AB3C7XQ9"
            required
          />
        </div>
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Beitreten…" : "Beitreten"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function GroupsClient({ initialGroups }: { initialGroups: GroupSummary[] }) {
  const { showToast } = useToast();
  const router = useRouter();
  const [groups] = useState(initialGroups);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  async function handleCreate(values: GroupFormValues) {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        description: values.description || null,
        icon: values.icon,
        color: values.color,
        maxMembers: values.maxMembers ? Number(values.maxMembers) : null,
        isPrivate: values.isPrivate,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Gruppe konnte nicht erstellt werden.");
    showToast("Gruppe erstellt!", "success");
    setCreateOpen(false);
    router.push(`/groups/${data.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#183B56]">Gruppen</h1>
          <p className="text-[#5b7a91] mt-1">Baut gemeinsam Routinen auf und feiert Fortschritte.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setJoinOpen(true)}>
            <LogIn className="h-4 w-4" /> Beitreten
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Neue Gruppe
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon="Users"
          title="Noch keine Gruppen"
          description="Erstelle eine eigene Gruppe oder tritt einer bestehenden Gruppe mit einem Einladungscode bei."
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setJoinOpen(true)}>
                Beitreten
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Erstellen
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-2">
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: g.color + "22" }}
                  >
                    <DynamicIcon name={g.icon} className="h-5 w-5" style={{ color: g.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#183B56] truncate">{g.name}</div>
                    <div className="text-xs text-[#5b7a91] flex items-center gap-1">
                      {g.isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                      {g.memberCount} Mitglieder · {g.role === "OWNER" ? "Besitzer" : g.role === "ADMIN" ? "Admin" : "Mitglied"}
                    </div>
                  </div>
                </div>
                {g.description && <p className="text-sm text-[#5b7a91] line-clamp-2">{g.description}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Neue Gruppe erstellen">
        <GroupForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} />
      </Modal>

      <JoinGroupModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}
