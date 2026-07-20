export const ADMIN_PIN_LENGTH = 6;
export const ADMIN_PASSWORD_MIN_LENGTH = 8;

export type AdminCredentialType = "pin" | "password";

const ADMIN_PIN_PATTERN = new RegExp(`^\\d{${ADMIN_PIN_LENGTH}}$`);

export function isValidAdminPin(pin: string) {
  return ADMIN_PIN_PATTERN.test(pin);
}

export function isValidAdminPassword(password: string) {
  return password.length >= ADMIN_PASSWORD_MIN_LENGTH;
}

export function isValidAdminCredential(type: AdminCredentialType, credential: string) {
  return type === "pin" ? isValidAdminPin(credential) : isValidAdminPassword(credential);
}

export function sanitizePinInput(value: string) {
  return value.replace(/\D/g, "").slice(0, ADMIN_PIN_LENGTH);
}

export function adminPinHint() {
  return `${ADMIN_PIN_LENGTH}-digit PIN`;
}

export function adminPasswordHint() {
  return `At least ${ADMIN_PASSWORD_MIN_LENGTH} characters`;
}
