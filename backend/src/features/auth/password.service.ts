import bcrypt from "bcrypt";

const ROUNDS = 12;

export const ADMIN_PIN_LENGTH = 6;
export const ADMIN_PASSWORD_MIN_LENGTH = 8;

const ADMIN_PIN_PATTERN = new RegExp(`^\\d{${ADMIN_PIN_LENGTH}}$`);

export function isValidAdminPin(pin: string) {
  return ADMIN_PIN_PATTERN.test(pin);
}

export function isValidAdminCredential(credential: string) {
  return isValidAdminPin(credential) || credential.length >= ADMIN_PASSWORD_MIN_LENGTH;
}

export function adminCredentialValidationError() {
  return `PIN must be exactly ${ADMIN_PIN_LENGTH} digits or password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters`;
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
