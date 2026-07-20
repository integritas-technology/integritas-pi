import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Layers3,
  Link2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stamp,
  UserRound
} from "lucide-react";
import { ErrorText } from "../../components/Text";
import { cx } from "../../lib/cx";
import {
  adminPinHint,
  isValidAdminCredential,
  sanitizePinInput,
  type AdminCredentialType
} from "../auth/adminCredentials";
import { PasswordRequirements } from "../auth/PasswordRequirements";
import { TOTP_ENABLED } from "../auth/totpEnabled";
import { hasConnectedProfile, type IntegritasAuthStatus } from "../integritas-auth/integritasAuthApi";
import { useIntegritasAuth } from "../integritas-auth/useIntegritasAuth";
import { completeSetup, initTotp, verifyTotp } from "./api";
import { onboardingSteps } from "./steps";
import type { CheckState, OnboardingFormState, OnboardingStepId } from "./types";

const TOTP_ACCOUNT_LABEL = "Edge Workbench";

const initialForm: OnboardingFormState = {
  credentialType: "pin",
  password: "",
  confirmPassword: "",
  twoFactorCode: ""
};

type PillTone = "neutral" | "good" | "warn" | "future";

const panelClass = "grid content-start gap-3 max-[700px]:gap-2";
const eyebrowClass = "m-0 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500";
const headingClass = "m-0 text-[clamp(1.4rem,2.2vw,1.85rem)] leading-tight text-slate-950";
const leadClass = "m-0 max-w-3xl text-sm leading-relaxed text-slate-600";
const formGridClass = "grid max-w-[520px] gap-2.5";
const labelClass = "grid gap-2 font-bold text-slate-700";
const inputClass = "w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-950";
const mutedClass = "text-sm font-medium text-slate-500";
const goodHintClass = "text-sm font-medium text-emerald-700";
const warnHintClass = "text-sm font-medium text-amber-700";
const statusCardClass = "grid max-w-2xl gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3";
const statusRowClass = "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between";
const statusTextClass = "mt-1 mb-0 text-slate-500";
const successResultClass = "flex items-start gap-2.5 rounded-xl bg-emerald-50 p-2.5 text-sm text-emerald-700";
const infoCalloutClass = "flex max-w-2xl items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3";
const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-xl border-0 bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButtonClass = "inline-flex items-center gap-2 rounded-xl border-0 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700";
const compactButtonClass = "inline-flex items-center gap-1.5 rounded-xl border-0 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700";
const actionRowClass = "flex flex-wrap items-center gap-2.5";
const connectAccountStepIndex = onboardingSteps.findIndex((step) => step.id === "connectAccount");

const pillToneClass: Record<PillTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  good: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  future: "bg-violet-100 text-violet-700"
};

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: PillTone }) {
  return (
    <span className={cx("inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold", pillToneClass[tone])}>{children}</span>
  );
}

function credentialHint(
  type: AdminCredentialType,
  credential: string
): {
  label: string;
  tone: "warn" | "good" | "neutral";
} {
  if (type === "pin") {
    if (!credential) return { label: `Enter a ${adminPinHint()}`, tone: "neutral" };
    if (!isValidAdminCredential(type, credential)) return { label: `Must be a ${adminPinHint()}`, tone: "warn" };
    return { label: "PIN looks good", tone: "good" };
  }

  if (!credential) return { label: "Complete the password requirements below", tone: "neutral" };
  if (!isValidAdminCredential(type, credential)) return { label: "Complete the remaining password requirements", tone: "warn" };
  return { label: "Password looks good", tone: "good" };
}

