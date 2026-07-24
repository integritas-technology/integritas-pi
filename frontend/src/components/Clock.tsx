import { useEffect, useState } from "react";
import { formatLocalTime, formatUtcTime } from "../lib/time";

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Current local and UTC time">
      <div className="grid gap-1"><span className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-slate-400">Local</span><strong className="font-mono text-sm text-slate-950">{formatLocalTime(now)}</strong></div>
      <div className="grid gap-1 border-l border-slate-200 pl-3"><span className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-slate-400">UTC</span><strong className="font-mono text-sm text-slate-950">{formatUtcTime(now)}</strong></div>
    </div>
  );
}
