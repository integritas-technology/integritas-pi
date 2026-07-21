import { Check, Circle } from "lucide-react";
import { cx } from "../../lib/cx";
import { getAdminPasswordRequirements } from "./adminCredentials";

export function PasswordRequirements({ password }: { password: string }) {
  const requirements = getAdminPasswordRequirements(password);

  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label="Password requirements">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Password must include</span>
      <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className={cx("flex items-center gap-2 text-sm font-medium", requirement.met ? "text-emerald-700" : "text-slate-500")}
            aria-label={`${requirement.label}: ${requirement.met ? "met" : "not met"}`}
          >
            {requirement.met ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
