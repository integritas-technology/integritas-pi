/** Local Integritas device identity (SQLite `integritas_device`). */
export type IntegritasDeviceType = "raspberry_pi" | "self_hosted";

/** Device type accepted by Connect APIs (includes Integritas Cloud API `unknown`). */
export type IntegritasConnectDeviceType = IntegritasDeviceType | "unknown";

export type IntegritasDevice = {
  deviceId: string;
  deviceName: string;
  deviceType: IntegritasDeviceType;
  createdAt: string;
  updatedAt: string;
};

export type StartActivationInput = {
  deviceId: string;
  deviceName: string;
  deviceType: IntegritasConnectDeviceType;
};

export type StartActivationResult = {
  activationId: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: string;
  pollIntervalSeconds: number;
};

export type ActivationStatusInput = {
  activationId: string;
  deviceId: string;
};

export type DeviceTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
};

export type ActivationStatusPending = {
  status: "pending";
  expiresAt: string;
};

export type ActivationStatusApproved = {
  status: "approved";
  tokens: DeviceTokens;
  device: {
    id: string;
    deviceId: string;
    name: string;
  };
};

export type ActivationStatusTerminal = {
  status: "denied" | "expired" | "connected";
};

export type ActivationStatusResult = ActivationStatusPending | ActivationStatusApproved | ActivationStatusTerminal;

export type DeviceMeResult = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
  };
  plan: {
    name: string;
    status: string;
    endDate: string | null;
    autoRenew: boolean;
  };
  usage: {
    apiKeyUsage: number;
    apiKeyLimit: number;
    apiKeyBonus: number;
    apiKeyExpiresAt: string | null;
    remaining: number;
  };
  devices: Array<{
    id: string;
    deviceId: string;
    name: string;
    deviceType: IntegritasConnectDeviceType;
    status: string;
    lastSeenAt: string | null;
    isCurrentDevice: boolean;
  }>;
  apiKey: {
    id: string;
    masked: string;
    expiresAt: string | null;
  };
  edge: {
    maxDevices: number;
    connectedCount: number;
  };
};

export type RefreshTokenInput = {
  refreshToken: string;
  deviceId: string;
};

export type RefreshTokenResult = DeviceTokens;
