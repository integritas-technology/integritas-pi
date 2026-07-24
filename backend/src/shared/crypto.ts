import crypto from "node:crypto";
import { env } from "../config/env.js";

export type EncryptedSecret = {
  iv: string;
  tag: string;
  value: string;
};

export function sha3HashHex(bytesOrString: string | Buffer) {
  return crypto.createHash("sha3-256").update(bytesOrString).digest("hex");
}

export function sha256Hex(bytesOrString: string | Buffer) {
  return crypto.createHash("sha256").update(bytesOrString).digest("hex");
}

function encryptionKey() {
  return crypto.createHash("sha256").update(env.appSecret).digest();
}

export function encryptSecret(value: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64")
  };
}

export function decryptSecret(secret: EncryptedSecret) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(secret.iv, "base64"));
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(secret.value, "base64")), decipher.final()]).toString("utf8");
}
