import { Section } from "./Section";

export function Page({ eyebrow, title, desc, action, children }: { eyebrow: string; title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="grid gap-6"><Section eyebrow={eyebrow} title={title} desc={desc} action={action} />{children}</div>;
}
