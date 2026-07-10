import { readFileSync, writeFileSync } from "node:fs";

const sourcePath = process.argv[2] ?? "manifest.source.json";
const outPath = process.argv[3] ?? "manifest.json";
const frontendDigest = process.env.FRONTEND_DIGEST ?? "";
const backendDigest = process.env.BACKEND_DIGEST ?? "";

const source = JSON.parse(readFileSync(sourcePath, "utf8"));

const manifest = {
  ...source,
  ...(frontendDigest ? { frontend: frontendDigest } : {}),
  ...(backendDigest ? { backend: backendDigest } : {}),
  createdAt: new Date().toISOString()
};

// minima-node is not yet update-managed (minimaglobal/minima:dev is
// multi-arch with a different digest per CPU architecture — no single pinned
// digest works across the Pi fleet). `false` marks it unconfigured on
// purpose; update-agent doesn't read this key, so it's excluded from the
// "must be a real digest" check below.
const UNVALIDATED_KEYS = new Set(["createdAt", "minima-node"]);

for (const [service, digest] of Object.entries(manifest)) {
  if (UNVALIDATED_KEYS.has(service)) continue;
  if (!digest) {
    throw new Error(`manifest missing digest for "${service}"`);
  }
}

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
