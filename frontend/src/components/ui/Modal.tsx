import { cn } from "../../lib/utils";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn("relative bg-panel border border-stroke w-full max-h-[90vh] flex flex-col", sizes[size])}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-stroke flex-shrink-0">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 text-muted hover:text-ink hover:bg-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
