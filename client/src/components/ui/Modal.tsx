"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open, onClose, title, subtitle, children, className, wide, footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  wide?: boolean | "xl";
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              "glass relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl shadow-glass sm:rounded-3xl",
              wide === "xl" ? "sm:max-w-5xl" : wide ? "sm:max-w-3xl" : "sm:max-w-lg",
              className,
            )}
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
          >
            {(title || subtitle) && (
              <div className="flex items-start gap-3 border-b hairline px-6 py-4">
                <div className="min-w-0 flex-1">
                  {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
                  {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
                </div>
                <button className="icon-btn -mr-2" onClick={onClose} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t hairline bg-fg/[0.02] px-6 py-3 safe-bottom">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
