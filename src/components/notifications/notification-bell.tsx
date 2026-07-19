"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${Math.floor(hours / 24)} Tg.`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + polling data-loading pattern
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    setUnreadCount(0);
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Benachrichtigungen"
        className="relative h-9 w-9 rounded-full flex items-center justify-center text-[#5b7a91] hover:bg-[#EAF7FC] transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#FF8A80]" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl bg-white shadow-xl border border-[#EAF7FC] z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EAF7FC]">
              <span className="font-bold text-sm text-[#183B56]">Benachrichtigungen</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-[#4FA8D8] font-semibold hover:underline">
                  Alle als gelesen markieren
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-[#5b7a91] px-4 py-8 text-center">Noch keine Benachrichtigungen.</p>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={clsx(
                      "px-4 py-3 border-b border-[#F5F7FA] last:border-b-0",
                      !n.read && "bg-[#EAF7FC]/50"
                    )}
                  >
                    <div className="text-sm font-semibold text-[#183B56]">{n.title}</div>
                    <div className="text-xs text-[#5b7a91] mt-0.5">{n.body}</div>
                    <div className="text-[10px] text-[#9db3c2] mt-1">{timeAgo(n.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
