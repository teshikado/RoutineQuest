import { Download, Monitor } from "lucide-react";
import clsx from "clsx";

const WINDOWS_DOWNLOAD_URL =
  "https://github.com/teshikado/RoutineQuest/releases/latest/download/RoutineQuest-Setup.exe";

export function DownloadWindowsCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "w-full max-w-sm rounded-2xl bg-[#111118]/80 backdrop-blur border border-[#292936] shadow-[var(--shadow-sm)] p-5 text-center",
        className
      )}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <Monitor className="h-4 w-4 text-[#A855F7]" />
        <h2 className="text-sm font-bold text-[#F8F7FC]">RoutineQuest für Windows</h2>
      </div>
      <p className="text-xs text-[#C8C5D2] mb-3">
        RoutineQuest gibt es auch als Windows-Programm für deinen Desktop.
      </p>
      <a
        href={WINDOWS_DOWNLOAD_URL}
        download
        aria-label="RoutineQuest für Windows herunterladen — startet den Download von RoutineQuest-Setup.exe"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#A855F7] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#9333EA] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7] focus-visible:ring-offset-2"
      >
        <Download className="h-4 w-4" />
        Für Windows herunterladen
      </a>
      <p className="text-[11px] text-[#C8C5D2] mt-2">
        Windows 10 und Windows 11 · benötigt eine Internetverbindung
      </p>
    </div>
  );
}
