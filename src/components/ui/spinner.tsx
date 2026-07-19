import clsx from "clsx";

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Wird geladen"
      className={clsx(
        "h-5 w-5 rounded-full border-2 border-[#D8B4FE] border-t-[#A855F7] animate-spin",
        className
      )}
    />
  );
}

export function PageLoading() {
  return (
    <div className="flex-1 flex items-center justify-center py-24">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
