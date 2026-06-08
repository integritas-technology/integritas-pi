import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import type { AuthUser } from "./types";

export function SidebarUserBox({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => void;
}) {
  return (
    <div className="sidebar-user-box">
      <div className="sidebar-user-box-main">
        <div className="sidebar-user-box-avatar" aria-hidden="true">
          <UserRound size={18} />
        </div>
        <div className="sidebar-user-box-copy">
          <strong>{user.username}</strong>
          <p>Administrator</p>
        </div>
      </div>

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
