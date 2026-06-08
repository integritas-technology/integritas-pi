import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stamp,
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

const MOCK_2FA_SECRET = "JBSWY3DPEHPK3PXP";
const MOCK_QR_PATTERN = [
  1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
  1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0,
];

const initialForm: OnboardingFormState = {
  username: "",
  password: "",
  confirmPassword: "",
  twoFactorCode: "",
  integritasApiKey: "",
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
    twofa: Smartphone,
    integritas: KeyRound,
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

function MockQrCode() {
  return (
    <div className="mock-onboarding-qr" aria-hidden="true">
      {MOCK_QR_PATTERN.map((on, index) => (
        <span
          key={index}
          className={cx(
            "mock-onboarding-qr-cell",
            on === 1 && "mock-onboarding-qr-cell-on",
          )}
        />
      ))}
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="mock-onboarding-panel">
      <p className="mock-onboarding-eyebrow">First-time setup</p>
      <h2>Welcome to Edge Workbench</h2>
      <p className="mock-onboarding-lead">
        Edge Workbench runs on your Raspberry Pi to stamp data proofs, monitor
        local services, and automate integrity checks — all from one dashboard on
        your network.
      </p>

      <div className="mock-onboarding-feature-grid">
        <article className="mock-onboarding-feature-card">
          <LockKeyhole size={22} />
          <h3>Secure access</h3>
          <p>
            Sign in with a local admin account and two-factor authentication to
            protect configuration on your LAN.
          </p>
        </article>
        <article className="mock-onboarding-feature-card">
          <Stamp size={22} />
          <h3>Stamp proofs</h3>
          <p>
            Hash files and API responses, then anchor them on your embedded
            Minima node through Integritas.
          </p>
        </article>
        <article className="mock-onboarding-feature-card">
          <ShieldCheck size={22} />
          <h3>Run at the edge</h3>
          <p>
            Poll data sources, track stamp history, and keep services healthy
            without leaving your Pi.
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
        Choose the username and password used to sign in to Edge Workbench.
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
      </div>
    </div>
  );
}

function TwoFactorStep({
  form,
  setForm,
  checkState,
  onVerify,
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
  checkState: MockCheckState;
  onVerify: () => void;
}) {
  return (
    <div className="mock-onboarding-panel">
      <p className="mock-onboarding-eyebrow">Step 2 of 3</p>
      <h2>Set up two-factor authentication</h2>
      <p className="mock-onboarding-lead">
        Scan the QR code with your authenticator app, then enter the 6-digit
        code to confirm setup.
      </p>

      <div className="mock-onboarding-2fa-layout">
        <MockQrCode />
        <div className="mock-onboarding-form-grid">
          <div>
            <p className="mock-onboarding-muted m-0 mb-2 text-sm">
              Or enter this key manually:
            </p>
            <code className="inline-block rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-semibold text-slate-800">
              {MOCK_2FA_SECRET}
            </code>
          </div>

          <label className="mock-onboarding-label">
            Confirmation code
            <input
              className="mock-onboarding-code-input"
              value={form.twoFactorCode}
              onChange={(event) =>
                setForm({
                  twoFactorCode: event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6),
                })
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
            />
          </label>

          <div className="mock-onboarding-action-row">
            <button
              type="button"
              className="mock-onboarding-btn-primary"
              onClick={onVerify}
              disabled={form.twoFactorCode.length !== 6 || checkState === "checking"}
            >
              {checkState === "checking" ? "Verifying…" : "Verify code"}
            </button>
            {checkState === "ok" && (
              <MockPill tone="good">Confirmed (mock)</MockPill>
            )}
          </div>
        </div>
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
        Paste your Integritas API key. You must verify it before continuing.
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
            if you do not have one yet.
          </p>
        </div>
      </div>

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
              <p>Plan: Pi Edge · Stamps remaining: 10,000</p>
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
    </div>
  );
}

function CompleteStep({ form }: { form: OnboardingFormState }) {
  const configured = [
    {
      label: "Admin account",
      detail: form.username ? `User “${form.username}”` : "Not set",
    },
    { label: "Two-factor auth", detail: "Authenticator linked (mock)" },
    { label: "Integritas", detail: "API key verified (mock)" },
  ];

  const automatic = [
    "Minima node health and peer connectivity",
    "Wallet lock and local security defaults",
    "Background services and stamp polling",
  ];

  return (
    <div className="mock-onboarding-panel">
      <p className="mock-onboarding-eyebrow">All done</p>
      <h2>Your edge gateway is ready</h2>
      <p className="mock-onboarding-lead">
        You have finished the required setup. Edge Workbench will initialise
        everything else silently when you continue.
      </p>

      <ul className="mock-onboarding-summary-list">
        {configured.map((item) => (
          <li
            key={item.label}
            className="mock-onboarding-summary-item mock-onboarding-summary-item-ok"
          >
            <span className="mock-onboarding-summary-icon mock-onboarding-summary-icon-ok">
              <Check size={16} />
            </span>
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mock-onboarding-info-callout">
        <Sparkles size={20} />
        <div>
          <strong>Configures automatically</strong>
          <ul className="mock-onboarding-muted m-0 mt-2 pl-4 text-sm leading-relaxed">
            {automatic.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mock-onboarding-note">
        Clicking finish marks setup complete in your browser only and opens the
        main dashboard mockup.
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
  const [twoFactorCheck, setTwoFactorCheck] = useState<MockCheckState>("idle");
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
    if ("twoFactorCode" in patch) setTwoFactorCheck("idle");
    if ("integritasApiKey" in patch) setIntegritasCheck("idle");
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
      case "twofa":
        return twoFactorCheck === "ok";
      case "integritas":
        return integritasCheck === "ok";
      case "complete":
        return true;
      default:
        return false;
    }
  }, [currentStep.id, form, twoFactorCheck, integritasCheck]);

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
              {currentStep.id === "twofa" && (
                <TwoFactorStep
                  form={form}
                  setForm={setForm}
                  checkState={twoFactorCheck}
                  onVerify={() => mockDelay(setTwoFactorCheck)}
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
              {currentStep.id === "complete" && <CompleteStep form={form} />}
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
                    Continue as guest
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
