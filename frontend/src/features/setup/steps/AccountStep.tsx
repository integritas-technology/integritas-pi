import { cx } from "../../../lib/cx";
import {
  adminPinHint,
  isValidAdminCredential,
  sanitizePinInput,
  type AdminCredentialType,
} from "../../auth/adminCredentials";
import { PasswordRequirements } from "../../auth/PasswordRequirements";
import {
  eyebrowClass,
  formGridClass,
  goodHintClass,
  headingClass,
  inputClass,
  labelClass,
  leadClass,
  mutedClass,
  panelClass,
  warnHintClass,
} from "../onboardingStyles";
import type { OnboardingFormState } from "../types";

function credentialHint(
  type: AdminCredentialType,
  credential: string,
): {
  label: string;
  tone: "warn" | "good" | "neutral";
} {
  if (type === "pin") {
    if (!credential) return { label: `Enter a ${adminPinHint()}`, tone: "neutral" };
    if (!isValidAdminCredential(type, credential))
      return { label: `Must be a ${adminPinHint()}`, tone: "warn" };
    return { label: "PIN looks good", tone: "good" };
  }

  if (!credential) return { label: "Complete the password requirements below", tone: "neutral" };
  if (!isValidAdminCredential(type, credential))
    return { label: "Complete the remaining password requirements", tone: "warn" };
  return { label: "Password looks good", tone: "good" };
}

export function AccountStep({
  form,
  setForm,
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
}) {
  const hint = credentialHint(form.credentialType, form.password);
  const credentialsMatch = !form.confirmPassword || form.password === form.confirmPassword;
  const isPin = form.credentialType === "pin";
  const credentialLabel = isPin ? "PIN" : "Password";

  const selectCredentialType = (credentialType: AdminCredentialType) => {
    setForm({ credentialType, password: "", confirmPassword: "" });
  };

  return (
    <div className={panelClass}>
      <p className={eyebrowClass}>Secure this device</p>
      <h2 className={headingClass}>Choose a PIN or password</h2>
      <p className={leadClass}>This local credential unlocks Edge Workbench on this hardware.</p>

      <div className={formGridClass}>
        <fieldset className="grid gap-2 border-0 p-0">
          <legend className="mb-2 font-bold text-slate-700">Credential type</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["pin", "password"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={cx(
                  "rounded-xl border px-3 py-2.5 text-sm font-bold",
                  form.credentialType === type
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-300 bg-white text-slate-700",
                )}
                aria-pressed={form.credentialType === type}
                onClick={() => selectCredentialType(type)}
              >
                {type === "pin" ? "6-digit PIN" : "Password"}
              </button>
            ))}
          </div>
        </fieldset>

        <label className={labelClass}>
          {credentialLabel}
          <input
            className={inputClass}
            value={form.password}
            onChange={(event) =>
              setForm({
                password: isPin ? sanitizePinInput(event.target.value) : event.target.value,
              })
            }
            type="password"
            inputMode={isPin ? "numeric" : "text"}
            pattern={isPin ? "[0-9]*" : undefined}
            maxLength={isPin ? 6 : undefined}
            placeholder={isPin ? "000000" : "Create a strong password"}
            autoComplete="new-password"
          />
          <span
            className={cx(
              hint.tone === "good" && goodHintClass,
              hint.tone === "warn" && warnHintClass,
              hint.tone === "neutral" && mutedClass,
            )}
          >
            {hint.label}
          </span>
        </label>
        {!isPin && <PasswordRequirements password={form.password} />}

        <label className={labelClass}>
          Confirm {credentialLabel.toLowerCase()}
          <input
            className={inputClass}
            value={form.confirmPassword}
            onChange={(event) =>
              setForm({
                confirmPassword: isPin ? sanitizePinInput(event.target.value) : event.target.value,
              })
            }
            type="password"
            inputMode={isPin ? "numeric" : "text"}
            pattern={isPin ? "[0-9]*" : undefined}
            maxLength={isPin ? 6 : undefined}
            placeholder={`Repeat ${credentialLabel.toLowerCase()}`}
            autoComplete="new-password"
          />
          {!credentialsMatch && (
            <span className={warnHintClass}>{credentialLabel}s do not match</span>
          )}
        </label>
      </div>
    </div>
  );
}
