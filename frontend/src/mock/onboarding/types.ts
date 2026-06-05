export type OnboardingStepId = "welcome" | "account" | "minima" | "integritas" | "complete";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  shortLabel: string;
};

export type OnboardingFormState = {
  username: string;
  password: string;
  confirmPassword: string;
  requireLocalAuth: boolean;
  minimaMdsPassword: string;
  minimaAutoConnect: boolean;
  integritasApiKey: string;
  skipIntegritas: boolean;
};

export type MockCheckState = "idle" | "checking" | "ok" | "error";
