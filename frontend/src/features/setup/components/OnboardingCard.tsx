import { Card } from "../../../components/Card";
import { cx } from "../../../lib/cx";

/**
 * Setup-wizard panel with a stable min-height so step transitions
 * (and PIN ↔ password) do not resize the card.
 */
export function OnboardingCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cx(
        "grid min-h-[600px] content-start gap-4 max-[700px]:min-h-[36rem] max-[700px]:gap-3",
        className,
      )}
    >
      {children}
    </Card>
  );
}
