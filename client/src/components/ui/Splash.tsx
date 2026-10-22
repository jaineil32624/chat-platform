"use client";

import { motion } from "framer-motion";
import { Logo } from "./Logo";

export function Splash({ label = "Connecting to Pulse…" }: { label?: string }) {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-5 bg-bg">
      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}>
        <Logo size={72} />
      </motion.div>
      <p className="text-sm text-muted">{label}</p>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-fg/10">
        <div className="relative h-full w-1/2 -translate-x-full animate-shimmer rounded-full bg-gradient-to-r from-accent to-accent2" />
      </div>
    </div>
  );
}
