import clsx from "clsx";

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Wird geladen"
      className={clsx(
        "h-5 w-5 rounded-full border-2 border-[#A7D8F0] border-t-[#4FA8D8] animate-spin",
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
