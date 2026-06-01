import { cx } from "../lib/cx";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={cx("card", className)}>{children}</section>;
}
