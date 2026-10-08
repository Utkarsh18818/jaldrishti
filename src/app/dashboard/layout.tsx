"use client";
import Link from "next/link";
import { MapPin, ArrowUpRight } from "lucide-react";
import { Brand, StatusBadge } from "@/components/ui";
import { OperationalProvider, useOperations } from "@/features/system/context";
import { DashboardNavigation } from "@/features/dashboard/navigation";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OperationalProvider>
      <DashboardShell>{children}</DashboardShell>
    </OperationalProvider>
  );
}
function DashboardShell({ children }: { children: React.ReactNode }) {
  const { view: demo, modeLabel, backendMode } = useOperations();
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">SAMPLE DEMO · DEMO_SYNTHETIC</p>
        <div className="location">
          <MapPin size={18} />
          <div>
            {demo.location}
            <small>Pune example region · No tank sensors</small>
          </div>
        </div>
        <DashboardNavigation />
        <div className="sidebar-bottom">
          <StatusBadge risk={demo.risk}>{demo.status}</StatusBadge>
          <p>Seeded score · Not recalculated</p>
          <p>
            Environmental intelligence.
            <br />
            Preventive action.
          </p>
          <Link href="/">
            Back to JalDrishti <ArrowUpRight size={14} />
          </Link>
          <Link href="/analysis">Analyze my site ↗</Link>
        </div>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-top">
          <span>
            <MapPin size={15} />
            {demo.location}
          </span>
          <span className="preview-label">SAMPLE DEMO · {modeLabel}</span>
        </header>
        <main id="main" className="dashboard-main">
          {children}
        </main>
        <footer className="dashboard-footer">
          {backendMode} · {modeLabel} · Deterministic water balance · No tank
          monitoring
        </footer>
      </div>
    </div>
  );
}
