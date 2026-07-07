import { Cpu, Globe2, Lightbulb, Radio, Webhook } from "lucide-react";
import { Card } from "../../components/Card";
import type { DataSourceCapabilities, DataSourceTemplate } from "./dataSourceTypes";

export const inputTemplates: DataSourceTemplate[] = [
  { title: "HTTP JSON API", description: "Fetch JSON from an external API, Pi service, or Docker-network endpoint", type: "json-api", config: { url: "https://example.com/data.json", method: "GET", headers: {} } },
  { title: "Webhook", description: "Receive pushed JSON from another app, device, or workflow", type: "webhook", config: {} },
  { title: "MQTT", description: "Subscribe to a broker topic and ingest JSON messages", type: "mqtt", config: { brokerUrl: "mqtt://localhost:1883", topic: "sensors/+/data" } },
  { title: "GPIO Input", description: "Record Raspberry Pi GPIO pin edge events as JSON", type: "gpio-input", config: { chip: "gpiochip0", pin: 17, pull: "off", edge: "both", debounceMs: 100, activeState: "high" } }
];

export function DataSourceTemplates({ capabilities, onSelect }: { capabilities: DataSourceCapabilities | null; onSelect: (template: DataSourceTemplate) => void }) {
  return (
    <section className="card">
      <div>
        <strong>Input sources</strong>
        <p className="muted">Inputs produce JSON, messages, or hardware events that workflows can record or use as triggers.</p>
      </div>
      <div className="data-source-template-grid">
        {inputTemplates.map((template) => {
          const Icon = template.type === "json-api" ? Globe2 : template.type === "webhook" ? Webhook : template.type === "mqtt" ? Radio : Cpu;
          const disabled = template.type === "gpio-input" && capabilities?.gpioInput.available === false;
          return (
            <Card className="data-source-template" key={template.title}>
              <Icon size={24} />
              <h3>{template.title}</h3>
              <p>{template.description}</p>
              {disabled && <p className="muted">{capabilities?.gpioInput.reason}</p>}
              <button type="button" disabled={disabled} onClick={() => onSelect(template)}>Add input</button>
            </Card>
          );
        })}
      </div>

      <div>
        <strong>Output targets</strong>
        <p className="muted">Outputs are devices the app can control from automation action blocks.</p>
      </div>
      <div className="data-source-template-grid">
        <Card className="data-source-template">
          <Lightbulb size={24} />
          <h3>GPIO Output</h3>
          <p>Define an LED output target that workflow blocks can pulse safely.</p>
          <p className="muted">LED profile only. Use a 220-330 ohm resistor in series with the LED.</p>
          <button type="button" disabled={capabilities?.gpioInput.available === false} onClick={() => onSelect({ title: "GPIO Output", description: "LED output target controlled by automation workflows", type: "gpio-output", config: { chip: "gpiochip0", pin: 18, profile: "led", activeState: "high", initialState: "inactive" } })}>Add output</button>
        </Card>
      </div>
    </section>
  );
}
