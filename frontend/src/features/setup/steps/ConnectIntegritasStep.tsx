import { CheckCircle2, ExternalLink, Link2, Loader2, RefreshCw } from "lucide-react";
import { ErrorAlert } from "../../../components/ErrorAlert";
import { cx } from "../../../lib/cx";
import {
  hasConnectedProfile,
  type IntegritasAuthStatus,
} from "../../integritas-auth/integritasAuthApi";
import {
  actionRowClass,
  eyebrowClass,
  headingClass,
  infoCalloutClass,
  leadClass,
  mutedClass,
  panelClass,
  primaryButtonClass,
  successResultClass,
} from "../onboardingStyles";

function RetryButton({ starting, onRetry }: { starting: boolean; onRetry: () => void }) {
  return (
    <button type="button" className={primaryButtonClass} disabled={starting} onClick={onRetry}>
      <RefreshCw size={16} aria-hidden="true" />
      {starting ? "Starting…" : "Try again"}
    </button>
  );
}

export function ConnectIntegritasStep({
  status,
  starting,
  error,
  onVerify,
  onRetry,
}: {
  status: IntegritasAuthStatus | null;
  starting: boolean;
  error: string | null;
  onVerify: () => boolean;
  onRetry: () => void;
}) {
  const pendingStatus = status?.status === "pending" ? status : null;
  const connectedStatus = status?.status === "connected" ? status : null;
  const terminalKind =
    status?.status === "denied" || status?.status === "expired" || status?.status === "revoked"
      ? status.status
      : null;
  const connectedProfile =
    connectedStatus && hasConnectedProfile(connectedStatus) ? connectedStatus : null;
  const connectedName = connectedProfile?.user.name ?? null;

  if (connectedStatus) {
    return (
      <div className={panelClass} aria-live="polite" aria-atomic="true">
        <p className={eyebrowClass}>All done</p>
        <h2 className={headingClass}>
          {connectedName ? `Welcome, ${connectedName}` : "Your Edge Workbench is ready"}
        </h2>
        <p className={leadClass}>
          Setup is complete. Open the dashboard — your plan and usage sync from Integritas Connect.
        </p>

        <div className={cx(successResultClass, "mb-3 max-w-xl")}>
          <CheckCircle2 className="shrink-0" size={20} aria-hidden="true" />
          <div>
            <strong>Connected successfully</strong>
            <p className="m-0 mt-1 text-emerald-700">
              {connectedProfile
                ? `${connectedProfile.user.name} (${connectedProfile.user.email})`
                : "Profile details will appear when Integritas Connect is reachable."}
            </p>
          </div>
        </div>

        <div className={cx(infoCalloutClass, "max-w-xl")}>
          <div>
            <strong>Configures automatically</strong>
            <ul className={cx(mutedClass, "m-0 mt-2 pl-4 text-sm leading-relaxed")}>
              <li>Minima node health and peer connectivity</li>
              <li>Wallet lock and local security defaults</li>
              <li>Background services and stamp polling</li>
            </ul>
          </div>
        </div>
      </div>
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
    <div className={panelClass}>
      <p className={eyebrowClass}>Integritas Connect</p>
      <h2 className={headingClass}>Connect your Integritas account</h2>
      <p className={leadClass}>
        Create or sign in with Integritas Connect to unlock your plan and proof usage on this
        device.
      </p>

      {terminalKind && terminalMessage ? (
        <ErrorAlert
          title="Connect session did not complete"
          action={<RetryButton starting={starting} onRetry={onRetry} />}
        >
          {terminalMessage}
        </ErrorAlert>
      ) : pendingStatus ? (
        <div className="grid max-w-xl gap-3" aria-live="polite">
          <div className={infoCalloutClass}>
            <Link2 className="shrink-0" size={20} aria-hidden="true" />
            <div>
              <strong>Finish in the Integritas Connect window</strong>
              <p className={cx(mutedClass, "m-0 mt-1")}>
                Open Connect to create or verify your account. We&apos;ll link automatically when
                you&apos;re done. Your Connect password stays with Integritas and is never stored on
                this device.
              </p>
            </div>
          </div>
          {error ? <ErrorAlert>{error}</ErrorAlert> : null}
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
              <ExternalLink size={16} aria-hidden="true" />
              Open Integritas Connect
            </a>
          </div>
        </div>
      ) : error ? (
        <ErrorAlert
          title="Couldn't start Integritas Connect"
          action={<RetryButton starting={starting} onRetry={onRetry} />}
        >
          {error}
        </ErrorAlert>
      ) : (
        <div className="grid max-w-xl gap-3" aria-live="polite">
          <div className={infoCalloutClass}>
            <Loader2
              className="shrink-0 animate-spin motion-reduce:animate-none"
              size={20}
              aria-hidden="true"
            />
            <div>
              <strong>Connecting to Integritas…</strong>
              <p className={cx(mutedClass, "m-0 mt-1")}>
                Preparing a secure Connect session for this device.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
