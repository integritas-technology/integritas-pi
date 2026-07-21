export type AuthUser = {
  displayName: string;
  role: "admin";
  lastLogin?: string | null;
};

export type SetupStatus = {
  localAdminCreated: boolean;
  setupComplete: boolean;
};
