import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError } from "../../lib/api";
import { getIntegritasAuthStatus, getIntegritasUserProfile, startIntegritasConnect, type IntegritasAuthStatus } from "./integritasAuthApi";

/** While pending: re-check Integritas Connect status (architecture poll interval). */
const POLL_INTERVAL_MS = 5_000;
const ACTIVATION_POPUP_WIDTH = 480;
const ACTIVATION_POPUP_HEIGHT = 720;

const TOKEN_DECRYPT_FAILED = "TOKEN_DECRYPT_FAILED";

const TOKEN_DECRYPT_FAILED_MESSAGE = "Local secrets were reset or changed. Connect your Integritas Connect account again.";

function isTokenDecryptFailed(error: unknown): boolean {
  return (error as ApiError)?.errorCode === TOKEN_DECRYPT_FAILED;
}

/** Re-fetch status after server cleared Integritas Connect (decrypt failure). */
async function statusAfterClear(): Promise<IntegritasAuthStatus> {
  try {
    return await getIntegritasAuthStatus();
  } catch {
    return { status: "unauthenticated" };
  }
}

export type UseIntegritasAuthOptions = {
  refreshProfileOnConnected?: boolean;
  enabled?: boolean;
};

export type StartIntegritasAuthOptions = {
  /** Open the Connect verify popup in the same user gesture (avoids a second click after start). */
  openPopup?: boolean;
};

export type UseIntegritasAuthResult = {
  status: IntegritasAuthStatus | null;
  loading: boolean;
  starting: boolean;
  error: string | null;
  notice: string | null;
  refresh: () => Promise<void>;
  start: (options?: StartIntegritasAuthOptions) => Promise<void>;
  openVerification: () => boolean;
};

function activationPopupFeatures(): string {
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - ACTIVATION_POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - ACTIVATION_POPUP_HEIGHT) / 2));
  return [
    "popup=yes",
    `width=${ACTIVATION_POPUP_WIDTH}`,
    `height=${ACTIVATION_POPUP_HEIGHT}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
}

/** Integritas Connect link state: status, start activation, popup verify device, pending poll + countdown. */
export function useIntegritasAuth(options?: UseIntegritasAuthOptions): UseIntegritasAuthResult {
  const refreshProfileOnConnected = options?.refreshProfileOnConnected ?? false;
  const enabled = options?.enabled ?? true;

  const [status, setStatus] = useState<IntegritasAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  // Latest status for openVerification without a stale closure.
  const statusRef = useRef(status);
  statusRef.current = status;

  const rememberPopup = useCallback((popup: Window | null) => {
    if (!popup) return null;
    popupRef.current = popup;
    popup.focus();
    return popup;
  }, []);

  const refresh = useCallback(async () => {
    try {
      // Candidate status — applied after optional profile enrich.
      let next = await getIntegritasAuthStatus();

      if (next.status === "connected" && refreshProfileOnConnected) {
        try {
          // Settings: sync profile from Integritas Connect (may return stale cache).
          const profile = await getIntegritasUserProfile({ refresh: true });
          next = {
            status: "connected",
            user: profile.user,
            plan: profile.plan,
            usage: profile.usage,
            fetchedAt: profile.fetchedAt,
          };
          if (profile.stale) {
            // Cache shown; Integritas Connect unreachable.
            setStatus(next);
            setError(null);
            setNotice("Showing last saved profile — Integritas Connect is unreachable right now.");
            return;
          }
        } catch (profileError) {
          if (isTokenDecryptFailed(profileError)) {
            // Local crypto mismatch — prompt reconnect.
            setStatus(await statusAfterClear());
            setError(profileError instanceof Error ? profileError.message : TOKEN_DECRYPT_FAILED_MESSAGE);
            setNotice(null);
            return;
          }
          // Revoke / other fatals: re-read status. Soft offline with cache is handled by the API.
          next = await getIntegritasAuthStatus();
        }
      }

      setStatus(next);
      setError(null);
      setNotice(null);
    } catch (err) {
      if (isTokenDecryptFailed(err)) {
        setStatus(await statusAfterClear());
        setError(err instanceof Error ? err.message : TOKEN_DECRYPT_FAILED_MESSAGE);
        setNotice(null);
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load Integritas status");
      setNotice(null);
    } finally {
      setLoading(false);
    }
  }, [refreshProfileOnConnected]);

  const start = useCallback(
    async (startOptions?: StartIntegritasAuthOptions) => {
      setStarting(true);
      setError(null);
      setNotice(null);

      // Open blank window in the click gesture so navigation after await is not blocked.
      let placeholder: Window | null = null;
      if (startOptions?.openPopup) {
        placeholder = rememberPopup(window.open("about:blank", "integritas-device-activate", activationPopupFeatures()));
      }

      try {
        const data = await startIntegritasConnect();
        setStatus({
          status: "pending",
          userCode: data.userCode,
          verificationUrl: data.verificationUrl,
          expiresAt: data.expiresAt,
        });

        if (startOptions?.openPopup) {
          if (placeholder && !placeholder.closed) {
            placeholder.location.href = data.verificationUrl;
            placeholder.focus();
          } else {
            // Popup blocked — pending UI still offers the verify link.
            rememberPopup(window.open(data.verificationUrl, "integritas-device-activate", activationPopupFeatures()));
          }
        }
      } catch (err) {
        if (placeholder && !placeholder.closed) {
          placeholder.close();
          popupRef.current = null;
        }
        setError(err instanceof Error ? err.message : "Failed to start Connect activation");
      } finally {
        setStarting(false);
      }
    },
    [rememberPopup],
  );

  const openVerification = useCallback(() => {
    const current = statusRef.current;
    if (current?.status !== "pending" || !current.verificationUrl) return false;

    const popup = rememberPopup(
      window.open(current.verificationUrl, "integritas-device-activate", activationPopupFeatures()),
    );
    return Boolean(popup);
  }, [rememberPopup]);

  // The parent learns completion through polling, so close the popup without cross-window messaging.
  useEffect(() => {
    if (status?.status !== "connected") return;

    const popup = popupRef.current;
    if (popup && !popup.closed) {
      popup.close();
    }
    popupRef.current = null;
  }, [status?.status]);

  // Initial load (and when re-enabled).
  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  // Pending: poll until approved / terminal.
  useEffect(() => {
    if (!enabled || status?.status !== "pending") return;

    const interval = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [enabled, status?.status, refresh]);

  return {
    status,
    loading,
    starting,
    error,
    notice,
    refresh,
    start,
    openVerification,
  };
}
