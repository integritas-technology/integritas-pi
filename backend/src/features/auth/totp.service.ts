import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { decryptSecret, encryptSecret, type EncryptedSecret } from "../../shared/crypto.js";

const ISSUER = "Integritas Pi";

export function generateSecret() {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function getOtpAuthUrl(secret: string, username: string) {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  });
  return totp.toString();
}

export async function renderQrPngBase64(otpAuthUrl: string) {
  return QRCode.toDataURL(otpAuthUrl, { type: "image/png", margin: 1 });
}

export function verifyToken(secret: string, token: string) {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  });
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export function encryptTotpSecret(secret: string) {
  return JSON.stringify(encryptSecret(secret));
}

export function decryptTotpSecret(encryptedJson: string) {
  return decryptSecret(JSON.parse(encryptedJson) as EncryptedSecret);
}
