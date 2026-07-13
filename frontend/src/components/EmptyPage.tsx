import { Layers3 } from "lucide-react";
import { Card } from "./Card";
import { Page } from "./Page";

export function EmptyPage({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <Page eyebrow={eyebrow} title={title} desc={desc}>
      <Card className="grid min-h-[260px] content-center justify-items-start gap-2.5 border-dashed bg-slate-50 text-slate-500">
        <Layers3 size={26} />
        <h3 className="m-0 text-xl font-bold text-slate-950">No implementation yet</h3>
        <p className="m-0 max-w-xl leading-relaxed">This page is included to define the product structure. No mock data or placeholder actions are wired here.</p>
      </Card>
    </Page>
  );
}
