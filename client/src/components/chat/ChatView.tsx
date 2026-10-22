"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Bell, Hash, Lock, Megaphone, Menu, Phone, Pin, Search, Users, Video } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { channelTitle, dmPartner, useStore } from "@/lib/store";
import type { Channel, Message, Server } from "@/lib/types";
import { cn, EMPTY, formatDay, relativeTime, sameDay } from "@/lib/utils";
import { Avatar, STATUS_LABEL } from "../ui/Avatar";
import { MessageItem } from "./MessageItem";
import { Composer } from "./Composer";

export function ChatView({ channel }: { channel: Channel }) {
  const server = useStore((s) => (channel.serverId ? s.db.servers[channel.serverId] : undefined));
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <ChatHeader channel={channel} server={server} />
      <MessageList channel={channel} server={server} />
      <TypingIndicator channelId={channel.id} />
      <Composer channel={channel} server={server} />
    </div>
  );
}

function ChatHeader({ channel, server }: { channel: Channel; server?: Server }) {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId);
  const rightPanel = useStore((s) => s.rightPanel);
  const actions = useStore.getState();
  const notifications = useStore((s) => (s.sessionUserId ? s.db.notifications[s.sessionUserId] : undefined)) ?? EMPTY;
  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const partner = dmPartner(db, channel, meId);
  const title = channelTitle(db, channel, meId);
  const isDm = channel.kind === "dm" || channel.kind === "group-dm";

  const sub = partner
    ? partner.status === "offline" ? `Last seen ${relativeTime(partner.lastSeen)}` : partner.customStatus || STATUS_LABEL[partner.status]
    : channel.kind === "group-dm" ? `${channel.memberIds?.length} members` : channel.topic;

  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number, cls?: string) => (
    <button onClick={onClick} className={cn("icon-btn relative", active && "bg-fg/10 text-fg", cls)} aria-label={label} title={label}>
      {icon}
      {!!badge && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />}
    </button>
  );

  return (
    <header className="glass relative z-20 flex h-14 shrink-0 items-center gap-2 border-x-0 border-t-0 px-2 sm:px-4 safe-top">
      <button className="icon-btn lg:hidden" onClick={() => actions.setMobileNav(true)} aria-label="Open navigation">
        <Menu size={20} />
      </button>
      {partner ? (
        <button onClick={() => actions.showProfile(partner.id)} className="flex min-w-0 items-center gap-2.5">
          <Avatar user={partner} size={32} showStatus ring="ring-surface" />
          <div className="min-w-0 text-left">
            <p className="truncate font-semibold leading-tight">{title}</p>
            <AnimatePresence mode="wait">
              <motion.p key={sub} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} className="truncate text-xs text-muted">{sub}</motion.p>
            </AnimatePresence>
          </div>
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted">{channel.kind === "announcement" ? <Megaphone size={20} /> : channel.kind === "group-dm" ? <Users size={20} /> : <Hash size={20} />}</span>
          <p className="shrink-0 font-semibold">{title}</p>
          {sub && <p className="hidden truncate border-l hairline pl-3 text-sm text-muted md:block">{sub}</p>}
        </div>
      )}
      <div className="ml-auto flex items-center gap-0.5">
        {isDm && btn(false, () => actions.openModal("encryption", { channelId: channel.id }), <Lock size={17} className="text-ok" />, "End-to-end encryption")}
        {btn(false, () => actions.startCall(channel.id, "voice"), <Phone size={18} />, "Start voice call")}
        {btn(false, () => actions.startCall(channel.id, "video"), <Video size={19} />, "Start video call", 0, "hidden sm:inline-flex")}
        {btn(rightPanel === "pins", () => actions.setRightPanel("pins"), <Pin size={18} />, "Pinned messages")}
        {!isDm && btn(rightPanel === "members", () => actions.setRightPanel("members"), <Users size={18} />, "Member list", 0, "hidden sm:inline-flex")}
        {btn(rightPanel === "search", () => actions.setRightPanel("search"), <Search size={18} />, "Search")}
        {btn(rightPanel === "notifications", () => { actions.setRightPanel("notifications"); actions.markNotificationsRead(); }, <Bell size={18} />, "Notifications", unreadNotifs)}
      </div>
    </header>
  );
}

const PAGE = 60;

