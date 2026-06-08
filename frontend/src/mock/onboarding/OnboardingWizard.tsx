import { useEffect, useMemo, useState } from "react";
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
  UserRound,
} from "lucide-react";
import { cx } from "../../lib/cx";
import { onboardingSteps } from "./steps";
import type {
  MockCheckState,
  OnboardingFormState,
  OnboardingStepId,
} from "./types";
import "./onboarding.css";

const initialForm: OnboardingFormState = {
  username: "",
  password: "",
  confirmPassword: "",
  requireLocalAuth: true,
  minimaMdsPassword: "",
  minimaAutoConnect: true,
  integritasApiKey: "",
  skipIntegritas: false,
};

type PillTone = "neutral" | "good" | "warn" | "future";

function MockPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: PillTone;
}) {
  return (
    <span
      className={cx("mock-onboarding-pill", `mock-onboarding-pill-${tone}`)}
    >
      {children}
    </span>
  );
}

function passwordStrength(password: string): {
  label: string;
  tone: "warn" | "good" | "neutral";
} {
  if (!password) return { label: "Enter a password", tone: "neutral" };
  if (password.length < 8) return { label: "Too short", tone: "warn" };
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
    return { label: "Fair — add a number and capital letter", tone: "warn" };
  return { label: "Strong", tone: "good" };
}

function StepIcon({
  id,
  active,
  complete,
}: {
  id: OnboardingStepId;
  active: boolean;
  complete: boolean;
}) {
  const icons = {
    welcome: Sparkles,
    account: UserRound,
    minima: RadioTower,
    integritas: ShieldCheck,
    complete: CheckCircle2,
  };
  const Icon = complete ? Check : icons[id];
  return (
    <div
      className={cx(
        "mock-onboarding-step-icon",
        active && "mock-onboarding-step-icon-active",
        complete && "mock-onboarding-step-icon-complete",
      )}
      aria-hidden="true"
    >
      <Icon size={18} strokeWidth={2} />
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="mock-onboarding-panel">
      <p className="mock-onboarding-eyebrow">First-time setup</p>
      <h2>Welcome to Edge Workbench</h2>
      <p className="mock-onboarding-lead">
        This wizard walks you through securing your Pi gateway, confirming the
        Minima node, and connecting Integritas stamping — similar to a Debian or
        Ubuntu desktop installer.
      </p>

      <div className="mock-onboarding-feature-grid">
        <article className="mock-onboarding-feature-card">
          <LockKeyhole size={22} />
          <h3>Protect the dashboard</h3>
          <p>
            Create a local admin account so only authorised users can change
            settings on your network.
          </p>
        </article>
        <article className="mock-onboarding-feature-card">
          <RadioTower size={22} />
          <h3>Confirm Minima</h3>
          <p>
            Minima is the embedded blockchain node that anchors proofs. We will
            check the local node and set access credentials.
          </p>
        </article>
        <article className="mock-onboarding-feature-card">
          <ShieldCheck size={22} />
          <h3>Connect Integritas</h3>
          <p>
            Integritas stamps data hashes to Minima so you can prove when files
            and API responses existed.
          </p>
        </article>
      </div>

      <p className="mock-onboarding-note">
        This is a UI mockup only. Nothing you enter here is saved or sent to the
        backend yet.
      </p>
    </div>
  );
}

