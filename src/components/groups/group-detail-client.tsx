"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy,
  RefreshCw,
  Pencil,
  Trash2,
  UserMinus,
  ShieldCheck,
  ShieldOff,
  LogOut,
  Trophy,
  Send,
  Lock,
  Globe,
  ListChecks,
} from "lucide-react";
import { Card, CardTitle, CardSubtitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { DynamicIcon } from "@/components/ui/icon";
import { GroupForm, type GroupFormValues } from "@/components/groups/group-form";
import { useToast } from "@/components/toast";
import type { GroupDetail } from "@/lib/group-data";

const ROLE_LABELS: Record<string, string> = { OWNER: "Besitzer", ADMIN: "Admin", MEMBER: "Mitglied" };

export function GroupDetailClient({ group }: { group: GroupDetail }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [members, setMembers] = useState(group.members);
  const [inviteCode, setInviteCode] = useState(group.activeInviteCode);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState("");
  const [removeTarget, setRemoveTarget] = useState<(typeof members)[number] | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const canManage = group.myRole === "OWNER" || group.myRole === "ADMIN";
  const isOwner = group.myRole === "OWNER";
  const joinUrl =
    typeof window !== "undefined" && inviteCode
      ? `${window.location.origin}/groups/join?code=${inviteCode}`
      : "";

  async function refreshInviteCode() {
    const res = await fetch(`/api/groups/${group.id}/invite`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setInviteCode(data.code);
      showToast("Neuer Einladungscode erstellt.", "success");
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(joinUrl);
    showToast("Link kopiert!", "success");
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteTarget.trim()) return;
    const isEmail = inviteTarget.includes("@");
    const res = await fetch(`/api/groups/${group.id}/invite/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEmail ? { email: inviteTarget } : { username: inviteTarget }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Einladung fehlgeschlagen.", "error");
      return;
    }
    showToast("Einladung gesendet!", "success");
    setInviteTarget("");
  }

  async function handleEditGroup(values: GroupFormValues) {
    const res = await fetch(`/api/groups/${group.id}`, {
      method: "PATCH",
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
    if (!res.ok) throw new Error(data.error ?? "Aktualisierung fehlgeschlagen.");
    showToast("Gruppe aktualisiert!", "success");
    setEditOpen(false);
    router.refresh();
  }

  async function handleDeleteGroup() {
    const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Gruppe gelöscht.", "success");
      router.push("/groups");
    } else {
      showToast("Löschen fehlgeschlagen.", "error");
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) return;
    const res = await fetch(`/api/groups/${group.id}/members/${removeTarget.userId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((m) => m.filter((x) => x.userId !== removeTarget.userId));
      showToast("Mitglied entfernt.", "success");
      setRemoveTarget(null);
    } else {
      showToast("Entfernen fehlgeschlagen.", "error");
    }
  }

  async function handleLeaveGroup() {
    const res = await fetch(`/api/groups/${group.id}/members/${group.myUserId}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Du hast die Gruppe verlassen.", "success");
      router.push("/groups");
    } else {
      showToast("Verlassen fehlgeschlagen.", "error");
    }
  }

  async function handleRoleChange(userId: string, role: "ADMIN" | "MEMBER") {
    const res = await fetch(`/api/groups/${group.id}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setMembers((m) => m.map((x) => (x.userId === userId ? { ...x, role } : x)));
      showToast(role === "ADMIN" ? "Zum Administrator ernannt." : "Administratorrechte entzogen.", "success");
    } else {
      showToast("Aktion fehlgeschlagen.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: group.color + "22" }}
          >
            <DynamicIcon name={group.icon} className="h-7 w-7" style={{ color: group.color }} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-[#F8F7FC]">{group.name}</h1>
              <span className="flex items-center gap-1 text-xs text-[#C8C5D2] bg-[#171720] rounded-full px-2 py-0.5">
                {group.isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {group.isPrivate ? "Privat" : "Öffentlich"}
              </span>
            </div>
            {group.description && <p className="text-sm text-[#C8C5D2] mt-1">{group.description}</p>}
            <p className="text-xs text-[#8D8998] mt-1">
              {members.length} Mitglieder{group.maxMembers ? ` / ${group.maxMembers}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/groups/${group.id}/routines`}>
              <Button variant="secondary" size="sm">
                <ListChecks className="h-4 w-4" /> Gruppenroutinen
              </Button>
            </Link>
            <Link href={`/leaderboard?group=${group.id}`}>
              <Button variant="secondary" size="sm">
                <Trophy className="h-4 w-4" /> Rangliste
              </Button>
            </Link>
            {canManage && (
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Bearbeiten
              </Button>
            )}
            {isOwner ? (
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> Löschen
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setLeaveOpen(true)}>
                <LogOut className="h-4 w-4" /> Verlassen
              </Button>
            )}
          </div>
        </div>
      </Card>

      {canManage && (
        <Card>
          <CardTitle>Mitglieder einladen</CardTitle>
          <CardSubtitle className="mb-3">Per Link, Code, Benutzername oder E-Mail.</CardSubtitle>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <code className="rounded-lg bg-[#171720] px-3 py-2 text-sm font-mono font-bold text-[#F8F7FC]">
              {inviteCode}
            </code>
            <Button size="sm" variant="secondary" onClick={copyLink}>
              <Copy className="h-4 w-4" /> Link kopieren
            </Button>
            <Button size="sm" variant="ghost" onClick={refreshInviteCode}>
              <RefreshCw className="h-4 w-4" /> Code erneuern
            </Button>
          </div>
          <form onSubmit={sendInvite} className="flex gap-2 max-w-md">
            <Input
              value={inviteTarget}
              onChange={(e) => setInviteTarget(e.target.value)}
              placeholder="Benutzername oder E-Mail"
            />
            <Button type="submit" size="sm">
              <Send className="h-4 w-4" /> Senden
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle className="mb-3">Mitglieder</CardTitle>
        <ul className="space-y-1">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 py-2 border-b border-[#171720] last:border-b-0">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: m.avatarColor + "33" }}
              >
                {m.avatarEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#F8F7FC] truncate flex items-center gap-1.5">
                  {m.username}
                  <span className="text-[10px] font-bold text-[#8D8998] bg-[#171720] rounded-full px-1.5 py-0.5">
                    {ROLE_LABELS[m.role]}
                  </span>
                </div>
                <div className="text-xs text-[#C8C5D2] flex items-center gap-1">
                  <DynamicIcon name={m.rankIcon} className="h-3 w-3" style={{ color: m.rankColor }} />
                  Level {m.level} · {m.rankName}
                </div>
              </div>
              {isOwner && m.userId !== group.myUserId && m.role !== "OWNER" && (
                <button
                  onClick={() => handleRoleChange(m.userId, m.role === "ADMIN" ? "MEMBER" : "ADMIN")}
                  title={m.role === "ADMIN" ? "Adminrechte entziehen" : "Zum Admin ernennen"}
                  className="p-2 rounded-lg text-[#C8C5D2] hover:bg-[#171720] hover:text-[#A855F7]"
                >
                  {m.role === "ADMIN" ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </button>
              )}
              {canManage && m.userId !== group.myUserId && m.role !== "OWNER" && (
                <button
                  onClick={() => setRemoveTarget(m)}
                  title="Entfernen"
                  className="p-2 rounded-lg text-[#C8C5D2] hover:bg-[#2A1219] hover:text-[#FB7185]"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Gruppe bearbeiten">
        <GroupForm
          onSubmit={handleEditGroup}
          onCancel={() => setEditOpen(false)}
          submitLabel="Speichern"
          initialValues={{
            name: group.name,
            description: group.description ?? "",
            icon: group.icon,
            color: group.color,
            maxMembers: group.maxMembers?.toString() ?? "",
            isPrivate: group.isPrivate,
          }}
        />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteGroup}
        title="Gruppe löschen?"
        description={`"${group.name}" wird für alle Mitglieder endgültig gelöscht.`}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
        title="Mitglied entfernen?"
        description={`"${removeTarget?.username}" wird aus der Gruppe entfernt.`}
      />

      <ConfirmDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={handleLeaveGroup}
        title="Gruppe verlassen?"
        description="Du kannst später über einen Einladungscode wieder beitreten."
        confirmLabel="Verlassen"
      />
    </div>
  );
}
