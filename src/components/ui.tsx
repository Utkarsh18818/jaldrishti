import Link from "next/link";
import { ArrowUpRight, Waves } from "lucide-react";
import type { ReactNode } from "react";
import type { RiskLevel } from "@/lib/demo-data";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="JalDrishti home">
      <Waves size={25} strokeWidth={1.7} />
      <span>
        JalDrishti<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function ButtonLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={secondary ? "button secondary" : "button"} href={href}>
      {children}
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function StatusBadge({
  risk,
  children,
}: {
  risk: RiskLevel;
  children: ReactNode;
}) {
  return (
    <span className={`status status-${risk}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}
