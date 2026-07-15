import { writeFileSync } from "node:fs";

const outPath = process.argv[2] ?? "manifest.json";
const frontendDigest = process.env.FRONTEND_DIGEST ?? "";
const backendDigest = process.env.BACKEND_DIGEST ?? "";
const updateAgentDigest = process.env.UPDATE_AGENT_DIGEST ?? "";
const version = process.env.VERSION ?? "";

if (!version) {
  throw new Error("VERSION env var is required");
}

const manifest = {
  frontend: frontendDigest,
  backend: backendDigest,
  updateAgent: updateAgentDigest,
  version,
  createdAt: new Date().toISOString()
};

const NON_DIGEST_KEYS = new Set(["version", "createdAt"]);

for (const [service, digest] of Object.entries(manifest)) {
  if (NON_DIGEST_KEYS.has(service)) continue;
  if (!digest) {
    throw new Error(`manifest missing digest for "${service}"`);
  }
}

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
