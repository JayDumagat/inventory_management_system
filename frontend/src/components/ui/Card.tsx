import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface CardProps { children: ReactNode; className?: string; }
export function Card({ children, className }: CardProps) {
  return <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm", className)}>{children}</div>;
}

interface CardHeaderProps { children: ReactNode; className?: string; }
export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn("px-6 py-4 border-b border-gray-100", className)}>{children}</div>;
}

interface CardTitleProps { children: ReactNode; className?: string; }
export function CardTitle({ children, className }: CardTitleProps) {
  return <h3 className={cn("text-base font-semibold text-gray-900", className)}>{children}</h3>;
}

interface CardContentProps { children: ReactNode; className?: string; }
export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}
