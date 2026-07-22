import { useId } from "react";

interface BrandLineGridProps {
  className?: string;
}

export function BrandLineGrid({ className = "" }: BrandLineGridProps) {
  const patternId = useId().replace(/:/g, "");

  return (
    <div
      className={`pointer-events-none absolute inset-0 opacity-[0.07] ${className}`.trim()}
      aria-hidden
    >
      <svg className="h-full w-full text-[#1a1a1a]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={patternId} width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
