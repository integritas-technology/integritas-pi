import { Activity, BellRing, Database, Gauge, RadioTower, Rows3, Settings, ShieldCheck, Wallet } from "lucide-react";
import type { NavItem } from "./types";

export const nav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "setup", label: "Setup", icon: Settings },
  { id: "node", label: "Minima Core", icon: RadioTower },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "integritas", label: "Integritas", icon: ShieldCheck },
  { id: "data", label: "Data Sources", icon: Database },
  { id: "dataReads", label: "Data Reads", icon: Rows3 },
  { id: "automation", label: "Automation", icon: BellRing },
  { id: "diagnostics", label: "Diagnostics", icon: Activity }
];
