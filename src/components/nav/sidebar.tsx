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
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-[#EAF7FC] bg-white z-40">
      <div className="flex items-center gap-2 px-5 h-16 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-[#4FA8D8] flex items-center justify-center shadow-[var(--shadow-blue-sm)]">
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
              aria-current={active ? "page" : undefined}
              className={clsx(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-[var(--ease-out-soft)]",
                active
                  ? "bg-[#EAF7FC] text-[#183B56] shadow-[inset_0_0_0_1px_rgba(79,168,216,0.25),var(--shadow-blue-sm)]"
                  : "text-[#5b7a91] hover:bg-[#F5F7FA] hover:text-[#183B56] hover:translate-x-0.5"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-[#4FA8D8]" />
              )}
              <DynamicIcon
                name={item.icon}
                className={clsx(
                  "h-4.5 w-4.5 transition-transform duration-200",
                  active ? "text-[#4FA8D8]" : "group-hover:scale-110"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-3 px-3 py-2.5 mx-3 mb-4 rounded-xl text-sm font-medium text-[#5b7a91] hover:bg-[#FFF0EE] hover:text-[#FF8A80] transition-colors duration-200"
      >
        <LogOut className="h-4.5 w-4.5" />
        Abmelden
      </button>
    </aside>
  );
}
