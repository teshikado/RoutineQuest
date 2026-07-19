import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("rounded-lg animate-shimmer", className)} aria-hidden="true" />;
}

/** Loosely mirrors the shape of a Card-based list item so the layout doesn't jump once real content arrives. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx("rounded-2xl bg-[#111118] border border-[#292936] p-5 shadow-[var(--shadow-xs)]", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full mt-4" />
      <Skeleton className="h-3 w-5/6 mt-2" />
    </div>
  );
}

export function SkeletonList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={clsx("space-y-3", className)} role="status" aria-label="Wird geladen">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
