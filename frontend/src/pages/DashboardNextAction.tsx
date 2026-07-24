import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { APP_NAME } from "../app/names";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Eyebrow, MutedText } from "../components/Text";
import { listDataSources } from "../features/data-sources/dataSourcesApi";
import { cx } from "../lib/cx";

export function DashboardNextAction() {
  const navigate = useNavigate();
  const [deviceCount, setDeviceCount] = useState<number | null>(null);

  useEffect(() => {
    listDataSources()
      .then((res) => setDeviceCount(res.items.length))
      .catch(() => setDeviceCount(null));
  }, []);

  const hasDevices = (deviceCount ?? 0) > 0;
  const step = hasDevices ? 2 : 1;

  return (
    <Card className="grid gap-6">
      <header className="grid max-w-2xl gap-2">
        <Eyebrow className="text-brand-accent">Getting started</Eyebrow>
        <h3 className="m-0 text-2xl tracking-tight text-slate-950">
          {step === 1 ? "Connect a device to get started" : "Create your first workflow"}
        </h3>
        <MutedText className="m-0 leading-relaxed">
          {APP_NAME} connects device data, proves it with Integritas, runs automations, and settles
          value on Minima. Do this in order:
        </MutedText>
      </header>

      <ol className="m-0 grid max-w-xl list-none gap-0 p-0">
        <Step
          number={1}
          title="Connect devices"
          detail="Add a sensor, API, webhook, MQTT, or GPIO source."
          state={hasDevices ? "done" : "current"}
        />
        <Step
          number={2}
          title="Create a workflow"
          detail="Automate what happens when device data or proofs arrive."
          state={hasDevices ? "current" : "upcoming"}
        />
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        {step === 1 ? (
          <Button type="button" onClick={() => navigate("/data")}>
            Connect devices
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        ) : (
          <>
            <Button type="button" onClick={() => navigate("/automation")}>
              Create workflow
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/data")}>
              Manage devices
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Step({
  number,
  title,
  detail,
  state,
}: {
  number: number;
  title: string;
  detail: string;
  state: "done" | "current" | "upcoming";
}) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0">
      <div className="relative flex flex-col items-center">
        <span
          className={cx(
            "relative z-10 grid size-8 place-items-center rounded-full text-sm font-bold",
            state === "done" && "bg-success text-brand-white",
            state === "current" && "bg-brand-graphite text-brand-white",
            state === "upcoming" && "bg-brand-graphite-soft text-brand-graphite-muted",
          )}
          aria-hidden="true"
        >
          {state === "done" ? <Check size={15} strokeWidth={2.75} /> : number}
        </span>
        {number === 1 ? (
          <span
            className={cx(
              "absolute top-8 bottom-[-0.75rem] w-px",
              state === "done" ? "bg-success" : "bg-brand-border",
            )}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="min-w-0 pt-0.5">
        <p
          className={cx(
            "m-0 font-bold",
            state === "upcoming" ? "text-brand-graphite-muted" : "text-slate-950",
          )}
        >
          {title}
          {state === "done" ? <span className="sr-only"> (done)</span> : null}
          {state === "current" ? <span className="sr-only"> (current)</span> : null}
        </p>
        <MutedText
          className={cx(
            "m-0 mt-1 text-sm leading-relaxed",
            state === "upcoming" && "text-brand-graphite-muted",
          )}
        >
          {detail}
        </MutedText>
      </div>
    </li>
  );
}
