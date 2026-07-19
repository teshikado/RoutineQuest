import { DynamicIcon } from "./icon";

export function EmptyState({
  icon = "Sparkles",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-2xl bg-[#EAF7FC]/60 border border-dashed border-[#A7D8F0]">
      <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm">
        <DynamicIcon name={icon} className="h-7 w-7 text-[#4FA8D8]" />
      </div>
      <h3 className="font-bold text-[#183B56] mb-1">{title}</h3>
      <p className="text-sm text-[#5b7a91] max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}
