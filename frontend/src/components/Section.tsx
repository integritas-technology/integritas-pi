export function Section({ eyebrow, title, desc, action }: { eyebrow: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
      {action}
    </div>
  );
}