function StepIcon({ id, active, complete }: { id: OnboardingStepId; active: boolean; complete: boolean }) {
  const icons = {
    welcome: Sparkles,
    account: LockKeyhole,
    twofa: Smartphone,
    connectAccount: UserRound,
    complete: CheckCircle2
  };
  const Icon = complete ? Check : icons[id];
  return (
    <div
      className={cx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 [&_svg]:pointer-events-none",
        active && "bg-white text-slate-950",
        complete && "bg-green-600 text-white"
      )}
      aria-hidden="true"
    >
      <Icon size={18} strokeWidth={2} />
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className={panelClass}>
      <p className={eyebrowClass}>First-time setup</p>
      <h2 className={headingClass}>Set up your Edge Workbench</h2>
      <p className={leadClass}>
        Edge Workbench runs on your Raspberry Pi to stamp data proofs, monitor local services, and automate integrity checks — all from one
        dashboard on your network.
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <article className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <LockKeyhole size={22} />
          <h3 className="m-0 text-sm">Secure this device</h3>
          <p className="m-0 text-xs leading-relaxed text-slate-500">
            {TOTP_ENABLED
              ? "Choose a local admin PIN or password and two-factor authentication to protect configuration on your LAN."
              : "Choose a local admin PIN or password to protect configuration on your LAN."}
          </p>
        </article>
        <article className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Stamp size={22} />
          <h3 className="m-0 text-sm">Stamp proofs</h3>
          <p className="m-0 text-xs leading-relaxed text-slate-500">
            Hash files and API responses, then anchor them on your embedded Minima node through Integritas.
          </p>
        </article>
        <article className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <ShieldCheck size={22} />
          <h3 className="m-0 text-sm">Run at the edge</h3>
          <p className="m-0 text-xs leading-relaxed text-slate-500">
            Poll input sources, track stamp history, and keep services healthy without leaving your Pi.
          </p>
        </article>
      </div>
    </div>
  );
}

