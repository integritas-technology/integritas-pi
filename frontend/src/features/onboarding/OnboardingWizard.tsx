import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  KeyRound,
  Layers3,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";
import { cx } from "../../lib/cx";
import { Pill } from "../../components/Pill";
import { onboardingSteps } from "./steps";
import type { MockCheckState, OnboardingFormState, OnboardingStepId } from "./types";

const initialForm: OnboardingFormState = {
  username: "",
  password: "",
  confirmPassword: "",
  requireLocalAuth: true,
  minimaMdsPassword: "",
  minimaAutoConnect: true,
  integritasApiKey: "",
  skipIntegritas: false
};

function passwordStrength(password: string): { label: string; tone: "warn" | "good" | "neutral" } {
  if (!password) return { label: "Enter a password", tone: "neutral" };
  if (password.length < 8) return { label: "Too short", tone: "warn" };
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: "Fair — add a number and capital letter", tone: "warn" };
  return { label: "Strong", tone: "good" };
}

function StepIcon({ id, active, complete }: { id: OnboardingStepId; active: boolean; complete: boolean }) {
  const icons = {
    welcome: Sparkles,
    account: UserRound,
    minima: RadioTower,
    integritas: ShieldCheck,
    complete: CheckCircle2
  };
  const Icon = complete ? Check : icons[id];
  return (
    <span className={cx("onboarding-step-icon", active && "active", complete && "complete")}>
      <Icon size={18} />
    </span>
  );
}

function WelcomeStep() {
  return (
    <div className="onboarding-panel">
      <p className="eyebrow">First-time setup</p>
      <h2>Welcome to Edge Workbench</h2>
      <p className="onboarding-lead">
        This wizard walks you through securing your Pi gateway, confirming the Minima node, and connecting Integritas stamping — similar to a Debian or Ubuntu desktop installer.
      </p>

      <div className="onboarding-feature-grid">
        <article className="onboarding-feature-card">
          <LockKeyhole size={22} />
          <h3>Protect the dashboard</h3>
          <p>Create a local admin account so only authorised users can change settings on your network.</p>
        </article>
        <article className="onboarding-feature-card">
          <RadioTower size={22} />
          <h3>Confirm Minima</h3>
          <p>Minima is the embedded blockchain node that anchors proofs. We will check the local node and set access credentials.</p>
        </article>
        <article className="onboarding-feature-card">
          <ShieldCheck size={22} />
          <h3>Connect Integritas</h3>
          <p>Integritas stamps data hashes to Minima so you can prove when files and API responses existed.</p>
        </article>
      </div>

      <p className="onboarding-note muted">
        This is a UI mockup only. Nothing you enter here is saved or sent to the backend yet.
      </p>
    </div>
  );
}

function AccountStep({ form, setForm }: { form: OnboardingFormState; setForm: (patch: Partial<OnboardingFormState>) => void }) {
  const strength = passwordStrength(form.password);
  const passwordsMatch = !form.confirmPassword || form.password === form.confirmPassword;

  return (
    <div className="onboarding-panel">
      <p className="eyebrow">Step 1 of 3</p>
      <h2>Create your admin account</h2>
      <p className="onboarding-lead">
        Set the username and password used to sign in to Edge Workbench. This protects configuration, API keys, and operational controls.
      </p>

      <div className="onboarding-form-grid">
        <label>
          Username
          <input
            value={form.username}
            onChange={(event) => setForm({ username: event.target.value })}
            placeholder="admin"
            autoComplete="username"
          />
          <span className="muted">Lowercase letters and numbers recommended.</span>
        </label>

        <label>
          Password
          <input
            value={form.password}
            onChange={(event) => setForm({ password: event.target.value })}
            type="password"
            placeholder="Choose a strong password"
            autoComplete="new-password"
          />
          <span className={cx("onboarding-hint", strength.tone === "good" && "good", strength.tone === "warn" && "warn")}>
            {strength.label}
          </span>
        </label>

        <label>
          Confirm password
          <input
            value={form.confirmPassword}
            onChange={(event) => setForm({ confirmPassword: event.target.value })}
            type="password"
            placeholder="Repeat password"
            autoComplete="new-password"
          />
          {!passwordsMatch && <span className="onboarding-hint warn">Passwords do not match</span>}
        </label>

        <label className="check-row onboarding-check-row">
          <input
            type="checkbox"
            checked={form.requireLocalAuth}
            onChange={(event) => setForm({ requireLocalAuth: event.target.checked })}
          />
          <span>
            <strong>Require sign-in on the local network</strong>
            <span className="muted">Recommended for Pi devices reachable from more than one machine.</span>
          </span>
        </label>
      </div>
    </div>
  );
}

