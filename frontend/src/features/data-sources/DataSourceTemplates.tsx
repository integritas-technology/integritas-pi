import { Camera, Cpu, Globe2, Lightbulb, Radio, Send, Webhook } from "lucide-react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { MutedText } from "../../components/Text";
import type { DataSourceCapabilities, DataSourceTemplate } from "./dataSourceTypes";

export const inputTemplates: DataSourceTemplate[] = [
  { title: "HTTP JSON API", description: "Fetch JSON from an external API, Pi service, or Docker-network endpoint", type: "json-api", config: { url: "https://example.com/data.json", method: "GET", headers: {} } },
  { title: "Webhook", description: "Receive pushed JSON from another app, device, or workflow", type: "webhook", config: {} },
  { title: "MQTT", description: "Subscribe to a broker topic and ingest JSON messages", type: "mqtt", config: { brokerUrl: "mqtt://localhost:1883", topic: "sensors/+/data" } },
  { title: "GPIO Input", description: "Record Raspberry Pi GPIO pin edge events as JSON", type: "gpio-input", config: { chip: "gpiochip0", pin: 17, pull: "off", edge: "both", debounceMs: 100, activeState: "high" } },
  { title: "Pi Camera", description: "Capture photos or short video clips from automation workflows", type: "pi-camera", config: { mode: "photo", width: 1280, height: 720, durationMs: 1000, fps: 30, outputFormat: "jpg" } }
];

export const outputTemplates: DataSourceTemplate[] = [
  { title: "GPIO Output", description: "LED output target controlled by automation workflows", type: "gpio-output", config: { chip: "gpiochip0", pin: 18, profile: "led", activeState: "high", initialState: "inactive" } },
  { title: "HTTP/API Output", description: "Send commands to an HTTP endpoint from automation workflows", type: "http-output", config: { url: "https://example.com/device/command", method: "POST", headers: {}, timeoutMs: 5000 } },
  { title: "MQTT Output", description: "Publish JSON commands to a broker topic from automation workflows", type: "mqtt-output", config: { brokerUrl: "mqtt://localhost:1883", topic: "devices/example/set", qos: 0, retain: false } }
];

export function DataSourceTemplates({ mode, capabilities, onSelect }: { mode: "input" | "output"; capabilities: DataSourceCapabilities | null; onSelect: (template: DataSourceTemplate) => void }) {
  const templates = mode === "input" ? inputTemplates : outputTemplates;
  const brokerUrl = capabilities?.mqttBroker?.enabled ? capabilities.mqttBroker.internalUrl : "mqtt://localhost:1883";

  return (
    <Card className="grid gap-6">
      <div>
        <strong>{mode === "input" ? "Input sources" : "Output targets"}</strong>
        <MutedText className="m-0 mt-1">{mode === "input" ? "Inputs produce JSON, messages, or hardware events that workflows can record or use as triggers." : "Outputs are devices or endpoints the app can control from automation action blocks."}</MutedText>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {templates.map((template) => {
          const Icon = template.type === "json-api" || template.type === "http-output" ? Globe2 : template.type === "webhook" ? Webhook : template.type === "mqtt" || template.type === "mqtt-output" ? Radio : template.type === "gpio-output" ? Lightbulb : template.type === "pi-camera" ? Camera : Cpu;
          const disabled = ((template.type === "gpio-input" || template.type === "gpio-output") && capabilities?.gpioInput.available === false) || (template.type === "pi-camera" && capabilities?.camera?.available === false);
          const config = template.type === "mqtt" || template.type === "mqtt-output" ? { ...template.config, brokerUrl } : template.config;
          return (
            <Card className="grid gap-3 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]" key={template.title}>
              <Icon size={24} />
              <h3 className="m-0">{template.title}</h3>
              <MutedText className="m-0">{template.description}</MutedText>
              {template.type === "gpio-output" && <MutedText className="m-0">LED profile only. Use a 220-330 ohm resistor in series with the LED.</MutedText>}
              {template.type === "pi-camera" && <MutedText className="m-0">Captures are stored locally under <code>{capabilities?.camera?.captureDir ?? "/data/captures"}</code> and hashed for stamping.</MutedText>}
              {(template.type === "mqtt" || template.type === "mqtt-output") && capabilities?.mqttBroker?.enabled && <MutedText className="m-0">Local broker available: <code>{capabilities.mqttBroker.internalUrl}</code></MutedText>}
              {disabled && <MutedText className="m-0">{template.type === "pi-camera" ? capabilities?.camera?.reason : capabilities?.gpioInput.reason}</MutedText>}
              <Button type="button" disabled={disabled} onClick={() => onSelect({ ...template, config })}>{mode === "input" ? "Add input" : "Add output"}</Button>
            </Card>
          );
        })}
      </div>
    </Card>
  );
}

export function LocalServicesCard({ capabilities }: { capabilities: DataSourceCapabilities | null }) {
  const broker = capabilities?.mqttBroker;
  const browserHost = typeof window === "undefined" ? "<pi-host-or-ip>" : window.location.hostname;
  const publicHost = broker?.publicHost || browserHost || "<pi-host-or-ip>";
  const publicPort = broker?.publicPort ?? 1883;
  const lanUrl = `mqtt://${publicHost}:${publicPort}`;
  const internalUrl = broker?.internalUrl ?? "mqtt://mqtt:1883";

  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong>Local services</strong>
          <MutedText className="m-0 mt-1">Connection details for app-provided services that help devices talk to this Pi.</MutedText>
        </div>
        <Send size={22} />
      </div>
      <Card className="grid gap-3 bg-slate-50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong>Local MQTT Broker</strong>
          <span className={broker?.enabled ? "font-extrabold text-emerald-700" : "font-extrabold text-slate-500"}>{broker?.enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <MutedText className="m-0">Run a broker on this Raspberry Pi so devices can connect directly without a separate broker.</MutedText>
        <div className="grid gap-2 text-sm">
          <div>LAN URL: <code>{lanUrl}</code></div>
          <div>Internal URL: <code>{internalUrl}</code></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => navigator.clipboard?.writeText(lanUrl)}>Copy LAN URL</Button>
          <Button type="button" variant="secondary" onClick={() => navigator.clipboard?.writeText(internalUrl)}>Copy internal URL</Button>
        </div>
        <MutedText className="m-0">Use the LAN URL for external devices. Use the internal URL in Integritas Pi MQTT device configs.</MutedText>
        {!broker?.enabled && <MutedText className="m-0">Enable with <code>ENABLE_MQTT_BROKER=true</code> and the Docker Compose MQTT profile.</MutedText>}
      </Card>
    </Card>
  );
}
