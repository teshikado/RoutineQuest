import clsx from "clsx";

export function ProgressBar({
  ratio,
  colorClass = "bg-[#4FA8D8]",
  trackClass = "bg-[#EAF7FC]",
  height = "h-3",
  className,
}: {
  ratio: number;
  colorClass?: string;
  trackClass?: string;
  height?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className={clsx("w-full rounded-full overflow-hidden", height, trackClass, className)}>
      <div
        className={clsx("h-full rounded-full transition-all duration-500 ease-out", colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
