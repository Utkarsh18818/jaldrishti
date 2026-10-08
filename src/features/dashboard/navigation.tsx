"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  SlidersHorizontal,
  Network,
  Bell,
  ListChecks,
  TrendingUp,
  Database,
} from "lucide-react";
export const sections = [
  { slug: "", title: "Overview", icon: LayoutDashboard },
  { slug: "forecast", title: "Forecast", icon: Activity },
  { slug: "simulator", title: "Simulator", icon: SlidersHorizontal },
  { slug: "system", title: "System", icon: Network },
  { slug: "alerts", title: "Alerts", icon: Bell },
  { slug: "actions", title: "Actions", icon: ListChecks },
  { slug: "impact", title: "Impact", icon: TrendingUp },
  { slug: "data", title: "Data", icon: Database },
];
export function DashboardNavigation() {
  const pathname = usePathname();
  return (
    <nav className="dashboard-navigation" aria-label="Dashboard">
      {sections.map(({ slug, title, icon: Icon }) => {
        const href = "/dashboard" + (slug ? "/" + slug : "");
        return (
          <Link
            key={title}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon size={19} />
            <span>{title}</span>
            {title === "Alerts" && (
              <span className="nav-alert" aria-label="Demo alert">
                •
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
