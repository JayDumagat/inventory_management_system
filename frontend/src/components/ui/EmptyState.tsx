import type { LucideIcon } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 sm:py-20 px-4 sm:px-6 text-center">
      <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
        <Icon className="w-7 h-7 text-primary-500" />
      </div>
      <h3 className="text-base font-semibold text-ink mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted max-w-xs mb-6">{description}</p>
      )}
      {(actionLabel || secondaryLabel) && (
        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          {secondaryLabel && onSecondaryAction && (
            <Button variant="outline" className="w-full sm:w-auto" onClick={onSecondaryAction}>
              {secondaryLabel}
            </Button>
          )}
          {actionLabel && onAction && (
            <Button className="w-full sm:w-auto" onClick={onAction}>{actionLabel}</Button>
          )}
        </div>
      )}
    </div>
  );
}
