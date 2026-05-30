import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface BadgeProps { children: ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info"; className?: string; }

const variants = {
  default: "bg-hover text-ink border border-stroke",
  success: "bg-green-50 text-green-800 border border-green-200",
  warning: "bg-yellow-50 text-yellow-800 border border-yellow-200",
  danger:  "bg-red-50 text-red-800 border border-red-200",
  info:    "bg-primary-50 text-primary-800 border border-primary-200",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center ui-pill px-2.5 py-1 text-xs font-medium uppercase tracking-[0.04em]", variants[variant], className)}>
      {children}
    </span>
  );
}
