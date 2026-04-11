import { cn } from "../../lib/utils";
import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  type?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, type, error, helperText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            "w-full rounded border px-3 py-2 text-sm outline-none transition-colors",
            "bg-white dark:bg-gray-900 text-gray-900 dark:text-white",
            "placeholder:text-gray-400 dark:placeholder:text-gray-500",
            error
              ? "border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
              : "border-gray-200 dark:border-gray-700 focus:border-primary-500 dark:focus:border-primary-400 focus:ring-1 focus:ring-primary-500/20 dark:focus:ring-primary-400/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="text-xs text-gray-400 dark:text-gray-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
