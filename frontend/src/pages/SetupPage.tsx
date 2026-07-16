import { CheckCircle2, Circle, LockKeyhole, LogOut, RadioTower, ShieldCheck } from "lucide-react";
import { Button } from "../components/Button";
import { ButtonRow } from "../components/ButtonRow";
import { Card } from "../components/Card";
import { Page } from "../components/Page";
import { Pill } from "../components/Pill";
import { MutedText } from "../components/Text";
import { useAuth } from "../features/auth";

const setupSteps = [
  { title: "Install package", description: "Confirm the Minima Edge Stack Pi Edition bundle is installed and running as a local service.", complete: true },
  { title: "Open dashboard", description: "Access Edge Workbench from a browser on the local network.", complete: true },
  { title: "Secure access", description: "Set password, local access rules, API keys, and backup options.", complete: false, icon: LockKeyhole },
  { title: "Connect devices", description: "Set up input sources, output targets, and device locations.", complete: false, icon: RadioTower },
  { title: "Create automated workflows", description: "Collect source data at set intervals.", complete: false, icon: Circle },
  { title: "Secure your data origination", description: "Stamp source data with Integritas.", complete: false, icon: ShieldCheck }
];

export function SetupPage() {
  const { signOut } = useAuth();
  const completed = setupSteps.filter((step) => step.complete).length;

  return (
    <Page
      eyebrow="Setup"
      title="Get your edge data workflow running"
      desc="Follow these steps to connect devices, collect data, and create verifiable Integritas records from the Pi."
      action={
        <ButtonRow>
          <Button type="button" variant="ghost" onClick={() => void signOut()}>
            <LogOut size={16} /> Sign out
          </Button>
        </ButtonRow>
      }
    >
      <Card className="grid gap-4">
        <div>
          <strong className="text-lg">{completed} of {setupSteps.length} steps complete</strong>
          <MutedText className="m-0 mt-1">You have already installed the bundle and opened the dashboard, so setup starts with progress made.</MutedText>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-emerald-600" style={{ width: `${completed / setupSteps.length * 100}%` }} /></div>
      </Card>

      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {setupSteps.map((step, index) => {
          const Icon = step.complete ? CheckCircle2 : step.icon ?? Circle;
          return (
            <Card className={step.complete ? "grid content-start gap-4 border-emerald-200 bg-emerald-50" : "grid content-start gap-4"} key={step.title}>
              <div className={step.complete ? "grid size-12 place-items-center rounded-[18px] bg-emerald-100 text-emerald-700" : "grid size-12 place-items-center rounded-[18px] bg-slate-100 text-slate-950"}><Icon size={24} /></div>
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Step {index + 1}</span>
                <h3 className="my-1.5">{step.title}</h3>
                <MutedText className="m-0 leading-relaxed">{step.description}</MutedText>
              </div>
              {step.complete && <Pill tone="good">Complete</Pill>}
            </Card>
          );
        })}
      </section>
    </Page>
  );
}
