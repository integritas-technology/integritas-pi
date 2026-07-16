import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "onDark";
type ButtonSize = "md" | "sm" | "xs";
type IconButtonSize = "md" | "sm" | "xs";

const variantClass: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-slate-950 text-white hover:bg-slate-800",
  secondary: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200",
  danger: "border-transparent bg-red-600 text-white hover:bg-red-700",
  onDark: "border-white/10 bg-white/15 text-white hover:bg-white/25",
};

const sizeClass: Record<ButtonSize, string> = {
  md: "rounded-2xl px-4 py-3 text-sm",
  sm: "rounded-xl px-3 py-2 text-sm",
  xs: "rounded-full px-3 py-1.5 text-xs",
};

const iconSizeClass: Record<IconButtonSize, string> = {
  md: "size-10 rounded-[14px]",
  sm: "size-9 rounded-xl",
  xs: "size-8 rounded-lg",
};

export function Button({
  children,
  className,
  size = "md",
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; size?: ButtonSize; variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex w-fit items-center justify-center gap-2 border font-bold transition-colors disabled:opacity-55",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  className,
  size = "md",
  variant = "secondary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; size?: IconButtonSize; variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-grid place-items-center border text-sm transition-colors disabled:opacity-55",
        variantClass[variant],
        iconSizeClass[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
