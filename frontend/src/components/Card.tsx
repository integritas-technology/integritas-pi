import { cx } from "../lib/cx";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "border-brand-border bg-brand-white rounded-md border p-6 shadow-[0_18px_40px_rgb(26_26_24_/_0.06)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
