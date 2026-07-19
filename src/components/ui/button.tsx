import { forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-[#4FA8D8] text-white hover:bg-[#3d92c0] shadow-sm",
  secondary: "bg-white text-[#183B56] border border-[#A7D8F0] hover:bg-[#EAF7FC]",
  ghost: "bg-transparent text-[#183B56] hover:bg-[#EAF7FC]",
  danger: "bg-[#FF8A80] text-white hover:bg-[#f16c60]",
  success: "bg-[#78D6B0] text-[#183B56] hover:bg-[#5fc79c]",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5 rounded-lg gap-1.5",
  md: "text-sm px-4 py-2.5 rounded-xl gap-2",
  lg: "text-base px-6 py-3 rounded-xl gap-2",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ className, variant = "primary", size = "md", ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4FA8D8] focus-visible:ring-offset-2 active:scale-[0.97]",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";
