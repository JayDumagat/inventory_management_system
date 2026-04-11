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
          <label htmlFor={inputId} className="text-xs font-medium text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            "w-full border px-3 py-2 text-sm outline-none transition-colors",
            "bg-panel text-ink",
            "placeholder:text-muted",
            error
              ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500/30"
              : "border-stroke focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {helperText && !error && <p className="text-xs text-muted">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
