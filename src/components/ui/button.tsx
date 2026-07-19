import { forwardRef } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-[#4FA8D8] text-white hover:bg-[#3d92c0] shadow-[var(--shadow-blue-sm)] hover:shadow-[var(--shadow-blue)]",
  secondary: "bg-white text-[#183B56] border border-[#A7D8F0] hover:bg-[#EAF7FC] shadow-[var(--shadow-xs)]",
  ghost: "bg-transparent text-[#183B56] hover:bg-[#EAF7FC]",
  danger:
    "bg-[#FF8A80] text-white hover:bg-[#f16c60] shadow-[0_2px_10px_rgba(255,138,128,0.28)] hover:shadow-[var(--shadow-coral)]",
  success:
    "bg-[#78D6B0] text-[#183B56] hover:bg-[#5fc79c] shadow-[0_2px_10px_rgba(120,214,176,0.28)] hover:shadow-[var(--shadow-mint)]",
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
        "inline-flex items-center justify-center font-semibold transition-all duration-200 ease-[var(--ease-out-soft)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FA8D8] focus-visible:ring-offset-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]",
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
