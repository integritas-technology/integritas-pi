import { Link2, LockKeyhole, ShieldCheck } from "lucide-react";
import { cx } from "../../../lib/cx";
import { TOTP_ENABLED } from "../../auth/totpEnabled";
import { onboardingWorkSteps } from "../steps";

const stepMeta: Record<string, { icon: typeof LockKeyhole; detail: string }> = {
  account: {
    icon: LockKeyhole,
    detail: TOTP_ENABLED
      ? "Choose a local admin PIN or password, then enable two-factor auth."
      : "Choose a local admin PIN or password to protect this device.",
  },
  twofa: {
    icon: ShieldCheck,
    detail: "Link an authenticator app for two-factor sign-in.",
  },
  connectAccount: {
    icon: Link2,
    detail: "Create and link your Integritas Connect account for plan and proof usage.",
  },
};

export function WelcomeStep() {
  const upcoming = onboardingWorkSteps;

  return (
    <div className="onboarding-enter grid gap-8 motion-safe:animate-[onboarding-fade-up_0.45s_ease-out_both] max-[700px]:gap-6">
      <header className="grid gap-3">
        <p className="m-0 text-xs font-bold tracking-[0.2em] text-[var(--brand-primary)] uppercase">
          Edge Workbench
        </p>
        <h2 className="m-0 max-w-xl text-[clamp(1.75rem,3.5vw,2.35rem)] leading-[1.15] font-extrabold tracking-[-0.03em] text-slate-950">
          Set up your device in a few steps
        </h2>
        <p className="m-0 max-w-lg text-base leading-relaxed font-medium text-slate-600">
          Stamp data proofs, monitor local services, and run integrity checks from one dashboard on
          your network.
        </p>
      </header>

      <section className="grid gap-3" aria-labelledby="welcome-ahead-heading">
        <h3
          id="welcome-ahead-heading"
          className="m-0 text-xs font-bold tracking-[0.16em] text-slate-500 uppercase"
        >
          What you&apos;ll set up
        </h3>

        <ol className="onboarding-enter-stagger m-0 grid list-none gap-2.5 p-0">
          {upcoming.map((step, index) => {
            const meta = stepMeta[step.id] ?? {
              icon: Link2,
              detail: step.label,
            };
            const Icon = meta.icon;

            return (
              <li
                key={step.id}
                className={cx(
                  "flex items-start gap-4 rounded border border-slate-200/80 bg-slate-50/80 px-4 py-3.5",
                  "motion-safe:animate-[onboarding-fade-up_0.45s_ease-out_both]",
                )}
                style={{ animationDelay: `${120 + index * 70}ms` }}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-white text-[var(--brand-primary)] shadow-[0_1px_0_rgba(15,23,42,0.04)] ring-1 ring-slate-200/90">
                  <Icon size={18} strokeWidth={2.25} aria-hidden="true" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="m-0 text-[0.7rem] font-bold tracking-[0.14em] text-slate-400 uppercase">
                    Step {index + 1}
                  </p>
                  <strong className="mt-1 block text-[0.95rem] font-bold text-slate-950">
                    {step.label}
                  </strong>
                  <p className="m-0 mt-1 text-sm leading-relaxed font-medium text-slate-500">
                    {meta.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
