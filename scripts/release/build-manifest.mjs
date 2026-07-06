import { readFileSync, writeFileSync } from "node:fs";

const sourcePath = process.argv[2] ?? "manifest.source.json";
const outPath = process.argv[3] ?? "manifest.json";
const frontendDigest = process.env.FRONTEND_DIGEST ?? "";
const backendDigest = process.env.BACKEND_DIGEST ?? "";

const source = JSON.parse(readFileSync(sourcePath, "utf8"));

const manifest = {
  ...source,
  ...(frontendDigest ? { frontend: frontendDigest } : {}),
  ...(backendDigest ? { backend: backendDigest } : {})
};

for (const [service, digest] of Object.entries(manifest)) {
  if (!digest) {
    throw new Error(`manifest missing digest for "${service}"`);
  }
}

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
