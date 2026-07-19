import clsx from "clsx";

export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-2xl bg-[#111118] border border-[#292936] shadow-[var(--shadow-sm)] p-5 transition-all duration-300 ease-[var(--ease-out-soft)]",
        interactive && "hover:-translate-y-1 hover:shadow-[var(--shadow-md)] hover:border-[#3D2A5C]",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={clsx("text-lg font-bold text-[#F8F7FC]", className)} {...props} />;
}

export function CardSubtitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={clsx("text-sm text-[#C8C5D2]", className)} {...props} />;
}
