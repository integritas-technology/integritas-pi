import { writeFileSync } from "node:fs";

const outPath = process.argv[2] ?? "manifest.json";
const frontendDigest = process.env.FRONTEND_DIGEST ?? "";
const backendDigest = process.env.BACKEND_DIGEST ?? "";

const manifest = {
  frontend: frontendDigest,
  backend: backendDigest,
  createdAt: new Date().toISOString()
};

for (const [service, digest] of Object.entries(manifest)) {
  if (service === "createdAt") continue;
  if (!digest) {
    throw new Error(`manifest missing digest for "${service}"`);
  }
}

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
