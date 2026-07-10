import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-slate-950 text-white hover:bg-slate-800",
  secondary: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200",
  danger: "border-transparent bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  children,
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex w-fit items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors disabled:opacity-55",
        variantClass[variant],
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
  variant = "secondary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-grid size-10 place-items-center rounded-[14px] border text-sm transition-colors disabled:opacity-55",
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
