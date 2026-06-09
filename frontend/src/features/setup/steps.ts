import type { OnboardingStep } from "./types";

export const onboardingSteps: OnboardingStep[] = [
  { id: "welcome", label: "Welcome", shortLabel: "Welcome" },
  { id: "account", label: "Set password", shortLabel: "Password" },
  { id: "twofa", label: "Two-factor auth", shortLabel: "2FA" },
  { id: "integritas", label: "Integritas API key", shortLabel: "Integritas" },
  { id: "complete", label: "Ready to use", shortLabel: "Finish" },
];
