"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { DynamicIcon } from "@/components/ui/icon";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-[#292936] bg-[#050507] z-40">
      <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
        <Image
          src="/logo/logo-mark-sm.png"
          alt="RoutineQuest"
          width={30}
          height={23}
          className="shrink-0"
          style={{ filter: "drop-shadow(0 0 6px rgba(168,85,247,0.5))" }}
          priority
        />
        <span className="font-extrabold text-[#F8F7FC]">RoutineQuest</span>
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
                  ? "bg-[#171720] text-[#F8F7FC] shadow-[inset_0_0_0_1px_rgba(168,85,247,0.3),var(--shadow-purple-sm)]"
                  : "text-[#C8C5D2] hover:bg-[#171720] hover:text-[#F8F7FC] hover:translate-x-0.5"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-[#A855F7]" />
              )}
              <DynamicIcon
                name={item.icon}
                className={clsx(
                  "h-4.5 w-4.5 transition-transform duration-200",
                  active ? "text-[#A855F7]" : "group-hover:scale-110"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-3 px-3 py-2.5 mx-3 mb-4 rounded-xl text-sm font-medium text-[#C8C5D2] hover:bg-[#2A1219] hover:text-[#FB7185] transition-colors duration-200"
      >
        <LogOut className="h-4.5 w-4.5" />
        Abmelden
      </button>
    </aside>
  );
}
