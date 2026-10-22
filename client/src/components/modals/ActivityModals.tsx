"use client";

import { motion } from "framer-motion";
import { Eraser, Lock, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { channelTitle, useStore } from "@/lib/store";
import { ACHIEVEMENTS, BADGES, levelProgress } from "@/lib/gamification";
import { MEME_TEMPLATES } from "@/lib/content";
import { safetyNumber } from "@/lib/crypto";
import type { Stroke } from "@/lib/types";
import { cn, EMPTY, uid } from "@/lib/utils";
import { Modal } from "../ui/Modal";
import { Avatar } from "../ui/Avatar";

export function PollModal({ channelId, question: q0, onClose }: { channelId: string; question?: string; onClose: () => void }) {
  const sendMessage = useStore((s) => s.sendMessage);
  const [question, setQuestion] = useState(q0 ?? "");
  const [options, setOptions] = useState(["", ""]);
  const [multi, setMulti] = useState(false);
  const valid = question.trim() && options.filter((o) => o.trim()).length >= 2;
  return (
    <Modal open onClose={onClose} title="Create a poll 📊" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!valid} onClick={() => { void sendMessage(channelId, { content: "", kind: "poll", poll: { question: question.trim(), multi, options: options.filter((o) => o.trim()).map((label, i) => ({ id: `o${i}`, label: label.trim(), votes: [] })) } }); onClose(); }}>Post poll</button></>}>
      <input autoFocus className="input text-base font-semibold" placeholder="Ask a question…" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={140} />
      <div className="mt-3 space-y-2">
        {options.map((o, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2">
            <input className="input" placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} maxLength={60} />
            {options.length > 2 && <button className="icon-btn" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Remove option"><X size={16} /></button>}
          </motion.div>
        ))}
      </div>
      {options.length < 10 && <button className="btn-ghost mt-2 text-accent" onClick={() => setOptions([...options, ""])}><Plus size={15} /> Add option</button>}
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Allow multiple answers</label>
    </Modal>
  );
}

const COLORS = ["#f8fafc", "#7c5cff", "#22d3ee", "#f43f5e", "#f59e0b", "#10b981", "#ec4899", "#0f172a"];

export function WhiteboardModal({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const strokes = useStore((s) => s.db.whiteboards[channelId]) ?? EMPTY;
  const users = useStore((s) => s.db.users);
  const meId = useStore((s) => s.sessionUserId)!;
  const { addStroke, clearWhiteboard } = useStore.getState();
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[1]);
  const [width, setWidth] = useState(4);
  const [eraser, setEraser] = useState(false);

  const draw = (ctx: CanvasRenderingContext2D, s: Stroke) => {
    if (s.points.length < 1) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = s.color === "erase" ? "destination-out" : "source-over";
    ctx.beginPath();
    const [x0, y0] = s.points[0];
    ctx.moveTo(x0 * ctx.canvas.width, y0 * ctx.canvas.height);
    for (const [x, y] of s.points.slice(1)) ctx.lineTo(x * ctx.canvas.width, y * ctx.canvas.height);
    if (s.points.length === 1) ctx.lineTo(x0 * ctx.canvas.width + 0.1, y0 * ctx.canvas.height);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  };

  const redraw = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    strokes.forEach((s) => draw(ctx, s));
    if (current.current) draw(ctx, current.current);
  };

  useEffect(() => {
    const c = canvas.current!;
    const resize = () => {
      const r = c.getBoundingClientRect();
      c.width = r.width * devicePixelRatio;
      c.height = r.height * devicePixelRatio;
      redraw();
    };
    resize();
    addEventListener("resize", resize);
    return () => removeEventListener("resize", resize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(redraw, [strokes]); // eslint-disable-line react-hooks/exhaustive-deps

  const pt = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  const contributors = [...new Set(strokes.map((s) => s.userId))];

  return (
    <Modal open onClose={onClose} title="Shared whiteboard 🎨" subtitle="Everyone in this channel sees strokes in real time (try two tabs!)" wide="xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {COLORS.map((c) => <button key={c} onClick={() => { setColor(c); setEraser(false); }} className={cn("h-8 w-8 rounded-full border-2 transition", color === c && !eraser ? "scale-110 border-fg" : "border-transparent")} style={{ background: c }} aria-label={c} />)}
        <input type="range" min={1} max={24} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-28 accent-[rgb(var(--accent))]" />
        <button onClick={() => setEraser((x) => !x)} className={cn("btn-soft py-1.5", eraser && "bg-accent/25")}><Eraser size={15} /> Eraser</button>
        <button onClick={() => clearWhiteboard(channelId)} className="btn-soft py-1.5 text-danger"><Trash2 size={15} /> Clear</button>
        <div className="ml-auto flex -space-x-2">{contributors.slice(0, 6).map((u) => <Avatar key={u} user={users[u]} size={26} className="rounded-full ring-2 ring-surface" />)}</div>
      </div>
      <canvas
        ref={canvas}
        className="h-[55vh] w-full touch-none rounded-2xl border hairline bg-[#11111c] [background-image:radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] [background-size:20px_20px]"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); current.current = { id: uid("stk"), userId: meId, color: eraser ? "erase" : color, width: (eraser ? width * 3 : width) * devicePixelRatio, points: [pt(e)] }; redraw(); }}
        onPointerMove={(e) => { if (!current.current) return; current.current.points.push(pt(e)); redraw(); }}
        onPointerUp={() => { if (current.current) addStroke(channelId, current.current); current.current = null; }}
      />
    </Modal>
  );
}

