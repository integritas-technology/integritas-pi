import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ToastProvider } from "./components/ToastProvider";
import { AuthProvider, useAuth } from "./features/auth";
import { DashboardPage } from "./pages/DashboardPage";
import { DataSourcesPage } from "./pages/DataSourcesPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { IntegritasPage } from "./pages/IntegritasPage";
import { MinimaPage } from "./pages/MinimaPage";
import { AutomationPage } from "./pages/AutomationPage";
import { SetupPage } from "./pages/SetupPage";
import { WalletPage } from "./pages/WalletPage";
import { AuthSettingsPage } from "./pages/AuthSettingsPage";

function AppContent() {
  const { user, signOut } = useAuth();

  return (
    <AppShell user={user!} onSignOut={() => void signOut()}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/node" element={<MinimaPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/integritas" element={<IntegritasPage />} />
        <Route path="/data" element={<DataSourcesPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/diagnostics" element={<DiagnosticsPage />} />
        <Route path="/settings" element={<AuthSettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ProtectedRoute>
          <AppContent />
        </ProtectedRoute>
      </AuthProvider>
    </ToastProvider>
  );
}
