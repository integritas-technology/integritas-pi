import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Layers3 } from "lucide-react";
import { BrandLineGrid } from "../../components/BrandLineGrid";
import { Button } from "../../components/Button";
import { ErrorText } from "../../components/Text";
import { cx } from "../../lib/cx";
import { isValidAdminCredential } from "../auth/adminCredentials";
import { TOTP_ENABLED } from "../auth/totpEnabled";
import { useIntegritasAuth } from "../integritas-auth/useIntegritasAuth";
import { completeSetup, initTotp, verifyTotp } from "./api";
import { mutedClass } from "./onboardingStyles";
import { onboardingSteps, onboardingWorkSteps } from "./steps";
import { AccountStep } from "./steps/AccountStep";
import { ConnectIntegritasStep } from "./steps/ConnectIntegritasStep";
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
  const workStepIndex = onboardingWorkSteps.findIndex((step) => step.id === currentStep.id);
  const isWorkStep = workStepIndex >= 0;
  const connectReady = currentStep.id === "connectAccount" && status?.status === "connected";
  const progress =
    currentStep.id === "welcome"
      ? 0
      : connectReady
        ? 100
        : ((workStepIndex + 1) / onboardingWorkSteps.length) * 100;

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
    if (connectReady) {
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

  const hideFooterContinue = currentStep.id === "connectAccount" && status?.status !== "connected";
  const canGoBack = stepIndex > 0 && !localAdminReady;
  const connectWaitingLabel =
    status?.status === "pending"
      ? "Waiting for Integritas Connect…"
      : "Preparing Integritas Connect…";
  const continueLabel = submitting
    ? "Securing device…"
    : connectReady
      ? "Enter Edge Workbench"
      : currentStep.id === "welcome"
        ? "Get started"
        : "Continue";
  const headerStatus = connectReady
    ? "Ready"
    : isWorkStep
      ? `Step ${workStepIndex + 1} of ${onboardingWorkSteps.length}`
      : "Getting started";

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden overscroll-contain bg-[#f5f3ed] text-[#1a1a1a]">
      <BrandLineGrid />
      <div
        className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden"
        role="main"
        aria-label="Setup Wizard"
      >
        <header className="bg-brand-white shrink-0 border-b border-slate-200/80">
          <div className="flex items-center justify-between gap-4 px-6 py-3 lg:px-10">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-950 text-white">
                <Layers3 size={18} aria-hidden="true" strokeWidth={2.25} />
              </div>
              <h1 className="m-0 truncate text-sm font-bold tracking-[-0.02em] text-slate-950">
                Edge Studio Setup
              </h1>
            </div>
            <p className={cx(mutedClass, "m-0 shrink-0 text-xs sm:text-sm")}>{headerStatus}</p>
          </div>
          <div
            className="h-0.5 bg-slate-200"
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={0}
            aria-valuemax={onboardingWorkSteps.length}
            aria-valuenow={
              currentStep.id === "welcome"
                ? 0
                : connectReady
                  ? onboardingWorkSteps.length
                  : workStepIndex + 1
            }
            aria-valuetext={
              connectReady
                ? "Setup complete"
                : isWorkStep
                  ? `Step ${workStepIndex + 1} of ${onboardingWorkSteps.length}`
                  : "Getting started"
            }
          >
            <span
              className="bg-brand-accent block h-full transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] overflow-y-auto px-6 py-8 max-[700px]:py-5 lg:px-10 lg:py-10">
            <div className="mx-auto w-full max-w-2xl">
              {currentStep.id === "welcome" && <WelcomeStep />}
              {currentStep.id === "account" && (
                <AccountStep
                  form={form}
                  setForm={setForm}
                  onSubmit={() => {
                    if (canContinue && !submitting) void goNext();
                  }}
                />
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
              {currentStep.id === "connectAccount" && (
                <ConnectIntegritasStep
                  status={status}
                  starting={starting || connectLoading}
                  error={connectError}
                  onVerify={openVerification}
                  onRetry={retryConnect}
                />
              )}
            </div>
          </div>

          {submitError ? (
            <ErrorText className="px-6" role="alert">
              {submitError}
            </ErrorText>
          ) : null}

          <footer className="bg-brand-white shrink-0 border-t border-slate-200">
            <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-4 lg:px-10">
              <div className="flex min-h-11 min-w-0 flex-1 items-center">
                {canGoBack ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={goBack}
                    disabled={submitting}
                  >
                    <ArrowLeft size={16} /> Back
                  </Button>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center justify-end">
                {hideFooterContinue ? (
                  <span
                    className={cx(mutedClass, "text-right text-xs sm:text-sm")}
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {connectWaitingLabel}
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={!canContinue || submitting}
                    onClick={() => void goNext()}
                  >
                    {continueLabel}
                    {!connectReady && !submitting ? <ArrowRight size={16} /> : null}
                  </Button>
                )}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
