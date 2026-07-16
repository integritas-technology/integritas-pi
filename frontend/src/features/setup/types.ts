export type OnboardingStepId = "welcome" | "account" | "twofa" | "connectAccount" | "complete";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  shortLabel: string;
};

export type OnboardingFormState = {
  password: string;
  confirmPassword: string;
  twoFactorCode: string;
};

export type CheckState = "idle" | "checking" | "ok" | "error";
