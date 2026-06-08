export type AuthUser = {
  username: string;
  role: "admin";
  lastLogin?: string | null;
};

export type SetupStatus = {
  setupComplete: boolean;
};
