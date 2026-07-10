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
    <div className="mt-4 grid gap-2.5 rounded-[18px] border border-slate-200 bg-slate-50 p-3">
      <button type="button" className="group flex w-full items-center gap-2.5 border-0 bg-transparent p-0 text-left" onClick={onSettings}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white" aria-hidden="true">
          <Settings size={18} />
        </div>
        <div>
          <strong className="block text-[0.92rem] group-hover:underline">{user.displayName}</strong>
          <p className="m-0 mt-0.5 text-[0.78rem] leading-snug text-slate-500">Account settings</p>
        </div>
      </button>

      <div className="flex">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[0.68rem] font-extrabold text-emerald-700">
          <ShieldCheck size={12} /> 2FA protected
        </span>
      </div>

      <button type="button" className="inline-flex w-fit items-center gap-1.5 border-0 bg-transparent p-0 text-[0.78rem] font-bold text-slate-500 hover:text-slate-950" onClick={onSignOut}>
        <LogOut size={14} /> Sign out
      </button>
    </div>
  );
}
