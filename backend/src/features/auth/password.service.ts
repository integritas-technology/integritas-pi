import bcrypt from "bcrypt";

const ROUNDS = 12;

export const ADMIN_PIN_LENGTH = 6;
export const ADMIN_PASSWORD_MIN_LENGTH = 8;

const ADMIN_PIN_PATTERN = new RegExp(`^\\d{${ADMIN_PIN_LENGTH}}$`);
const ADMIN_PASSWORD_UPPERCASE_PATTERN = /[A-Z]/;
const ADMIN_PASSWORD_LOWERCASE_PATTERN = /[a-z]/;
const ADMIN_PASSWORD_NUMBER_PATTERN = /\d/;
const ADMIN_PASSWORD_SYMBOL_PATTERN = /[^A-Za-z0-9\s]/;

export function isValidAdminPin(pin: string) {
  return ADMIN_PIN_PATTERN.test(pin);
}

export function isValidAdminPassword(password: string) {
  return (
    password.length >= ADMIN_PASSWORD_MIN_LENGTH &&
    ADMIN_PASSWORD_UPPERCASE_PATTERN.test(password) &&
    ADMIN_PASSWORD_LOWERCASE_PATTERN.test(password) &&
    ADMIN_PASSWORD_NUMBER_PATTERN.test(password) &&
    ADMIN_PASSWORD_SYMBOL_PATTERN.test(password)
  );
}

export function isValidAdminCredential(credential: string) {
  return isValidAdminPin(credential) || isValidAdminPassword(credential);
}

export function adminCredentialValidationError() {
  return `PIN must be exactly ${ADMIN_PIN_LENGTH} digits or password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, number, and symbol`;
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