function MinimaStep({
  form,
  setForm,
  checkState,
  onTestConnection
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
  checkState: MockCheckState;
  onTestConnection: () => void;
}) {
  return (
    <div className="onboarding-panel">
      <p className="eyebrow">Step 2 of 3</p>
      <h2>Configure Minima</h2>
      <p className="onboarding-lead">
        Minima runs as a lightweight full node on your Pi. Integritas uses it to anchor stamp proofs. Confirm the bundled node is reachable and set the MiniDapp System password.
      </p>

      <div className="onboarding-status-card">
        <div className="onboarding-status-row">
          <div>
            <strong>Local Minima container</strong>
            <p className="muted">Docker service: minima (ports 9001–9003)</p>
          </div>
          <Pill tone={checkState === "ok" ? "good" : checkState === "checking" ? "warn" : "neutral"}>
            {checkState === "ok" ? "Reachable" : checkState === "checking" ? "Checking…" : "Not tested"}
          </Pill>
        </div>
        {checkState === "ok" && (
          <div className="onboarding-mock-result">
            <CheckCircle2 size={18} />
            <div>
              <strong>Mock connection successful</strong>
              <p className="muted">Node version 1.0.42 · Peers: 4 · Chain height: 1,284,901</p>
            </div>
          </div>
        )}
      </div>

      <div className="onboarding-form-grid">
        <label>
          MDS password
          <input
            value={form.minimaMdsPassword}
            onChange={(event) => setForm({ minimaMdsPassword: event.target.value })}
            type="password"
            placeholder="MiniDapp System password"
          />
          <span className="muted">Used to access Minima miniDapps and RPC from this workbench.</span>
        </label>

        <label className="check-row onboarding-check-row">
          <input
            type="checkbox"
            checked={form.minimaAutoConnect}
            onChange={(event) => setForm({ minimaAutoConnect: event.target.checked })}
          />
          <span>
            <strong>Auto-connect to default peers</strong>
            <span className="muted">Join the Minima network using bundled peer list (megammr.minima.global).</span>
          </span>
        </label>
      </div>

      <div className="button-row">
        <button type="button" onClick={onTestConnection} disabled={checkState === "checking"}>
          {checkState === "checking" ? "Testing…" : "Test Minima connection"}
        </button>
      </div>
    </div>
  );
}

