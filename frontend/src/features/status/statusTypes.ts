export type DeviceNodeState = "running" | "stopped" | "error" | "restarting" | "unknown";

export type DeviceDisk = {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
};

export type DeviceStatus = {
  checkedAt: string;
  device: {
    id: string;
    hostname: string;
    platform: string;
    arch: string;
    uptimeSeconds: number;
    cpuCount: number;
    memory: {
      totalBytes: number;
      freeBytes: number;
      usedBytes: number;
    };
    loadAvg: [number, number, number];
    disk: DeviceDisk | null;
  };
  app: {
    running: true;
    setupComplete: boolean;
    integritasConfigured: boolean;
    integritasConnected: boolean | null;
  };
  node: {
    state: DeviceNodeState;
    lastCheckedAt: string | null;
  };
};
