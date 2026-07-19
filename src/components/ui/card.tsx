import clsx from "clsx";

export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-2xl bg-white border border-[#EAF7FC] shadow-[var(--shadow-sm)] p-5 transition-all duration-300 ease-[var(--ease-out-soft)]",
        interactive && "hover:-translate-y-1 hover:shadow-[var(--shadow-md)] hover:border-[#cfe9f6]",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={clsx("text-lg font-bold text-[#183B56]", className)} {...props} />;
}

export function CardSubtitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={clsx("text-sm text-[#5b7a91]", className)} {...props} />;
}
