import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "onDark";
type ButtonSize = "md" | "sm" | "xs";
type IconButtonSize = "md" | "sm" | "xs";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-brand-graphite text-brand-white enabled:hover:bg-brand-graphite-hover",
  secondary:
    "border-brand-border bg-brand-white text-brand-graphite enabled:hover:bg-brand-bg",
  ghost:
    "border-transparent bg-brand-bg text-brand-graphite enabled:hover:bg-brand-graphite-soft",
  danger: "border-transparent bg-error text-brand-white enabled:hover:bg-error-hover",
  onDark:
    "border-brand-on-dark-border bg-brand-on-dark text-brand-white enabled:hover:bg-brand-on-dark-hover",
};

const sizeClass: Record<ButtonSize, string> = {
  md: "rounded px-4 py-3 text-sm",
  sm: "rounded px-3 py-2 text-sm",
  xs: "rounded px-3 py-1.5 text-xs",
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
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
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
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: IconButtonSize;
  variant?: ButtonVariant;
}) {
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
