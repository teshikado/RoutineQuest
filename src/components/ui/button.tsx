import { forwardRef } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-[#A855F7] text-white hover:bg-[#9333EA] shadow-[var(--shadow-blue-sm)] hover:shadow-[var(--shadow-blue)]",
  secondary: "bg-[#111118] text-[#F8F7FC] border border-[#D8B4FE] hover:bg-[#171720] shadow-[var(--shadow-xs)]",
  ghost: "bg-transparent text-[#F8F7FC] hover:bg-[#171720]",
  danger:
    "bg-[#FB7185] text-white hover:bg-[#E11D48] shadow-[0_2px_10px_rgba(251,113,133,0.3)] hover:shadow-[var(--shadow-coral)]",
  success:
    "bg-[#34D399] text-[#052015] hover:bg-[#10B981] shadow-[0_2px_10px_rgba(52,211,153,0.3)] hover:shadow-[var(--shadow-mint)]",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5 rounded-lg gap-1.5",
  md: "text-sm px-4 py-2.5 rounded-xl gap-2",
  lg: "text-base px-6 py-3 rounded-xl gap-2",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }
>(({ className, variant = "primary", size = "md", loading = false, disabled, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex items-center justify-center font-semibold transition-all duration-200 ease-[var(--ease-out-soft)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7] focus-visible:ring-offset-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
Button.displayName = "Button";
