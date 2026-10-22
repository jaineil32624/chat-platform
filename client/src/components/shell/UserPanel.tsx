"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Headphones, HeadphoneOff, Mic, MicOff, Settings } from "lucide-react";
import { useState } from "react";
import { useMe, useStore } from "@/lib/store";
import { levelProgress } from "@/lib/gamification";
import type { Presence } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, STATUS_LABEL, StatusDot } from "../ui/Avatar";

export function UserPanel() {
  const me = useMe();
  const setPresence = useStore((s) => s.setPresence);
  const openModal = useStore((s) => s.openModal);
  const showProfile = useStore((s) => s.showProfile);
  const call = useStore((s) => s.call);
  const updateCall = useStore((s) => s.updateCall);
  const streak = useStore((s) => (s.sessionUserId ? s.db.stats[s.sessionUserId]?.streak ?? 0 : 0));
  const [open, setOpen] = useState(false);
  if (!me) return null;
  const lp = levelProgress(me.xp);
  const muted = call?.muted ?? false;
  const deaf = call?.deafened ?? false;

  return (
    <div className="relative border-t hairline bg-bg/60 p-2 safe-bottom">
      <div className="mb-1.5 px-1">
        <div className="flex items-center justify-between text-[10px] font-semibold text-muted">
          <span>LVL {lp.level}</span>
          {streak > 0 && <span title="Daily streak">🔥 {streak}</span>}
          <span>{lp.current}/{lp.needed} XP</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/10">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2" initial={false} animate={{ width: `${Math.max(3, lp.pct * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl p-1 text-left hover:bg-fg/[0.06]">
          <Avatar user={me} size={34} showStatus ring="ring-bg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{me.displayName}</p>
            <p className="truncate text-[11px] text-muted">{me.customStatus || STATUS_LABEL[me.status]}</p>
          </div>
        </button>
        <button className={cn("icon-btn h-8 w-8", muted && "text-danger")} onClick={() => updateCall({ muted: !muted })} aria-label="Toggle mute">
          {muted ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
        <button className={cn("icon-btn h-8 w-8", deaf && "text-danger")} onClick={() => updateCall({ deafened: !deaf })} aria-label="Toggle deafen">
          {deaf ? <HeadphoneOff size={17} /> : <Headphones size={17} />}
        </button>
        <button className="icon-btn h-8 w-8 hover:rotate-45" onClick={() => openModal("settings")} aria-label="Settings">
          <Settings size={17} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="glass absolute bottom-full left-2 right-2 z-40 mb-2 rounded-2xl p-1.5 shadow-glass">
            {(["online", "idle", "dnd", "offline"] as Presence[]).map((p) => (
              <button key={p} onClick={() => { setPresence(p); setOpen(false); }} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-fg/10", me.status === p && "bg-fg/5")}>
                <StatusDot status={p} className="h-2.5 w-2.5" ring="ring-transparent" />
                {p === "offline" ? "Invisible" : STATUS_LABEL[p]}
              </button>
            ))}
            <div className="my-1 h-px bg-fg/10" />
            <button onClick={() => { showProfile(me.id); setOpen(false); }} className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-fg/10">View profile</button>
            <button onClick={() => { openModal("achievements"); setOpen(false); }} className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-fg/10">Achievements & badges</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
