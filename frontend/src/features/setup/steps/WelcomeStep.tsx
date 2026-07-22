import { LockKeyhole, ShieldCheck, Stamp } from "lucide-react";
import { TOTP_ENABLED } from "../../auth/totpEnabled";
import { eyebrowClass, headingClass, leadClass, panelClass } from "../onboardingStyles";

export function WelcomeStep() {
  return (
    <div className={panelClass}>
      <p className={eyebrowClass}>First-time setup</p>
      <h2 className={headingClass}>Set up your Edge Workbench</h2>
      <p className={leadClass}>
        Edge Workbench runs on your Raspberry Pi to stamp data proofs, monitor local services, and
        automate integrity checks — all from one dashboard on your network.
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <article className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <LockKeyhole size={22} />
          <h3 className="m-0 text-sm">Secure this device</h3>
          <p className="m-0 text-xs leading-relaxed text-slate-500">
            {TOTP_ENABLED
              ? "Choose a local admin PIN or password and two-factor authentication to protect configuration on your LAN."
              : "Choose a local admin PIN or password to protect configuration on your LAN."}
          </p>
        </article>
        <article className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Stamp size={22} />
          <h3 className="m-0 text-sm">Stamp proofs</h3>
          <p className="m-0 text-xs leading-relaxed text-slate-500">
            Hash files and API responses, then anchor them on your embedded Minima node through
            Integritas.
          </p>
        </article>
        <article className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <ShieldCheck size={22} />
          <h3 className="m-0 text-sm">Run at the edge</h3>
          <p className="m-0 text-xs leading-relaxed text-slate-500">
            Poll input sources, track stamp history, and keep services healthy without leaving your
            Pi.
          </p>
        </article>
      </div>
    </div>
  );
}
