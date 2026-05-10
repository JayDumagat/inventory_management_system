import { cn } from "../../lib/utils";
import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-xl font-medium shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      primary: "bg-primary-600 text-white hover:bg-primary-700 motion-safe:hover:-translate-y-px",
      secondary: "bg-hover text-ink hover:bg-primary-100/60",
      danger: "bg-red-600 text-white hover:bg-red-700 motion-safe:hover:-translate-y-px",
      ghost: "text-muted shadow-none hover:bg-hover hover:text-ink",
      outline: "border border-stroke bg-panel text-ink hover:bg-hover",
    };
    const sizes = {
      sm: "text-xs px-3 py-2 gap-1.5 min-h-9",
      md: "text-sm px-4 py-2.5 gap-2 min-h-10",
      lg: "text-sm px-5 py-3 gap-2 min-h-11",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
