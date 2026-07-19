import { DynamicIcon } from "./icon";

export function EmptyState({
  icon = "Sparkles",
  title,
  description,
  action,
  illustration,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Optional illustration (e.g. from @/components/ui/illustrations) shown instead of the icon circle. */
  illustration?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-2xl bg-[#171720]/60 border border-dashed border-[#D8B4FE]">
      {illustration ? (
        <div className="w-44 max-w-full mb-2">{illustration}</div>
      ) : (
        <div className="h-14 w-14 rounded-full bg-[#1D1D28] flex items-center justify-center mb-4 shadow-[var(--shadow-xs)]">
          <DynamicIcon name={icon} className="h-7 w-7 text-[#A855F7]" />
        </div>
      )}
      <h3 className="font-bold text-[#F8F7FC] mb-1">{title}</h3>
      <p className="text-sm text-[#C8C5D2] max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}
