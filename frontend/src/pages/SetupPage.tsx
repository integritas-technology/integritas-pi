import { CheckCircle2, Circle, LockKeyhole, RadioTower, ShieldCheck, Sparkles } from "lucide-react";
import { Page } from "../components/Page";

const setupSteps = [
  { title: "Install package", description: "Confirm the Minima Edge Stack Pi Edition bundle is installed and running as a local service.", complete: true },
  { title: "Open dashboard", description: "Access Edge Workbench from a browser on the local network.", complete: true },
  { title: "Secure access", description: "Set password, local access rules, API keys, and backup options.", complete: false, icon: LockKeyhole },
  { title: "Connect data sources", description: "Set the communication protocol and device location.", complete: false, icon: RadioTower },
  { title: "Create automated workflows", description: "Collect source data at set intervals.", complete: false, icon: Circle },
  { title: "Secure your data origination", description: "Stamp source data with Integritas.", complete: false, icon: ShieldCheck }
];

export function SetupPage({ onRestartOnboarding }: { onRestartOnboarding?: () => void }) {
  const completed = setupSteps.filter((step) => step.complete).length;

  return (
    <Page
      eyebrow="Setup"
      title="Get your edge data workflow running"
      desc="Follow these steps to connect devices, collect data, and create verifiable Integritas records from the Pi."
      action={
        onRestartOnboarding ? (
          <button type="button" className="setup-relaunch-button" onClick={onRestartOnboarding}>
            <Sparkles size={16} /> Preview setup wizard
          </button>
        ) : undefined
      }
    >
      <section className="card setup-progress-card">
        <div>
          <strong>{completed} of {setupSteps.length} steps complete</strong>
          <p className="muted">You have already installed the bundle and opened the dashboard, so setup starts with progress made.</p>
        </div>
        <div className="setup-progress-bar"><span style={{ width: `${completed / setupSteps.length * 100}%` }} /></div>
      </section>

      <section className="setup-step-grid">
        {setupSteps.map((step, index) => {
          const Icon = step.complete ? CheckCircle2 : step.icon ?? Circle;
          return (
            <article className={step.complete ? "card setup-step complete" : "card setup-step"} key={step.title}>
              <div className="setup-step-icon"><Icon size={24} /></div>
              <div>
                <span>Step {index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
              {step.complete && <span className="pill pill-good">Complete</span>}
            </article>
          );
        })}
      </section>
    </Page>
  );
}
