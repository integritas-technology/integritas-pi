import type { OnboardingStep } from "./types";

export const onboardingSteps: OnboardingStep[] = [
  { id: "welcome", label: "Welcome", shortLabel: "Welcome" },
  { id: "account", label: "Secure access", shortLabel: "Account" },
  { id: "minima", label: "Minima node", shortLabel: "Minima" },
  { id: "integritas", label: "Integritas stamping", shortLabel: "Integritas" },
  { id: "complete", label: "Ready to use", shortLabel: "Finish" },
];
