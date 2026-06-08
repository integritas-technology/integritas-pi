import { LogOut, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import type { MockSession } from "./storage";

export function SidebarUserBox({
  session,
  onSignOut,
  onCreateAdminAccount,
}: {
  session: MockSession;
  onSignOut: () => void;
  onCreateAdminAccount?: () => void;
}) {
  const isGuest = session.mode === "guest";
  const displayName = isGuest ? "Guest" : (session.username ?? "Admin");

  return (
    <div
      className={isGuest ? "sidebar-user-box sidebar-user-box-guest" : "sidebar-user-box"}
    >
      <div className="sidebar-user-box-main">
        <div
          className={
            isGuest ? "sidebar-user-box-avatar sidebar-user-box-avatar-guest" : "sidebar-user-box-avatar"
          }
          aria-hidden="true"
        >
          <UserRound size={18} />
        </div>
        <div className="sidebar-user-box-copy">
          <strong>{displayName}</strong>
          <p>{isGuest ? "Browsing without admin account" : "Administrator"}</p>
        </div>
      </div>

      <div className="sidebar-user-box-meta">
        {isGuest ? (
          <span className="sidebar-user-box-pill sidebar-user-box-pill-warn">
            <ShieldAlert size={12} /> Limited security
          </span>
        ) : (
          <span className="sidebar-user-box-pill sidebar-user-box-pill-good">
            <ShieldCheck size={12} /> 2FA protected
          </span>
        )}
      </div>

      {isGuest && onCreateAdminAccount ? (
        <button
          type="button"
          className="sidebar-user-box-cta"
          onClick={onCreateAdminAccount}
        >
          Create admin account
        </button>
      ) : null}

      <button type="button" className="sidebar-user-box-signout" onClick={onSignOut}>
        <LogOut size={14} /> Sign out
      </button>
    </div>
  );
}
