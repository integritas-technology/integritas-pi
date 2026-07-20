export const ADMIN_PIN_LENGTH = 6;
export const ADMIN_PASSWORD_MIN_LENGTH = 8;

export type AdminCredentialType = "pin" | "password";
export type AdminPasswordRequirement = {
  id: "length" | "uppercase" | "lowercase" | "number" | "symbol";
  label: string;
  met: boolean;
};

const ADMIN_PIN_PATTERN = new RegExp(`^\\d{${ADMIN_PIN_LENGTH}}$`);
const ADMIN_PASSWORD_UPPERCASE_PATTERN = /[A-Z]/;
const ADMIN_PASSWORD_LOWERCASE_PATTERN = /[a-z]/;
const ADMIN_PASSWORD_NUMBER_PATTERN = /\d/;
const ADMIN_PASSWORD_SYMBOL_PATTERN = /[^A-Za-z0-9\s]/;

export function isValidAdminPin(pin: string) {
  return ADMIN_PIN_PATTERN.test(pin);
}

export function getAdminPasswordRequirements(password: string): AdminPasswordRequirement[] {
  return [
    { id: "length", label: `${ADMIN_PASSWORD_MIN_LENGTH} or more characters`, met: password.length >= ADMIN_PASSWORD_MIN_LENGTH },
    { id: "uppercase", label: "One uppercase letter", met: ADMIN_PASSWORD_UPPERCASE_PATTERN.test(password) },
    { id: "lowercase", label: "One lowercase letter", met: ADMIN_PASSWORD_LOWERCASE_PATTERN.test(password) },
    { id: "number", label: "One number", met: ADMIN_PASSWORD_NUMBER_PATTERN.test(password) },
    { id: "symbol", label: "One symbol, such as ! or @", met: ADMIN_PASSWORD_SYMBOL_PATTERN.test(password) }
  ];
}

export function isValidAdminPassword(password: string) {
  return getAdminPasswordRequirements(password).every((requirement) => requirement.met);
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
