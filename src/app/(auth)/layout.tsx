import Image from "next/image";
import { DownloadAppSection } from "@/components/download-app-card";
import { Reveal } from "@/components/ui/reveal";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#050507] px-4 py-10">
      <div
        className="pointer-events-none absolute -top-24 -right-16 h-96 w-96 rounded-full opacity-50 blur-3xl animate-soft-drift"
        style={{ background: "radial-gradient(circle, #A855F7 0%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full opacity-35 blur-3xl animate-soft-drift"
        style={{ background: "radial-gradient(circle, #C026FF 0%, transparent 70%)", animationDelay: "2s" }}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-40" aria-hidden="true" />

      <Reveal direction="scale" className="relative flex flex-col items-center gap-2 mb-8">
        <Image
          src="/logo/logo-mark.png"
          alt="RoutineQuest"
          width={88}
          height={66}
          className="animate-logo-pulse"
          priority
        />
        <div className="text-center">
          <div className="text-xl font-extrabold text-[#F8F7FC] leading-none">RoutineQuest</div>
          <div className="text-xs text-[#D8B4FE] font-medium mt-1.5">
            Routine aufbauen. XP sammeln. Gemeinsam aufsteigen.
          </div>
        </div>
      </Reveal>

      <Reveal
        direction="scale"
        delay={0.08}
        className="relative w-full max-w-sm rounded-2xl bg-[#111118] border border-[#292936] shadow-[var(--shadow-xl)] p-7"
      >
        {children}
      </Reveal>

      <Reveal delay={0.16} className="relative mt-6">
        <DownloadAppSection />
      </Reveal>
    </div>
  );
}
