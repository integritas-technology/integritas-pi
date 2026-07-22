import { CheckCircle2, ExternalLink, Link2, RefreshCw } from "lucide-react";
import { ErrorText } from "../../../components/Text";
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

export function ConnectAccountStep({
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

  return (
    <div className={panelClass}>
      <p className={eyebrowClass}>Integritas Connect account</p>
      <h2 className={headingClass}>
        {connectedStatus
          ? "Integritas Connect account created and connected"
          : "Create your Integritas Connect account"}
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
            {terminalKind === "revoked" && "This device was revoked in Integritas Connect."} Start
            again to continue setup.
          </p>
          <div className={actionRowClass}>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={starting}
              onClick={onRetry}
            >
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
                We&apos;ll connect automatically after signup and email verification. Your password
                stays with Integritas Connect and is never stored on this device.
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
              <strong>
                {starting
                  ? "Preparing secure activation…"
                  : "Preparing your Integritas Connect account…"}
              </strong>
              <p className={cx(mutedClass, "m-0 mt-1")}>
                Device security is complete. We&apos;re preparing the 20-minute Integritas Connect
                account activation window.
              </p>
            </div>
          </div>
          {error ? (
            <>
              <ErrorText>{error}</ErrorText>
              <div className={actionRowClass}>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={starting}
                  onClick={onRetry}
                >
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
