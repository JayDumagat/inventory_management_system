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
    const base = "inline-flex items-center justify-center ui-pill font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      primary: "bg-primary-600 text-white border border-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500/35",
      secondary: "bg-hover text-ink border border-stroke hover:bg-primary-50/60 focus-visible:ring-primary-500/25",
      danger: "bg-red-600 text-white border border-red-600 hover:bg-red-700 focus-visible:ring-red-500/25",
      ghost: "text-muted border border-transparent hover:bg-hover hover:text-ink focus-visible:ring-primary-500/25",
      outline: "border border-stroke bg-panel text-ink hover:bg-hover focus-visible:ring-primary-500/25",
    };
    const sizes = {
      sm: "text-xs px-[calc(var(--space-control-x)-0.1rem)] py-[calc(var(--space-control-y)-0.05rem)] gap-1.5 min-h-[2.25rem]",
      md: "text-sm px-[calc(var(--space-control-x)+0.25rem)] py-[var(--space-control-y)] gap-2 min-h-10",
      lg: "text-sm px-[calc(var(--space-control-x)+0.7rem)] py-[calc(var(--space-control-y)+0.2rem)] gap-2 min-h-11",
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
