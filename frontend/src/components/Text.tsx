import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx";

export function MutedText({ children, className, ...props }: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return <p className={cx("text-slate-500", className)} {...props}>{children}</p>;
}

export function ErrorText({ children, className, ...props }: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return <p className={cx("text-red-700", className)} {...props}>{children}</p>;
}

export function Eyebrow({ children, className, ...props }: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return <p className={cx("m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500", className)} {...props}>{children}</p>;
}
