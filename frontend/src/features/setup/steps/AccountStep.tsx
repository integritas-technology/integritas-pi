import { APP_NAME } from "../../../app/names";
import { CredentialInput } from "../../../components/CredentialInput";
import { cx } from "../../../lib/cx";
import {
  ADMIN_PIN_LENGTH,
  isValidAdminPin,
  sanitizePinInput,
  type AdminCredentialType,
} from "../../auth/adminCredentials";
import { PasswordRequirements } from "../../auth/PasswordRequirements";
import { CredentialTypeToggle } from "../components/CredentialTypeToggle";
import { OnboardingCard } from "../components/OnboardingCard";
import {
  eyebrowClass,
  formGridClass,
  goodHintClass,
  labelClass,
  leadClass,
  mutedClass,
  warnHintClass,
} from "../onboardingStyles";
import type { OnboardingFormState } from "../types";

function pinHint(pin: string): { label: string; tone: "good" | "neutral" } {
  if (!pin) return { label: `Enter ${ADMIN_PIN_LENGTH} digits`, tone: "neutral" };
  if (!isValidAdminPin(pin)) {
    return { label: `${pin.length} of ${ADMIN_PIN_LENGTH} digits`, tone: "neutral" };
  }
  return { label: "PIN looks good", tone: "good" };
}

export function AccountStep({
  form,
  setForm,
  onSubmit,
}: {
  form: OnboardingFormState;
  setForm: (patch: Partial<OnboardingFormState>) => void;
  onSubmit: () => void;
}) {
  const isPin = form.credentialType === "pin";
  const credentialLabel = isPin ? "PIN" : "Password";
  const hint = isPin ? pinHint(form.password) : null;
  const confirmComplete = isPin
    ? form.confirmPassword.length === ADMIN_PIN_LENGTH
    : form.password.length > 0 && form.confirmPassword.length >= form.password.length;
  const showMismatch =
    Boolean(form.confirmPassword) && confirmComplete && form.password !== form.confirmPassword;

  const selectCredentialType = (credentialType: AdminCredentialType) => {
    setForm({ credentialType, password: "", confirmPassword: "" });
  };

  return (
    <OnboardingCard>
      <p className={eyebrowClass}>Secure this device</p>
      <h2 className="text-2xl font-semibold">Choose a PIN or password</h2>
      <p className={leadClass}>
        Your local credential stays on this device and unlocks {APP_NAME}.
      </p>

      <form
        className={cx(formGridClass, "relative")}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <CredentialTypeToggle
          label="Sign in method"
          value={form.credentialType}
          onChange={selectCredentialType}
        />

        <label className={labelClass}>
          {credentialLabel}
          <CredentialInput
            mode={form.credentialType}
            value={form.password}
            onChange={(event) =>
              setForm({
                password: isPin ? sanitizePinInput(event.target.value) : event.target.value,
              })
            }
            maxLength={isPin ? ADMIN_PIN_LENGTH : undefined}
            placeholder={isPin ? "••••••" : "Create a strong password"}
            autoComplete={isPin ? undefined : "new-password"}
          />
          {hint && (
            <span className={cx(hint.tone === "good" ? goodHintClass : mutedClass)}>
              {hint.label}
            </span>
          )}
        </label>
        {!isPin && <PasswordRequirements password={form.password} />}

        <label className={labelClass}>
          Confirm {credentialLabel.toLowerCase()}
          <CredentialInput
            mode={form.credentialType}
            value={form.confirmPassword}
            onChange={(event) =>
              setForm({
                confirmPassword: isPin ? sanitizePinInput(event.target.value) : event.target.value,
              })
            }
            maxLength={isPin ? ADMIN_PIN_LENGTH : undefined}
            placeholder={isPin ? "••••••" : "Repeat password"}
            autoComplete={isPin ? undefined : "new-password"}
          />
          <span
            className={cx(
              "min-h-[1.25rem] text-sm font-medium",
              showMismatch ? warnHintClass : "invisible",
            )}
            role={showMismatch ? "status" : undefined}
          >
            {showMismatch ? `${credentialLabel}s do not match` : "\u00a0"}
          </span>
        </label>

        {/* Hidden submit so Enter activates the form without a visible duplicate Continue. */}
        <button
          type="submit"
          className="absolute h-px w-px overflow-hidden border-0 p-0 [clip:rect(0,0,0,0)]"
        >
          Continue
        </button>
      </form>
    </OnboardingCard>
  );
}
