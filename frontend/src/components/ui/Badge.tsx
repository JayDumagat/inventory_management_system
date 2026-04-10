import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface BadgeProps { children: ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info"; className?: string; }

const variants = {
  default: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  success: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  warning: "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  danger:  "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  info:    "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
