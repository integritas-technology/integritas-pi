import { cx } from "../lib/cx";

export type SubTabOption<T extends string> = {
  value: T;
  label: string;
};

export function SubTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly SubTabOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex w-fit flex-wrap gap-1.5 rounded-[18px] border border-slate-200 bg-slate-100/80 p-1.5 shadow-sm", className)} role="tablist" aria-label={label}>
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx(
              "rounded-[14px] border px-3.5 py-2.5 text-sm font-extrabold transition-colors",
              active
                ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                : "border-transparent bg-transparent text-slate-600 hover:bg-white hover:text-slate-950",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
