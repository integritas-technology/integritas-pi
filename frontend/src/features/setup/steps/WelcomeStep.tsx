import { Link2, LockKeyhole, ShieldCheck } from "lucide-react";
import { TOTP_ENABLED } from "../../auth/totpEnabled";
import { onboardingWorkSteps } from "../steps";
import { APP_NAME } from "../../../app/names";

const stepMeta: Record<string, { icon: typeof LockKeyhole; detail: string }> = {
  account: {
    icon: LockKeyhole,
    detail: TOTP_ENABLED
      ? "Setup a local admin PIN or password, then two-factor auth."
      : "Setup a local admin PIN or password for this device.",
  },
  twofa: {
    icon: ShieldCheck,
    detail: "Setup an authenticator app for two-factor sign-in.",
  },
  connectAccount: {
    icon: Link2,
    detail: "Setup Integritas Connect for stamping and verifying data.",
  },
};

export function WelcomeStep() {
  const upcoming = onboardingWorkSteps;

  return (
    <div className="onboarding-enter grid gap-10 motion-safe:animate-[onboarding-fade-up_0.45s_ease-out_both] max-[700px]:gap-8">
      <header className="grid gap-4">
        <h2 className="m-0 text-[clamp(2rem,5vw,2.85rem)] leading-[1.05] font-medium text-slate-950">
          {APP_NAME}
        </h2>
        <div className="grid max-w-lg gap-2">
          <p className="m-0 text-base leading-relaxed font-medium text-slate-600">
            {APP_NAME} is a platform used to manage, secure, and monitor your devices. This setup
            wizard will guide you through the setup process.
          </p>
        </div>
      </header>

      <section className="grid gap-4" aria-labelledby="welcome-ahead-heading">
        <h3 id="welcome-ahead-heading" className="text-md m-0 font-bold">
          Steps to follow to get started
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
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-xl border border-slate-200/80 bg-brand-white px-4 py-3.5 motion-safe:animate-[onboarding-fade-up_0.45s_ease-out_both]"
                style={{ animationDelay: `${140 + index * 80}ms` }}
              >
                <span className="grid h-10 w-10 place-items-center text-brand-accent">
                  <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[0.95rem] font-bold text-slate-950">{step.label}</p>
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