function IntegritasStep({
  form,
  setForm,
  checkState,
  onVerifyKey
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
  checkState: MockCheckState;
  onVerifyKey: () => void;
}) {
  return (
    <div className="onboarding-panel">
      <p className="eyebrow">Step 3 of 3</p>
      <h2>Connect Integritas</h2>
      <p className="onboarding-lead">
        Integritas hashes your files and API data, then anchors those hashes on Minima. You need an API key from Integritas to stamp and verify proofs from this Pi.
      </p>

      <div className="onboarding-info-callout">
        <KeyRound size={20} />
        <div>
          <strong>Get an API key</strong>
          <p className="muted">
            Sign up at{" "}
            <a href="https://integritas.technology/" target="_blank" rel="noreferrer">
              integritas.technology <ExternalLink size={14} />
            </a>{" "}
            and paste the key below. You can skip this step and configure it later in the Integritas page.
          </p>
        </div>
      </div>

      <label className="check-row onboarding-check-row onboarding-skip-row">
        <input
          type="checkbox"
          checked={form.skipIntegritas}
          onChange={(event) => setForm({ skipIntegritas: event.target.checked })}
        />
        <span>
          <strong>Skip for now</strong>
          <span className="muted">Finish setup without stamping enabled. Manual stamps and automation will stay disabled.</span>
        </span>
      </label>

      {!form.skipIntegritas && (
        <>
          <div className="onboarding-form-grid">
            <label>
              Integritas API key
              <input
                value={form.integritasApiKey}
                onChange={(event) => setForm({ integritasApiKey: event.target.value })}
                type="password"
                placeholder="Paste API key"
              />
            </label>
          </div>

          <div className="onboarding-status-card">
            <div className="onboarding-status-row">
              <div>
                <strong>API key check</strong>
                <p className="muted">Validates format and mock quota status.</p>
              </div>
              <Pill tone={checkState === "ok" ? "good" : checkState === "checking" ? "warn" : "neutral"}>
                {checkState === "ok" ? "Valid (mock)" : checkState === "checking" ? "Verifying…" : "Not verified"}
              </Pill>
            </div>
            {checkState === "ok" && (
              <div className="onboarding-mock-result">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Mock verification passed</strong>
                  <p className="muted">Plan: Pi Edge · Stamps remaining: 10,000 · Region: EU</p>
                </div>
              </div>
            )}
          </div>

          <div className="button-row">
            <button type="button" onClick={onVerifyKey} disabled={!form.integritasApiKey || checkState === "checking"}>
              {checkState === "checking" ? "Verifying…" : "Verify API key"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CompleteStep({ form, minimaOk, integritasOk }: { form: OnboardingFormState; minimaOk: boolean; integritasOk: boolean }) {
  const items = [
    { label: "Admin account", detail: form.username ? `User “${form.username}”` : "Not set", ok: Boolean(form.username && form.password) },
    { label: "Local sign-in", detail: form.requireLocalAuth ? "Required on LAN" : "Optional", ok: true },
    { label: "Minima node", detail: minimaOk ? "Connection tested (mock)" : "Not tested yet", ok: minimaOk },
    {
      label: "Integritas stamping",
      detail: form.skipIntegritas ? "Skipped — configure later" : integritasOk ? "API key verified (mock)" : "Key not verified",
      ok: form.skipIntegritas || integritasOk
    }
  ];

  return (
    <div className="onboarding-panel">
      <p className="eyebrow">All done</p>
      <h2>Your edge gateway is ready</h2>
      <p className="onboarding-lead">
        Review the summary below, then enter Edge Workbench. You can revisit any setting from the Setup and feature pages once real backend wiring is added.
      </p>

      <ul className="onboarding-summary-list">
        {items.map((item) => (
          <li key={item.label} className={cx("onboarding-summary-item", item.ok && "ok")}>
            <span className="onboarding-summary-icon">{item.ok ? <Check size={16} /> : <Circle size={16} />}</span>
            <div>
              <strong>{item.label}</strong>
              <p className="muted">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="onboarding-note muted">
        Clicking finish will mark setup complete in your browser only and open the main dashboard mockup.
      </p>
    </div>
  );
}

export function OnboardingWizard({ onComplete, onSkip }: { onComplete: () => void; onSkip?: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setFormState] = useState<OnboardingFormState>(initialForm);
  const [minimaCheck, setMinimaCheck] = useState<MockCheckState>("idle");
  const [integritasCheck, setIntegritasCheck] = useState<MockCheckState>("idle");

  const currentStep = onboardingSteps[stepIndex];
  const progress = ((stepIndex + 1) / onboardingSteps.length) * 100;

  const setForm = (patch: Partial<OnboardingFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
    if ("integritasApiKey" in patch || "skipIntegritas" in patch) setIntegritasCheck("idle");
  };

  const canContinue = useMemo(() => {
    switch (currentStep.id) {
      case "welcome":
        return true;
      case "account":
        return (
          form.username.trim().length >= 2 &&
          form.password.length >= 8 &&
          form.password === form.confirmPassword
        );
      case "minima":
        return form.minimaMdsPassword.length >= 4;
      case "integritas":
        return form.skipIntegritas || form.integritasApiKey.length >= 8;
      case "complete":
        return true;
      default:
        return false;
    }
  }, [currentStep.id, form]);

  const goNext = () => {
    if (stepIndex < onboardingSteps.length - 1) setStepIndex((index) => index + 1);
    else onComplete();
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((index) => index - 1);
  };

  const mockDelay = (setter: (state: MockCheckState) => void) => {
    setter("checking");
    window.setTimeout(() => setter("ok"), 900);
  };

  return (
    <div className="onboarding-root">
      <header className="onboarding-header">
        <div className="onboarding-brand">
          <div className="brand-icon"><Layers3 size={24} /></div>
          <div>
            <p>Minima Edge Stack</p>
            <h1>First-time setup</h1>
          </div>
        </div>
        <Pill tone="future">UI mockup</Pill>
      </header>

      <div className="onboarding-progress">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="onboarding-body">
        <aside className="onboarding-sidebar">
          <p className="onboarding-sidebar-title">Setup steps</p>
          <ol className="onboarding-step-list">
            {onboardingSteps.map((step, index) => {
              const complete = index < stepIndex;
              const active = index === stepIndex;
              return (
                <li key={step.id} className={cx("onboarding-step-item", active && "active", complete && "complete")}>
                  <StepIcon id={step.id} active={active} complete={complete} />
                  <div>
                    <span>{step.shortLabel}</span>
                    <strong>{step.label}</strong>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="onboarding-content card">
          {currentStep.id === "welcome" && <WelcomeStep />}
          {currentStep.id === "account" && <AccountStep form={form} setForm={setForm} />}
          {currentStep.id === "minima" && (
            <MinimaStep
              form={form}
              setForm={setForm}
              checkState={minimaCheck}
              onTestConnection={() => mockDelay(setMinimaCheck)}
            />
          )}
          {currentStep.id === "integritas" && (
            <IntegritasStep
              form={form}
              setForm={setForm}
              checkState={integritasCheck}
              onVerifyKey={() => mockDelay(setIntegritasCheck)}
            />
          )}
          {currentStep.id === "complete" && (
            <CompleteStep form={form} minimaOk={minimaCheck === "ok"} integritasOk={integritasCheck === "ok"} />
          )}

          <footer className="onboarding-footer">
            <div className="onboarding-footer-left">
              {stepIndex > 0 ? (
                <button type="button" className="onboarding-secondary" onClick={goBack}>
                  <ArrowLeft size={16} /> Back
                </button>
              ) : onSkip ? (
                <button type="button" className="onboarding-secondary" onClick={onSkip}>
                  Skip for now
                </button>
              ) : (
                <span />
              )}
            </div>
            <div className="onboarding-footer-right">
              <span className="muted">
                Step {stepIndex + 1} of {onboardingSteps.length}
              </span>
              <button type="button" disabled={!canContinue} onClick={goNext}>
                {currentStep.id === "complete" ? "Enter Edge Workbench" : "Continue"}
                {currentStep.id !== "complete" && <ArrowRight size={16} />}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
