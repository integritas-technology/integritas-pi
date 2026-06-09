import { useState } from "react";
import { ArrowLeft, ArrowRight, Layers3, LogIn } from "lucide-react";
import { login } from "./api";
import "./login.css";

type LoginPhase = "credentials" | "twofa";

const TOTP_ACCOUNT_LABEL = "Edge Workbench";

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [phase, setPhase] = useState<LoginPhase>("credentials");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const credentialsValid = password.trim().length >= 1;
  const twoFactorValid = twoFactorCode.length === 6;

  const continueToTwoFactor = () => {
    if (!credentialsValid) return;
    setError(null);
    setPhase("twofa");
    setTwoFactorCode("");
  };

  const signIn = async () => {
    if (!twoFactorValid || signingIn) return;
    setSigningIn(true);
    setError(null);
    try {
      await login({
        password,
        totpToken: twoFactorCode,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSigningIn(false);
    }
  };

  const backToCredentials = () => {
    setPhase("credentials");
    setTwoFactorCode("");
    setSigningIn(false);
    setError(null);
  };

  return (
    <div className="mock-login-root">
      <div className="mock-login-card" role="main" aria-label="Sign in">
        <div className="mock-login-brand">
          <div className="mock-login-brand-icon" aria-hidden="true">
            <Layers3 size={24} />
          </div>
          <div>
            <p>Minima Edge Stack</p>
            <h1>Edge Workbench</h1>
          </div>
        </div>

        {phase === "credentials" ? (
          <div className="mock-login-panel">
            <p className="mock-login-eyebrow">Sign in</p>
            <h2>Welcome back</h2>
            <p className="mock-login-lead">
              Enter your admin password to continue.
            </p>

            <div className="mock-login-form">
              <label className="mock-login-label">
                Password
                <input
                  className="mock-login-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="Your password"
                  autoComplete="current-password"
                />
              </label>
            </div>

            <div className="mock-login-actions">
              <button
                type="button"
                className="mock-login-btn-primary"
                disabled={!credentialsValid}
                onClick={continueToTwoFactor}
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="mock-login-panel">
            <button
              type="button"
              className="mock-login-back"
              onClick={backToCredentials}
            >
              <ArrowLeft size={16} /> Back
            </button>

            <p className="mock-login-eyebrow">Two-factor auth</p>
            <h2>Enter your code</h2>
            <p className="mock-login-lead">
              Open your authenticator app and enter the 6-digit code for{" "}
              <strong>{TOTP_ACCOUNT_LABEL}</strong>.
            </p>

            <div className="mock-login-form">
              <label className="mock-login-label">
                Authentication code
                <input
                  className="mock-login-code-input"
                  value={twoFactorCode}
                  onChange={(event) =>
                    setTwoFactorCode(
                      event.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </label>
            </div>

            {error ? <p className="error-text">{error}</p> : null}

            <div className="mock-login-actions">
              <button
                type="button"
                className="mock-login-btn-primary"
                disabled={!twoFactorValid || signingIn}
                onClick={signIn}
              >
                {signingIn ? (
                  "Signing in…"
                ) : (
                  <>
                    <LogIn size={16} /> Sign in
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
