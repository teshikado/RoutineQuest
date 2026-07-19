export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/routines", label: "Meine Routinen", icon: "ListChecks" },
  { href: "/week", label: "Wochenplan", icon: "CalendarDays" },
  { href: "/stats", label: "Statistiken", icon: "BarChart3" },
  { href: "/groups", label: "Gruppen", icon: "Users" },
  { href: "/leaderboard", label: "Rangliste", icon: "Trophy" },
  { href: "/profile", label: "Profil", icon: "UserCircle" },
  { href: "/settings", label: "Einstellungen", icon: "Settings" },
] as const;

export const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: "LayoutDashboard" },
  { href: "/routines", label: "Routinen", icon: "ListChecks" },
  { href: "/week", label: "Woche", icon: "CalendarDays" },
  { href: "/groups", label: "Gruppen", icon: "Users" },
  { href: "/profile", label: "Profil", icon: "UserCircle" },
] as const;
