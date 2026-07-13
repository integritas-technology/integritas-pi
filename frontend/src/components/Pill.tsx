import type { Tone } from "../app/types";
import { cx } from "../lib/cx";

const toneClass: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  good: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  future: "bg-violet-100 text-violet-700",
};

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={cx("inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold", toneClass[tone])}>{children}</span>;
}
