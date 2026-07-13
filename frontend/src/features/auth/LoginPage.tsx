import { useState } from "react";
import { ArrowLeft, ArrowRight, Layers3, LogIn } from "lucide-react";
import { ErrorText } from "../../components/Text";
import { login } from "./api";

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
    <div className="fixed inset-0 z-50 flex min-h-0 items-center justify-center overflow-auto overscroll-contain bg-slate-50 p-4 sm:p-6">
      <div className="grid w-full max-w-[420px] gap-5 rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/10 sm:p-8" role="main" aria-label="Sign in">
        <div className="grid justify-items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white" aria-hidden="true">
            <Layers3 size={24} />
          </div>
          <div>
            <p className="m-0 text-sm text-slate-500">Minima Edge Stack</p>
            <h1 className="m-0 text-xl text-slate-950">Edge Workbench</h1>
          </div>
        </div>

        {phase === "credentials" ? (
          <div className="grid gap-3">
            <p className="m-0 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">Sign in</p>
            <h2 className="m-0 text-xl leading-tight text-slate-950">Welcome back</h2>
            <p className="m-0 text-sm leading-relaxed text-slate-600">
              Enter your admin password to continue.
            </p>

            <div className="grid gap-2.5">
              <label className="grid gap-2 font-bold text-slate-700">
                Password
                <input
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-950"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="Your password"
                  autoComplete="current-password"
                />
              </label>
            </div>

            <div className="grid gap-2.5 pt-1">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!credentialsValid}
                onClick={continueToTwoFactor}
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 self-start border-0 bg-transparent p-0 text-sm font-bold text-slate-600"
              onClick={backToCredentials}
            >
              <ArrowLeft size={16} /> Back
            </button>

            <p className="m-0 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">Two-factor auth</p>
            <h2 className="m-0 text-xl leading-tight text-slate-950">Enter your code</h2>
            <p className="m-0 text-sm leading-relaxed text-slate-600">
              Open your authenticator app and enter the 6-digit code for{" "}
              <strong>{TOTP_ACCOUNT_LABEL}</strong>.
            </p>

            <div className="grid gap-2.5">
              <label className="grid gap-2 font-bold text-slate-700">
                Authentication code
                <input
                  className="w-full max-w-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-center text-lg font-semibold tracking-[0.35em] text-slate-950"
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

            {error ? <ErrorText>{error}</ErrorText> : null}

            <div className="grid gap-2.5 pt-1">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
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
