import { TOTP_ENABLED } from "../auth/totpEnabled";
import type { OnboardingStep } from "./types";

export const onboardingSteps: OnboardingStep[] = [
  { id: "welcome", label: "Welcome", shortLabel: "Welcome" },
  { id: "account", label: "Secure this device", shortLabel: "Security" },
  // TEMP: restore if we need TOTP or delete TOTP if not needed.
  ...(TOTP_ENABLED ? [{ id: "twofa" as const, label: "Two-factor auth", shortLabel: "2FA" }] : []),
  { id: "connectAccount", label: "Create cloud account", shortLabel: "Account" },
  { id: "complete", label: "Ready to use", shortLabel: "Ready" },
];
