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
    <div className={cx("flex w-fit flex-wrap gap-2 rounded-[18px] border border-slate-200 bg-white p-1.5", className)} role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={cx(
            "rounded-[14px] border-0 bg-transparent px-3.5 py-2.5 font-extrabold text-slate-600",
            value === option.value && "bg-slate-950 text-white",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
