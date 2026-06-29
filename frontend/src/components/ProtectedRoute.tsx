import type { ReactNode } from "react";
import { useAuth } from "../features/auth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : null;
}
