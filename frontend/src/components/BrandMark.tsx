export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden="true">
      <g fill="currentColor">
        <polygon points="14,3 19,14 9,14" />
        <polygon points="14,3 19,14 9,14" fillOpacity={0.85} transform="rotate(60 14 14)" />
        <polygon points="14,3 19,14 9,14" fillOpacity={0.7} transform="rotate(120 14 14)" />
        <polygon points="14,3 19,14 9,14" fillOpacity={0.85} transform="rotate(180 14 14)" />
        <polygon points="14,3 19,14 9,14" fillOpacity={0.7} transform="rotate(240 14 14)" />
        <polygon points="14,3 19,14 9,14" fillOpacity={0.85} transform="rotate(300 14 14)" />
      </g>
    </svg>
  );
}
