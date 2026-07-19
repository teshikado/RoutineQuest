"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { DynamicIcon } from "@/components/ui/icon";
import { MOBILE_NAV_ITEMS } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-surface border-t border-[#292936] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
      <div className="grid grid-cols-5">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] text-[11px] font-medium transition-colors duration-200",
                active ? "text-[#A855F7]" : "text-[#8D8998]"
              )}
            >
              <span
                className={clsx(
                  "absolute top-1 h-1 w-6 rounded-full bg-[#A855F7] transition-all duration-200",
                  active ? "opacity-100 scale-100" : "opacity-0 scale-50"
                )}
              />
              <DynamicIcon name={item.icon} className={clsx("h-5 w-5 transition-transform duration-200", active && "scale-110")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
