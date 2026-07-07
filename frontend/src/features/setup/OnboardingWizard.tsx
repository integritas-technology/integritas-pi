import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
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
import { completeSetup, initTotp, verifyIntegritasKey, verifyTotp } from "./api";
import { INTEGRITAS_STEP_REQUIRED } from "./config";
import { onboardingSteps } from "./steps";
import type { CheckState, OnboardingFormState, OnboardingStepId } from "./types";
import "./onboarding.css";

const TOTP_ACCOUNT_LABEL = "Edge Workbench";

const initialForm: OnboardingFormState = {
  password: "",
  confirmPassword: "",
  twoFactorCode: "",
  integritasApiKey: "",
};

type PillTone = "neutral" | "good" | "warn" | "future";

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: PillTone;
}) {
  return (
    <span className={cx("mock-onboarding-pill", `mock-onboarding-pill-${tone}`)}>
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
            Poll input sources, track stamp history, and keep services healthy
            without leaving your Pi.
          </p>
        </article>
      </div>
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
      <h2>Set your admin password</h2>
      <p className="mock-onboarding-lead">
        Choose the password used to sign in to Edge Workbench.
      </p>

      <div className="mock-onboarding-form-grid">
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
  qrCode,
  totpSecret,
  loadingQr,
  qrError,
  checkState,
  onVerifyCode,
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
  qrCode: string | null;
  totpSecret: string | null;
  loadingQr: boolean;
  qrError: string | null;
  checkState: CheckState;
  onVerifyCode: () => void;
}) {
  const [showManualKey, setShowManualKey] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const copyManualKey = async () => {
    if (!totpSecret) return;
    try {
      await navigator.clipboard.writeText(totpSecret);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("idle");
    }
  };

  return (
    <div className="mock-onboarding-panel">
      <p className="mock-onboarding-eyebrow">Step 2 of 3</p>
      <h2>Set up two-factor authentication</h2>
      <p className="mock-onboarding-lead">
        Scan the QR code with your authenticator app, or enter the setup key
        manually if scanning fails. Then enter the current 6-digit code to
        confirm it is working.
      </p>

      <div className="mock-onboarding-2fa-layout">
        {loadingQr ? (
          <p className="mock-onboarding-muted">Generating QR code…</p>
        ) : qrError ? (
          <p className="error-text">{qrError}</p>
        ) : qrCode ? (
          <img
            src={qrCode}
            alt="TOTP QR code"
            className="mock-onboarding-qr-image"
          />
        ) : null}

        <div className="mock-onboarding-form-grid">
          {totpSecret ? (
            <div className="mock-onboarding-manual-key">
              <div className="mock-onboarding-manual-key-header">
                <label className="mock-onboarding-label m-0" htmlFor="setup-manual-key">
                  Manual setup key
                </label>
                <button
                  type="button"
                  className="mock-onboarding-btn-secondary mock-onboarding-btn-compact"
                  onClick={() => setShowManualKey((visible) => !visible)}
                  aria-pressed={showManualKey}
                >
                  {showManualKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showManualKey ? "Hide key" : "Show key"}
                </button>
              </div>
              <p className="mock-onboarding-muted text-sm">
                Use issuer <strong>Integritas Pi</strong> and account{" "}
                <strong>{TOTP_ACCOUNT_LABEL}</strong> if your app asks for them.
              </p>
              <div className="mock-onboarding-manual-key-row">
                <input
                  id="setup-manual-key"
                  className="mock-onboarding-input mock-onboarding-manual-key-input"
                  readOnly
                  value={showManualKey ? totpSecret : "•".repeat(Math.min(totpSecret.length, 32))}
                  aria-label="Authenticator setup key"
                />
                <button
                  type="button"
                  className="mock-onboarding-btn-secondary mock-onboarding-btn-compact"
                  onClick={() => void copyManualKey()}
                  title="Copy setup key"
                >
                  <Copy size={16} />
                  {copyState === "copied" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : null}

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
        </div>
      </div>

      <div className="mock-onboarding-status-card">
        <div className="mock-onboarding-status-row">
          <div>
            <strong>Authenticator check</strong>
            <p>Confirms your app is generating valid codes.</p>
          </div>
          <Pill
            tone={
              checkState === "ok"
                ? "good"
                : checkState === "checking"
                  ? "warn"
                  : checkState === "error"
                    ? "warn"
                    : "neutral"
            }
          >
            {checkState === "ok"
              ? "Verified"
              : checkState === "checking"
                ? "Verifying…"
                : checkState === "error"
                  ? "Invalid code"
                  : "Not verified"}
          </Pill>
        </div>
        {checkState === "ok" && (
          <div className="mock-onboarding-mock-result">
            <CheckCircle2 size={18} />
            <div>
              <strong>Authenticator linked</strong>
              <p>You can continue with the rest of setup.</p>
            </div>
          </div>
        )}
        <div className="mock-onboarding-action-row">
          <button
            type="button"
            className="mock-onboarding-btn-primary"
            onClick={onVerifyCode}
            disabled={form.twoFactorCode.length !== 6 || checkState === "checking" || !qrCode}
          >
            {checkState === "checking" ? "Verifying…" : "Verify code"}
          </button>
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
  integritasSkipped,
  onSkip,
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
  checkState: CheckState;
  onVerifyKey: () => void;
  integritasSkipped: boolean;
  onSkip: () => void;
}) {
  return (
    <div className="mock-onboarding-panel">
      <p className="mock-onboarding-eyebrow">Step 3 of 3</p>
      <h2>Connect Integritas</h2>
      <p className="mock-onboarding-lead">
        {INTEGRITAS_STEP_REQUIRED
          ? "Paste your Integritas API key and verify it before continuing."
          : "Paste your Integritas API key now, or skip and configure it later from the Integritas page."}
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
            disabled={integritasSkipped}
          />
        </label>
      </div>

      <div className="mock-onboarding-status-card">
        <div className="mock-onboarding-status-row">
          <div>
            <strong>API key check</strong>
            <p>Validates the key with Integritas.</p>
          </div>
          <Pill
            tone={
              integritasSkipped
                ? "neutral"
                : checkState === "ok"
                  ? "good"
                  : checkState === "checking"
                    ? "warn"
                    : "neutral"
            }
          >
            {integritasSkipped
              ? "Skipped"
              : checkState === "ok"
                ? "Valid"
                : checkState === "checking"
                  ? "Verifying…"
                  : "Not verified"}
          </Pill>
        </div>
        {checkState === "ok" && !integritasSkipped && (
          <div className="mock-onboarding-mock-result">
            <CheckCircle2 size={18} />
            <div>
              <strong>API key verified</strong>
              <p>Your key will be saved when you finish setup.</p>
            </div>
          </div>
        )}
        <div className="mock-onboarding-action-row">
          <button
            type="button"
            className="mock-onboarding-btn-primary"
            onClick={onVerifyKey}
            disabled={!form.integritasApiKey || checkState === "checking" || integritasSkipped}
          >
            {checkState === "checking" ? "Verifying…" : "Verify API key"}
          </button>
          {!INTEGRITAS_STEP_REQUIRED ? (
            <button
              type="button"
              className="mock-onboarding-btn-secondary"
              onClick={onSkip}
              disabled={integritasSkipped}
            >
              Skip for now
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CompleteStep({
  passwordSet,
  totpVerified,
  integritasSkipped,
  integritasVerified,
}: {
  passwordSet: boolean;
  totpVerified: boolean;
  integritasSkipped: boolean;
  integritasVerified: boolean;
}) {
  const configured = [
    {
      label: "Admin password",
      detail: passwordSet ? "Configured" : "Not set",
    },
    {
      label: "Two-factor auth",
      detail: totpVerified ? "Authenticator linked" : "Not verified",
    },
    {
      label: "Integritas",
      detail: integritasSkipped
        ? "Skipped — configure later"
        : integritasVerified
          ? "API key verified"
          : "Not configured",
    },
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
    </div>
  );
}

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setFormState] = useState<OnboardingFormState>(initialForm);
  const [totpCheck, setTotpCheck] = useState<CheckState>("idle");
  const [integritasCheck, setIntegritasCheck] = useState<CheckState>("idle");
  const [integritasSkipped, setIntegritasSkipped] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    if ("twoFactorCode" in patch) {
      setTotpCheck("idle");
    }
    if ("integritasApiKey" in patch) {
      setIntegritasCheck("idle");
      setIntegritasSkipped(false);
    }
  };

  useEffect(() => {
    if (currentStep.id !== "twofa") return;
    if (qrCode || loadingQr) return;

    setLoadingQr(true);
    setQrError(null);
    initTotp()
      .then((result) => {
        setQrCode(result.qrCodePngBase64);
        setTotpSecret(result.secret);
      })
      .catch((err: Error) => setQrError(err.message))
      .finally(() => setLoadingQr(false));
  }, [currentStep.id, qrCode, loadingQr]);

  const canContinue = useMemo(() => {
    switch (currentStep.id) {
      case "welcome":
        return true;
      case "account":
        return (
          form.password.length >= 8 &&
          form.password === form.confirmPassword
        );
      case "twofa":
        return totpCheck === "ok" && Boolean(qrCode) && !qrError;
      case "integritas":
        if (INTEGRITAS_STEP_REQUIRED) return integritasCheck === "ok";
        return integritasCheck === "ok" || integritasSkipped;
      case "complete":
        return true;
      default:
        return false;
    }
  }, [currentStep.id, form, totpCheck, integritasCheck, integritasSkipped, qrCode, qrError]);

  const goNext = async () => {
    if (currentStep.id === "complete") {
      setSubmitting(true);
      setSubmitError(null);
      try {
        await completeSetup({
          password: form.password,
          integritasApiKey: integritasSkipped ? undefined : form.integritasApiKey || undefined,
        });
        onComplete();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Setup failed");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (stepIndex < onboardingSteps.length - 1) {
      setStepIndex((index) => index + 1);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((index) => index - 1);
  };

  const verifyTotpCode = async () => {
    setTotpCheck("checking");
    try {
      await verifyTotp(form.twoFactorCode);
      setTotpCheck("ok");
    } catch {
      setTotpCheck("error");
    }
  };

  const verifyIntegritas = async () => {
    setIntegritasCheck("checking");
    try {
      await verifyIntegritasKey(form.integritasApiKey);
      setIntegritasCheck("ok");
    } catch {
      setIntegritasCheck("error");
    }
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
                  qrCode={qrCode}
                  totpSecret={totpSecret}
                  loadingQr={loadingQr}
                  qrError={qrError}
                  checkState={totpCheck}
                  onVerifyCode={() => void verifyTotpCode()}
                />
              )}
              {currentStep.id === "integritas" && (
                <IntegritasStep
                  form={form}
                  setForm={setForm}
                  checkState={integritasCheck}
                  onVerifyKey={() => void verifyIntegritas()}
                  integritasSkipped={integritasSkipped}
                  onSkip={() => {
                    setIntegritasSkipped(true);
                    setIntegritasCheck("idle");
                  }}
                />
              )}
              {currentStep.id === "complete" && (
                <CompleteStep
                  passwordSet={form.password.length >= 8}
                  totpVerified={totpCheck === "ok"}
                  integritasSkipped={integritasSkipped}
                  integritasVerified={integritasCheck === "ok"}
                />
              )}
            </div>

            {submitError ? <p className="error-text px-6">{submitError}</p> : null}

            <footer className="mock-onboarding-footer">
              <div>
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    className="mock-onboarding-btn-secondary"
                    onClick={goBack}
                    disabled={submitting}
                  >
                    <ArrowLeft size={16} /> Back
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
                  disabled={!canContinue || submitting}
                  onClick={() => void goNext()}
                >
                  {submitting
                    ? "Finishing…"
                    : currentStep.id === "complete"
                      ? "Enter Edge Workbench"
                      : "Continue"}
                  {currentStep.id !== "complete" && !submitting && (
                    <ArrowRight size={16} />
                  )}
                </button>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