function MessageList({ channel, server }: { channel: Channel; server?: Server }) {
  const all = useStore((s) => s.db.messages[channel.id]);
  const meId = useStore((s) => s.sessionUserId)!;
  const jumpToId = useStore((s) => s.jumpToId);
  // only messages that were already waiting when the channel opened count as "new"
  const firstUnreadId = useRef<{ channel?: string; id?: string }>({});
  if (firstUnreadId.current.channel !== channel.id) {
    const s = useStore.getState().db;
    const last = useStore.getState().openedReadAt ?? 0;
    firstUnreadId.current = { channel: channel.id, id: last ? (s.messages[channel.id] ?? []).find((m) => !m.threadParentId && m.createdAt > last && m.authorId !== meId)?.id : undefined };
  }
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  // remember where "new messages" starts when the channel is opened
  useEffect(() => {
    setLimit(PAGE);
    atBottom.current = true;
  }, [channel.id, meId]);

  const messages = useMemo(() => (all ?? []).filter((m) => !m.threadParentId), [all]);
  const visible = messages.slice(-limit);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (atBottom.current) el.scrollTop = el.scrollHeight;
  }, [visible.length, channel.id]);

  // keep pinned to bottom while images/animations change height
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (atBottom.current) el.scrollTop = el.scrollHeight; });
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [visible.length]);

  useEffect(() => {
    if (!jumpToId) return;
    const idx = messages.findIndex((m) => m.id === jumpToId);
    if (idx >= 0 && messages.length - idx > limit) setLimit(messages.length - idx + 10);
    setTimeout(() => document.getElementById(`msg-${jumpToId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }, [jumpToId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scroller.current!;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    atBottom.current = near;
    setShowJump(!near);
    if (el.scrollTop < 60 && limit < messages.length) {
      const prev = el.scrollHeight;
      setLimit((l) => l + PAGE);
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prev; });
    }
  };

  const firstUnread = visible.find((m) => m.id === firstUnreadId.current.id);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="scroll-thin h-full overflow-y-auto overflow-x-hidden pb-2">
        <div>
          {limit >= messages.length && <ChannelWelcome channel={channel} server={server} />}
          {visible.map((m, i) => {
            const prev = visible[i - 1];
            const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
            const grouped = !!prev && !newDay && prev.authorId === m.authorId && m.createdAt - prev.createdAt < 5 * 60_000 && !m.replyToId && prev.kind !== "system" && m.kind !== "system" && m !== firstUnread;
            return (
              <div key={m.id}>
                {newDay && <DayDivider ts={m.createdAt} />}
                {m === firstUnread && (
                  <div className="relative my-2 flex items-center px-6">
                    <div className="h-px flex-1 bg-danger/60" />
                    <span className="ml-2 rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">New</span>
                  </div>
                )}
                <MessageItem message={m} grouped={grouped} channel={channel} server={server} />
              </div>
            );
          })}
        </div>
      </div>
      <AnimatePresence>
        {showJump && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => { const el = scroller.current!; el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }}
            className="glass absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-glass"
          >
            <ArrowDown size={15} /> Jump to present
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function DayDivider({ ts }: { ts: number }) {
  return (
    <div className="my-4 flex items-center gap-3 px-6">
      <div className="h-px flex-1 bg-fg/10" />
      <span className="text-[11px] font-semibold text-muted">{formatDay(ts)}</span>
      <div className="h-px flex-1 bg-fg/10" />
    </div>
  );
}

function ChannelWelcome({ channel, server }: { channel: Channel; server?: Server }) {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId);
  const partner = dmPartner(db, channel, meId);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="px-6 pb-4 pt-10">
      {partner ? (
        <>
          <Avatar user={partner} size={80} />
          <h2 className="mt-3 font-display text-3xl font-bold">{partner.displayName}</h2>
          <p className="text-muted">@{partner.username}</p>
          <p className="mt-3 max-w-lg text-sm text-muted">This is the beginning of your direct message history with <b className="text-fg">{partner.displayName}</b>. Messages are protected with simulated end-to-end encryption 🔒</p>
        </>
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-fg/10"><Hash size={34} /></div>
          <h2 className="mt-3 font-display text-3xl font-bold">Welcome to #{channel.name}!</h2>
          <p className="mt-1 text-muted">This is the start of the #{channel.name} channel{server ? ` in ${server.name}` : ""}. {channel.topic}</p>
        </>
      )}
    </motion.div>
  );
}

export function TypingIndicator({ channelId }: { channelId: string }) {
  const typing = useStore((s) => s.typing[channelId]);
  const users = useStore((s) => s.db.users);
  const meId = useStore((s) => s.sessionUserId);
  const ids = Object.keys(typing ?? {}).filter((u) => u !== meId);
  const names = ids.map((id) => users[id]?.displayName.split(" ")[0]).filter(Boolean);
  const label = names.length === 0 ? "" : names.length === 1 ? `${names[0]} is typing` : names.length === 2 ? `${names[0]} and ${names[1]} are typing` : names.length === 3 ? `${names.slice(0, 2).join(", ")} and ${names[2]} are typing` : "Several people are typing";
  return (
    <div className="h-6 px-5 sm:px-7">
      <AnimatePresence>
        {label && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="flex items-center gap-2 text-xs text-muted">
            <div className="flex -space-x-1.5">{ids.slice(0, 3).map((id) => <Avatar key={id} user={users[id]} size={16} />)}</div>
            <span className="flex items-center gap-0.5 rounded-full bg-fg/[0.07] px-2 py-1.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-fg/70" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </span>
            <span><b className="font-semibold text-fg/80">{label}</b>…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export type { Message };
