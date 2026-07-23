import { Check, Circle } from "lucide-react";
import { cx } from "../../lib/cx";
import { getAdminPasswordRequirements } from "./adminCredentials";

export function PasswordRequirements({ password }: { password: string }) {
  const requirements = getAdminPasswordRequirements(password);

  return (
    <div
      className="border-brand-border bg-brand-white grid gap-2 rounded border p-3 shadow-[0_1px_2px_rgb(26_26_24_/_0.08)]"
      aria-label="Password requirements"
    >
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
        Password must include
      </span>
      <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className={cx(
              "flex items-center gap-2 text-sm font-medium",
              requirement.met ? "text-emerald-700" : "text-slate-500",
            )}
            aria-label={`${requirement.label}: ${requirement.met ? "met" : "not met"}`}
          >
            {requirement.met ? (
              <Check size={15} strokeWidth={3} aria-hidden="true" />
            ) : (
              <Circle size={15} aria-hidden="true" />
            )}
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
