export type OnboardingStepId =
  | "welcome"
  | "account"
  | "twofa"
  | "integritas"
  | "complete";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  shortLabel: string;
};

export type OnboardingFormState = {
  username: string;
  password: string;
  confirmPassword: string;
  twoFactorCode: string;
  integritasApiKey: string;
};

export type MockCheckState = "idle" | "checking" | "ok" | "error";