export function ScheduleModal({ channelId, text: t0, onClose }: { channelId: string; text?: string; onClose: () => void }) {
  const allScheduled = useStore((s) => s.db.scheduled);
  const meId = useStore((s) => s.sessionUserId);
  const scheduled = useMemo(() => allScheduled.filter((x) => x.authorId === meId), [allScheduled, meId]);
  const { scheduleMessage, cancelScheduled } = useStore.getState();
  const [text, setText] = useState(t0 ?? "");
  const [mins, setMins] = useState(5);
  const presets = [[1, "1 min"], [5, "5 min"], [30, "30 min"], [60, "1 hour"], [180, "3 hours"]] as const;
  return (
    <Modal open onClose={onClose} title="Schedule a message ⏰" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!text.trim()} onClick={() => { scheduleMessage(channelId, text.trim(), Date.now() + mins * 60_000); onClose(); }}>Schedule</button></>}>
      <textarea autoFocus className="input min-h-[90px]" placeholder="Your message" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map(([m, l]) => <button key={m} onClick={() => setMins(m)} className={cn("chip", mins === m && "bg-accent/25 text-fg")}>{l}</button>)}
        <label className="chip">Custom <input type="number" min={1} value={mins} onChange={(e) => setMins(Math.max(1, Number(e.target.value)))} className="w-14 bg-transparent text-fg outline-none" /> min</label>
      </div>
      <p className="mt-2 text-xs text-muted">Sends at {new Date(Date.now() + mins * 60_000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
      {scheduled.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Upcoming</p>
          {scheduled.map((s) => (
            <div key={s.id} className="mt-1.5 flex items-center gap-2 rounded-xl bg-fg/[0.04] px-3 py-2 text-sm">
              <span className="text-xs text-muted">{new Date(s.sendAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              <span className="flex-1 truncate">{s.content}</span>
              <button className="icon-btn h-7 w-7" onClick={() => cancelScheduled(s.id)} aria-label="Cancel"><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function MemeModal({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const sendMessage = useStore((s) => s.sendMessage);
  const [tpl, setTpl] = useState(MEME_TEMPLATES[0]);
  const [top, setTop] = useState("when the code works");
  const [bottom, setBottom] = useState("on the first try");
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    c.width = 600; c.height = 600;
    const g = ctx.createLinearGradient(0, 0, 600, 600);
    g.addColorStop(0, tpl.gradient[0]); g.addColorStop(1, tpl.gradient[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 600, 600);
    ctx.font = "260px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(tpl.emoji, 300, 315);
    ctx.font = "900 52px Impact, 'Arial Black', sans-serif";
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 8; ctx.lineJoin = "round";
    const line = (t: string, y: number) => { const s = t.toUpperCase(); ctx.strokeText(s, 300, y, 560); ctx.fillText(s, 300, y, 560); };
    line(top, 60); line(bottom, 545);
  }, [tpl, top, bottom]);

  return (
    <Modal open onClose={onClose} title="Meme generator 🐸" wide footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => { const url = canvas.current!.toDataURL("image/jpeg", 0.85); void sendMessage(channelId, { content: "[meme]", kind: "image", attachments: [{ id: uid("att"), kind: "image", name: "meme.jpg", size: Math.round(url.length * 0.75), mime: "image/jpeg", url, width: 600, height: 600 }] }); onClose(); }}>Share meme</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <canvas ref={canvas} className="aspect-square w-full rounded-2xl shadow-glass" />
        <div className="space-y-3">
          <input className="input" value={top} onChange={(e) => setTop(e.target.value)} placeholder="Top text" />
          <input className="input" value={bottom} onChange={(e) => setBottom(e.target.value)} placeholder="Bottom text" />
          <div className="grid grid-cols-3 gap-2">
            {MEME_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => setTpl(t)} className={cn("flex aspect-square flex-col items-center justify-center rounded-xl text-3xl", tpl.id === t.id && "ring-2 ring-accent")} style={{ background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
                {t.emoji}<span className="mt-1 text-[10px] font-bold text-white drop-shadow">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function EncryptionModal({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const channel = db.channels[channelId];
  const [digits, setDigits] = useState<string[]>([]);
  const other = channel?.memberIds?.find((m) => m !== meId) ?? meId;
  useEffect(() => { void safetyNumber(meId, other).then(setDigits); }, [meId, other]);
  const count = (db.messages[channelId] ?? []).filter((m) => m.ciphertext).length;
  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><ShieldCheck className="text-ok" /> End-to-end encryption</span>}>
      <p className="text-sm text-muted">Messages in <b className="text-fg">{channelTitle(db, channel, meId)}</b> are encrypted with AES-256-GCM using a key derived (PBKDF2) from this conversation&apos;s participants. Compare the safety number with your contact to verify the session.</p>
      <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl bg-bg/70 p-4 font-mono text-lg tracking-wider">
        {digits.map((d, i) => <motion.span key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="text-center">{d}</motion.span>)}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-ok/10 p-3 text-sm text-ok"><Lock size={16} /> {count} message{count === 1 ? "" : "s"} encrypted in this conversation</div>
      <p className="mt-3 text-xs text-muted">⚠️ Educational simulation: keys are derived in-browser and are not a substitute for a real E2EE protocol like Signal&apos;s Double Ratchet.</p>
    </Modal>
  );
}

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const rows = [
    ["Ctrl / ⌘ + K", "Search messages"], ["Ctrl / ⌘ + /", "Show shortcuts"], ["Ctrl / ⌘ + ,", "Open settings"], ["Alt + ↑ / ↓", "Previous / next channel"],
    ["↑ (empty composer)", "Edit your last message"], ["Enter / Shift + Enter", "Send / new line"], ["Esc", "Cancel reply or edit"], ["@name", "Mention someone"],
  ];
  const cmds = [["/poll Q | A | B", "Create a poll"], ["/trivia", "Trivia round"], ["/roll 20", "Roll a d20"], ["/flip", "Coin flip"], ["/schedule 10m hi", "Send later"], ["/spoiler text", "Spoiler"], ["/me waves", "Action"], ["/nick Name", "Change name"], ["/status text", "Custom status"], ["/whiteboard", "Whiteboard"], ["/call", "Voice call"]];
  const fmt = [["**bold**", "bold"], ["*italic*", "italic"], ["~~strike~~", "strike"], ["`code`", "code"], ["||spoiler||", "spoiler"], ["> quote", "quote"]];
  const Section = ({ title, items }: { title: string; items: string[][] }) => (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
      <div className="space-y-1">{items.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3 rounded-xl bg-fg/[0.04] px-3 py-2 text-sm"><span>{v}</span><kbd className="rounded-lg bg-fg/10 px-2 py-0.5 font-mono text-xs">{k}</kbd></div>)}</div>
    </div>
  );
  return (
    <Modal open onClose={onClose} title="Shortcuts & commands ⌨️" wide>
      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Keyboard" items={rows} />
        <Section title="Slash commands" items={cmds} />
        <Section title="Formatting" items={fmt} />
      </div>
    </Modal>
  );
}

export function AchievementsModal({ onClose }: { onClose: () => void }) {
  const me = useStore((s) => (s.sessionUserId ? s.db.users[s.sessionUserId] : undefined));
  const stats = useStore((s) => (s.sessionUserId ? s.db.stats[s.sessionUserId] : undefined));
  if (!me) return null;
  const unlocked = stats?.achievements ?? [];
  const lp = levelProgress(me.xp);
  return (
    <Modal open onClose={onClose} title="Achievements & progress 🏆" wide>
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Level", lp.level], ["Total XP", me.xp], ["Messages", stats?.messages ?? 0], ["Day streak", `${stats?.streak ?? 0} 🔥`]].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-gradient-to-br from-accent/15 to-accent2/10 p-4 text-center">
            <p className="font-display text-2xl font-extrabold">{v}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/10"><motion.div className="h-full bg-gradient-to-r from-accent to-accent2" initial={{ width: 0 }} animate={{ width: `${lp.pct * 100}%` }} /></div>
      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">Badges</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.values(BADGES).map((b) => {
          const own = me.badges.includes(b.id);
          return <span key={b.id} title={b.description} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-sm", own ? "bg-accent/20" : "bg-fg/[0.04] opacity-40 grayscale")}>{b.emoji} {b.label}</span>;
        })}
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">Achievements · {unlocked.length}/{ACHIEVEMENTS.length}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a, i) => {
          const got = unlocked.includes(a.id);
          return (
            <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className={cn("flex items-center gap-3 rounded-2xl border p-3", got ? "border-warn/40 bg-warn/[0.07]" : "hairline opacity-55")}>
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-2xl", got ? "bg-warn/20" : "bg-fg/[0.06] grayscale")}>{a.emoji}</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{a.name}</p><p className="text-xs text-muted">{a.description}</p></div>
              {a.xp > 0 && <span className="text-xs font-bold text-accent">+{a.xp}</span>}
            </motion.div>
          );
        })}
      </div>
    </Modal>
  );
}

export function NewDmModal({ onClose }: { onClose: () => void }) {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const { openDm, createGroupDm } = useStore.getState();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const people = useMemo(() => {
    const friends = new Set(Object.entries(db.friends[meId] ?? {}).filter(([, s]) => s === "friends").map(([id]) => id));
    return Object.values(db.users).filter((u) => u.id !== meId && (!q || u.displayName.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => Number(friends.has(b.id)) - Number(friends.has(a.id))).slice(0, 40);
  }, [db.users, db.friends, meId, q]);
  return (
    <Modal open onClose={onClose} title="New message" subtitle="Pick one person for a DM, or several for a group chat (up to 9)."
      footer={<button className="btn-primary" disabled={!sel.length} onClick={() => { if (sel.length === 1) openDm(sel[0]); else createGroupDm(sel); onClose(); }}>{sel.length > 1 ? `Create group (${sel.length + 1})` : "Start chat"}</button>}>
      <input autoFocus className="input" placeholder="Type a name" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="scroll-thin mt-3 max-h-80 space-y-1 overflow-y-auto">
        {people.map((u) => {
          const on = sel.includes(u.id);
          return (
            <button key={u.id} onClick={() => setSel(on ? sel.filter((x) => x !== u.id) : sel.length < 9 ? [...sel, u.id] : sel)} className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left", on ? "bg-accent/15" : "hover:bg-fg/[0.04]")}>
              <Avatar user={u} size={34} showStatus ring="ring-surface" />
              <span className="flex-1 text-sm font-medium">{u.displayName}</span>
              <span className={cn("h-5 w-5 rounded-md border-2", on ? "border-accent bg-accent" : "border-fg/30")} />
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
