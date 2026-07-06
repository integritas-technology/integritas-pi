import { readFileSync, writeFileSync } from "node:fs";
import { sign } from "node:crypto";

const manifestPath = process.argv[2] ?? "manifest.json";
const signaturePath = process.argv[3] ?? "manifest.json.sig";
const privateKeyPem = process.env.MANIFEST_SIGNING_KEY;

if (!privateKeyPem) {
  throw new Error("MANIFEST_SIGNING_KEY env var is required (Ed25519 private key, PEM format)");
}

const manifestBytes = readFileSync(manifestPath);
const privateKey = { key: privateKeyPem, format: "pem" };
const signature = sign(null, manifestBytes, privateKey);

writeFileSync(signaturePath, signature.toString("base64"));
console.log(`Wrote ${signaturePath}`);
