import clsx from "clsx";
import { DynamicIcon } from "./icon";

const SIZE_CLASSES = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
} as const;

const ICON_SIZE_CLASSES = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
} as const;

/** Rank icon on a soft radial gradient disc in the rank's own color, with an optional glow ring. */
export function RankBadge({
  icon,
  color,
  size = "md",
  glow = false,
  className,
}: {
  icon: string;
  color: string;
  size?: keyof typeof SIZE_CLASSES;
  glow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx("relative shrink-0 rounded-full flex items-center justify-center", SIZE_CLASSES[size], className)}
      style={{
        background: `radial-gradient(circle at 32% 28%, ${color}66, ${color}1f 72%)`,
        boxShadow: glow ? `0 0 0 4px ${color}1f, 0 10px 24px ${color}40` : `inset 0 0 0 1px ${color}33`,
      }}
    >
      <DynamicIcon name={icon} className={ICON_SIZE_CLASSES[size]} style={{ color }} />
    </div>
  );
}
