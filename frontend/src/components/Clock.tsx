import { useEffect, useState } from "react";
import { formatLocalTime, formatUtcTime } from "../lib/time";

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="clock-card" aria-label="Current local and UTC time">
      <div><span>Local</span><strong>{formatLocalTime(now)}</strong></div>
      <div><span>UTC</span><strong>{formatUtcTime(now)}</strong></div>
    </div>
  );
}
