const LOGIN_KEY = "integritas-pi.mock-logged-in";

export function isLoggedIn(): boolean {
  try {
    return localStorage.getItem(LOGIN_KEY) === "true";
  } catch {
    return false;
  }
}

export function markLoggedIn(): void {
  try {
    localStorage.setItem(LOGIN_KEY, "true");
  } catch {
    // Ignore storage failures in prototype mockup.
  }
}

export function logout(): void {
  try {
    localStorage.removeItem(LOGIN_KEY);
  } catch {
    // Ignore storage failures in prototype mockup.
  }
}
