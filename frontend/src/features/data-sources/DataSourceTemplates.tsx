import { Code2, Database } from "lucide-react";
import { Card } from "../../components/Card";
import type { DataSourceTemplate } from "./dataSourceTypes";

export const dataSourceTemplates: DataSourceTemplate[] = [
  { title: "Internal source", description: "JSON from another service on this Pi or Docker network", type: "internal-json-api", config: { url: "http://backend:3000/api/health", method: "GET", headers: {} } },
  { title: "API source", description: "JSON from an HTTP API endpoint", type: "json-api", config: { url: "https://example.com/data.json", method: "GET", headers: {} } }
];

export function DataSourceTemplates({ onSelect }: { onSelect: (template: DataSourceTemplate) => void }) {
  return (
    <div className="data-source-template-grid">
      {dataSourceTemplates.map((template, index) => {
        const Icon = index === 0 ? Database : Code2;
        return (
          <Card className="data-source-template" key={template.title}>
            <Icon size={24} />
            <h3>{template.title}</h3>
            <p>{template.description}</p>
            <button type="button" onClick={() => onSelect(template)}>Use template</button>
          </Card>
        );
      })}
    </div>
  );
}
