import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface CardProps { children: ReactNode; className?: string; }
export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("bg-panel border border-stroke rounded-2xl shadow-sm", className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps { children: ReactNode; className?: string; }
export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn("px-4 py-3.5 sm:px-5 sm:py-4 border-b border-stroke", className)}>{children}</div>;
}

interface CardTitleProps { children: ReactNode; className?: string; }
export function CardTitle({ children, className }: CardTitleProps) {
  return <h3 className={cn("text-sm font-semibold text-ink", className)}>{children}</h3>;
}

interface CardContentProps { children: ReactNode; className?: string; }
export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("px-4 py-3.5 sm:px-5 sm:py-4", className)}>{children}</div>;
}
