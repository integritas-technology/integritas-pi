import type { InputHTMLAttributes } from "react";
import { cx } from "../lib/cx";

const inputClass =
  "w-full rounded border-0 bg-brand-white px-3 py-2.5 text-left text-sm font-bold text-brand-graphite shadow-[0_1px_2px_rgb(26_26_24_/_0.08)] ring-1 ring-brand-border/80 outline-none transition-[box-shadow,ring-color] duration-150 focus-visible:ring-2 focus-visible:ring-brand-graphite/25 focus-visible:ring-offset-2 motion-reduce:transition-none";

/** Shared text field matching the onboarding / brand form look. */
export function Input({ className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type={type} className={cx(inputClass, className)} />;
}
