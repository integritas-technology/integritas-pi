import { Layers3 } from "lucide-react";
import { Card } from "./Card";
import { Page } from "./Page";

export function EmptyPage({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <Page eyebrow={eyebrow} title={title} desc={desc}>
      <Card className="empty-card">
        <Layers3 size={26} />
        <h3>No implementation yet</h3>
        <p>This page is included to define the product structure. No mock data or placeholder actions are wired here.</p>
      </Card>
    </Page>
  );
}
