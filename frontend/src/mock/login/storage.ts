export type MockSessionMode = "admin" | "guest";

export type MockSession = {
  mode: MockSessionMode;
  username?: string;
};

const SESSION_KEY = "integritas-pi.mock-session";

function readSession(): MockSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockSession;
    if (parsed.mode !== "admin" && parsed.mode !== "guest") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: MockSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures in prototype mockup.
  }
}

export function getSession(): MockSession | null {
  return readSession();
}

export function isLoggedIn(): boolean {
  return readSession() !== null;
}

export function markAdminLogin(username: string): void {
  writeSession({ mode: "admin", username: username.trim() || "admin" });
}

export function markGuestLogin(): void {
  writeSession({ mode: "guest" });
}

export function markLoggedIn(username = "admin"): void {
  markAdminLogin(username);
}

export function logout(): void {
  writeSession(null);
}
