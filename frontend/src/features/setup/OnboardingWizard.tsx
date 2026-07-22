import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Layers3 } from "lucide-react";
import { ErrorText } from "../../components/Text";
import { cx } from "../../lib/cx";
import { isValidAdminCredential } from "../auth/adminCredentials";
import { TOTP_ENABLED } from "../auth/totpEnabled";
import { hasConnectedProfile } from "../integritas-auth/integritasAuthApi";
import { useIntegritasAuth } from "../integritas-auth/useIntegritasAuth";
import { completeSetup, initTotp, verifyTotp } from "./api";
import { mutedClass, primaryButtonClass, secondaryButtonClass } from "./onboardingStyles";
import { StepIcon } from "./StepIcon";
import { onboardingSteps } from "./steps";
import { AccountStep } from "./steps/AccountStep";
import { CompleteStep } from "./steps/CompleteStep";
import { ConnectAccountStep } from "./steps/ConnectAccountStep";
import { TwoFactorStep } from "./steps/TwoFactorStep";
import { WelcomeStep } from "./steps/WelcomeStep";
import type { CheckState, OnboardingFormState, OnboardingStepId } from "./types";

const initialForm: OnboardingFormState = {
  credentialType: "pin",
  password: "",
  confirmPassword: "",
  twoFactorCode: "",
};

const connectAccountStepIndex = onboardingSteps.findIndex((step) => step.id === "connectAccount");

export function OnboardingWizard({
  onComplete,
  resumeAtConnect = false,
}: {
  onComplete: () => void;
  resumeAtConnect?: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(() =>
    resumeAtConnect ? Math.max(0, connectAccountStepIndex) : 0,
  );
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
    openVerification,
  } = useIntegritasAuth({
    enabled: localAdminReady,
    refreshProfileOnConnected: true,
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
        return (
          isValidAdminCredential(form.credentialType, form.password) &&
          form.password === form.confirmPassword
        );
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
    void start({ openPopup: true });
  };

  const connectedStatus = status?.status === "connected" ? status : null;

  const connectedName =
    connectedStatus && hasConnectedProfile(connectedStatus) ? connectedStatus.user.name : null;
  const connectedPlan =
    connectedStatus && hasConnectedProfile(connectedStatus)
      ? `${connectedStatus.plan.name}${connectedStatus.plan.status ? ` (${connectedStatus.plan.status})` : ""}`
      : null;
  const connectedUsage =
    connectedStatus && hasConnectedProfile(connectedStatus)
      ? connectedStatus.usage.remaining
      : null;

  const hideFooterContinue = currentStep.id === "connectAccount" && status?.status !== "connected";

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden overscroll-contain bg-white">
      <div
        className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
        role="main"
        aria-label="First-time setup"
      >
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
          <span
            className="block h-full bg-violet-600 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden bg-slate-900 p-4 text-slate-200 max-[900px]:px-4 max-[900px]:py-3">
            <p className="m-0 mb-3 shrink-0 text-[0.72rem] font-extrabold tracking-widest text-slate-400 uppercase">
              Setup steps
            </p>
            <ol className="m-0 grid min-h-0 [scrollbar-width:thin] [scrollbar-color:rgb(148_163_184_/_0.55)_transparent] list-none gap-2 overflow-y-auto p-0 max-[900px]:auto-cols-[minmax(140px,1fr)] max-[900px]:grid-flow-col max-[900px]:overflow-x-auto max-[900px]:overflow-y-hidden max-[900px]:pb-1">
              {onboardingSteps.map((step, index) => {
                const complete = index < stepIndex;
                const active = index === stepIndex;
                return (
                  <li
                    key={step.id}
                    className={cx(
                      "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-slate-400",
                      active && "bg-white/10 text-white",
                      complete && "text-slate-300",
                    )}
                  >
                    <StepIcon id={step.id} active={active} complete={complete} />
                    <div>
                      <span className="block text-[0.72rem] font-bold tracking-wide uppercase">
                        {step.shortLabel}
                      </span>
                      <strong className="mt-0.5 block text-[0.88rem] leading-snug">
                        {step.label}
                      </strong>
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-col bg-white">
            <div className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] overflow-y-auto px-6 py-5 max-[700px]:py-3 lg:px-10 lg:py-6">
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
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={goBack}
                    disabled={submitting}
                  >
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
                    {status?.status === "pending"
                      ? "Waiting for account connection…"
                      : "Preparing account activation…"}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={primaryButtonClass}
                    disabled={!canContinue || submitting}
                    onClick={() => void goNext()}
                  >
                    {submitting
                      ? "Securing device…"
                      : currentStep.id === "complete"
                        ? "Enter Edge Workbench"
                        : "Continue"}
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
