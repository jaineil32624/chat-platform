"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Menu, MessageCircle, Search, UserPlus, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { Avatar, STATUS_LABEL } from "../ui/Avatar";

type Tab = "online" | "all" | "pending" | "blocked" | "add";

export function FriendsView() {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const actions = useStore.getState();
  const [tab, setTab] = useState<Tab>("online");
  const [q, setQ] = useState("");
  const rel = db.friends[meId] ?? {};

  const lists = useMemo(() => {
    const by = (st: string) => Object.entries(rel).filter(([, s]) => s === st).map(([id]) => db.users[id]).filter(Boolean) as User[];
    const friends = by("friends").sort((a, b) => a.displayName.localeCompare(b.displayName));
    return {
      online: friends.filter((f) => f.status !== "offline"),
      all: friends,
      pending: [...by("incoming").map((u) => ({ u, dir: "in" as const })), ...by("outgoing").map((u) => ({ u, dir: "out" as const }))],
      blocked: by("blocked"),
    };
  }, [db.users, rel]);

  const suggestions = useMemo(() => {
    const ql = q.toLowerCase();
    return Object.values(db.users)
      .filter((u) => u.id !== meId && !rel[u.id] && (!ql || u.displayName.toLowerCase().includes(ql) || u.username.includes(ql)))
      .sort((a, b) => (a.status === "offline" ? 1 : 0) - (b.status === "offline" ? 1 : 0))
      .slice(0, 24);
  }, [db.users, rel, q, meId]);

  const activity = useMemo(
    () => lists.online.filter((u) => u.customStatus).slice(0, 6),
    [lists.online],
  );

  const tabs: [Tab, string, number?][] = [
    ["online", "Online", lists.online.length],
    ["all", "All", lists.all.length],
    ["pending", "Pending", lists.pending.filter((p) => p.dir === "in").length],
    ["blocked", "Blocked"],
  ];

  const row = (u: User, right: React.ReactNode, sub?: string) => (
    <motion.div layout key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="group flex items-center gap-3 rounded-2xl border-t hairline px-3 py-2.5 transition hover:bg-fg/[0.04]">
      <button onClick={() => actions.showProfile(u.id)}><Avatar user={u} size={40} showStatus ring="ring-bg" /></button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{u.displayName} <span className="hidden text-sm font-normal text-muted group-hover:inline">@{u.username}</span></p>
        <p className="truncate text-xs text-muted">{sub ?? (u.status === "offline" ? `Last seen ${relativeTime(u.lastSeen)}` : u.customStatus || STATUS_LABEL[u.status])}</p>
      </div>
      <div className="flex gap-1.5">{right}</div>
    </motion.div>
  );

  const roundBtn = (onClick: () => void, icon: React.ReactNode, label: string, cls = "") => (
    <button onClick={onClick} aria-label={label} title={label} className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-fg/[0.07] text-muted transition hover:scale-105 hover:text-fg", cls)}>{icon}</button>
  );

  return (
    <div className="flex h-full min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-x-0 border-t-0 px-2 no-scrollbar sm:px-4 safe-top">
          <button className="icon-btn lg:hidden" onClick={() => actions.setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <Users size={20} className="shrink-0 text-muted" />
          <span className="mr-2 shrink-0 font-semibold">Friends</span>
          {tabs.map(([t, label, n]) => (
            <button key={t} onClick={() => setTab(t)} className={cn("shrink-0 rounded-lg px-3 py-1 text-sm font-medium transition", tab === t ? "bg-fg/10 text-fg" : "text-muted hover:bg-fg/5 hover:text-fg")}>
              {label}
              {t === "pending" && !!n && <span className="ml-1.5 rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{n}</span>}
            </button>
          ))}
          <button onClick={() => setTab("add")} className={cn("shrink-0 rounded-lg px-3 py-1 text-sm font-semibold transition", tab === "add" ? "bg-ok/20 text-ok" : "bg-ok text-white hover:brightness-110")}>Add Friend</button>
        </header>

        <div className="scroll-thin flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === "add" ? (
            <div>
              <h2 className="font-display text-xl font-bold">Add friends</h2>
              <p className="mt-1 text-sm text-muted">Search 50+ simulated users by name or username. Most will accept within seconds.</p>
              <label className="mt-4 flex items-center gap-2 rounded-2xl border hairline bg-bg/60 px-4 py-3 focus-within:border-accent/60">
                <Search size={16} className="text-muted" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="flex-1 bg-transparent outline-none" />
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {suggestions.map((u) => (
                  <motion.div layout key={u.id} className="flex items-center gap-3 rounded-2xl border hairline bg-fg/[0.03] p-3">
                    <button onClick={() => actions.showProfile(u.id)}><Avatar user={u} size={44} showStatus ring="ring-bg" /></button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{u.displayName}</p>
                      <p className="truncate text-xs text-muted">{u.bio}</p>
                    </div>
                    {roundBtn(() => actions.sendFriendRequest(u.id), <UserPlus size={16} />, "Send friend request", "hover:bg-ok hover:text-white")}
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                {tab === "pending" ? "Pending" : tab === "blocked" ? "Blocked" : tab === "online" ? "Online" : "All friends"} — {tab === "pending" ? lists.pending.length : lists[tab].length}
              </p>
              <AnimatePresence initial={false}>
                {tab === "pending" &&
                  lists.pending.map(({ u, dir }) =>
                    row(u, dir === "in" ? (
                      <>
                        {roundBtn(() => actions.respondFriend(u.id, true), <Check size={17} />, "Accept", "hover:bg-ok hover:text-white")}
                        {roundBtn(() => actions.respondFriend(u.id, false), <X size={17} />, "Decline", "hover:bg-danger hover:text-white")}
                      </>
                    ) : roundBtn(() => actions.removeFriend(u.id), <X size={17} />, "Cancel request"), dir === "in" ? "Incoming friend request" : "Outgoing friend request"),
                  )}
                {(tab === "online" || tab === "all") &&
                  lists[tab].map((u) => row(u, (
                    <>
                      {roundBtn(() => actions.openDm(u.id), <MessageCircle size={17} />, "Message")}
                      {roundBtn(() => actions.removeFriend(u.id), <X size={17} />, "Remove friend", "hover:bg-danger hover:text-white")}
                    </>
                  )))}
                {tab === "blocked" && lists.blocked.map((u) => row(u, roundBtn(() => actions.removeFriend(u.id), <X size={17} />, "Unblock")))}
              </AnimatePresence>
              {((tab === "pending" && !lists.pending.length) || (tab !== "pending" && !lists[tab].length)) && (
                <div className="flex flex-col items-center py-16 text-center text-muted">
                  <span className="animate-float text-6xl">🫂</span>
                  <p className="mt-4">{tab === "online" ? "No friends online right now." : tab === "pending" ? "No pending requests." : tab === "blocked" ? "You haven't blocked anyone." : "No friends yet — let's add some!"}</p>
                  {tab !== "blocked" && <button className="btn-primary mt-4" onClick={() => setTab("add")}><UserPlus size={16} /> Find people</button>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <aside className="hidden w-[320px] shrink-0 border-l hairline p-5 xl:block">
        <h3 className="font-display text-lg font-bold">Active now</h3>
        {activity.length ? (
          <div className="mt-3 space-y-2">
            {activity.map((u) => (
              <button key={u.id} onClick={() => actions.openDm(u.id)} className="flex w-full items-center gap-3 rounded-2xl border hairline bg-fg/[0.03] p-3 text-left transition hover:border-accent/30">
                <Avatar user={u} size={36} showStatus ring="ring-bg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{u.displayName}</p>
                  <p className="truncate text-xs text-muted">{u.customStatus}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">It&apos;s quiet for now… when friends start an activity, it&apos;ll show up here.</p>
        )}
      </aside>
    </div>
  );
}
