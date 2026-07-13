import { useEffect, useState } from "react";
import { formatLocalTime, formatUtcTime } from "../lib/time";

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="grid min-w-[210px] grid-cols-2 gap-3 rounded-[20px] border border-slate-200 bg-white p-3 shadow-[0_12px_26px_rgba(15,23,42,0.05)]" aria-label="Current local and UTC time">
      <div className="grid gap-1"><span className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-slate-400">Local</span><strong className="font-mono text-sm text-slate-950">{formatLocalTime(now)}</strong></div>
      <div className="grid gap-1"><span className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-slate-400">UTC</span><strong className="font-mono text-sm text-slate-950">{formatUtcTime(now)}</strong></div>
    </div>
  );
}
