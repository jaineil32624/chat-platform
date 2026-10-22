"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight, Bot, Brain, Download, Github, Globe, Lock, MessageSquareText, Mic, Palette, Shield, Smartphone, Sparkles, Trophy, Users, Video, Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "../ui/Logo";
import { DOWNLOADS, REPO_URL } from "@/lib/site";
import { asset, cn } from "@/lib/utils";

const SCRIPT = [
  { who: "Ava", color: "#7c5cff", text: "anyone tryna queue ranked later? 🎮" },
  { who: "Kai", color: "#22d3ee", text: "bet, send an invite" },
  { who: "You", color: "#f59e0b", text: "I'm in! give me 5 min ☕", mine: true },
  { who: "Maya", color: "#ec4899", text: "omg wait for meee 😭" },
  { who: "Nova AI", color: "#7c5cff", text: "🧠 Trivia time! What does HTTP stand for?", ai: true },
  { who: "Leo", color: "#10b981", text: "HyperText Transfer Protocol. EZ 😎" },
];

function LiveChatPreview() {
  const [n, setN] = useState(1);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setTyping(true);
      setTimeout(() => { setTyping(false); setN((x) => (x >= SCRIPT.length ? 1 : x + 1)); }, 1100);
    }, n >= SCRIPT.length ? 3200 : 1500);
    return () => clearTimeout(t);
  }, [n]);
  const next = SCRIPT[n % SCRIPT.length];
  return (
    <div className="glass relative w-full overflow-hidden rounded-[28px] shadow-glass">
      <div className="flex items-center gap-2 border-b hairline px-5 py-3.5">
        <span className="h-3 w-3 rounded-full bg-danger/80" /><span className="h-3 w-3 rounded-full bg-warn/80" /><span className="h-3 w-3 rounded-full bg-ok/80" />
        <span className="ml-3 text-sm font-semibold text-muted"># general · Gaming Guild</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-ok"><span className="h-2 w-2 animate-pulse rounded-full bg-ok" />38 online</span>
      </div>
      <div className="flex h-[330px] flex-col justify-end gap-3 p-5">
        <AnimatePresence initial={false}>
          {SCRIPT.slice(0, n).slice(-5).map((m, i) => (
            <motion.div key={`${m.who}${i}${n}`} layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className={cn("flex items-end gap-2.5", m.mine && "flex-row-reverse")}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: m.color }}>{m.who[0]}</div>
              <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-sm", m.mine ? "rounded-br-md bg-gradient-to-br from-accent to-accent2 text-white" : m.ai ? "rounded-bl-md border border-accent/40 bg-accent/10" : "rounded-bl-md bg-fg/[0.07]")}>
                {!m.mine && <p className="mb-0.5 text-[11px] font-bold" style={{ color: m.color }}>{m.who}{m.ai && " ✨"}</p>}
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="h-5">
          {typing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs text-muted">
              <span className="flex gap-0.5 rounded-full bg-fg/[0.07] px-2 py-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-fg/70" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
              {next.who} is typing…
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: <Zap />, title: "Real-time everything", text: "Typing indicators, presence, read receipts and live reactions synced across tabs and devices." },
  { icon: <Bot />, title: "56 AI-simulated users", text: "Distinct personalities that chat, reply, react, vote in polls, play trivia and go offline." },
  { icon: <Users />, title: "Servers, channels & roles", text: "Categories, text/voice/announcement channels, a bitfield permission system and admin tools." },
  { icon: <MessageSquareText />, title: "Rich messaging", text: "Threads, replies, edits, pins, saved messages, markdown, spoilers, GIFs, stickers and files." },
  { icon: <Mic />, title: "Voice notes & calls", text: "Record real voice notes with live waveforms. Voice/video call UI with camera & screen share." },
  { icon: <Lock />, title: "Encryption simulation", text: "AES-256-GCM per-conversation keys, PBKDF2 password hashing and verifiable safety numbers." },
  { icon: <Trophy />, title: "XP, levels & achievements", text: "Daily streaks, 20 achievements, badges, reputation tiers and message milestones." },
  { icon: <Brain />, title: "Polls, trivia & whiteboard", text: "Mini-activities in any channel: live polls, competitive trivia, memes and a shared canvas." },
  { icon: <Sparkles />, title: "Nova AI assistant", text: "Built-in assistant with an offline brain — or plug in a Claude API key for real AI answers." },
  { icon: <Shield />, title: "Admin dashboard", text: "Analytics, live activity, message insights, reports queue, mutes, bans and moderation log." },
  { icon: <Palette />, title: "Theme studio", text: "Dark, light & system modes, accent palettes, wallpapers, glassmorphism and text scaling." },
  { icon: <Smartphone />, title: "Every screen", text: "Responsive mobile, tablet & desktop layouts, an Android APK and a Godot companion client." },
];

const STACK = ["Next.js 15", "React 19", "TypeScript", "Tailwind CSS", "Zustand", "Framer Motion", "Socket.IO", "Supabase / Postgres", "Web Crypto", "Capacitor", "Godot 4", "Vitest"];

export function Landing() {
  const hero = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-bg">
      <nav className="glass fixed inset-x-0 top-0 z-40 border-x-0 border-t-0 safe-top">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-8">
          <Logo size={32} />
          <span className="font-display text-xl font-extrabold">Pulse</span>
          <div className="ml-6 hidden gap-6 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-fg">Features</a>
            <a href="#download" className="hover:text-fg">Download</a>
            <a href="#stack" className="hover:text-fg">Tech</a>
            <a href={REPO_URL} className="hover:text-fg">GitHub</a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href={REPO_URL} className="icon-btn" aria-label="GitHub"><Github size={18} /></a>
            <Link href="/auth/" className="btn-primary">Open Pulse <ArrowRight size={16} /></Link>
          </div>
        </div>
      </nav>

      <section ref={hero} className="relative px-4 pb-24 pt-32 sm:px-8 sm:pt-40">
        <motion.div style={{ y }} className="pointer-events-none absolute inset-0 -z-0">
          <div className="absolute left-[-10%] top-[-10%] h-[520px] w-[520px] rounded-full bg-accent/30 blur-[120px]" />
          <div className="absolute right-[-10%] top-[20%] h-[460px] w-[460px] rounded-full bg-accent2/25 blur-[120px]" />
          <img src={asset("/assets/decor/orbs.svg")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        </motion.div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="chip border border-accent/30 bg-accent/10 text-fg">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ok" /> v1.0 · 56 simulated users online
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl">
              Where conversations <span className="gradient-text">come alive.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-6 max-w-xl text-lg text-muted">
              Pulse is a production-grade chat platform simulation — servers, DMs, threads, voice notes, polls and trivia, populated by a living community of AI-driven users. No sign-up wall, no backend required.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-8 flex flex-wrap gap-3">
              <Link href="/auth/" className="btn-primary px-6 py-3.5 text-base"><Globe size={18} /> Play in your browser</Link>
              <a href="#download" className="btn-soft px-6 py-3.5 text-base"><Download size={18} /> Download apps</a>
            </motion.div>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[["56+", "AI users"], ["11", "communities"], ["40+", "features"]].map(([v, l]) => (
                <div key={l}><p className="font-display text-3xl font-extrabold">{v}</p><p className="text-sm text-muted">{l}</p></div>
              ))}
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 30, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.2, type: "spring", damping: 18 }} className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-accent/30 to-accent2/20 blur-2xl" />
            <LiveChatPreview />
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 5 }} className="glass absolute -bottom-6 -left-6 hidden items-center gap-3 rounded-2xl px-4 py-3 shadow-glass sm:flex">
              <span className="text-2xl">🏆</span><div><p className="text-sm font-bold">Achievement unlocked</p><p className="text-xs text-muted">Chatterbox · +30 XP</p></div>
            </motion.div>
            <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 6 }} className="glass absolute -right-4 -top-14 hidden items-center gap-2 rounded-2xl px-4 py-2.5 shadow-glass sm:flex">
              <Video size={16} className="text-accent2" /><span className="text-sm font-semibold">4 in Squad 1</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="relative px-4 py-24 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center font-display text-4xl font-extrabold sm:text-5xl">Everything a modern messenger needs</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted">Inspired by Discord, WhatsApp, iMessage and Slack — engineered as a single, coherent product.</p>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: (i % 3) * 0.06 }} whileHover={{ y: -4 }} className="group rounded-3xl border hairline bg-surface/70 p-6 shadow-glass">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-accent2/20 text-accent transition group-hover:scale-110">{f.icon}</div>
                <h3 className="font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] border hairline shadow-glass">
          <img src={asset("/assets/screenshots/desktop-chat.png")} alt="Pulse desktop app — a server channel with messages, reactions and member list" className="w-full" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        </div>
      </section>

      <section id="download" className="px-4 py-24 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-4xl font-extrabold sm:text-5xl">Play it <span className="gradient-text">anywhere</span></h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted">Run it instantly in the browser, install the Android app, or try the Godot-powered companion client.</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DOWNLOADS.map((d) => {
              const inner = (
                <>
                  <span className="text-4xl transition group-hover:scale-110">{d.icon}</span>
                  <p className="mt-4 font-display text-lg font-bold">{d.label}</p>
                  <p className="mt-1 text-sm text-muted">{d.sub}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent2">{"internal" in d ? "Launch" : "Download"} <ArrowRight size={14} /></span>
                </>
              );
              const cls = "group rounded-3xl border hairline bg-surface/70 p-6 shadow-glass transition hover:-translate-y-1 hover:border-accent/40";
              return "internal" in d ? <a key={d.id} href={asset(`/${d.href === "app/" ? "auth/" : d.href}`)} className={cls}>{inner}</a> : <a key={d.id} href={d.href} className={cls}>{inner}</a>;
            })}
          </div>
          <p className="mt-6 text-center text-xs text-muted">Builds are produced automatically by GitHub Actions on every release. Android: enable “Install unknown apps” to sideload the APK.</p>
        </div>
      </section>

      <section id="stack" className="px-4 pb-24 sm:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-display text-3xl font-extrabold">Built with</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {STACK.map((s) => <span key={s} className="rounded-full border hairline bg-surface/70 px-4 py-2 text-sm font-medium">{s}</span>)}
          </div>
        </div>
      </section>

      <footer className="border-t hairline px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 text-sm text-muted sm:flex-row">
          <Logo size={26} />
          <span>Pulse — a chat platform simulation. All users except you are simulated.</span>
          <a href={REPO_URL} className="flex items-center gap-1.5 hover:text-fg sm:ml-auto"><Github size={16} /> Source on GitHub</a>
        </div>
      </footer>
    </div>
  );
}
