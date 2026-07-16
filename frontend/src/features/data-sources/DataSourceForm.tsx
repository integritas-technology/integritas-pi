import { Button } from "../../components/Button";
import { Pill } from "../../components/Pill";
import { StatusRow } from "../../components/StatusRow";
import { MutedText } from "../../components/Text";
import type { DataSource, DataSourceTemplate } from "./dataSourceTypes";

export function DataSourceForm({ template, name, setName, description, setDescription, type, setType, url, setUrl, healthStatusUrl, setHealthStatusUrl, brokerUrl, setBrokerUrl, topic, setTopic, gpioChip, setGpioChip, gpioPin, setGpioPin, gpioPull, setGpioPull, gpioEdge, setGpioEdge, gpioDebounceMs, setGpioDebounceMs, gpioActiveState, setGpioActiveState, method, setMethod, onSubmit, busy, submitLabel = "Add source" }: { template: DataSourceTemplate | null; name: string; setName: (value: string) => void; description: string; setDescription: (value: string) => void; type: DataSource["type"]; setType: (value: DataSource["type"]) => void; url: string; setUrl: (value: string) => void; healthStatusUrl: string; setHealthStatusUrl: (value: string) => void; brokerUrl: string; setBrokerUrl: (value: string) => void; topic: string; setTopic: (value: string) => void; gpioChip: string; setGpioChip: (value: string) => void; gpioPin: string; setGpioPin: (value: string) => void; gpioPull: "off" | "up" | "down"; setGpioPull: (value: "off" | "up" | "down") => void; gpioEdge: "rising" | "falling" | "both"; setGpioEdge: (value: "rising" | "falling" | "both") => void; gpioDebounceMs: string; setGpioDebounceMs: (value: string) => void; gpioActiveState: "high" | "low"; setGpioActiveState: (value: "high" | "low") => void; method: "GET" | "POST" | "PUT" | "PATCH"; setMethod: (value: "GET" | "POST" | "PUT" | "PATCH") => void; onSubmit: () => void; busy: boolean; submitLabel?: string }) {
  return (
    <section className="grid min-w-0 gap-3 [&_label]:grid [&_label]:gap-3 [&_label]:font-bold [&_label]:text-slate-700">
      <StatusRow>
        <div>
          <strong>{submitLabel}</strong>
          <MutedText className="m-0 mt-1">Configure how this device communicates with Integritas Pi.</MutedText>
        </div>
        {template && <Pill>{template.title}</Pill>}
      </StatusRow>
      <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Source name" /></label>
      <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does this source provide?" /></label>
      {type === "webhook" ? (
        <MutedText>A receive URL will be generated after saving. POST JSON to that URL to update this source.</MutedText>
      ) : type === "mqtt" ? (
        <>
          <label>Broker URL<input value={brokerUrl} onChange={(event) => setBrokerUrl(event.target.value)} placeholder="mqtt://192.168.1.50:1883" /></label>
          <label>Topic<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="sensors/+/data" /></label>
          <MutedText>Messages must contain JSON payloads. The backend subscribes and updates this source when messages arrive.</MutedText>
        </>
      ) : type === "mqtt-output" ? (
        <>
          <label>Broker URL<input value={brokerUrl} onChange={(event) => setBrokerUrl(event.target.value)} placeholder="mqtt://mqtt:1883" /></label>
          <label>Topic<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="devices/example/set" /></label>
          <MutedText>Automation workflows publish JSON payloads to this broker topic.</MutedText>
        </>
      ) : type === "gpio-input" ? (
        <>
          <label>GPIO chip<input value={gpioChip} onChange={(event) => setGpioChip(event.target.value)} placeholder="gpiochip0" /></label>
          <label>BCM pin number<input value={gpioPin} onChange={(event) => setGpioPin(event.target.value)} placeholder="17" inputMode="numeric" /></label>
          <label>Pull resistor<select value={gpioPull} onChange={(event) => setGpioPull(event.target.value as "off" | "up" | "down")}><option value="off">Off</option><option value="up">Pull-up</option><option value="down">Pull-down</option></select></label>
          <label>Edge<select value={gpioEdge} onChange={(event) => setGpioEdge(event.target.value as "rising" | "falling" | "both")}><option value="rising">Rising</option><option value="falling">Falling</option><option value="both">Both</option></select></label>
          <label>Debounce ms<input value={gpioDebounceMs} onChange={(event) => setGpioDebounceMs(event.target.value)} placeholder="100" inputMode="numeric" /></label>
          <label>Active state<select value={gpioActiveState} onChange={(event) => setGpioActiveState(event.target.value as "high" | "low")}><option value="high">High</option><option value="low">Low</option></select></label>
          <MutedText>GPIO input sources use BCM numbering and record edge events only while an Automation workflow is enabled.</MutedText>
        </>
      ) : type === "gpio-output" ? (
        <>
          <label>Output profile<select value="led" disabled><option value="led">LED</option></select></label>
          <label>GPIO chip<input value={gpioChip} onChange={(event) => setGpioChip(event.target.value)} placeholder="gpiochip0" /></label>
          <label>BCM pin number<input value={gpioPin} onChange={(event) => setGpioPin(event.target.value)} placeholder="18" inputMode="numeric" /></label>
          <label>LED turns on when GPIO is<select value={gpioActiveState} onChange={(event) => setGpioActiveState(event.target.value as "high" | "low")}><option value="high">High (common GPIO to resistor to LED to GND wiring)</option><option value="low">Low (LED/resistor tied to 3.3V, GPIO sinks current)</option></select></label>
          <MutedText>LED output targets can be pulsed from Automation. For the documented GPIO18 LED wiring, choose High. Wire the LED with a 220-330 ohm resistor and never connect GPIO directly to 5V, motors, or relays.</MutedText>
        </>
      ) : type === "http-output" ? (
        <>
          <label>URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/device/command" /></label>
          <label>Method<select value={method === "GET" ? "POST" : method} onChange={(event) => setMethod(event.target.value as "POST" | "PUT" | "PATCH")}><option value="POST">POST</option><option value="PUT">PUT</option><option value="PATCH">PATCH</option></select></label>
          <MutedText>Automation workflows send JSON payloads to this endpoint.</MutedText>
        </>
      ) : (
        <>
          <label>URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/data.json" /></label>
          <label>Health status URL<input value={healthStatusUrl} onChange={(event) => setHealthStatusUrl(event.target.value)} placeholder="https://example.com/health" /></label>
          <label>Method<select value={method === "PUT" || method === "PATCH" ? "POST" : method} onChange={(event) => setMethod(event.target.value as "GET" | "POST")}><option value="GET">GET</option><option value="POST">POST</option></select></label>
        </>
      )}
      <Button type="button" disabled={busy || !name || (type !== "webhook" && type !== "mqtt" && type !== "mqtt-output" && type !== "gpio-input" && type !== "gpio-output" && !url) || ((type === "mqtt" || type === "mqtt-output") && (!brokerUrl || !topic)) || ((type === "gpio-input" || type === "gpio-output") && (!gpioChip || !gpioPin))} onClick={onSubmit}>{submitLabel}</Button>
    </section>
  );
}
