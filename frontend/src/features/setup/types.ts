import type { AdminCredentialType } from "../auth/adminCredentials";

export type OnboardingStepId = "welcome" | "account" | "twofa" | "connectAccount" | "complete";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  shortLabel: string;
};

export type OnboardingFormState = {
  credentialType: AdminCredentialType;
  password: string;
  confirmPassword: string;
  twoFactorCode: string;
};

export type CheckState = "idle" | "checking" | "ok" | "error";
