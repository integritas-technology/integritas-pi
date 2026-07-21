import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, Copy, Eye, EyeOff, RotateCcw, ShieldAlert, Tag } from "lucide-react";
import { Button } from "../components/Button";
import { ButtonRow } from "../components/ButtonRow";
import { Card } from "../components/Card";
import { Page } from "../components/Page";
import { ErrorText } from "../components/Text";
import { changePassword, initTotpReset, verifyTotpReset } from "../features/auth/api";
import { isValidAdminCredential, sanitizePinInput, type AdminCredentialType } from "../features/auth/adminCredentials";
import { PasswordRequirements } from "../features/auth/PasswordRequirements";
import { TOTP_ENABLED } from "../features/auth/totpEnabled";
import { IntegritasConnectPanel } from "../features/integritas-auth/IntegritasConnectPanel";
import { useUpdateStatusRefresh } from "../features/update/useUpdateStatusRefresh";

type TotpResetPhase = "idle" | "scan" | "done";

const formClass = "grid gap-3";
const labelClass = "grid gap-3 font-bold text-slate-700";

export function AuthSettingsPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newCredentialType, setNewCredentialType] = useState<AdminCredentialType>("pin");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwTotpToken, setPwTotpToken] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const [totpPhase, setTotpPhase] = useState<TotpResetPhase>("idle");
  const [resetCurrentPassword, setResetCurrentPassword] = useState("");
  const [resetCurrentToken, setResetCurrentToken] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [showManualKey, setShowManualKey] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  useUpdateStatusRefresh((status) => setCurrentVersion(status?.currentVersion ?? null));

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSubmitting(true);
    setPwError(null);
    setPwSuccess(false);
    try {
      await changePassword({
        currentPassword,
        newPassword,
        ...(TOTP_ENABLED ? { totpToken: pwTotpToken } : {}),
      });
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPwTotpToken("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change credential");
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleInitTotpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetSubmitting(true);
    setResetError(null);
    try {
      const result = await initTotpReset({ currentPassword: resetCurrentPassword, totpToken: resetCurrentToken });
      setQrCode(result.qrCodePngBase64);
      setTotpSecret(result.secret);
      setTotpPhase("scan");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to start 2FA reset");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleVerifyTotpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifySubmitting(true);
    setVerifyError(null);
    try {
      await verifyTotpReset({ totpToken: verifyCode });
      setQrCode(null);
      setTotpSecret(null);
      setTotpPhase("done");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Invalid code — try again");
    } finally {
      setVerifySubmitting(false);
    }
  };

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

  const resetTotpFlow = () => {
    setTotpPhase("idle");
    setResetCurrentPassword("");
    setResetCurrentToken("");
    setVerifyCode("");
    setVerifyError(null);
    setResetError(null);
    setShowManualKey(false);
  };

  const newCredentialIsPin = newCredentialType === "pin";
  const newCredentialLabel = newCredentialIsPin ? "PIN" : "password";
  const newCredentialsMatch = !confirmNewPassword || newPassword === confirmNewPassword;
  const passwordFormReady =
    currentPassword.length > 0 &&
    isValidAdminCredential(newCredentialType, newPassword) &&
    newPassword === confirmNewPassword &&
    (!TOTP_ENABLED || pwTotpToken.length === 6);

  return (
    <Page
      eyebrow="Admin account"
      title="Account settings"
      action={
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> Back
        </button>
      }
    >
      <IntegritasConnectPanel />

      <Card>
        <div className="grid gap-1" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Change PIN or password</h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
            {TOTP_ENABLED
              ? "Choose a 6-digit PIN or a strong password. A valid 2FA code is also required."
              : "Choose a 6-digit PIN or a strong password."}
          </p>
        </div>

        {pwSuccess && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3" style={{ marginBottom: 16 }}>
            <p className="text-sm text-emerald-700 flex items-center gap-2" style={{ margin: 0 }}>
              <Check size={14} /> Credential changed successfully.
            </p>
          </div>
        )}

        <form onSubmit={(e) => void handleChangePassword(e)} className={formClass}>
          <label className={labelClass}>
            Current PIN or password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setPwError(null);
                setPwSuccess(false);
              }}
              placeholder="Your current credential"
              autoComplete="current-password"
            />
          </label>
          <fieldset className="grid gap-2 border-0 p-0">
            <legend className="mb-2 font-bold text-slate-700">New credential type</legend>
            <div className="grid max-w-md grid-cols-2 gap-2">
              {(["pin", "password"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${
                    newCredentialType === type ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"
                  }`}
                  aria-pressed={newCredentialType === type}
                  onClick={() => {
                    setNewCredentialType(type);
                    setNewPassword("");
                    setConfirmNewPassword("");
                    setPwError(null);
                    setPwSuccess(false);
                  }}
                >
                  {type === "pin" ? "6-digit PIN" : "Password"}
                </button>
              ))}
            </div>
          </fieldset>
          <label className={labelClass}>
            New {newCredentialLabel}
            <input
              type="password"
              inputMode={newCredentialIsPin ? "numeric" : "text"}
              pattern={newCredentialIsPin ? "[0-9]*" : undefined}
              maxLength={newCredentialIsPin ? 6 : undefined}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(newCredentialIsPin ? sanitizePinInput(e.target.value) : e.target.value);
                setPwError(null);
                setPwSuccess(false);
              }}
              placeholder={newCredentialIsPin ? "000000" : "Create a strong password"}
              autoComplete="new-password"
            />
          </label>
          {!newCredentialIsPin && <PasswordRequirements password={newPassword} />}
          <label className={labelClass}>
            Confirm new {newCredentialLabel}
            <input
              type="password"
              inputMode={newCredentialIsPin ? "numeric" : "text"}
              pattern={newCredentialIsPin ? "[0-9]*" : undefined}
              maxLength={newCredentialIsPin ? 6 : undefined}
              value={confirmNewPassword}
              onChange={(e) => {
                setConfirmNewPassword(newCredentialIsPin ? sanitizePinInput(e.target.value) : e.target.value);
                setPwError(null);
                setPwSuccess(false);
              }}
              placeholder={`Repeat new ${newCredentialLabel}`}
              autoComplete="new-password"
            />
            {!newCredentialsMatch && (
              <span className="text-sm font-medium text-amber-700">{newCredentialIsPin ? "PINs" : "Passwords"} do not match</span>
            )}
          </label>
          {TOTP_ENABLED ? (
            <label className={labelClass}>
              2FA code
              <input
                value={pwTotpToken}
                onChange={(e) => {
                  setPwTotpToken(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setPwError(null);
                  setPwSuccess(false);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
              />
            </label>
          ) : null}
          {pwError && <ErrorText className="m-0">{pwError}</ErrorText>}
          <ButtonRow>
            <Button type="submit" disabled={pwSubmitting || !passwordFormReady}>
              {pwSubmitting ? "Updating…" : "Change credential"}
            </Button>
          </ButtonRow>
        </form>
      </Card>

      {TOTP_ENABLED ? (
        <Card>
          <div className="grid gap-1" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Reset two-factor authentication</h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
              Generates a new TOTP secret. The QR code is shown once — save it in your authenticator before closing.
            </p>
          </div>

          {totpPhase === "idle" && (
            <form onSubmit={(e) => void handleInitTotpReset(e)} className={formClass}>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="flex items-center gap-2" style={{ margin: 0, fontSize: "0.875rem", color: "#92400e" }}>
                  <ShieldAlert size={14} />
                  Your current 2FA secret will be replaced. Make sure your authenticator app is available before continuing.
                </p>
              </div>
              <label className={labelClass}>
                Current PIN or password
                <input
                  type="password"
                  value={resetCurrentPassword}
                  onChange={(e) => {
                    setResetCurrentPassword(e.target.value);
                    setResetError(null);
                  }}
                  placeholder="Your current credential"
                  autoComplete="current-password"
                />
              </label>
              <label className={labelClass}>
                Current 2FA code
                <input
                  value={resetCurrentToken}
                  onChange={(e) => {
                    setResetCurrentToken(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setResetError(null);
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                />
              </label>
              {resetError && <ErrorText className="m-0">{resetError}</ErrorText>}
              <ButtonRow>
                <Button type="submit" disabled={resetSubmitting || resetCurrentPassword.length === 0 || resetCurrentToken.length !== 6}>
                  {resetSubmitting ? "Verifying…" : "Start 2FA reset"}
                </Button>
              </ButtonRow>
            </form>
          )}

          {totpPhase === "scan" && qrCode && (
            <div className="grid gap-6">
              <div className="flex gap-6 flex-wrap items-start">
                <img src={qrCode} alt="TOTP QR code" style={{ width: 160, height: 160, borderRadius: 12, border: "1px solid #e2e8f0" }} />
                {totpSecret && (
                  <div className="grid gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          color: "#64748b",
                        }}
                      >
                        Manual setup key
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowManualKey((v) => !v)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 flex items-center gap-1"
                      >
                        {showManualKey ? (
                          <>
                            <EyeOff size={12} /> Hide
                          </>
                        ) : (
                          <>
                            <Eye size={12} /> Show
                          </>
                        )}
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
                      Issuer: <strong>Integritas Pi</strong>, Account: <strong>Edge Workbench</strong>
                    </p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={showManualKey ? totpSecret : "•".repeat(Math.min(totpSecret.length, 32))}
                        style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.875rem" }}
                        aria-label="Authenticator setup key"
                      />
                      <button
                        type="button"
                        onClick={() => void copyManualKey()}
                        className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 flex items-center gap-1.5"
                      >
                        <Copy size={13} />
                        {copyState === "copied" ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={(e) => void handleVerifyTotpReset(e)} className={formClass}>
                <label className={labelClass}>
                  Confirmation code
                  <input
                    value={verifyCode}
                    onChange={(e) => {
                      setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setVerifyError(null);
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                  />
                </label>
                {verifyError && <ErrorText className="m-0">{verifyError}</ErrorText>}
                <ButtonRow>
                  <Button type="submit" disabled={verifySubmitting || verifyCode.length !== 6}>
                    {verifySubmitting ? "Verifying…" : "Confirm new 2FA"}
                  </Button>
                </ButtonRow>
              </form>
            </div>
          )}

          {totpPhase === "done" && (
            <div className="grid gap-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <p className="flex items-center gap-2" style={{ margin: 0, fontSize: "0.875rem", color: "#065f46" }}>
                  <CheckCircle2 size={14} />
                  Two-factor authentication has been reset. Your authenticator app is now linked to the new secret.
                </p>
              </div>
              <ButtonRow>
                <Button type="button" onClick={resetTotpFlow}>
                  <RotateCcw size={14} /> Reset again
                </Button>
              </ButtonRow>
            </div>
          )}
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center gap-2 font-bold">
          <Tag size={18} /> Version
        </div>
        <p className="mt-2 tabular-nums text-slate-500">{currentVersion ?? "Unknown"}</p>
        <ButtonRow className="mt-3">
          <a
            href="/update"
            className="inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Check for updates
          </a>
        </ButtonRow>
      </Card>
    </Page>
  );
}
