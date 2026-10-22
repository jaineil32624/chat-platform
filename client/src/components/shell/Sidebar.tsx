"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark, ChevronDown, Compass, Hash, Lock, LogOut, Megaphone, Plus, Search, Settings, UserPlus, Users, Volume2, X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { channelTitle, dmPartner, useStore } from "@/lib/store";
import { unreadCount } from "@/lib/store/reducer";
import { can, Perm } from "@/lib/permissions";
import type { Channel } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { Avatar } from "../ui/Avatar";
import { UserPanel } from "./UserPanel";

export function Sidebar() {
  const active = useStore((s) => s.activeServerId);
  return (
    <aside className="flex h-full w-full flex-col bg-surface/80 sm:w-[260px] safe-top">
      {active === "home" ? <HomeSidebar /> : <ServerSidebar serverId={active} />}
      <UserPanel />
    </aside>
  );
}

function HomeSidebar() {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const homeView = useStore((s) => s.homeView);
  const activeChannelId = useStore((s) => s.activeChannelId);
  const setHomeView = useStore((s) => s.setHomeView);
  const openChannel = useStore((s) => s.openChannel);
  const openModal = useStore((s) => s.openModal);
  const setRightPanel = useStore((s) => s.setRightPanel);
  const typing = useStore((s) => s.typing);
  const [filter, setFilter] = useState("");

  const dms = useMemo(() => {
    return Object.values(db.channels)
      .filter((c) => (c.kind === "dm" || c.kind === "group-dm") && c.memberIds?.includes(meId))
      .map((c) => {
        const list = db.messages[c.id] ?? [];
        return { c, last: list[list.length - 1], unread: unreadCount(db, meId, c.id) };
      })
      .filter(({ c }) => !filter || channelTitle(db, c, meId).toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => (b.last?.createdAt ?? b.c.createdAt) - (a.last?.createdAt ?? a.c.createdAt));
  }, [db, meId, filter]);

  const pending = Object.values(db.friends[meId] ?? {}).filter((s) => s === "incoming").length;

  const navItem = (key: "friends" | "discover", icon: React.ReactNode, label: string, badge?: number) => (
    <button
      onClick={() => setHomeView(key)}
      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", homeView === key && !activeChannelId ? "bg-fg/10 text-fg" : "text-muted hover:bg-fg/5 hover:text-fg")}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {!!badge && <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white">{badge}</span>}
    </button>
  );

  return (
    <>
      <div className="border-b hairline p-3">
        <label className="flex items-center gap-2 rounded-xl bg-bg/70 px-3 py-2 text-sm text-muted">
          <Search size={15} />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a conversation" className="w-full bg-transparent outline-none placeholder:text-muted/70" />
        </label>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-2">
        {navItem("friends", <Users size={18} />, "Friends", pending)}
        {navItem("discover", <Compass size={18} />, "Discover")}
        <button onClick={() => setRightPanel("saved")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-fg/5 hover:text-fg">
          <Bookmark size={18} /> <span>Saved messages</span>
        </button>
        <div className="mt-4 flex items-center justify-between px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          Direct messages
          <button className="rounded p-0.5 hover:bg-fg/10 hover:text-fg" onClick={() => openModal("newDm")} aria-label="New message">
            <Plus size={15} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {dms.map(({ c, last, unread }) => {
            const partner = dmPartner(db, c, meId);
            const isTyping = Object.keys(typing[c.id] ?? {}).some((u) => u !== meId);
            const activeNow = activeChannelId === c.id;
            const preview = isTyping ? "typing…" : last ? (last.deletedAt ? "Message deleted" : last.kind === "gif" ? "GIF" : last.kind === "voice" ? "🎙️ Voice message" : last.attachments?.length ? "📎 Attachment" : last.kind === "poll" ? `📊 ${last.poll?.question}` : last.content.replace(/[*_`#>|~]/g, "")) : "Say hi 👋";
            return (
              <motion.button
                layout
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => openChannel(c.id)}
                className={cn("group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition", activeNow ? "bg-fg/10" : "hover:bg-fg/5")}
              >
                {partner ? (
                  <Avatar user={partner} size={38} showStatus ring={activeNow ? "ring-elevated" : "ring-surface"} />
                ) : (
                  <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-white">
                    <Users size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className={cn("truncate text-sm", unread ? "font-bold text-fg" : "font-medium text-fg/90")}>{channelTitle(db, c, meId)}</span>
                    {partner?.isBot && partner.id === "bot_nova" && <span className="rounded bg-accent px-1 text-[9px] font-bold text-white">AI</span>}
                    {last && <span className="ml-auto shrink-0 text-[10px] text-muted">{relativeTime(last.createdAt)}</span>}
                  </div>
                  <p className={cn("truncate text-xs", isTyping ? "text-accent" : unread ? "text-fg/80" : "text-muted")}>{preview}</p>
                </div>
                {!!unread && <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold leading-[18px] text-white">{unread}</span>}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}

function ServerSidebar({ serverId }: { serverId: string }) {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const activeChannelId = useStore((s) => s.activeChannelId);
  const openChannel = useStore((s) => s.openChannel);
  const openModal = useStore((s) => s.openModal);
  const leaveServer = useStore((s) => s.leaveServer);
  const call = useStore((s) => s.call);
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const server = db.servers[serverId];
  if (!server) return <div className="flex-1" />;
  const canManage = can(server, meId, Perm.MANAGE_CHANNELS);

  const byCat = server.categories.map((cat) => ({
    cat,
    channels: server.channelIds.map((id) => db.channels[id]).filter((c): c is Channel => !!c && c.categoryId === cat.id),
  }));

  const icon = (c: Channel) => (c.kind === "voice" ? <Volume2 size={17} /> : c.kind === "announcement" ? <Megaphone size={17} /> : <Hash size={17} />);

  return (
    <>
      <div className="relative">
        <div className="h-24 w-full" style={{ background: `linear-gradient(135deg, ${server.color}, rgb(var(--accent2) / 0.6))` }}>
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
        </div>
        <button onClick={() => setMenu((m) => !m)} className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-xl bg-black/35 px-3 py-2 text-left text-white backdrop-blur-md transition hover:bg-black/45">
          <span className="text-lg">{server.icon}</span>
          <span className="flex-1 truncate font-display font-bold">{server.name}</span>
          <motion.span animate={{ rotate: menu ? 180 : 0 }}>{menu ? <X size={16} /> : <ChevronDown size={16} />}</motion.span>
        </button>
        <AnimatePresence>
          {menu && (
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="glass absolute inset-x-2 top-full z-30 mt-1 rounded-2xl p-1.5 shadow-glass">
              {[
                { icon: <UserPlus size={16} />, label: "Invite people", onClick: () => openModal("invite", { serverId }), cls: "text-accent" },
                ...(canManage ? [
                  { icon: <Settings size={16} />, label: "Server settings", onClick: () => openModal("serverSettings", { serverId }), cls: "" },
                  { icon: <Plus size={16} />, label: "Create channel", onClick: () => openModal("createChannel", { serverId }), cls: "" },
                ] : []),
                ...(server.ownerId !== meId ? [{ icon: <LogOut size={16} />, label: "Leave server", onClick: () => leaveServer(serverId), cls: "text-danger" }] : []),
              ].map((i) => (
                <button key={i.label} onClick={() => { i.onClick(); setMenu(false); }} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium hover:bg-fg/10", i.cls)}>
                  {i.icon} {i.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-3 pt-2">
        {byCat.map(({ cat, channels }) => (
          <div key={cat.id} className="mt-3">
            <button onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))} className="group flex w-full items-center gap-1 px-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted hover:text-fg">
              <motion.span animate={{ rotate: collapsed[cat.id] ? -90 : 0 }}><ChevronDown size={12} /></motion.span>
              <span className="flex-1 text-left">{cat.name}</span>
              {canManage && <Plus size={14} className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); openModal("createChannel", { serverId, categoryId: cat.id }); }} />}
            </button>
            {channels.map((c) => {
              const unread = unreadCount(db, meId, c.id);
              const activeNow = activeChannelId === c.id;
              if (collapsed[cat.id] && !activeNow && !unread) return null;
              const inCall = call?.channelId === c.id;
              return (
                <div key={c.id}>
                  <button
                    onClick={() => openChannel(c.id)}
                    className={cn(
                      "group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[15px] transition",
                      activeNow || inCall ? "bg-fg/10 text-fg" : unread ? "font-semibold text-fg hover:bg-fg/5" : "text-muted hover:bg-fg/5 hover:text-fg",
                    )}
                  >
                    {!!unread && !activeNow && <span className="absolute -left-2 h-2 w-1 rounded-r bg-fg" />}
                    <span className="opacity-70">{icon(c)}</span>
                    <span className="flex-1 truncate text-left">{c.name}</span>
                    {c.kind === "announcement" && <Lock size={12} className="opacity-50" />}
                    {!!unread && !activeNow && <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold leading-[17px] text-white">{unread > 50 ? "50+" : unread}</span>}
                  </button>
                  {c.kind === "voice" && inCall && call && (
                    <div className="mb-1 ml-8 space-y-1">
                      {call.participants.map((p) => (
                        <div key={p} className="flex items-center gap-2 text-xs text-muted">
                          <Avatar user={db.users[p]} size={20} speaking={call.speakingId === p} />
                          <span className="truncate">{db.users[p]?.displayName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
