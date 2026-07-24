import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx";

export function DarkHeroCard({
  children,
  className,
  layout = "grid",
  rounded = "rounded-[28px]",
  padding = "p-6 lg:p-8",
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  layout?: "grid" | "none";
  rounded?: string;
  padding?: string;
}) {
  return (
    <section
      className={cx(
        "relative overflow-hidden border border-slate-800 bg-slate-950 text-white before:absolute before:-right-10 before:-top-20 before:size-[260px] before:rounded-full before:bg-cyan-400 before:opacity-30 before:blur-[64px] after:absolute after:-bottom-28 after:right-40 after:size-[260px] after:rounded-full after:bg-violet-400 after:opacity-30 after:blur-[64px]",
        rounded,
        padding,
        layout === "grid" && "grid gap-6",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
