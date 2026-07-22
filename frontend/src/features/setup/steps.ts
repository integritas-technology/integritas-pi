import { TOTP_ENABLED } from "../auth/totpEnabled";
import type { OnboardingStep } from "./types";

export const onboardingSteps: OnboardingStep[] = [
  { id: "welcome", label: "Welcome" },
  { id: "account", label: "Secure this device" },
  // TEMP: restore if we need TOTP or delete TOTP if not needed.
  ...(TOTP_ENABLED ? [{ id: "twofa" as const, label: "Two-factor auth" }] : []),
  { id: "connectAccount", label: "Integritas Connect" },
];

export const onboardingWorkSteps = onboardingSteps.filter((step) => step.id !== "welcome");
