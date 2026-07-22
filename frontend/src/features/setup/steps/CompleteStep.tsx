import { Check, Sparkles } from "lucide-react";
import { cx } from "../../../lib/cx";
import { TOTP_ENABLED } from "../../auth/totpEnabled";
import {
  eyebrowClass,
  headingClass,
  infoCalloutClass,
  leadClass,
  mutedClass,
  panelClass,
} from "../onboardingStyles";

export function CompleteStep({
  passwordSet,
  totpVerified,
  connectedName,
  connectedPlan,
  connectedUsage,
}: {
  passwordSet: boolean;
  totpVerified: boolean;
  connectedName: string | null;
  connectedPlan: string | null;
  connectedUsage: number | null;
}) {
  const configured = [
    {
      label: "Admin credential",
      detail: passwordSet ? "Configured" : "Not set",
    },
    ...(TOTP_ENABLED
      ? [
          {
            label: "Two-factor auth",
            detail: totpVerified ? "Authenticator linked" : "Not verified",
          },
        ]
      : []),
    {
      label: "Workbench account",
      detail: connectedName ? `Signed in as ${connectedName}` : "Connected",
    },
    ...(connectedPlan
      ? [
          {
            label: "Plan",
            detail: connectedPlan,
          },
        ]
      : []),
    ...(connectedUsage !== null
      ? [
          {
            label: "Usage remaining",
            detail: connectedUsage.toLocaleString(),
          },
        ]
      : []),
  ];

  const automatic = [
    "Minima node health and peer connectivity",
    "Wallet lock and local security defaults",
    "Background services and stamp polling",
  ];

  return (
    <div className={panelClass}>
      <p className={eyebrowClass}>All done</p>
      <h2 className={headingClass}>
        {connectedName ? `Welcome, ${connectedName}` : "Your Edge Workbench is ready"}
      </h2>
      <p className={leadClass}>
        Setup is complete. You can open the dashboard — your plan and usage sync from your Workbench
        account.
      </p>

      <ul className="m-0 grid max-w-xl list-none gap-2 p-0">
        {configured.map((item) => (
          <li
            key={item.label}
            className="flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 p-3"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-green-600 text-white">
              <Check size={16} />
            </span>
            <div>
              <strong>{item.label}</strong>
              <p className="mt-1 mb-0 text-slate-500">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className={infoCalloutClass}>
        <Sparkles size={20} />
        <div>
          <strong>Configures automatically</strong>
          <ul className={cx(mutedClass, "m-0 mt-2 pl-4 text-sm leading-relaxed")}>
            {automatic.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
