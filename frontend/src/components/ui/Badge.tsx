import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface BadgeProps { children: ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info"; className?: string; }

const variants = {
  default: "bg-hover text-ink border border-stroke",
  success: "bg-green-50 text-green-700 border border-green-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  danger:  "bg-red-50 text-red-700 border border-red-200",
  info:    "bg-primary-50 text-primary-700 border border-primary-200",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