function AccountStep({
  form,
  setForm,
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
}) {
  const strength = passwordStrength(form.password);
  const passwordsMatch =
    !form.confirmPassword || form.password === form.confirmPassword;

  return (
    <div className="mock-onboarding-panel">
      <p className="mock-onboarding-eyebrow">Step 1 of 3</p>
      <h2>Create your admin account</h2>
      <p className="mock-onboarding-lead">
        Set the username and password used to sign in to Edge Workbench. This
        protects configuration, API keys, and operational controls.
      </p>

      <div className="mock-onboarding-form-grid">
        <label className="mock-onboarding-label">
          Username
          <input
            className="mock-onboarding-input"
            value={form.username}
            onChange={(event) => setForm({ username: event.target.value })}
            placeholder="admin"
            autoComplete="username"
          />
          <span className="mock-onboarding-muted">
            Lowercase letters and numbers recommended.
          </span>
        </label>

        <label className="mock-onboarding-label">
          Password
          <input
            className="mock-onboarding-input"
            value={form.password}
            onChange={(event) => setForm({ password: event.target.value })}
            type="password"
            placeholder="Choose a strong password"
            autoComplete="new-password"
          />
          <span
            className={cx(
              strength.tone === "good" && "mock-onboarding-hint-good",
              strength.tone === "warn" && "mock-onboarding-hint-warn",
              strength.tone === "neutral" && "mock-onboarding-muted",
            )}
          >
            {strength.label}
          </span>
        </label>

        <label className="mock-onboarding-label">
          Confirm password
          <input
            className="mock-onboarding-input"
            value={form.confirmPassword}
            onChange={(event) =>
              setForm({ confirmPassword: event.target.value })
            }
            type="password"
            placeholder="Repeat password"
            autoComplete="new-password"
          />
          {!passwordsMatch && (
            <span className="mock-onboarding-hint-warn">
              Passwords do not match
            </span>
          )}
        </label>

        <label className="mock-onboarding-check-row">
          <input
            type="checkbox"
            checked={form.requireLocalAuth}
            onChange={(event) =>
              setForm({ requireLocalAuth: event.target.checked })
            }
          />
          <span>
            <strong>Require sign-in on the local network</strong>
            <span className="mock-onboarding-muted">
              Recommended for Pi devices reachable from more than one machine.
            </span>
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
  onTestConnection,
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
  checkState: MockCheckState;
  onTestConnection: () => void;
}) {
  return (
    <div className="mock-onboarding-panel">
      <p className="mock-onboarding-eyebrow">Step 2 of 3</p>
      <h2>Configure Minima</h2>
      <p className="mock-onboarding-lead">
        Minima runs as a lightweight full node on your Pi. Integritas uses it to
        anchor stamp proofs. Confirm the bundled node is reachable and set the
        MiniDapp System password.
      </p>

      <div className="mock-onboarding-status-card">
        <div className="mock-onboarding-status-row">
          <div>
            <strong>Local Minima container</strong>
            <p>Docker service: minima (ports 9001–9003)</p>
          </div>
          <MockPill
            tone={
              checkState === "ok"
                ? "good"
                : checkState === "checking"
                  ? "warn"
                  : "neutral"
            }
          >
            {checkState === "ok"
              ? "Reachable"
              : checkState === "checking"
                ? "Checking…"
                : "Not tested"}
          </MockPill>
        </div>
        {checkState === "ok" && (
          <div className="mock-onboarding-mock-result">
            <CheckCircle2 size={18} />
            <div>
              <strong>Mock connection successful</strong>
              <p>Node version 1.0.42 · Peers: 4 · Chain height: 1,284,901</p>
            </div>
          </div>
        )}
        <div className="mock-onboarding-action-row">
          <button
            type="button"
            className="mock-onboarding-btn-primary"
            onClick={onTestConnection}
            disabled={checkState === "checking"}
          >
            {checkState === "checking" ? "Testing…" : "Test Minima connection"}
          </button>
        </div>
      </div>

      <div className="mock-onboarding-form-grid">
        <label className="mock-onboarding-label">
          MDS password
          <input
            className="mock-onboarding-input"
            value={form.minimaMdsPassword}
            onChange={(event) =>
              setForm({ minimaMdsPassword: event.target.value })
            }
            type="password"
            placeholder="MiniDapp System password"
          />
          <span className="mock-onboarding-muted">
            Used to access Minima miniDapps and RPC from this workbench.
          </span>
        </label>

        <label className="mock-onboarding-check-row">
          <input
            type="checkbox"
            checked={form.minimaAutoConnect}
            onChange={(event) =>
              setForm({ minimaAutoConnect: event.target.checked })
            }
          />
          <span>
            <strong>Auto-connect to default peers</strong>
            <span className="mock-onboarding-muted">
              Join the Minima network using bundled peer list
              (megammr.minima.global).
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

function IntegritasStep({
  form,
  setForm,
  checkState,
  onVerifyKey,
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
  checkState: MockCheckState;
  onVerifyKey: () => void;
}) {
  return (
    <div className="mock-onboarding-panel">
      <p className="mock-onboarding-eyebrow">Step 3 of 3</p>
      <h2>Connect Integritas</h2>
      <p className="mock-onboarding-lead">
        Integritas hashes your files and API data, then anchors those hashes on
        Minima. You need an API key from Integritas to stamp and verify proofs
        from this Pi.
      </p>

      <div className="mock-onboarding-info-callout">
        <KeyRound size={20} />
        <div>
          <strong>Get an API key</strong>
          <p className="mock-onboarding-muted">
            Sign up at{" "}
            <a
              href="https://integritas.technology/"
              target="_blank"
              rel="noreferrer"
            >
              integritas.technology <ExternalLink size={14} />
            </a>{" "}
            and paste the key below. You can skip this step and configure it
            later in the Integritas page.
          </p>
        </div>
      </div>

      <label className="mock-onboarding-check-row mock-onboarding-skip-row">
        <input
          type="checkbox"
          checked={form.skipIntegritas}
          onChange={(event) =>
            setForm({ skipIntegritas: event.target.checked })
          }
        />
        <span>
          <strong>Skip for now</strong>
          <span className="mock-onboarding-muted">
            Finish setup without stamping enabled. Manual stamps and automation
            will stay disabled.
          </span>
        </span>
      </label>

      {!form.skipIntegritas && (
        <>
          <div className="mock-onboarding-form-grid">
            <label className="mock-onboarding-label">
              Integritas API key
              <input
                className="mock-onboarding-input"
                value={form.integritasApiKey}
                onChange={(event) =>
                  setForm({ integritasApiKey: event.target.value })
                }
                type="password"
                placeholder="Paste API key"
              />
            </label>
          </div>

          <div className="mock-onboarding-status-card">
            <div className="mock-onboarding-status-row">
              <div>
                <strong>API key check</strong>
                <p>Validates format and mock quota status.</p>
              </div>
              <MockPill
                tone={
                  checkState === "ok"
                    ? "good"
                    : checkState === "checking"
                      ? "warn"
                      : "neutral"
                }
              >
                {checkState === "ok"
                  ? "Valid (mock)"
                  : checkState === "checking"
                    ? "Verifying…"
                    : "Not verified"}
              </MockPill>
            </div>
            {checkState === "ok" && (
              <div className="mock-onboarding-mock-result">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Mock verification passed</strong>
                  <p>Plan: Pi Edge · Stamps remaining: 10,000 · Region: EU</p>
                </div>
              </div>
            )}
            <div className="mock-onboarding-action-row">
              <button
                type="button"
                className="mock-onboarding-btn-primary"
                onClick={onVerifyKey}
                disabled={!form.integritasApiKey || checkState === "checking"}
              >
                {checkState === "checking" ? "Verifying…" : "Verify API key"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CompleteStep({
  form,
  minimaOk,
  integritasOk,
}: {
  form: OnboardingFormState;
  minimaOk: boolean;
  integritasOk: boolean;
}) {
  const items = [
    {
      label: "Admin account",
      detail: form.username ? `User “${form.username}”` : "Not set",
      ok: Boolean(form.username && form.password),
    },
    {
      label: "Local sign-in",
      detail: form.requireLocalAuth ? "Required on LAN" : "Optional",
      ok: true,
    },
    {
      label: "Minima node",
      detail: minimaOk ? "Connection tested (mock)" : "Not tested yet",
      ok: minimaOk,
    },
    {
      label: "Integritas stamping",
      detail: form.skipIntegritas
        ? "Skipped — configure later"
        : integritasOk
          ? "API key verified (mock)"
          : "Key not verified",
      ok: form.skipIntegritas || integritasOk,
    },
  ];

  return (
    <div className="mock-onboarding-panel">
      <p className="mock-onboarding-eyebrow">All done</p>
      <h2>Your edge gateway is ready</h2>
      <p className="mock-onboarding-lead">
        Review the summary below, then enter Edge Workbench. You can revisit any
        setting from the Setup and feature pages once real backend wiring is
        added.
      </p>

      <ul className="mock-onboarding-summary-list">
        {items.map((item) => (
          <li
            key={item.label}
            className={cx(
              "mock-onboarding-summary-item",
              item.ok && "mock-onboarding-summary-item-ok",
            )}
          >
            <span
              className={cx(
                "mock-onboarding-summary-icon",
                item.ok && "mock-onboarding-summary-icon-ok",
              )}
            >
              {item.ok ? <Check size={16} /> : <Circle size={16} />}
            </span>
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mock-onboarding-note">
        Clicking finish will mark setup complete in your browser only and open
        the main dashboard mockup.
      </p>
    </div>
  );
}

export function OnboardingWizard({
  onComplete,
  onSkip,
}: {
  onComplete: () => void;
  onSkip?: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setFormState] = useState<OnboardingFormState>(initialForm);
  const [minimaCheck, setMinimaCheck] = useState<MockCheckState>("idle");
  const [integritasCheck, setIntegritasCheck] =
    useState<MockCheckState>("idle");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const currentStep = onboardingSteps[stepIndex];
  const progress = ((stepIndex + 1) / onboardingSteps.length) * 100;

  const setForm = (patch: Partial<OnboardingFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
    if ("integritasApiKey" in patch || "skipIntegritas" in patch)
      setIntegritasCheck("idle");
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
    if (stepIndex < onboardingSteps.length - 1)
      setStepIndex((index) => index + 1);
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
    <div className="mock-onboarding-root">
      <div
        className="mock-onboarding-shell"
        role="main"
        aria-label="First-time setup"
      >
        <header className="mock-onboarding-header">
          <div className="mock-onboarding-brand">
            <div className="mock-onboarding-brand-icon">
              <Layers3 size={24} />
            </div>
            <div>
              <p>Minima Edge Stack</p>
              <h1>First-time setup</h1>
            </div>
          </div>
          <MockPill tone="future">UI mockup</MockPill>
        </header>

        <div className="mock-onboarding-progress-track">
          <span
            className="mock-onboarding-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mock-onboarding-body">
          <aside className="mock-onboarding-sidebar">
            <p className="mock-onboarding-sidebar-title">Setup steps</p>
            <ol className="mock-onboarding-step-list">
              {onboardingSteps.map((step, index) => {
                const complete = index < stepIndex;
                const active = index === stepIndex;
                return (
                  <li
                    key={step.id}
                    className={cx(
                      "mock-onboarding-step-item",
                      active && "mock-onboarding-step-item-active",
                      complete && "mock-onboarding-step-item-complete",
                    )}
                  >
                    <StepIcon
                      id={step.id}
                      active={active}
                      complete={complete}
                    />
                    <div className="mock-onboarding-step-copy">
                      <span>{step.shortLabel}</span>
                      <strong>{step.label}</strong>
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="mock-onboarding-main">
            <div className="mock-onboarding-scroll">
              {currentStep.id === "welcome" && <WelcomeStep />}
              {currentStep.id === "account" && (
                <AccountStep form={form} setForm={setForm} />
              )}
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
                <CompleteStep
                  form={form}
                  minimaOk={minimaCheck === "ok"}
                  integritasOk={integritasCheck === "ok"}
                />
              )}
            </div>

            <footer className="mock-onboarding-footer">
              <div>
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    className="mock-onboarding-btn-secondary"
                    onClick={goBack}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>
                ) : onSkip ? (
                  <button
                    type="button"
                    className="mock-onboarding-btn-secondary"
                    onClick={onSkip}
                  >
                    Skip for now
                  </button>
                ) : (
                  <span />
                )}
              </div>
              <div className="mock-onboarding-footer-right">
                <span className="mock-onboarding-muted">
                  Step {stepIndex + 1} of {onboardingSteps.length}
                </span>
                <button
                  type="button"
                  className="mock-onboarding-btn-primary"
                  disabled={!canContinue}
                  onClick={goNext}
                >
                  {currentStep.id === "complete"
                    ? "Enter Edge Workbench"
                    : "Continue"}
                  {currentStep.id !== "complete" && <ArrowRight size={16} />}
                </button>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
