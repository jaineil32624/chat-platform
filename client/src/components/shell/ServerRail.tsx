"use client";

import { motion } from "framer-motion";
import { Compass, MessageCircle, Plus, Shield } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useIsAdmin, useStore } from "@/lib/store";
import { unreadCount } from "@/lib/store/reducer";
import { cn } from "@/lib/utils";

function RailItem({ active, unread, label, onClick, children, color }: { active?: boolean; unread?: number; label: string; onClick?: () => void; children: React.ReactNode; color?: string }) {
  return (
    <div className="group relative flex w-full justify-center">
      <motion.span
        className="absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-fg"
        animate={{ height: active ? 36 : unread ? 8 : 0, opacity: active || unread ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
      <button
        onClick={onClick}
        aria-label={label}
        className={cn(
          "relative flex h-12 w-12 items-center justify-center overflow-hidden text-xl transition-all duration-300",
          active ? "rounded-2xl shadow-glow" : "rounded-[24px] bg-fg/[0.06] hover:rounded-2xl hover:bg-fg/10",
        )}
        style={active && color ? { background: color } : undefined}
      >
        {children}
      </button>
      {!!unread && (
        <span className="absolute -bottom-0.5 right-2.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-4 ring-bg animate-pop-in">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-elevated px-3 py-1.5 text-sm font-semibold shadow-glass group-hover:block">
        {label}
      </span>
    </div>
  );
}

export function ServerRail() {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId);
  const active = useStore((s) => s.activeServerId);
  const homeView = useStore((s) => s.homeView);
  const openServer = useStore((s) => s.openServer);
  const setHomeView = useStore((s) => s.setHomeView);
  const openModal = useStore((s) => s.openModal);
  const isAdmin = useIsAdmin();

  const servers = useMemo(() => Object.values(db.servers).filter((s) => meId && s.memberIds.includes(meId)).sort((a, b) => a.createdAt - b.createdAt), [db.servers, meId]);

  const dmUnread = useMemo(() => {
    if (!meId) return 0;
    return Object.values(db.channels)
      .filter((c) => (c.kind === "dm" || c.kind === "group-dm") && c.memberIds?.includes(meId))
      .reduce((n, c) => n + unreadCount(db, meId, c.id), 0);
  }, [db, meId]);

  return (
    <nav className="no-scrollbar flex h-full w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-bg py-3 safe-top">
      <RailItem label="Direct Messages" active={active === "home" && homeView !== "discover"} unread={dmUnread} onClick={() => setHomeView("friends")} color="linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent2)))">
        <MessageCircle size={22} className={active === "home" && homeView !== "discover" ? "text-white" : "text-fg"} />
      </RailItem>
      <div className="mx-auto h-0.5 w-8 rounded bg-fg/10" />
      {servers.map((s) => {
        const unread = meId ? s.channelIds.reduce((n, c) => n + Math.min(unreadCount(db, meId, c), 1), 0) : 0;
        return (
          <RailItem key={s.id} label={s.name} active={active === s.id} unread={active === s.id ? 0 : unread} onClick={() => openServer(s.id)} color={s.color}>
            <span className={cn("transition-transform group-hover:scale-110")}>{s.icon}</span>
          </RailItem>
        );
      })}
      <RailItem label="Create a server" onClick={() => openModal("createServer")}>
        <Plus size={22} className="text-ok" />
      </RailItem>
      <RailItem label="Discover communities" active={active === "home" && homeView === "discover"} onClick={() => setHomeView("discover")} color="rgb(var(--ok))">
        <Compass size={22} className={homeView === "discover" && active === "home" ? "text-white" : "text-ok"} />
      </RailItem>
      {isAdmin && (
        <Link href="/admin/" className="contents">
          <RailItem label="Admin dashboard">
            <Shield size={20} className="text-warn" />
          </RailItem>
        </Link>
      )}
    </nav>
  );
}
