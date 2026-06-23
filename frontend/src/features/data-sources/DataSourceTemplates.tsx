import { Globe2, Radio, Webhook } from "lucide-react";
import { Card } from "../../components/Card";
import type { DataSourceTemplate } from "./dataSourceTypes";

export const dataSourceTemplates: DataSourceTemplate[] = [
  { title: "HTTP JSON API", description: "Fetch JSON from an external API, Pi service, or Docker-network endpoint", type: "json-api", config: { url: "https://example.com/data.json", method: "GET", headers: {} } },
  { title: "Webhook", description: "Receive pushed JSON from another app, device, or workflow", type: "webhook", config: {} },
  { title: "MQTT", description: "Subscribe to a broker topic and ingest JSON messages", type: "mqtt", config: { brokerUrl: "mqtt://localhost:1883", topic: "sensors/+/data" } }
];

export function DataSourceTemplates({ onSelect }: { onSelect: (template: DataSourceTemplate) => void }) {
  return (
    <div className="data-source-template-grid">
      {dataSourceTemplates.map((template, index) => {
        const Icon = template.type === "json-api" ? Globe2 : template.type === "webhook" ? Webhook : Radio;
        return (
          <Card className="data-source-template" key={template.title}>
            <Icon size={24} />
            <h3>{template.title}</h3>
            <p>{template.description}</p>
            <button type="button" onClick={() => onSelect(template)}>Add source</button>
          </Card>
        );
      })}
    </div>
  );
}
