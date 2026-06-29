import { LogOut, Settings, ShieldCheck } from "lucide-react";
import type { AuthUser } from "./types";

export function SidebarUserBox({
  user,
  onSignOut,
  onSettings,
}: {
  user: AuthUser;
  onSignOut: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="sidebar-user-box">
      <button type="button" className="sidebar-user-box-main" onClick={onSettings}>
        <div className="sidebar-user-box-avatar" aria-hidden="true">
          <Settings size={18} />
        </div>
        <div className="sidebar-user-box-copy">
          <strong>{user.displayName}</strong>
          <p>Account settings</p>
        </div>
      </button>

      <div className="sidebar-user-box-meta">
        <span className="sidebar-user-box-pill sidebar-user-box-pill-good">
          <ShieldCheck size={12} /> 2FA protected
        </span>
      </div>

      <button type="button" className="sidebar-user-box-signout" onClick={onSignOut}>
        <LogOut size={14} /> Sign out
      </button>
    </div>
  );
}
