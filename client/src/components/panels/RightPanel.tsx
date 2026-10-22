"use client";

import { motion } from "framer-motion";
import { Bell, Bookmark, Crown, MessageSquareText, Pin, Search, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { channelMembers, channelTitle, useStore, type RightPanel as Kind } from "@/lib/store";
import { searchMessages } from "@/lib/store/reducer";
import { topRole } from "@/lib/permissions";
import { renderMarkdown } from "@/lib/markdown";
import type { Message, Presence, User } from "@/lib/types";
import { cn, EMPTY, formatTime, relativeTime } from "@/lib/utils";
import { Avatar } from "../ui/Avatar";
import { MessageItem } from "../chat/MessageItem";
import { Composer } from "../chat/Composer";
import { TypingIndicator } from "../chat/ChatView";

const TITLES: Record<Exclude<Kind, null>, [string, React.ReactNode]> = {
  members: ["Members", <Users key="m" size={17} />],
  thread: ["Thread", <MessageSquareText key="t" size={17} />],
  pins: ["Pinned messages", <Pin key="p" size={17} />],
  search: ["Search", <Search key="s" size={17} />],
  saved: ["Saved messages", <Bookmark key="b" size={17} />],
  notifications: ["Notifications", <Bell key="n" size={17} />],
};

export function RightPanel() {
  const panel = useStore((s) => s.rightPanel);
  const setRightPanel = useStore((s) => s.setRightPanel);
  const channelId = useStore((s) => s.activeChannelId);
  const channel = useStore((s) => (channelId ? s.db.channels[channelId] : undefined));
  if (!panel) return null;
  if (panel === "members" && (!channel || channel.kind === "dm")) return null;
  const [title, icon] = TITLES[panel];
  return (
    <motion.aside
      key={panel}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className="fixed inset-0 z-40 flex flex-col bg-surface sm:static sm:z-auto sm:w-[340px] sm:shrink-0 sm:border-l sm:hairline sm:bg-surface/70 lg:w-[300px] xl:w-[340px] safe-top"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b hairline px-4">
        <span className="text-muted">{icon}</span>
        <h3 className="flex-1 font-semibold">{title}</h3>
        <button className="icon-btn" onClick={() => setRightPanel(null)} aria-label="Close panel"><X size={18} /></button>
      </div>
      <div className="min-h-0 flex-1">
        {panel === "members" && channel && <MemberList channelId={channel.id} />}
        {panel === "thread" && <ThreadPanel />}
        {panel === "pins" && channel && <PinsPanel channelId={channel.id} />}
        {panel === "search" && <SearchPanel />}
        {panel === "saved" && <SavedPanel />}
        {panel === "notifications" && <NotificationsPanel />}
      </div>
    </motion.aside>
  );
}

const GROUP_ORDER: Presence[] = ["online", "idle", "dnd", "offline"];

function MemberList({ channelId }: { channelId: string }) {
  const db = useStore((s) => s.db);
  const showProfile = useStore((s) => s.showProfile);
  const channel = db.channels[channelId];
  const server = channel?.serverId ? db.servers[channel.serverId] : undefined;
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const ids = channelMembers(db, channel);
    const users = ids.map((id) => db.users[id]).filter(Boolean).filter((u) => !q || u.displayName.toLowerCase().includes(q.toLowerCase()));
    const out: { label: string; color?: string; users: User[] }[] = [];
    // hoisted roles first (like Discord), then by presence
    const hoisted = server?.roles.filter((r) => r.hoist).sort((a, b) => b.position - a.position) ?? [];
    const used = new Set<string>();
    for (const r of hoisted) {
      const members = users.filter((u) => u.status !== "offline" && !used.has(u.id) && server!.memberRoles[u.id]?.includes(r.id));
      members.forEach((u) => used.add(u.id));
      if (members.length) out.push({ label: r.name, color: r.color, users: members });
    }
    for (const st of GROUP_ORDER) {
      const members = users.filter((u) => !used.has(u.id) && (st === "offline" ? u.status === "offline" : u.status !== "offline" && st === "online"));
      if (members.length) out.push({ label: st === "online" ? "Online" : "Offline", users: members.sort((a, b) => a.displayName.localeCompare(b.displayName)) });
      if (st === "online") break;
    }
    const offline = users.filter((u) => !used.has(u.id) && u.status === "offline");
    if (offline.length) out.push({ label: "Offline", users: offline.sort((a, b) => a.displayName.localeCompare(b.displayName)) });
    return out;
  }, [db, channel, server, q]);

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" className="input py-2" />
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{g.label} — {g.users.length}</p>
            {g.users.map((u) => {
              const role = topRole(server, u.id);
              return (
                <motion.button layout="position" key={u.id} onClick={() => showProfile(u.id)} className={cn("flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-fg/[0.06]", u.status === "offline" && "opacity-45")}>
                  <Avatar user={u} size={34} showStatus ring="ring-surface" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-sm font-medium" style={{ color: role && role.position > 1 ? role.color : undefined }}>{u.displayName}</span>
                      {server?.ownerId === u.id && <Crown size={12} className="shrink-0 text-warn" />}
                      {u.isBot && <span className="rounded bg-accent px-1 text-[8px] font-bold text-white">{u.id === "bot_nova" ? "AI" : "BOT"}</span>}
                    </div>
                    {u.customStatus && u.status !== "offline" && <p className="truncate text-[11px] text-muted">{u.customStatus}</p>}
                  </div>
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreadPanel() {
  const parentId = useStore((s) => s.threadParentId);
  const channelId = useStore((s) => s.activeChannelId);
  const db = useStore((s) => s.db);
  const channel = channelId ? db.channels[channelId] : undefined;
  if (!channel || !parentId) return <Empty text="Select a message to start a thread." />;
  const server = channel.serverId ? db.servers[channel.serverId] : undefined;
  const list = db.messages[channel.id] ?? [];
  const parent = list.find((m) => m.id === parentId);
  const replies = list.filter((m) => m.threadParentId === parentId);
  if (!parent) return <Empty text="Message not found." />;
  return (
    <div className="flex h-full flex-col">
      <div className="scroll-thin flex-1 overflow-y-auto pb-2">
        <div className="border-b hairline pb-3"><MessageItem message={parent} grouped={false} channel={channel} server={server} inThread /></div>
        <p className="px-6 py-2 text-xs font-semibold text-muted">{replies.length} {replies.length === 1 ? "reply" : "replies"}</p>
        {replies.map((m, i) => <MessageItem key={m.id} message={m} grouped={replies[i - 1]?.authorId === m.authorId} channel={channel} server={server} inThread />)}
      </div>
      <TypingIndicator channelId={channel.id} />
      <Composer channel={channel} server={server} threadParentId={parentId} compact />
    </div>
  );
}

function ResultCard({ m, highlight }: { m: Message; highlight?: string }) {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId);
  const jumpTo = useStore((s) => s.jumpTo);
  const author = db.users[m.authorId];
  const ch = db.channels[m.channelId];
  return (
    <button onClick={() => jumpTo(m.channelId, m.id)} className="w-full rounded-2xl border hairline bg-fg/[0.03] p-3 text-left transition hover:border-accent/40 hover:bg-fg/[0.05]">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <Avatar user={author} size={20} />
        <b className="text-fg">{author?.displayName}</b>
        <span className="truncate">in {ch?.serverId ? "#" : ""}{channelTitle(db, ch, meId)}</span>
        <span className="ml-auto shrink-0">{relativeTime(m.createdAt)}</span>
      </div>
      <p className="md line-clamp-3 text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content || (m.attachments?.length ? `📎 ${m.attachments[0].name}` : m.poll ? `📊 ${m.poll.question}` : m.kind), { users: db.users, highlight }) }} />
    </button>
  );
}

function PinsPanel({ channelId }: { channelId: string }) {
  const all = useStore((s) => s.db.messages[channelId]);
  const pins = useMemo(() => (all ?? []).filter((m) => m.pinned && !m.deletedAt), [all]);
  if (!pins.length) return <Empty icon="📌" text="No pinned messages yet. Pin important messages from the message menu." />;
  return <div className="scroll-thin h-full space-y-2 overflow-y-auto p-3">{[...pins].reverse().map((m) => <ResultCard key={m.id} m={m} />)}</div>;
}

function SearchPanel() {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const activeServerId = useStore((s) => s.activeServerId);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"here" | "all">("here");
  const [has, setHas] = useState<"" | "image" | "link" | "file">("");

  const channelIds = useMemo(() => {
    const visible = Object.values(db.channels).filter((c) => (c.memberIds ? c.memberIds.includes(meId) : c.serverId && db.servers[c.serverId]?.memberIds.includes(meId)));
    if (scope === "all") return visible.map((c) => c.id);
    return visible.filter((c) => (activeServerId === "home" ? !c.serverId : c.serverId === activeServerId)).map((c) => c.id);
  }, [db.channels, db.servers, meId, scope, activeServerId]);

  const fromMatch = /from:(\S+)/.exec(q);
  const author = fromMatch ? Object.values(db.users).find((u) => u.username.startsWith(fromMatch[1].toLowerCase()) || u.displayName.toLowerCase().startsWith(fromMatch[1].toLowerCase())) : undefined;
  const text = q.replace(/from:\S+/, "").trim();
  const results = q.trim() || has ? searchMessages(db, text, { channelIds, authorId: author?.id, has: has || undefined, limit: 60 }) : [];

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b hairline p-3">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages · try from:ava" className="input" />
        <div className="flex flex-wrap gap-1.5">
          {(["here", "all"] as const).map((s) => <button key={s} onClick={() => setScope(s)} className={cn("chip", scope === s && "bg-accent/20 text-fg")}>{s === "here" ? "This space" : "Everywhere"}</button>)}
          {(["image", "link", "file"] as const).map((h) => <button key={h} onClick={() => setHas(has === h ? "" : h)} className={cn("chip", has === h && "bg-accent2/20 text-fg")}>has:{h}</button>)}
        </div>
      </div>
      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-3">
        {(q || has) && <p className="px-1 text-xs text-muted">{results.length} result{results.length === 1 ? "" : "s"}{author ? ` from ${author.displayName}` : ""}</p>}
        {results.map((m) => <ResultCard key={m.id} m={m} highlight={text || undefined} />)}
        {!q && !has && <Empty icon="🔎" text="Search across messages, files and polls. Filter by author with from:name." />}
      </div>
    </div>
  );
}

function SavedPanel() {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const items = (db.saved[meId] ?? []).map((k) => {
    const [cid, mid] = k.split("::");
    return db.messages[cid]?.find((m) => m.id === mid);
  }).filter((m): m is Message => !!m && !m.deletedAt);
  if (!items.length) return <Empty icon="🔖" text="Nothing saved yet. Use “Save message” from any message menu to bookmark it here." />;
  return <div className="scroll-thin h-full space-y-2 overflow-y-auto p-3">{items.map((m) => <ResultCard key={m.id} m={m} />)}</div>;
}

function NotificationsPanel() {
  const items = useStore((s) => (s.sessionUserId ? s.db.notifications[s.sessionUserId] : undefined)) ?? EMPTY;
  const openChannel = useStore((s) => s.openChannel);
  if (!items.length) return <Empty icon="🔔" text="You're all caught up!" />;
  return (
    <div className="scroll-thin h-full space-y-1.5 overflow-y-auto p-3">
      {items.map((n) => (
        <motion.button layout key={n.id} onClick={() => n.channelId && openChannel(n.channelId)} className={cn("flex w-full items-start gap-3 rounded-2xl p-3 text-left transition hover:bg-fg/[0.05]", !n.read && "bg-accent/[0.07]")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fg/[0.07] text-base">{n.icon ?? "🔔"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{n.title}</p>
            <p className="line-clamp-2 text-xs text-muted">{n.body}</p>
          </div>
          <span className="shrink-0 text-[10px] text-muted">{formatTime(n.createdAt)}</span>
        </motion.button>
      ))}
    </div>
  );
}

function Empty({ text, icon = "💬" }: { text: string; icon?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="animate-float text-5xl">{icon}</span>
      <p className="max-w-[240px] text-sm text-muted">{text}</p>
    </div>
  );
}
