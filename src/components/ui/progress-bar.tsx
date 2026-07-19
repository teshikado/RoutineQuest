import clsx from "clsx";

export function ProgressBar({
  ratio,
  colorClass = "bg-[#4FA8D8]",
  gradient,
  trackClass = "bg-[#EAF7FC]",
  height = "h-3",
  className,
  shine = false,
}: {
  ratio: number;
  colorClass?: string;
  /** CSS `background` value (e.g. a linear-gradient) — takes priority over colorClass when set. */
  gradient?: string;
  trackClass?: string;
  height?: string;
  className?: string;
  /** Adds a soft moving highlight sweep across the filled portion (e.g. for the XP bar). */
  shine?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  const complete = pct >= 100;
  return (
    <div className={clsx("w-full rounded-full overflow-hidden", height, trackClass, className)}>
      <div
        className={clsx(
          "relative h-full rounded-full overflow-hidden transition-[width] duration-700 ease-[var(--ease-out-soft)]",
          !gradient && colorClass,
          complete && "animate-success-pulse"
        )}
        style={{ width: `${pct}%`, background: gradient }}
      >
        {shine && pct > 0 && (
          <span className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-progress-shine" />
        )}
      </div>
    </div>
  );
}
