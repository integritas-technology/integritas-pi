import type { LucideIcon } from "lucide-react";

export type Tone = "neutral" | "good" | "warn" | "future";
export type NavId = "dashboard" | "setup" | "node" | "wallet" | "integritas" | "data" | "automation" | "diagnostics";
export type NavItem = { id: NavId; label: string; icon: LucideIcon; badge?: string };

export type Health = { status: string; service: string };
export type FileItem = { name: string; type: "file" | "directory" | "other"; size?: number };
export type FilesResponse = { path: string; items: FileItem[] };
export type MinimaStatus = { ok: boolean; status?: number; source: string; body?: unknown; error?: string };
export type MinimaConfig = { megammrHost: string; megammrHostSource: "database" | "default" };
export type MinimaCommandResult = { ok: boolean; status?: number; source: string; command?: string; body?: unknown; error?: string };
export type IntegritasConfig = { baseUrl: string; requestId: string; hasApiKey: boolean; apiKeySource: "database" | "environment" | "none"; portalUrl: string };
export type StatusOverview = {
  generatedAt: string;
  services: Array<{ name: string; ok: boolean; status: string; details?: unknown; error?: string }>;
  resources?: {
    containers?: Array<{
      service: string;
      containerId: string;
      state: string;
      status: string;
      cpuPercent: number | null;
      memory: { usage?: string | null; limit?: string | null } | null;
      disk: { rootFs?: string | null };
    }>;
    disks?: Array<{ path: string; used: string; total: string; free: string; usedPercent: number }>;
    error?: string;
  };
};