function AccountStep({ form, setForm }: { form: OnboardingFormState; setForm: (patch: Partial<OnboardingFormState>) => void }) {
  const hint = credentialHint(form.credentialType, form.password);
  const credentialsMatch = !form.confirmPassword || form.password === form.confirmPassword;
  const isPin = form.credentialType === "pin";
  const credentialLabel = isPin ? "PIN" : "Password";

  const selectCredentialType = (credentialType: AdminCredentialType) => {
    setForm({ credentialType, password: "", confirmPassword: "" });
  };

  return (
    <div className={panelClass}>
      <p className={eyebrowClass}>Secure this device</p>
      <h2 className={headingClass}>Choose a PIN or password</h2>
      <p className={leadClass}>This local credential unlocks Edge Workbench on this hardware.</p>

      <div className={formGridClass}>
        <fieldset className="grid gap-2 border-0 p-0">
          <legend className="mb-2 font-bold text-slate-700">Credential type</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["pin", "password"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={cx(
                  "rounded-xl border px-3 py-2.5 text-sm font-bold",
                  form.credentialType === type ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"
                )}
                aria-pressed={form.credentialType === type}
                onClick={() => selectCredentialType(type)}
              >
                {type === "pin" ? "6-digit PIN" : "Password"}
              </button>
            ))}
          </div>
        </fieldset>

        <label className={labelClass}>
          {credentialLabel}
          <input
            className={inputClass}
            value={form.password}
            onChange={(event) => setForm({ password: isPin ? sanitizePinInput(event.target.value) : event.target.value })}
            type="password"
            inputMode={isPin ? "numeric" : "text"}
            pattern={isPin ? "[0-9]*" : undefined}
            maxLength={isPin ? 6 : undefined}
            placeholder={isPin ? "000000" : "Create a strong password"}
            autoComplete="new-password"
          />
          <span
            className={cx(
              hint.tone === "good" && goodHintClass,
              hint.tone === "warn" && warnHintClass,
              hint.tone === "neutral" && mutedClass
            )}
          >
            {hint.label}
          </span>
        </label>
        {!isPin && <PasswordRequirements password={form.password} />}

        <label className={labelClass}>
          Confirm {credentialLabel.toLowerCase()}
          <input
            className={inputClass}
            value={form.confirmPassword}
            onChange={(event) => setForm({ confirmPassword: isPin ? sanitizePinInput(event.target.value) : event.target.value })}
            type="password"
            inputMode={isPin ? "numeric" : "text"}
            pattern={isPin ? "[0-9]*" : undefined}
            maxLength={isPin ? 6 : undefined}
            placeholder={`Repeat ${credentialLabel.toLowerCase()}`}
            autoComplete="new-password"
          />
          {!credentialsMatch && <span className={warnHintClass}>{credentialLabel}s do not match</span>}
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
  onVerifyCode
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
    <div className={panelClass}>
      <p className={eyebrowClass}>Two-factor auth</p>
      <h2 className={headingClass}>Set up two-factor authentication</h2>
      <p className={leadClass}>
        Scan the QR code with your authenticator app, or enter the setup key manually if scanning fails. Then enter the current 6-digit code
        to confirm it is working.
      </p>

      <div className="grid max-w-2xl gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        {loadingQr ? (
          <p className={mutedClass}>Generating QR code…</p>
        ) : qrError ? (
          <ErrorText>{qrError}</ErrorText>
        ) : qrCode ? (
          <img src={qrCode} alt="TOTP QR code" className="h-48 w-48 rounded-xl border border-slate-200 bg-white p-2" />
        ) : null}

        <div className={formGridClass}>
          {totpSecret ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className={cx(labelClass, "m-0")} htmlFor="setup-manual-key">
                  Manual setup key
                </label>
                <button
                  type="button"
                  className={compactButtonClass}
                  onClick={() => setShowManualKey((visible) => !visible)}
                  aria-pressed={showManualKey}
                >
                  {showManualKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showManualKey ? "Hide key" : "Show key"}
                </button>
              </div>
              <p className={cx(mutedClass, "text-sm")}>
                Use issuer <strong>Integritas Pi</strong> and account <strong>{TOTP_ACCOUNT_LABEL}</strong> if your app asks for them.
              </p>
              <div className="flex flex-wrap items-stretch gap-2">
                <input
                  id="setup-manual-key"
                  className={cx(inputClass, "min-w-0 flex-1 font-mono text-sm tracking-wide")}
                  readOnly
                  value={showManualKey ? totpSecret : "•".repeat(Math.min(totpSecret.length, 32))}
                  aria-label="Authenticator setup key"
                />
                <button type="button" className={compactButtonClass} onClick={() => void copyManualKey()} title="Copy setup key">
                  <Copy size={16} />
                  {copyState === "copied" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : null}

          <label className={labelClass}>
            Confirmation code
            <input
              className="w-full max-w-[12rem] rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-center text-lg font-semibold tracking-[0.35em] text-slate-950"
              value={form.twoFactorCode}
              onChange={(event) =>
                setForm({
                  twoFactorCode: event.target.value.replace(/\D/g, "").slice(0, 6)
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

      <div className={statusCardClass}>
        <div className={statusRowClass}>
          <div>
            <strong>Authenticator check</strong>
            <p className={statusTextClass}>Confirms your app is generating valid codes.</p>
          </div>
          <Pill tone={checkState === "ok" ? "good" : checkState === "checking" ? "warn" : checkState === "error" ? "warn" : "neutral"}>
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
          <div className={successResultClass}>
            <CheckCircle2 size={18} />
            <div>
              <strong>Authenticator linked</strong>
              <p className="mt-1 mb-0 text-slate-500">You can continue with the rest of setup.</p>
            </div>
          </div>
        )}
        <div className={actionRowClass}>
          <button
            type="button"
            className={primaryButtonClass}
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

function ConnectAccountStep({
  status,
  starting,
  error,
  onVerify,
  onRetry
}: {
  status: IntegritasAuthStatus | null;
  starting: boolean;
  error: string | null;
  onVerify: () => boolean;
  onRetry: () => void;
}) {
  const pendingStatus = status?.status === "pending" ? status : null;
  const connectedStatus = status?.status === "connected" ? status : null;
  const terminalKind = status?.status === "denied" || status?.status === "expired" || status?.status === "revoked" ? status.status : null;
  const connectedProfile = connectedStatus && hasConnectedProfile(connectedStatus) ? connectedStatus : null;

  return (
    <div className={panelClass}>
      <p className={eyebrowClass}>Integritas Connect account</p>
      <h2 className={headingClass}>
        {connectedStatus ? "Integritas Connect account created and connected" : "Create your Integritas Connect account"}
      </h2>
      <p className={leadClass}>
        {connectedStatus
          ? "Your account is linked to this Edge Workbench. Continue to review your setup."
          : "Create the Integritas Connect account used for your plan and proof usage."}
      </p>

      {connectedStatus ? (
        <div className="grid max-w-xl gap-3">
          <div className={successResultClass}>
            <CheckCircle2 className="shrink-0" size={20} />
            <div>
              <strong>Integritas Connect account connected successfully</strong>
              <p className="m-0 mt-1 text-emerald-700">
                {connectedProfile
                  ? `${connectedProfile.user.name} (${connectedProfile.user.email})`
                  : "Profile details will appear when Integritas Connect is reachable."}
              </p>
            </div>
          </div>
        </div>
      ) : terminalKind ? (
        <div className="grid max-w-xl gap-3">
          <p className={mutedClass}>
            {terminalKind === "denied" && "Activation was denied in Integritas Connect."}
            {terminalKind === "expired" && "The verification code expired."}
            {terminalKind === "revoked" && "This device was revoked in Integritas Connect."} Start again to continue setup.
          </p>
          <div className={actionRowClass}>
            <button type="button" className={primaryButtonClass} disabled={starting} onClick={onRetry}>
              <RefreshCw size={16} />
              {starting ? "Starting…" : "Try again"}
            </button>
          </div>
        </div>
      ) : pendingStatus ? (
        <div className="grid max-w-xl gap-3">
          <div className={infoCalloutClass}>
            <Link2 className="shrink-0" size={20} />
            <div>
              <strong>Finish securely in the Integritas Connect account window</strong>
              <p className={cx(mutedClass, "m-0 mt-1")}>
                We&apos;ll connect automatically after signup and email verification. Your password stays with Integritas Connect and is
                never stored on this device.
              </p>
            </div>
          </div>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <div className={actionRowClass}>
            <a
              className={primaryButtonClass}
              href={pendingStatus.verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (onVerify()) event.preventDefault();
              }}
            >
              <ExternalLink size={16} />
              Create cloud account
            </a>
          </div>
        </div>
      ) : (
        <div className="grid max-w-xl gap-3">
          <div className={infoCalloutClass}>
            <Link2 className="shrink-0" size={20} />
            <div>
              <strong>{starting ? "Preparing secure activation…" : "Preparing your Integritas Connect account…"}</strong>
              <p className={cx(mutedClass, "m-0 mt-1")}>
                Device security is complete. We&apos;re preparing the 20-minute Integritas Connect account activation window.
              </p>
            </div>
          </div>
          {error ? (
            <>
              <ErrorText>{error}</ErrorText>
              <div className={actionRowClass}>
                <button type="button" className={primaryButtonClass} disabled={starting} onClick={onRetry}>
                  <RefreshCw size={16} />
                  {starting ? "Starting…" : "Try again"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CompleteStep({
  passwordSet,
  totpVerified,
  connectedName,
  connectedPlan,
  connectedUsage
}: {
  passwordSet: boolean;
  totpVerified: boolean;
  connectedName: string | null;
  connectedPlan: string | null;
  connectedUsage: number | null;
}) {
  const configured = [
    {
      label: "Admin credential",
      detail: passwordSet ? "Configured" : "Not set"
    },
    ...(TOTP_ENABLED
      ? [
          {
            label: "Two-factor auth",
            detail: totpVerified ? "Authenticator linked" : "Not verified"
          }
        ]
      : []),
    {
      label: "Workbench account",
      detail: connectedName ? `Signed in as ${connectedName}` : "Connected"
    },
    ...(connectedPlan
      ? [
          {
            label: "Plan",
            detail: connectedPlan
          }
        ]
      : []),
    ...(connectedUsage !== null
      ? [
          {
            label: "Usage remaining",
            detail: connectedUsage.toLocaleString()
          }
        ]
      : [])
  ];

  const automatic = [
    "Minima node health and peer connectivity",
    "Wallet lock and local security defaults",
    "Background services and stamp polling"
  ];

  return (
    <div className={panelClass}>
      <p className={eyebrowClass}>All done</p>
      <h2 className={headingClass}>{connectedName ? `Welcome, ${connectedName}` : "Your Edge Workbench is ready"}</h2>
      <p className={leadClass}>Setup is complete. You can open the dashboard — your plan and usage sync from your Workbench account.</p>

      <ul className="m-0 grid max-w-xl list-none gap-2 p-0">
        {configured.map((item) => (
          <li key={item.label} className="flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 p-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-green-600 text-white">
              <Check size={16} />
            </span>
            <div>
              <strong>{item.label}</strong>
              <p className="mt-1 mb-0 text-slate-500">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className={infoCalloutClass}>
        <Sparkles size={20} />
        <div>
          <strong>Configures automatically</strong>
          <ul className={cx(mutedClass, "m-0 mt-2 pl-4 text-sm leading-relaxed")}>
            {automatic.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function OnboardingWizard({ onComplete, resumeAtConnect = false }: { onComplete: () => void; resumeAtConnect?: boolean }) {
  const [stepIndex, setStepIndex] = useState(() => (resumeAtConnect ? Math.max(0, connectAccountStepIndex) : 0));
  const [form, setFormState] = useState<OnboardingFormState>(initialForm);
  const [totpCheck, setTotpCheck] = useState<CheckState>("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localAdminReady, setLocalAdminReady] = useState(resumeAtConnect);
  const connectStartRequested = useRef(false);

  const {
    status,
    loading: connectLoading,
    starting,
    error: connectError,

    start,
    openVerification
  } = useIntegritasAuth({
    enabled: localAdminReady,
    refreshProfileOnConnected: true
  });

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

  // After local admin exists: start Connect activation on the account screen.
  useEffect(() => {
    if (!localAdminReady || currentStep.id !== "connectAccount") return;
    if (connectLoading || starting || connectStartRequested.current || connectError) return;
    if (!status || status.status !== "unauthenticated") return;

    connectStartRequested.current = true;
    void start();
  }, [localAdminReady, currentStep.id, connectLoading, starting, connectError, status, start]);

  const canContinue = useMemo(() => {
    switch (currentStep.id) {
      case "welcome":
        return true;
      case "account":
        return isValidAdminCredential(form.credentialType, form.password) && form.password === form.confirmPassword;
      case "twofa":
        return totpCheck === "ok" && Boolean(qrCode) && !qrError;
      case "connectAccount":
        return status?.status === "connected";
      case "complete":
        return status?.status === "connected";
      default:
        return false;
    }
  }, [currentStep.id, form, totpCheck, qrCode, qrError, status?.status]);

  const shouldCreateLocalAdmin = (stepId: OnboardingStepId) => {
    if (localAdminReady) return false;
    if (TOTP_ENABLED) return stepId === "twofa";
    return stepId === "account";
  };

  const goNext = async () => {
    if (currentStep.id === "complete") {
      onComplete();
      return;
    }

    if (shouldCreateLocalAdmin(currentStep.id)) {
      setSubmitting(true);
      setSubmitError(null);
      try {
        await completeSetup({ password: form.password });
        setLocalAdminReady(true);
        connectStartRequested.current = false;
        setStepIndex((index) => index + 1);
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
    if (localAdminReady) return;
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

  const retryConnect = () => {
    void start();
  };

  const connectedStatus = status?.status === "connected" ? status : null;

  const connectedName = connectedStatus && hasConnectedProfile(connectedStatus) ? connectedStatus.user.name : null;
  const connectedPlan =
    connectedStatus && hasConnectedProfile(connectedStatus)
      ? `${connectedStatus.plan.name}${connectedStatus.plan.status ? ` (${connectedStatus.plan.status})` : ""}`
      : null;
  const connectedUsage = connectedStatus && hasConnectedProfile(connectedStatus) ? connectedStatus.usage.remaining : null;

  const hideFooterContinue = currentStep.id === "connectAccount" && status?.status !== "connected";

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden overscroll-contain bg-white">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white" role="main" aria-label="First-time setup">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Layers3 size={24} />
            </div>
            <div>
              <p className="m-0 text-sm text-slate-500">Minima Edge Stack</p>
              <h1 className="m-0 mt-0.5 text-lg">First-time setup</h1>
            </div>
          </div>
        </header>

        <div className="h-1 shrink-0 bg-slate-200">
          <span className="block h-full bg-violet-600 transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden bg-slate-900 p-4 text-slate-200 max-[900px]:px-4 max-[900px]:py-3">
            <p className="m-0 mb-3 shrink-0 text-[0.72rem] font-extrabold uppercase tracking-widest text-slate-400">Setup steps</p>
            <ol className="m-0 grid min-h-0 list-none gap-2 overflow-y-auto p-0 [scrollbar-color:rgb(148_163_184_/_0.55)_transparent] [scrollbar-width:thin] max-[900px]:grid-flow-col max-[900px]:auto-cols-[minmax(140px,1fr)] max-[900px]:overflow-x-auto max-[900px]:overflow-y-hidden max-[900px]:pb-1">
              {onboardingSteps.map((step, index) => {
                const complete = index < stepIndex;
                const active = index === stepIndex;
                return (
                  <li
                    key={step.id}
                    className={cx(
                      "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-slate-400",
                      active && "bg-white/10 text-white",
                      complete && "text-slate-300"
                    )}
                  >
                    <StepIcon id={step.id} active={active} complete={complete} />
                    <div>
                      <span className="block text-[0.72rem] font-bold uppercase tracking-wide">{step.shortLabel}</span>
                      <strong className="mt-0.5 block text-[0.88rem] leading-snug">{step.label}</strong>
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] max-[700px]:py-3 lg:px-10 lg:py-6">
              {currentStep.id === "welcome" && <WelcomeStep />}
              {currentStep.id === "account" && <AccountStep form={form} setForm={setForm} />}
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
              {currentStep.id === "connectAccount" && (
                <ConnectAccountStep
                  status={status}
                  starting={starting || connectLoading}
                  error={connectError}
                  onVerify={openVerification}
                  onRetry={retryConnect}
                />
              )}
              {currentStep.id === "complete" && (
                <CompleteStep
                  passwordSet={localAdminReady}
                  totpVerified={localAdminReady}
                  connectedName={connectedName}
                  connectedPlan={connectedPlan}
                  connectedUsage={connectedUsage}
                />
              )}
            </div>

            {submitError ? <ErrorText className="px-6">{submitError}</ErrorText> : null}

            <footer className="flex shrink-0 flex-col items-stretch gap-3 border-t border-slate-200 bg-white px-6 py-3 max-[900px]:gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {stepIndex > 0 && !localAdminReady ? (
                  <button type="button" className={secondaryButtonClass} onClick={goBack} disabled={submitting}>
                    <ArrowLeft size={16} /> Back
                  </button>
                ) : (
                  <span />
                )}
              </div>
              <div className="flex items-center justify-between gap-3.5 max-[900px]:justify-between">
                <span className={mutedClass}>
                  Step {stepIndex + 1} of {onboardingSteps.length}
                </span>
                {hideFooterContinue ? (
                  <span className={mutedClass}>
                    {status?.status === "pending" ? "Waiting for account connection…" : "Preparing account activation…"}
                  </span>
                ) : (
                  <button type="button" className={primaryButtonClass} disabled={!canContinue || submitting} onClick={() => void goNext()}>
                    {submitting ? "Securing device…" : currentStep.id === "complete" ? "Enter Edge Workbench" : "Continue"}
                    {currentStep.id !== "complete" && !submitting && <ArrowRight size={16} />}
                  </button>
                )}
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
