"use client";

import { useEffect, useState } from "react";
import { Download, Monitor, Apple } from "lucide-react";
import clsx from "clsx";

const WINDOWS_DOWNLOAD_URL =
  "https://github.com/teshikado/RoutineQuest/releases/latest/download/RoutineQuest-Setup.exe";
const MACOS_APPLE_SILICON_URL =
  "https://github.com/teshikado/RoutineQuest/releases/latest/download/RoutineQuest-macOS-Apple-Silicon.dmg";
const MACOS_INTEL_URL =
  "https://github.com/teshikado/RoutineQuest/releases/latest/download/RoutineQuest-macOS-Intel.dmg";

type Platform = "windows" | "macos" | null;

// Best-effort client-side OS hint — never hides an option, only highlights
// one. iPadOS reports "Macintosh" in its user agent since iPadOS 13, so a
// touch-capable "Mac" is treated as ambiguous (no recommendation) rather
// than mislabeled as a Mac desktop.
function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const isTouchMac = /Mac/.test(ua) && navigator.maxTouchPoints > 1;
  if (/Win/.test(ua)) return "windows";
  if (/Mac/.test(ua) && !isTouchMac) return "macos";
  return null;
}

function DownloadButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      aria-label={`${label} — startet den Download`}
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#A855F7] px-3 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#9333EA] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7] focus-visible:ring-offset-2"
    >
      <Download className="h-3.5 w-3.5 shrink-0" />
      {label}
    </a>
  );
}

function CardShell({
  icon,
  title,
  subtitle,
  extraNote,
  recommended,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  extraNote?: string;
  recommended: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "relative w-full rounded-2xl bg-[#111118]/80 backdrop-blur border p-5 text-center transition-all duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1",
        recommended
          ? "border-[#A855F7] shadow-[var(--shadow-purple)]"
          : "border-[#292936] shadow-[var(--shadow-sm)] hover:border-[#3D2A5C] hover:shadow-[var(--shadow-md)]"
      )}
    >
      {recommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#A855F7] px-2.5 py-1 text-[9px] font-bold text-white shadow-[var(--shadow-purple-sm)]">
          Empfohlen für dein Gerät
        </span>
      )}
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {icon}
        <h2 className="text-sm font-bold text-[#F8F7FC]">{title}</h2>
      </div>
      <p className="text-xs text-[#C8C5D2]">{subtitle}</p>
      {extraNote && <p className="text-[11px] text-[#D8B4FE] mt-1 font-medium">{extraNote}</p>}
      <div className="mt-3">{children}</div>
      <p className="text-[11px] text-[#C8C5D2] mt-2">benötigt eine Internetverbindung</p>
    </div>
  );
}

export function DownloadAppSection({ className }: { className?: string }) {
  const [platform, setPlatform] = useState<Platform>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client-only OS detection, not derivable during render/SSR
    setPlatform(detectPlatform());
  }, []);

  return (
    <div className={clsx("w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4", className)}>
      <CardShell
        icon={<Monitor className="h-4 w-4 text-[#A855F7]" />}
        title="RoutineQuest für Windows"
        subtitle="Windows 10 und Windows 11"
        recommended={platform === "windows"}
      >
        <DownloadButton href={WINDOWS_DOWNLOAD_URL} label="Für Windows herunterladen" />
      </CardShell>

      <CardShell
        icon={<Apple className="h-4 w-4 text-[#A855F7]" />}
        title="RoutineQuest für macOS"
        subtitle="Für MacBook und iMac"
        recommended={platform === "macos"}
      >
        <div className="flex flex-col gap-2">
          <DownloadButton href={MACOS_APPLE_SILICON_URL} label="Apple Silicon (M1–M4)" />
          <DownloadButton href={MACOS_INTEL_URL} label="Intel-Mac" />
        </div>
        <p className="text-[10px] text-[#8D8998] mt-2">
          Nicht sicher? Apple-Menü → „Über diesen Mac&rdquo; zeigt den Chip deines Geräts.
        </p>
      </CardShell>
    </div>
  );
}
