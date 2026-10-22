"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  default: "from-fg/10 to-fg/5",
  success: "from-ok/30 to-ok/5",
  warn: "from-warn/30 to-warn/5",
  danger: "from-danger/30 to-danger/5",
  level: "from-accent/40 to-accent2/20",
};

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  const openChannel = useStore((s) => s.openChannel);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 safe-top sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            layout
            key={t.id}
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ type: "spring", damping: 24, stiffness: 340 }}
            onClick={() => {
              if (t.channelId) openChannel(t.channelId);
              dismiss(t.id);
            }}
            className={cn("glass pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl p-3.5 text-left shadow-glass")}
          >
            <div className={cn("absolute inset-0 -z-10 bg-gradient-to-br opacity-80", TONE[t.tone ?? "default"])} />
            {t.icon && (
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fg/10 text-lg", t.tone === "level" && "animate-pop-in")}>{t.icon}</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.body}</p>}
            </div>
            {t.tone === "level" && <span className="absolute -right-2 -top-2 text-4xl opacity-20">✨</span>}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
