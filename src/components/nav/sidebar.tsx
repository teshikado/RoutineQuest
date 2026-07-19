"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Sparkles, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { DynamicIcon } from "@/components/ui/icon";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-[#EAF7FC] bg-white">
      <div className="flex items-center gap-2 px-5 h-16 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-[#4FA8D8] flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="font-extrabold text-[#183B56]">RoutineQuest</span>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[#EAF7FC] text-[#183B56]"
                  : "text-[#5b7a91] hover:bg-[#F5F7FA] hover:text-[#183B56]"
              )}
            >
              <DynamicIcon name={item.icon} className={clsx("h-4.5 w-4.5", active && "text-[#4FA8D8]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-3 px-3 py-2.5 mx-3 mb-4 rounded-xl text-sm font-medium text-[#5b7a91] hover:bg-[#FFF0EE] hover:text-[#FF8A80] transition-colors"
      >
        <LogOut className="h-4.5 w-4.5" />
        Abmelden
      </button>
    </aside>
  );
}
