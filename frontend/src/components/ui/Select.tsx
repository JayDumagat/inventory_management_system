import type { SelectHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-muted">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "w-full border px-3 py-2 text-sm outline-none transition-colors",
            "bg-panel text-ink",
            error
              ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
              : "border-stroke focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
