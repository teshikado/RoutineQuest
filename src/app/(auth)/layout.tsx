import { Sparkles } from "lucide-react";
import { DownloadWindowsCard } from "@/components/download-windows-card";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#A7D8F0] to-[#EAF7FC] px-4 py-10">
      <div className="flex items-center gap-2 mb-8">
        <div className="h-10 w-10 rounded-xl bg-[#4FA8D8] flex items-center justify-center shadow-sm">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-xl font-extrabold text-[#183B56] leading-none">RoutineQuest</div>
          <div className="text-xs text-[#4FA8D8] font-medium">
            Routine aufbauen. XP sammeln. Gemeinsam aufsteigen.
          </div>
        </div>
      </div>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-7">{children}</div>
      <DownloadWindowsCard className="mt-6" />
    </div>
  );
}
