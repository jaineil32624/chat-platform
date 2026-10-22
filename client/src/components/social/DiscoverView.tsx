"use client";

import { motion } from "framer-motion";
import { Compass, Menu, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Gaming", "Education", "Tech", "Art", "Music", "Science", "Lifestyle"];
const CAT_TAGS: Record<string, string[]> = {
  Gaming: ["gaming", "esports", "lfg"], Education: ["education", "study", "homework", "books"], Tech: ["programming", "tech", "open source"],
  Art: ["art", "design", "creative", "photography"], Music: ["music", "playlists"], Science: ["science", "space"], Lifestyle: ["food", "cooking", "fitness", "sports", "travel", "writing"],
};

export function DiscoverView() {
  const servers = useStore((s) => s.db.servers);
  const users = useStore((s) => s.db.users);
  const meId = useStore((s) => s.sessionUserId)!;
  const { joinServer, openServer, setMobileNav } = useStore.getState();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const list = useMemo(() => Object.values(servers)
    .filter((s) => s.isPublic)
    .filter((s) => cat === "All" || s.tags.some((t) => CAT_TAGS[cat]?.includes(t)))
    .filter((s) => !q || `${s.name} ${s.description} ${s.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.memberIds.length - a.memberIds.length), [servers, cat, q]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="glass flex h-14 shrink-0 items-center gap-2 border-x-0 border-t-0 px-2 sm:px-4 safe-top lg:hidden">
        <button className="icon-btn" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
        <Compass size={20} className="text-muted" /> <span className="font-semibold">Discover</span>
      </header>
      <div className="scroll-thin flex-1 overflow-y-auto">
        <section className="relative overflow-hidden px-6 pb-10 pt-12 text-center sm:px-10">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(800px_300px_at_50%_0%,rgb(var(--accent)/0.35),transparent),radial-gradient(500px_200px_at_80%_60%,rgb(var(--accent2)/0.25),transparent)]" />
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="font-display text-3xl font-extrabold sm:text-5xl">
            Find your <span className="gradient-text">community</span>
          </motion.h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">From gaming to study groups, there&apos;s a place for you on Pulse.</p>
          <label className="glass mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-2xl px-4 py-3 shadow-glass">
            <Search size={18} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Explore communities" className="flex-1 bg-transparent outline-none" />
          </label>
          <div className="no-scrollbar mx-auto mt-5 flex max-w-3xl gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition", cat === c ? "bg-fg text-bg" : "bg-fg/[0.07] text-muted hover:text-fg")}>{c}</button>
            ))}
          </div>
        </section>
        <section className="grid gap-4 px-4 pb-10 sm:grid-cols-2 sm:px-8 xl:grid-cols-3">
          {list.map((s, i) => {
            const joined = s.memberIds.includes(meId);
            const online = s.memberIds.filter((m) => users[m]?.status !== "offline").length;
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -4 }} className="group overflow-hidden rounded-3xl border hairline bg-surface shadow-glass">
                <div className="relative h-28" style={{ background: `linear-gradient(135deg, ${s.color}, rgb(var(--accent2) / 0.5))` }}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.3),transparent_55%)]" />
                  <div className="absolute -bottom-7 left-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-3xl shadow-lg ring-4 ring-surface transition group-hover:scale-110">{s.icon}</div>
                </div>
                <div className="p-5 pt-9">
                  <h3 className="font-display text-lg font-bold">{s.name}</h3>
                  <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted">{s.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{s.tags.slice(0, 3).map((t) => <span key={t} className="chip">#{t}</span>)}</div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok" /> {online} online</span>
                    <span className="flex items-center gap-1.5"><Users size={13} /> {s.memberIds.length} members</span>
                    <button onClick={() => (joined ? openServer(s.id) : joinServer(s.id))} className={cn("ml-auto", joined ? "btn-soft py-1.5" : "btn-primary py-1.5")}>{joined ? "Open" : "Join"}</button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
