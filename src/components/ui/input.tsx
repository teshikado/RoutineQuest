import { forwardRef } from "react";
import clsx from "clsx";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-xl border border-[#292936] bg-[#111118] px-3.5 py-2.5 text-sm text-[#F8F7FC] placeholder:text-[#8D8998] transition-all duration-200 hover:border-[#D8B4FE] focus:outline-none focus:ring-2 focus:ring-[#A855F7] focus:border-transparent focus:shadow-[var(--shadow-blue-sm)]",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={clsx("block text-sm font-semibold text-[#F8F7FC] mb-1.5", className)} {...props} />
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="text-xs text-[#FB7185] mt-1.5">{children}</p>;
}
