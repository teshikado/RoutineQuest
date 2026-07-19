import { forwardRef } from "react";
import clsx from "clsx";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-xl border border-[#dbeaf3] bg-white px-3.5 py-2.5 text-sm text-[#183B56] placeholder:text-[#9db3c2] focus:outline-none focus:ring-2 focus:ring-[#4FA8D8] focus:border-transparent transition-shadow",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={clsx("block text-sm font-semibold text-[#183B56] mb-1.5", className)} {...props} />
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="text-xs text-[#e2564c] mt-1.5">{children}</p>;
}
