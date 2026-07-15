export const ADMIN_PIN_LENGTH = 6;

const ADMIN_PIN_PATTERN = new RegExp(`^\\d{${ADMIN_PIN_LENGTH}}$`);

export function isValidAdminPin(pin: string) {
  return ADMIN_PIN_PATTERN.test(pin);
}

export function sanitizePinInput(value: string) {
  return value.replace(/\D/g, "").slice(0, ADMIN_PIN_LENGTH);
}

export function adminPinHint() {
  return `${ADMIN_PIN_LENGTH}-digit PIN`;
}
