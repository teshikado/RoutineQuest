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
  Plus,
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
import { ProgressBar } from "@/components/ui/progress-bar";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicIcon } from "@/components/ui/icon";
import { GroupForm, type GroupFormValues } from "@/components/groups/group-form";
import { ChallengeForm, type ChallengeFormValues } from "@/components/groups/challenge-form";
import { useToast } from "@/components/toast";
import type { GroupDetail } from "@/lib/group-data";

type ChallengeData = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  target: number;
  progress: number;
  ratio: number;
  completed: boolean;
  startDate: string;
  endDate: string;
};

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  TASKS_COUNT: "Aufgaben gemeinsam erledigt",
  STREAK_DAYS: "Tage in Folge aktiv",
  XP_TOTAL: "Gemeinsame XP gesammelt",
  PERFECT_WEEK: "Mitglieder mit perfekter Woche",
};

const ROLE_LABELS: Record<string, string> = { OWNER: "Besitzer", ADMIN: "Admin", MEMBER: "Mitglied" };

export function GroupDetailClient({ group, challenges }: { group: GroupDetail; challenges: ChallengeData[] }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [members, setMembers] = useState(group.members);
  const [inviteCode, setInviteCode] = useState(group.activeInviteCode);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
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

  async function handleCreateChallenge(values: ChallengeFormValues) {
    const res = await fetch(`/api/groups/${group.id}/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, target: Number(values.target) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Challenge konnte nicht erstellt werden.");
    showToast("Challenge gestartet!", "success");
    setChallengeOpen(false);
    router.refresh();
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
              <h1 className="text-xl font-extrabold text-[#183B56]">{group.name}</h1>
              <span className="flex items-center gap-1 text-xs text-[#5b7a91] bg-[#F5F7FA] rounded-full px-2 py-0.5">
                {group.isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {group.isPrivate ? "Privat" : "Öffentlich"}
              </span>
            </div>
            {group.description && <p className="text-sm text-[#5b7a91] mt-1">{group.description}</p>}
            <p className="text-xs text-[#9db3c2] mt-1">
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
            <code className="rounded-lg bg-[#F5F7FA] px-3 py-2 text-sm font-mono font-bold text-[#183B56]">
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
            <li key={m.userId} className="flex items-center gap-3 py-2 border-b border-[#F5F7FA] last:border-b-0">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: m.avatarColor + "33" }}
              >
                {m.avatarEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#183B56] truncate flex items-center gap-1.5">
                  {m.username}
                  <span className="text-[10px] font-bold text-[#9db3c2] bg-[#F5F7FA] rounded-full px-1.5 py-0.5">
                    {ROLE_LABELS[m.role]}
                  </span>
                </div>
                <div className="text-xs text-[#5b7a91] flex items-center gap-1">
                  <DynamicIcon name={m.rankIcon} className="h-3 w-3" style={{ color: m.rankColor }} />
                  Level {m.level} · {m.rankName}
                </div>
              </div>
              {isOwner && m.userId !== group.myUserId && m.role !== "OWNER" && (
                <button
                  onClick={() => handleRoleChange(m.userId, m.role === "ADMIN" ? "MEMBER" : "ADMIN")}
                  title={m.role === "ADMIN" ? "Adminrechte entziehen" : "Zum Admin ernennen"}
                  className="p-2 rounded-lg text-[#5b7a91] hover:bg-[#EAF7FC] hover:text-[#4FA8D8]"
                >
                  {m.role === "ADMIN" ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </button>
              )}
              {canManage && m.userId !== group.myUserId && m.role !== "OWNER" && (
                <button
                  onClick={() => setRemoveTarget(m)}
                  title="Entfernen"
                  className="p-2 rounded-lg text-[#5b7a91] hover:bg-[#FFF0EE] hover:text-[#FF8A80]"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>Gruppen-Challenges</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setChallengeOpen(true)}>
              <Plus className="h-4 w-4" /> Challenge starten
            </Button>
          )}
        </div>
        {challenges.length === 0 ? (
          <EmptyState
            icon="Trophy"
            title="Noch keine Challenge"
            description="Startet gemeinsam eine Challenge, um euch gegenseitig zu motivieren."
          />
        ) : (
          <div className="space-y-4">
            {challenges.map((c) => (
              <div key={c.id} className="rounded-xl border border-[#EAF7FC] p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[#183B56]">{c.title}</span>
                  {c.completed && (
                    <span className="text-xs font-bold text-white bg-[#78D6B0] rounded-full px-2.5 py-1">
                      Abgeschlossen
                    </span>
                  )}
                </div>
                {c.description && <p className="text-xs text-[#5b7a91] mb-2">{c.description}</p>}
                <ProgressBar ratio={c.ratio} colorClass={c.completed ? "bg-[#78D6B0]" : "bg-[#4FA8D8]"} />
                <div className="flex justify-between text-xs text-[#5b7a91] mt-1.5">
                  <span>{CHALLENGE_TYPE_LABELS[c.type]}</span>
                  <span className="font-semibold">
                    {c.progress} / {c.target}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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

      <Modal open={challengeOpen} onClose={() => setChallengeOpen(false)} title="Neue Challenge">
        <ChallengeForm onSubmit={handleCreateChallenge} onCancel={() => setChallengeOpen(false)} />
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
