import { TOTP_ENABLED } from "../auth/totpEnabled";
import type { OnboardingStep } from "./types";

export const onboardingSteps: OnboardingStep[] = [
  { id: "welcome", label: "Welcome", shortLabel: "Welcome" },
  { id: "account", label: "Set PIN", shortLabel: "PIN" },
  // TEMP: restore if we need TOTP or delete TOTP if not needed.
  ...(TOTP_ENABLED ? [{ id: "twofa" as const, label: "Two-factor auth", shortLabel: "2FA" }] : []),
  { id: "integritas", label: "Integritas API key", shortLabel: "Integritas" },
  { id: "complete", label: "Ready to use", shortLabel: "Finish" },
];
