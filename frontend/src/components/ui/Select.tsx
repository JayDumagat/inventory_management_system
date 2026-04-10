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
          <label htmlFor={selectId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
            "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
            error
              ? "border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-1 focus:ring-red-500"
              : "border-gray-200 dark:border-gray-700 focus:border-primary-500 dark:focus:border-primary-400 focus:ring-1 focus:ring-primary-500 dark:focus:ring-primary-400",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
