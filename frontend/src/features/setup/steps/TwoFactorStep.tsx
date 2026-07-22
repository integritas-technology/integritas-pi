import { useState } from "react";
import { CheckCircle2, Copy, Eye, EyeOff } from "lucide-react";
import { ErrorText } from "../../../components/Text";
import { cx } from "../../../lib/cx";
import {
  actionRowClass,
  compactButtonClass,
  eyebrowClass,
  formGridClass,
  headingClass,
  inputClass,
  labelClass,
  leadClass,
  mutedClass,
  panelClass,
  primaryButtonClass,
  statusCardClass,
  statusRowClass,
  statusTextClass,
  successResultClass,
} from "../onboardingStyles";
import type { CheckState, OnboardingFormState } from "../types";

const TOTP_ACCOUNT_LABEL = "Edge Workbench";

type PillTone = "neutral" | "good" | "warn" | "future";

const pillToneClass: Record<PillTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  good: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  future: "bg-violet-100 text-violet-700",
};

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: PillTone }) {
  return (
    <span
      className={cx(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold",
        pillToneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

export function TwoFactorStep({
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
    <div className={panelClass}>
      <p className={eyebrowClass}>Two-factor auth</p>
      <h2 className={headingClass}>Set up two-factor authentication</h2>
      <p className={leadClass}>
        Scan the QR code with your authenticator app, or enter the setup key manually if scanning
        fails. Then enter the current 6-digit code to confirm it is working.
      </p>

      <div className="grid max-w-2xl gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        {loadingQr ? (
          <p className={mutedClass}>Generating QR code…</p>
        ) : qrError ? (
          <ErrorText>{qrError}</ErrorText>
        ) : qrCode ? (
          <img
            src={qrCode}
            alt="TOTP QR code"
            className="h-48 w-48 rounded-xl border border-slate-200 bg-white p-2"
          />
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
                Use issuer <strong>Integritas Pi</strong> and account{" "}
                <strong>{TOTP_ACCOUNT_LABEL}</strong> if your app asks for them.
              </p>
              <div className="flex flex-wrap items-stretch gap-2">
                <input
                  id="setup-manual-key"
                  className={cx(inputClass, "min-w-0 flex-1 font-mono text-sm tracking-wide")}
                  readOnly
                  value={showManualKey ? totpSecret : "•".repeat(Math.min(totpSecret.length, 32))}
                  aria-label="Authenticator setup key"
                />
                <button
                  type="button"
                  className={compactButtonClass}
                  onClick={() => void copyManualKey()}
                  title="Copy setup key"
                >
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
                  twoFactorCode: event.target.value.replace(/\D/g, "").slice(0, 6),
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
