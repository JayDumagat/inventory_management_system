import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface BadgeProps { children: ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info"; className?: string; }

const variants = {
  default: "bg-stroke text-ink",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger:  "bg-red-100 text-red-800",
  info:    "bg-primary-100 text-primary-800",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
