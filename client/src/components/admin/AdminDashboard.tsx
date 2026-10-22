"use client";

import { motion } from "framer-motion";
import { Activity, ArrowLeft, Ban, Flag, MessageSquare, Search, Server as ServerIcon, ShieldCheck, Users, VolumeX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { channelTitle, useStore } from "@/lib/store";
import { isMuted } from "@/lib/store/reducer";
import { levelFromXp } from "@/lib/gamification";
import type { Message } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { Avatar, STATUS_LABEL } from "../ui/Avatar";
import { Logo } from "../ui/Logo";

const STOP = new Set("the a an and or but to of in on at for is it i you me my we our be are was were this that with so just like lol im it's i'm do does did have has not no yes what how who why when can will would should get got your they them he she his her its there here all".split(" "));

export function AdminDashboard() {
  const db = useStore((s) => s.db);
  const actions = useStore.getState();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"overview" | "users" | "moderation">("overview");

  const allMessages = useMemo(() => Object.values(db.messages).flat().filter((m) => !m.deletedAt), [db.messages]);
  const now = Date.now();
  const users = Object.values(db.users);
  const online = users.filter((u) => u.status !== "offline").length;
  const today = allMessages.filter((m) => now - m.createdAt < 86_400_000).length;

  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({ hour: `${new Date(now - (23 - i) * 3_600_000).getHours()}:00`, messages: 0, humans: 0 }));
    for (const m of allMessages) {
      const h = Math.floor((now - m.createdAt) / 3_600_000);
      if (h < 24) {
        buckets[23 - h].messages++;
        if (!db.users[m.authorId]?.isBot) buckets[23 - h].humans++;
      }
    }
    return buckets;
  }, [allMessages, db.users, now]);

  const perServer = useMemo(() => Object.values(db.servers).map((s) => ({
    name: s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name,
    messages: s.channelIds.reduce((n, c) => n + (db.messages[c]?.length ?? 0), 0),
    color: s.color,
  })).sort((a, b) => b.messages - a.messages).slice(0, 8), [db.servers, db.messages]);

  const presence = (["online", "idle", "dnd", "offline"] as const).map((st) => ({ name: STATUS_LABEL[st], value: users.filter((u) => u.status === st).length, color: { online: "#34d399", idle: "#fbbf24", dnd: "#f43f5e", offline: "#64748b" }[st] }));

  const insights = useMemo(() => {
    const words = new Map<string, number>();
    const emojis = new Map<string, number>();
    let len = 0;
    for (const m of allMessages) {
      len += m.content.length;
      for (const w of m.content.toLowerCase().match(/[a-z']{3,}/g) ?? []) if (!STOP.has(w)) words.set(w, (words.get(w) ?? 0) + 1);
      for (const e of m.content.match(/\p{Extended_Pictographic}/gu) ?? []) emojis.set(e, (emojis.get(e) ?? 0) + 1);
      for (const [e, us] of Object.entries(m.reactions ?? {})) emojis.set(e, (emojis.get(e) ?? 0) + us.length);
    }
    const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    const authors = new Map<string, number>();
    allMessages.forEach((m) => authors.set(m.authorId, (authors.get(m.authorId) ?? 0) + 1));
    return { words: top(words, 14), emojis: top(emojis, 10), avg: allMessages.length ? Math.round(len / allMessages.length) : 0, authors: top(authors, 6) };
  }, [allMessages]);

  const feed = useMemo(() => [...allMessages].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12), [allMessages]);
  const filteredUsers = users.filter((u) => !q || `${u.displayName} ${u.username}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(a.isBot) - Number(b.isBot) || b.xp - a.xp);
  const openReports = db.reports.filter((r) => !r.resolved);

  const stat = (icon: React.ReactNode, label: string, value: number | string, sub: string, cls: string) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border hairline bg-surface/80 p-5 shadow-glass">
      <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-2xl", cls)}>{icon}</div>
      <p className="font-display text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted">{sub}</p>
    </motion.div>
  );

  const findMsg = (key: string): Message | undefined => {
    const [cid, mid] = key.split("::");
    return db.messages[cid]?.find((m) => m.id === mid);
  };

  return (
    <div className="min-h-[100dvh] bg-bg">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_400px_at_0%_0%,rgb(var(--accent)/0.15),transparent)]" />
      <header className="glass sticky top-0 z-20 flex items-center gap-3 border-x-0 border-t-0 px-4 py-3 sm:px-8 safe-top">
        <Link href="/app/" className="icon-btn" aria-label="Back to app"><ArrowLeft size={18} /></Link>
        <Logo size={30} />
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold leading-tight">Admin Dashboard</h1>
          <p className="text-xs text-muted">Live platform analytics & moderation</p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-ok/15 px-3 py-1 text-xs font-semibold text-ok sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-ok" /> Live</span>
      </header>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <div className="no-scrollbar mb-6 flex gap-1 overflow-x-auto">
          {(["overview", "users", "moderation"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("shrink-0 rounded-xl px-4 py-2 text-sm font-semibold capitalize", tab === t ? "bg-fg text-bg" : "text-muted hover:bg-fg/5")}>
              {t}{t === "moderation" && openReports.length > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 text-[10px] text-white">{openReports.length}</span>}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {stat(<Users size={20} />, "Total users", users.length, `${users.filter((u) => !u.isBot).length} human · ${users.filter((u) => u.isBot).length} simulated`, "bg-accent/20 text-accent")}
              {stat(<Activity size={20} />, "Online now", online, `${Math.round((online / Math.max(1, users.length)) * 100)}% of all users`, "bg-ok/20 text-ok")}
              {stat(<MessageSquare size={20} />, "Messages (24h)", today, `${allMessages.length} total · avg ${insights.avg} chars`, "bg-accent2/20 text-accent2")}
              {stat(<ServerIcon size={20} />, "Servers", Object.keys(db.servers).length, `${Object.keys(db.channels).length} channels`, "bg-warn/20 text-warn")}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Message volume · last 24h" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={hourly}>
                    <defs>
                      <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--accent))" stopOpacity={0.6} /><stop offset="1" stopColor="rgb(var(--accent))" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--accent2))" stopOpacity={0.6} /><stop offset="1" stopColor="rgb(var(--accent2))" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgb(var(--line) / 0.07)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} interval={3} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip contentStyle={{ background: "rgb(var(--elevated))", border: "none", borderRadius: 12, color: "rgb(var(--fg))" }} />
                    <Area type="monotone" dataKey="messages" name="All messages" stroke="rgb(var(--accent))" strokeWidth={2.5} fill="url(#ga)" />
                    <Area type="monotone" dataKey="humans" name="Human messages" stroke="rgb(var(--accent2))" strokeWidth={2} fill="url(#gb)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Presence">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={presence} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                      {presence.map((p) => <Cell key={p.name} fill={p.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "rgb(var(--elevated))", border: "none", borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-1.5 text-xs">{presence.map((p) => <span key={p.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.name} · {p.value}</span>)}</div>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Activity by server">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={perServer} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{ fill: "rgb(var(--muted))", fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgb(var(--fg) / 0.04)" }} contentStyle={{ background: "rgb(var(--elevated))", border: "none", borderRadius: 12 }} />
                    <Bar dataKey="messages" radius={[0, 8, 8, 0]}>{perServer.map((p) => <Cell key={p.name} fill={p.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Message insights">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Trending words</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {insights.words.map(([w, n], i) => <span key={w} className="rounded-full bg-accent/15 px-2.5 py-1 text-xs" style={{ fontSize: `${Math.max(11, 16 - i * 0.4)}px` }}>{w} <b className="text-muted">{n}</b></span>)}
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">Top emoji</p>
                <div className="mt-2 flex flex-wrap gap-2">{insights.emojis.map(([e, n]) => <span key={e} className="flex items-center gap-1 rounded-xl bg-fg/[0.05] px-2 py-1 text-lg">{e}<span className="text-xs text-muted">{n}</span></span>)}</div>
              </Card>
              <Card title="Live activity">
                <div className="space-y-2.5">
                  {feed.map((m) => (
                    <div key={m.id} className="flex items-start gap-2.5 text-sm">
                      <Avatar user={db.users[m.authorId]} size={26} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate"><b>{db.users[m.authorId]?.displayName}</b> <span className="text-muted">in {db.channels[m.channelId]?.serverId ? `#${channelTitle(db, db.channels[m.channelId], undefined)}` : "a private chat"}</span></p>
                        <p className="truncate text-xs text-muted">{m.content.replace(/[*_`#>|~]/g, "") || m.kind}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted">{relativeTime(m.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card title="Most active members">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {insights.authors.map(([id, n], i) => (
                  <div key={id} className="flex flex-col items-center rounded-2xl bg-fg/[0.03] p-3 text-center">
                    <span className="text-xs font-bold text-muted">#{i + 1}</span>
                    <Avatar user={db.users[id]} size={44} className="my-2" />
                    <p className="w-full truncate text-sm font-semibold">{db.users[id]?.displayName}</p>
                    <p className="text-xs text-muted">{n} messages</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "users" && (
          <Card title={`Users · ${users.length}`}>
            <label className="mb-3 flex items-center gap-2 rounded-xl bg-bg/70 px-3 py-2"><Search size={15} className="text-muted" /><input className="flex-1 bg-transparent text-sm outline-none" placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted"><tr><th className="py-2">User</th><th>Status</th><th>Level</th><th>Rep</th><th>Joined</th><th>State</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {filteredUsers.slice(0, 80).map((u) => {
                    const banned = !!db.bans[u.id];
                    const muted = isMuted(db, u.id);
                    return (
                      <tr key={u.id} className="border-t hairline">
                        <td className="py-2"><div className="flex items-center gap-2.5"><Avatar user={u} size={30} showStatus ring="ring-surface" /><div><p className="font-medium">{u.displayName} {u.isBot && <span className="rounded bg-accent px-1 text-[9px] font-bold text-white">BOT</span>}</p><p className="text-xs text-muted">@{u.username}</p></div></div></td>
                        <td className="text-muted">{STATUS_LABEL[u.status]}</td>
                        <td>{levelFromXp(u.xp)}</td>
                        <td>{u.reputation}</td>
                        <td className="text-muted">{new Date(u.joinedAt).toLocaleDateString()}</td>
                        <td>{banned ? <span className="chip bg-danger/15 text-danger">Banned</span> : muted ? <span className="chip bg-warn/15 text-warn">Muted</span> : <span className="chip bg-ok/15 text-ok">Active</span>}</td>
                        <td className="text-right">
                          {u.id !== "bot_nova" && (
                            <div className="inline-flex gap-1">
                              <button className="btn py-1 text-xs text-warn hover:bg-warn/10" onClick={() => actions.moderate(u.id, muted ? "unmute" : "mute", muted ? "Unmuted by admin" : "Muted by admin", muted ? undefined : 15 * 60_000)}><VolumeX size={13} /> {muted ? "Unmute" : "Mute"}</button>
                              <button className="btn py-1 text-xs text-danger hover:bg-danger/10" onClick={() => actions.moderate(u.id, banned ? "unban" : "ban", banned ? "Unbanned by admin" : "Violation of community guidelines")}><Ban size={13} /> {banned ? "Unban" : "Ban"}</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "moderation" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={`Reports queue · ${openReports.length} open`}>
              {!db.reports.length && <p className="py-6 text-center text-sm text-muted">No reports yet. Users can report any message from its ••• menu.</p>}
              <div className="space-y-2">
                {db.reports.map((r) => {
                  const m = findMsg(r.messageId);
                  return (
                    <div key={r.id} className={cn("rounded-2xl border hairline p-3", r.resolved && "opacity-50")}>
                      <div className="flex items-center gap-2 text-xs text-muted"><Flag size={13} className="text-danger" /> Reported by {db.users[r.reporterId]?.displayName} · {relativeTime(r.createdAt)}</div>
                      <p className="mt-1.5 text-sm"><b>{m ? db.users[m.authorId]?.displayName : "?"}:</b> {m?.deletedAt ? <i className="text-muted">deleted</i> : m?.content || "(attachment)"}</p>
                      {!r.resolved && m && (
                        <div className="mt-2 flex gap-1.5">
                          <button className="btn-soft py-1 text-xs" onClick={() => actions.resolveReport(r.id)}>Dismiss</button>
                          <button className="btn py-1 text-xs text-danger hover:bg-danger/10" onClick={() => { actions.deleteMessage(m.channelId, m.id); actions.resolveReport(r.id); }}>Delete message</button>
                          <button className="btn py-1 text-xs text-warn hover:bg-warn/10" onClick={() => { actions.moderate(m.authorId, "mute", `Report: ${r.reason}`, 30 * 60_000); actions.resolveReport(r.id); }}>Mute author 30m</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card title="Moderation log">
              {!db.moderation.length && <p className="py-6 text-center text-sm text-muted">No moderation actions yet.</p>}
              <div className="space-y-2">
                {db.moderation.slice(0, 40).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-fg/[0.03] p-3 text-sm">
                    <ShieldCheck size={16} className={a.kind === "ban" ? "text-danger" : a.kind === "mute" ? "text-warn" : "text-ok"} />
                    <p className="flex-1"><b>{db.users[a.moderatorId]?.displayName}</b> {a.kind}d <b>{db.users[a.userId]?.displayName}</b> <span className="text-muted">— {a.reason}</span></p>
                    <span className="text-xs text-muted">{relativeTime(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={cn("rounded-3xl border hairline bg-surface/80 p-5 shadow-glass", className)}>
      <h2 className="mb-4 font-display font-bold">{title}</h2>
      {children}
    </motion.section>
  );
}
