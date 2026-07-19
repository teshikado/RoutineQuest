"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Pencil, Flame, Award, CheckCircle2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label, FieldError } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicIcon } from "@/components/ui/icon";
import { RankBadge } from "@/components/ui/rank-badge";
import { Reveal, RevealGroup } from "@/components/ui/reveal";
import { useToast } from "@/components/toast";
import { getLevelProgress, getRankForLevel } from "@/lib/xp";

const AVATAR_EMOJIS = ["🙂", "😄", "🚀", "🔥", "🌟", "🐱", "🐶", "🦉", "🌸", "🍀", "⚡", "🎯"];
const AVATAR_COLORS = ["#4FA8D8", "#78D6B0", "#FFD166", "#FF8A80", "#A78BFA", "#F472B6"];

type ProfileUser = {
  email: string;
  username: string;
  avatarEmoji: string;
  avatarColor: string;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
};

type Badge = { id: string; name: string; description: string; icon: string; color: string; earnedAt: string };

function EditProfileModal({
  open,
  onClose,
  user,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: ProfileUser;
  onSaved: (u: ProfileUser) => void;
}) {
  const { showToast } = useToast();
  const [username, setUsername] = useState(user.username);
  const [avatarEmoji, setAvatarEmoji] = useState(user.avatarEmoji);
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkUsername = useCallback(
    async (value: string) => {
      if (value === user.username) {
        setStatus("available");
        return;
      }
      if (value.trim().length < 3) {
        setStatus("invalid");
        return;
      }
      setStatus("checking");
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`);
      const data = await res.json();
      setStatus(data.available ? "available" : data.error ? "invalid" : "taken");
    },
    [user.username]
  );

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => checkUsername(username), 350);
    return () => clearTimeout(handle);
  }, [username, open, checkUsername]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (status !== "available") {
      setError("Bitte wähle einen verfügbaren Benutzernamen.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, avatarEmoji, avatarColor }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Speichern fehlgeschlagen.");
      return;
    }
    showToast("Profil aktualisiert!", "success");
    onSaved({ ...user, username, avatarEmoji, avatarColor });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Profil bearbeiten">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="flex justify-center">
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center text-4xl"
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
                  "h-9 w-9 rounded-full flex items-center justify-center text-lg border-2",
                  avatarEmoji === emoji ? "border-[#4FA8D8] scale-110" : "border-transparent bg-[#F5F7FA]"
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
                aria-pressed={avatarColor === color}
                className={clsx(
                  "h-7 w-7 rounded-full border-2",
                  avatarColor === color ? "border-[#183B56] scale-110" : "border-white"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="username">Benutzername</Label>
          <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          {status === "available" && (
            <p className="text-xs text-[#3fae7f] mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Verfügbar
            </p>
          )}
          {status === "taken" && <p className="text-xs text-[#e2564c] mt-1.5">Bereits vergeben.</p>}
        </div>
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={loading || status !== "available"}>
            {loading ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProfileClient({ user: initialUser, badges }: { user: ProfileUser; badges: Badge[] }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [editOpen, setEditOpen] = useState(false);

  const progress = getLevelProgress(user.totalXp);
  const rank = getRankForLevel(progress.level);

  return (
    <div className="space-y-6 max-w-3xl">
      <Reveal>
        <Card>
          <div className="flex items-center gap-4 flex-wrap">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-4xl shrink-0 shadow-[var(--shadow-sm)]"
              style={{ backgroundColor: user.avatarColor + "33" }}
            >
              {user.avatarEmoji}
            </div>
            <div className="flex-1 min-w-[180px]">
              <h1 className="text-xl font-extrabold text-[#183B56]">{user.username}</h1>
              <p className="text-sm text-[#5b7a91]">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <RankBadge icon={rank.icon} color={rank.color} size="sm" />
                <span className="text-sm font-semibold" style={{ color: rank.color }}>
                  Level {progress.level} · {rank.name}
                </span>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Bearbeiten
            </Button>
          </div>
        </Card>
      </Reveal>

      <RevealGroup className="grid grid-cols-1 sm:grid-cols-2 gap-4" stagger={0.06}>
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-[#183B56]">XP-Fortschritt</span>
            <span className="text-xs font-semibold text-[#5b7a91] tabular-nums">
              {progress.xpIntoLevel} / {progress.xpForNextLevel} XP
            </span>
          </div>
          <ProgressBar ratio={progress.progressRatio} gradient="linear-gradient(90deg, #FFD166, #ffb84d)" shine height="h-3.5" />
          <p className="text-xs text-[#5b7a91] mt-2">Noch {progress.xpRemaining} XP bis Level {progress.level + 1}.</p>
        </Card>
        <Card className="flex items-center gap-4">
          <Flame
            className={clsx("h-9 w-9", user.currentStreak > 0 && "animate-flame")}
            style={{ color: user.currentStreak > 0 ? "#FFD166" : "#c8d6e0" }}
          />
          <div>
            <div className="font-extrabold text-[#183B56] tabular-nums">{user.currentStreak} Tage Streak</div>
            <div className="text-xs text-[#5b7a91]">Rekord: {user.longestStreak} Tage</div>
          </div>
        </Card>
      </RevealGroup>

      <Reveal delay={0.08}>
        <Card>
          <CardTitle className="flex items-center gap-2 mb-3">
            <Award className="h-4 w-4 text-[#D69E22]" /> Abzeichen
          </CardTitle>
          {badges.length === 0 ? (
            <EmptyState
              icon="Award"
              title="Noch keine Abzeichen"
              description="Nimm an Gruppenroutinen teil, um digitale Abzeichen zu sammeln."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col items-center text-center gap-1.5 rounded-xl p-3 bg-[#F5F7FA] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]"
                >
                  <div
                    className="h-11 w-11 rounded-full flex items-center justify-center"
                    style={{ background: `radial-gradient(circle at 32% 28%, ${b.color}55, ${b.color}22 72%)` }}
                  >
                    <DynamicIcon name={b.icon} className="h-5 w-5" style={{ color: b.color }} />
                  </div>
                  <span className="text-xs font-bold text-[#183B56]">{b.name}</span>
                  <span className="text-[10px] text-[#5b7a91]">{b.description}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Reveal>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        user={user}
        onSaved={(u) => {
          setUser(u);
          router.refresh();
        }}
      />
    </div>
  );
}
