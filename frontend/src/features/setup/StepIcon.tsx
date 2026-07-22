import { Check, CheckCircle2, LockKeyhole, Smartphone, Sparkles, UserRound } from "lucide-react";
import { cx } from "../../lib/cx";
import type { OnboardingStepId } from "./types";

export function StepIcon({
  id,
  active,
  complete,
}: {
  id: OnboardingStepId;
  active: boolean;
  complete: boolean;
}) {
  const icons = {
    welcome: Sparkles,
    account: LockKeyhole,
    twofa: Smartphone,
    connectAccount: UserRound,
    complete: CheckCircle2,
  };
  const Icon = complete ? Check : icons[id];
  return (
    <div
      className={cx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 [&_svg]:pointer-events-none",
        active && "bg-white text-slate-950",
        complete && "bg-green-600 text-white",
      )}
      aria-hidden="true"
    >
      <Icon size={18} strokeWidth={2} />
    </div>
  );
}
