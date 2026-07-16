import { Cpu, Globe2, Lightbulb, Radio, Webhook } from "lucide-react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { MutedText } from "../../components/Text";
import type { DataSourceCapabilities, DataSourceTemplate } from "./dataSourceTypes";

export const inputTemplates: DataSourceTemplate[] = [
  { title: "HTTP JSON API", description: "Fetch JSON from an external API, Pi service, or Docker-network endpoint", type: "json-api", config: { url: "https://example.com/data.json", method: "GET", headers: {} } },
  { title: "Webhook", description: "Receive pushed JSON from another app, device, or workflow", type: "webhook", config: {} },
  { title: "MQTT", description: "Subscribe to a broker topic and ingest JSON messages", type: "mqtt", config: { brokerUrl: "mqtt://localhost:1883", topic: "sensors/+/data" } },
  { title: "GPIO Input", description: "Record Raspberry Pi GPIO pin edge events as JSON", type: "gpio-input", config: { chip: "gpiochip0", pin: 17, pull: "off", edge: "both", debounceMs: 100, activeState: "high" } }
];

export function DataSourceTemplates({ capabilities, onSelect }: { capabilities: DataSourceCapabilities | null; onSelect: (template: DataSourceTemplate) => void }) {
  return (
    <Card className="grid gap-6">
      <div>
        <strong>Input sources</strong>
        <MutedText className="m-0 mt-1">Inputs produce JSON, messages, or hardware events that workflows can record or use as triggers.</MutedText>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {inputTemplates.map((template) => {
          const Icon = template.type === "json-api" ? Globe2 : template.type === "webhook" ? Webhook : template.type === "mqtt" ? Radio : Cpu;
          const disabled = template.type === "gpio-input" && capabilities?.gpioInput.available === false;
          return (
            <Card className="grid gap-3 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]" key={template.title}>
              <Icon size={24} />
              <h3 className="m-0">{template.title}</h3>
              <MutedText className="m-0">{template.description}</MutedText>
              {disabled && <MutedText className="m-0">{capabilities?.gpioInput.reason}</MutedText>}
              <Button type="button" disabled={disabled} onClick={() => onSelect(template)}>Add input</Button>
            </Card>
          );
        })}
      </div>

      <div>
        <strong>Output targets</strong>
        <MutedText className="m-0 mt-1">Outputs are devices the app can control from automation action blocks.</MutedText>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        <Card className="grid gap-3 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
          <Lightbulb size={24} />
          <h3 className="m-0">GPIO Output</h3>
          <MutedText className="m-0">Define an LED output target that workflow blocks can pulse safely.</MutedText>
          <MutedText className="m-0">LED profile only. Use a 220-330 ohm resistor in series with the LED.</MutedText>
          <Button type="button" disabled={capabilities?.gpioInput.available === false} onClick={() => onSelect({ title: "GPIO Output", description: "LED output target controlled by automation workflows", type: "gpio-output", config: { chip: "gpiochip0", pin: 18, profile: "led", activeState: "high", initialState: "inactive" } })}>Add output</Button>
        </Card>
      </div>
    </Card>
  );
}
