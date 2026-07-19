import { Sparkles } from "lucide-react";
import { DownloadWindowsCard } from "@/components/download-windows-card";
import { Reveal } from "@/components/ui/reveal";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#A7D8F0] to-[#EAF7FC] px-4 py-10">
      <div
        className="pointer-events-none absolute -top-24 -right-16 h-80 w-80 rounded-full opacity-40 blur-3xl animate-soft-drift"
        style={{ background: "radial-gradient(circle, #FFFFFF 0%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full opacity-30 blur-3xl animate-soft-drift"
        style={{ background: "radial-gradient(circle, #78D6B0 0%, transparent 70%)", animationDelay: "2s" }}
        aria-hidden="true"
      />

      <Reveal direction="scale" className="flex items-center gap-2 mb-8">
        <div className="h-10 w-10 rounded-xl bg-[#4FA8D8] flex items-center justify-center shadow-[var(--shadow-blue)]">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-xl font-extrabold text-[#183B56] leading-none">RoutineQuest</div>
          <div className="text-xs text-[#4FA8D8] font-medium">
            Routine aufbauen. XP sammeln. Gemeinsam aufsteigen.
          </div>
        </div>
      </Reveal>

      <Reveal direction="scale" delay={0.08} className="w-full max-w-sm rounded-2xl bg-white shadow-[var(--shadow-xl)] p-7">
        {children}
      </Reveal>

      <Reveal delay={0.16}>
        <DownloadWindowsCard className="mt-6" />
      </Reveal>
    </div>
  );
}
