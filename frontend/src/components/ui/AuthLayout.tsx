import { Package, BarChart3, Shield, Zap, Layers } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

const DEFAULT_FEATURES = [
  { icon: BarChart3, text: "Real-time inventory tracking across all locations" },
  { icon: Zap, text: "Fast POS and automated order management" },
  { icon: Layers, text: "Multi-branch support with role-based access" },
  { icon: Shield, text: "Audit trails and enterprise-grade security" },
];

interface AuthBrandingProps {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}

export function AuthBranding({ title, subtitle, children }: AuthBrandingProps) {
  return (
    <div className="flex flex-col items-start w-full">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-white/20 flex items-center justify-center">
          <Package className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white">Inventra</span>
      </div>
      {title ? (
        <>
          <h2 className="text-2xl font-bold text-white mb-3 leading-snug">{title}</h2>
          {subtitle && (
            <p className="text-primary-100 text-sm mb-6 leading-relaxed">{subtitle}</p>
          )}
          {children}
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-white mb-3 leading-snug">
            Manage inventory with confidence
          </h2>
          <p className="text-primary-100 text-sm mb-8 leading-relaxed">
            A complete platform for modern businesses — track stock, manage orders,
            and grow with powerful analytics.
          </p>
          <ul className="space-y-4">
            {DEFAULT_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="w-7 h-7 bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm text-primary-100">{text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface AuthLayoutProps {
  children: ReactNode;
  leftContent?: ReactNode;
  /** Controls max-width of the form panel. Defaults to "sm". */
  formWidth?: "sm" | "md" | "lg";
}

/**
 * Split-screen auth layout.
 *
 * Desktop: branding on left, form on right.
 * Mobile: form on top, branding below.
 */
export function AuthLayout({ children, leftContent, formWidth = "sm" }: AuthLayoutProps) {
  const maxW = formWidth === "lg" ? "max-w-lg" : formWidth === "md" ? "max-w-md" : "max-w-sm";

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ── RIGHT: form panel ───────────────────────────────────────── */}
      {/* Appears first in DOM → top on mobile, right on desktop. */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-page overflow-y-auto">
        <div className={cn("w-full py-6 md:py-0", maxW)}>{children}</div>
      </div>

      {/* ── LEFT: branding panel ────────────────────────────────────── */}
      {/* md:order-first makes it appear LEFT on desktop despite being second in DOM. */}
      <div className="md:order-first w-full md:w-5/12 lg:w-1/2 bg-primary-600 flex items-center justify-center p-10 py-14 md:py-10 md:min-h-screen relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 -right-12 w-60 h-60 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative z-10 w-full max-w-xs">
          {leftContent ?? <AuthBranding />}
        </div>
      </div>
    </div>
  );
}
