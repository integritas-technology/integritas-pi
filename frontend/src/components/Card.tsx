import { cx } from "../lib/cx";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={cx("rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]", className)}>{children}</section>;
}
