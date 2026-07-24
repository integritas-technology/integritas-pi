import { useId } from "react";
import { cx } from "../../../lib/cx";
import type { AdminCredentialType } from "../../auth/adminCredentials";

const OPTIONS: { value: AdminCredentialType; label: string }[] = [
  { value: "pin", label: "6-digit PIN" },
  { value: "password", label: "Password" },
];

export function CredentialTypeToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: AdminCredentialType;
  onChange: (value: AdminCredentialType) => void;
}) {
  const labelId = useId();

  return (
    <div className="grid gap-2">
      <p id={labelId} className="text-brand-graphite text-md m-0 font-bold">
        {label}
      </p>
      <div
        className="bg-brand-graphite-soft grid grid-cols-2 gap-0.5 rounded-xl p-1"
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={cx(
                "focus-visible:ring-brand-graphite/25 rounded-lg px-3 py-2.5 text-sm font-bold transition-[color,background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none",
                selected
                  ? "bg-brand-white text-brand-graphite ring-brand-border/80 font-bold shadow-[0_1px_2px_rgb(26_26_24_/_0.08)] ring-1"
                  : "text-brand-graphite-muted hover:text-brand-graphite bg-transparent",
              )}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
