import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { APP_NAME } from "../../../app/names";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { cx } from "../../../lib/cx";
import type { AdminCredentialType } from "../../auth/adminCredentials";
import { TOTP_ENABLED } from "../../auth/totpEnabled";
import {
  hasConnectedProfile,
  type IntegritasAuthStatus,
} from "../../integritas-auth/integritasAuthApi";
import { OnboardingCard } from "../components/OnboardingCard";
import {
  actionRowClass,
  eyebrowClass,
  leadClass,
  mutedClass,
  primaryButtonClass,
} from "../onboardingStyles";

const connectSteps = [
  "Open Integritas Connect",
  "Create your account or sign in",
  "Approve this device",
] as const;

const PREPARING_LOADER_DELAY_MS = 400;

function RetryButton({ starting, onRetry }: { starting: boolean; onRetry: () => void }) {
  return (
    <button type="button" className={primaryButtonClass} disabled={starting} onClick={onRetry}>
      <RefreshCw size={16} aria-hidden="true" />
      {starting ? "Starting…" : "Try again"}
    </button>
  );
}

function ListeningPulse() {
  return (
    <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-60 motion-safe:animate-ping motion-reduce:hidden" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-600" />
    </span>
  );
}

function SetupDoneRow({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="bg-brand-white grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 rounded-xl border border-slate-200/80 px-3.5 py-3">
      <span className="text-brand-accent grid h-8 w-8 place-items-center" aria-hidden="true">
        <CheckCircle2 size={20} strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[0.95rem] font-bold text-slate-950">{title}</p>
        <p className="m-0 mt-1 text-sm leading-relaxed font-medium text-slate-500">{detail}</p>
      </div>
    </li>
  );
}

function deviceSignInDetail(credentialType: AdminCredentialType | null | undefined): string {
  if (credentialType === "pin") return "Admin PIN set for this device";
  if (credentialType === "password") return "Admin password set for this device";
  return "Device security enabled";
}

export function ConnectIntegritasStep({
  status,
  starting,
  error,
  onVerify,
  onRetry,
  credentialType,
}: {
  status: IntegritasAuthStatus | null;
  starting: boolean;
  error: string | null;
  onVerify: () => boolean;
  onRetry: () => void;
  /** Known when this session created the credential; omit on resume. */
  credentialType?: AdminCredentialType | null;
}) {
  const [listening, setListening] = useState(false);
  const [showPreparingLoader, setShowPreparingLoader] = useState(false);
  const pendingStatus = status?.status === "pending" ? status : null;
  const connectedStatus = status?.status === "connected" ? status : null;
  const terminalKind =
    status?.status === "denied" || status?.status === "expired" || status?.status === "revoked"
      ? status.status
      : null;
  const connectedProfile =
    connectedStatus && hasConnectedProfile(connectedStatus) ? connectedStatus : null;
  const verificationUrl = pendingStatus?.verificationUrl;
  const isPreparing = !connectedStatus && !pendingStatus && !terminalKind && !error;

  useEffect(() => {
    setListening(false);
  }, [verificationUrl]);

  useEffect(() => {
    if (!isPreparing) {
      setShowPreparingLoader(false);
      return;
    }
    const timer = window.setTimeout(() => setShowPreparingLoader(true), PREPARING_LOADER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isPreparing]);

  if (connectedStatus) {
    const connectDetail = connectedProfile
      ? `Connected as ${connectedProfile.user.email}`
      : "Connected to Integritas Connect";

    return (
      <OnboardingCard>
        <p className={eyebrowClass}>Setup complete</p>
        <h2 className="text-2xl font-semibold">{APP_NAME} is ready</h2>
        <p className={leadClass}>
          Setup is complete. Open the dashboard to start using {APP_NAME} services.
        </p>

        <ul className="m-0 grid max-w-xl list-none gap-2 p-0" aria-live="polite" aria-atomic="true">
          <SetupDoneRow title="Device security" detail={deviceSignInDetail(credentialType)} />
          {TOTP_ENABLED ? (
            <SetupDoneRow title="Two-factor auth" detail="Authenticator ready for sign-in" />
          ) : null}
          <SetupDoneRow title="Integritas Connected" detail={connectDetail} />
        </ul>
      </OnboardingCard>
    );
  }

  const terminalMessage =
    terminalKind === "denied"
      ? "Activation was denied in Integritas Connect."
      : terminalKind === "expired"
        ? "The verification session expired."
        : terminalKind === "revoked"
          ? "This device was revoked in Integritas Connect."
          : null;

  return (
    <OnboardingCard>
      <p className={eyebrowClass}>Integritas Connect</p>
      <h2 className="text-2xl font-semibold">Connect your Integritas account</h2>
      <p className={leadClass}>
        Connect your Integritas account to unlock your plan and Integritas services on this device.
      </p>

      {terminalKind && terminalMessage ? (
        <ErrorAlert
          title="Connect session did not complete"
          action={<RetryButton starting={starting} onRetry={onRetry} />}
        >
          {terminalMessage}
        </ErrorAlert>
      ) : pendingStatus ? (
        <div className="grid max-w-xl gap-4" aria-live="polite">
          {listening ? (
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <ListeningPulse />
              <div>
                <strong className="text-slate-950">Listening for approval…</strong>
                <p className={cx(mutedClass, "m-0 mt-1")}>
                  Finish in the Integritas Connect window. We&apos;ll continue automatically when
                  you approve this device.
                </p>
              </div>
            </div>
          ) : (
            <ol className="m-0 grid list-none gap-2 p-0">
              {connectSteps.map((label, index) => (
                <li
                  key={label}
                  className="bg-brand-white grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-slate-200/80 px-3.5 py-3"
                >
                  <span
                    className="text-brand-accent grid h-8 w-8 place-items-center text-sm font-bold"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="text-[0.95rem] font-medium text-slate-950">{label}</span>
                </li>
              ))}
            </ol>
          )}
          {error ? <ErrorAlert>{error}</ErrorAlert> : null}
          <div className="grid gap-2">
            <div className={actionRowClass}>
              <a
                className={primaryButtonClass}
                href={pendingStatus.verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  setListening(true);
                  if (onVerify()) event.preventDefault();
                }}
              >
                <ExternalLink size={16} aria-hidden="true" />
                {listening ? "Reopen Integritas Connect" : "Open Integritas Connect"}
              </a>
            </div>
            {!listening ? (
              <p className={cx(mutedClass, "m-0")}>
                The password you use to sign in to Integritas stays with Integritas and is never
                stored on this device. The link expires in about 20 minutes.
              </p>
            ) : (
              <p className={cx(mutedClass, "m-0")}>
                The password you use to sign in to Integritas Connect stays with Integritas and is
                never stored on this device.
              </p>
            )}
          </div>
        </div>
      ) : error ? (
        <ErrorAlert
          title="Couldn't start Integritas Connect"
          action={<RetryButton starting={starting} onRetry={onRetry} />}
        >
          {error}
        </ErrorAlert>
      ) : showPreparingLoader ? (
        <div className="grid max-w-xl gap-3" aria-live="polite">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <Loader2
              className="mt-0.5 shrink-0 animate-spin text-slate-600 motion-reduce:animate-none"
              size={20}
              aria-hidden="true"
            />
            <div>
              <strong className="text-slate-950">Connecting to Integritas…</strong>
              <p className={cx(mutedClass, "m-0 mt-1")}>
                Preparing a secure Connect session for this device.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="sr-only" aria-live="polite">
          Preparing Integritas Connect…
        </div>
      )}
    </OnboardingCard>
  );
}
