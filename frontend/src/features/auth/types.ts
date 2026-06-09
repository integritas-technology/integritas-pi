export type AuthUser = {
  displayName: string;
  role: "admin";
  lastLogin?: string | null;
};

export type SetupStatus = {
  setupComplete: boolean;
};
