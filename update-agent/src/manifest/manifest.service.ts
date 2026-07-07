import { verify } from "node:crypto";
import { env } from "../config/env.js";
import { getLastAppliedManifestTimestamp } from "./manifest-state.js";

export type Manifest = {
  frontend: string;
  backend: string;
  "minima-node": string;
  createdAt: string;
};

export const MANIFEST_SERVICE_KEYS = ["frontend", "backend", "minima-node"] as const;

function isManifest(value: unknown): value is Manifest {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.frontend === "string" &&
    typeof record.backend === "string" &&
    typeof record["minima-node"] === "string" &&
    typeof record.createdAt === "string" &&
    !Number.isNaN(Date.parse(record.createdAt))
  );
}

export async function fetchVerifiedManifest(): Promise<Manifest> {
  if (!env.manifestUrl) {
    throw new Error("MANIFEST_URL is not configured");
  }
  if (!env.manifestPublicKey) {
    throw new Error("MANIFEST_PUBLIC_KEY is not configured");
  }

  const [manifestResponse, signatureResponse] = await Promise.all([
    fetch(env.manifestUrl),
    fetch(`${env.manifestUrl}.sig`)
  ]);

  if (!manifestResponse.ok) {
    throw new Error(`Failed to fetch manifest: HTTP ${manifestResponse.status}`);
  }
  if (!signatureResponse.ok) {
    throw new Error(`Failed to fetch manifest signature: HTTP ${signatureResponse.status}`);
  }

  const manifestBytes = Buffer.from(await manifestResponse.arrayBuffer());
  const signatureBase64 = (await signatureResponse.text()).trim();
  const signature = Buffer.from(signatureBase64, "base64");

  const valid = verify(null, manifestBytes, { key: env.manifestPublicKey, format: "pem" }, signature);
  if (!valid) {
    throw new Error("Manifest signature verification failed");
  }

  const parsed: unknown = JSON.parse(manifestBytes.toString("utf8"));
  if (!isManifest(parsed)) {
    throw new Error("Manifest is missing required fields");
  }

  // Reject strictly-older manifests (replay of a superseded release, or a
  // downgrade). Equal is allowed: it's just the already-applied manifest
  // being served again on a routine status check, not a replay attempt.
  const lastApplied = await getLastAppliedManifestTimestamp();
  if (lastApplied !== null && Date.parse(parsed.createdAt) < lastApplied) {
    throw new Error(
      `Manifest is older than the last applied update (createdAt ${parsed.createdAt}) — refusing to apply a replayed or downgraded manifest`
    );
  }

  return parsed;
}
