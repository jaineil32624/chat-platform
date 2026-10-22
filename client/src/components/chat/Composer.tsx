"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Clock, Image as ImageIcon, Mic, Paperclip, PenTool, Plus, Send, Smile, Sticker, Trash2, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { channelTitle, useStore } from "@/lib/store";
import { isMuted } from "@/lib/store/reducer";
import { can, Perm } from "@/lib/permissions";
import { TRIVIA } from "@/lib/content";
import { ASSISTANT_ID } from "@/lib/sim/personas";
import type { Attachment, Channel, Server } from "@/lib/types";
import { cn, compressImage, formatBytes, formatDuration, pick, rand, readFileAsDataUrl, uid } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { Avatar } from "../ui/Avatar";
import { EmojiPicker, GifPicker } from "./Pickers";

const COMMANDS = [
  { cmd: "/poll", hint: "Question | Option A | Option B", desc: "Create a poll" },
  { cmd: "/trivia", hint: "", desc: "Start a trivia round" },
  { cmd: "/roll", hint: "[sides]", desc: "Roll a die" },
  { cmd: "/flip", hint: "", desc: "Flip a coin" },
  { cmd: "/schedule", hint: "10m Your message", desc: "Send a message later" },
  { cmd: "/spoiler", hint: "text", desc: "Hide text behind a spoiler" },
  { cmd: "/shrug", hint: "[text]", desc: "Append ¯\\_(ツ)_/¯" },
  { cmd: "/tableflip", hint: "", desc: "(╯°□°)╯︵ ┻━┻" },
  { cmd: "/me", hint: "action", desc: "Italic action message" },
  { cmd: "/nick", hint: "New name", desc: "Change your display name" },
  { cmd: "/status", hint: "text", desc: "Set a custom status" },
  { cmd: "/whiteboard", hint: "", desc: "Open the shared whiteboard" },
  { cmd: "/call", hint: "", desc: "Start a voice call" },
  { cmd: "/help", hint: "", desc: "Show shortcuts & commands" },
];

const MAX_FILE = 4 * 1024 * 1024;

export function Composer({ channel, server, threadParentId, compact }: { channel: Channel; server?: Server; threadParentId?: string; compact?: boolean }) {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const replyToId = useStore((s) => s.replyToId);
  const sounds = useStore((s) => s.sounds);
  const actions = useStore.getState();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [panel, setPanel] = useState<null | "emoji" | "gif" | "plus">(null);
  const [rec, setRec] = useState<null | { start: number; levels: number[] }>(null);
  const [drag, setDrag] = useState(false);
  const [sel, setSel] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const typingAt = useRef(0);
  const recorder = useRef<{ mr?: MediaRecorder; chunks: Blob[]; stream?: MediaStream; raf?: number; ctx?: AudioContext }>({ chunks: [] });

  const replyTo = !threadParentId && replyToId ? db.messages[channel.id]?.find((m) => m.id === replyToId) : undefined;
  const muted = isMuted(db, meId);
  const readOnly = channel.kind === "announcement" && !can(server, meId, Perm.MANAGE_CHANNELS);
  const canAttach = can(server, meId, Perm.ATTACH_FILES);
  const title = channelTitle(db, channel, meId);
  const draftKey = `pulse-draft:${channel.id}:${threadParentId ?? ""}`;

  // persist unsent drafts per channel
  useEffect(() => {
    try { setText(sessionStorage.getItem(draftKey) ?? ""); } catch { setText(""); }
    setFiles([]);
    if (!compact) ta.current?.focus();
  }, [draftKey, compact]);
  useEffect(() => {
    try { text ? sessionStorage.setItem(draftKey, text) : sessionStorage.removeItem(draftKey); } catch { /* ignore */ }
  }, [text, draftKey]);
  useEffect(() => { if (replyToId) ta.current?.focus(); }, [replyToId]);

  // autosize
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(200, el.scrollHeight)}px`;
  }, [text]);

  // autocomplete: slash commands + @mentions
  const slash = text.startsWith("/") && !text.includes(" ") ? COMMANDS.filter((c) => c.cmd.startsWith(text.toLowerCase())) : [];
  const mentionMatch = /(^|\s)@([\w.]*)$/.exec(text);
  const mentionCandidates = useMemo(() => {
    if (!mentionMatch) return [];
    const ids = channel.memberIds ?? (channel.serverId ? db.servers[channel.serverId]?.memberIds : []) ?? [];
    const q = mentionMatch[2].toLowerCase();
    return [...new Set([ASSISTANT_ID, ...ids])]
      .map((id) => db.users[id])
      .filter((u) => u && u.id !== meId && (u.displayName.toLowerCase().includes(q) || u.username.includes(q)))
      .slice(0, 6);
  }, [mentionMatch?.[2], channel, db.users, db.servers, meId]); // eslint-disable-line react-hooks/exhaustive-deps
  const suggestions = slash.length ? slash.length : mentionCandidates.length;
  useEffect(() => setSel(0), [suggestions]);

  const onChange = (v: string) => {
    setText(v);
    const now = Date.now();
    if (v && now - typingAt.current > 2500) {
      typingAt.current = now;
      actions.setTyping(channel.id, true);
    }
    if (!v) actions.setTyping(channel.id, false);
  };

  const applySuggestion = (i: number) => {
    if (slash.length) {
      const c = slash[i];
      setText(`${c.cmd} `);
    } else if (mentionCandidates[i]) {
      const u = mentionCandidates[i]!;
      const handle = u.id === ASSISTANT_ID ? "nova" : u.username;
      setText(text.replace(/@([\w.]*)$/, `@${handle} `));
    }
    ta.current?.focus();
  };

  const addFiles = async (list: FileList | File[]) => {
    if (!canAttach) return actions.toast({ title: "You can't attach files here", tone: "warn" });
    for (const f of Array.from(list).slice(0, 6)) {
      if (f.size > MAX_FILE * 3) {
        actions.toast({ title: "File too large", body: `${f.name} is over 12 MB`, tone: "warn" });
        continue;
      }
      if (f.type.startsWith("image/")) {
        const { url, width, height } = await compressImage(f);
        setFiles((x) => [...x, { id: uid("att"), kind: "image", name: f.name, size: f.size, mime: f.type, url, width, height }]);
      } else {
        const url = f.size <= MAX_FILE ? await readFileAsDataUrl(f) : "#";
        setFiles((x) => [...x, { id: uid("att"), kind: "file", name: f.name, size: f.size, mime: f.type || "application/octet-stream", url }]);
      }
    }
  };

  const runCommand = async (raw: string): Promise<boolean> => {
    const [cmd, ...rest] = raw.split(" ");
    const arg = rest.join(" ").trim();
    const send = (content: string, extra = {}) => actions.sendMessage(channel.id, { content, threadParentId, ...extra });
    switch (cmd.toLowerCase()) {
      case "/poll": {
        const parts = arg.split("|").map((s) => s.trim()).filter(Boolean);
        if (parts.length < 3) { actions.openModal("poll", { channelId: channel.id, question: parts[0] }); return true; }
        await send("", { kind: "poll", poll: { question: parts[0], multi: false, options: parts.slice(1, 11).map((label, i) => ({ id: `o${i}`, label, votes: [] })) } });
        return true;
      }
      case "/trivia": {
        const q = pick(TRIVIA);
        actions.dispatch("message:new", { message: { id: uid("msg"), channelId: channel.id, authorId: ASSISTANT_ID, kind: "trivia", content: "", createdAt: Date.now(), status: "sent", trivia: { question: q.q, choices: q.choices, answer: q.answer, answeredBy: {}, category: q.category } } });
        return true;
      }
      case "/roll": {
        const sides = Math.max(2, Math.min(1000, Number(arg) || 6));
        await send(`🎲 rolled a **${rand(1, sides)}** (d${sides})`);
        return true;
      }
      case "/flip": await send(`🪙 flipped a coin: **${Math.random() < 0.5 ? "Heads" : "Tails"}**`); return true;
      case "/shrug": await send(`${arg} ¯\\_(ツ)_/¯`.trim()); return true;
      case "/tableflip": await send("(╯°□°)╯︵ ┻━┻"); return true;
      case "/spoiler": if (arg) await send(`||${arg}||`); return true;
      case "/me": if (arg) await send(`*${db.users[meId]?.displayName} ${arg}*`); return true;
      case "/nick": if (arg) { actions.updateProfile({ displayName: arg.slice(0, 32) }); actions.toast({ title: `You're now ${arg}` }); } return true;
      case "/status": actions.updateProfile({ customStatus: arg || undefined }); actions.toast({ title: arg ? "Status updated" : "Status cleared" }); return true;
      case "/whiteboard": actions.openModal("whiteboard", { channelId: channel.id }); return true;
      case "/call": actions.startCall(channel.id, "voice"); return true;
      case "/help": actions.openModal("shortcuts"); return true;
      case "/schedule": {
        const m = /^(\d+)\s*(s|m|h)\s+(.+)$/i.exec(arg);
        if (!m) { actions.openModal("schedule", { channelId: channel.id }); return true; }
        const ms = Number(m[1]) * (m[2].toLowerCase() === "s" ? 1000 : m[2].toLowerCase() === "m" ? 60_000 : 3_600_000);
        actions.scheduleMessage(channel.id, m[3], Date.now() + ms);
        return true;
      }
      default:
        return false;
    }
  };

  const submit = async () => {
    const content = text.trim();
    if (!content && !files.length) return;
    if (content.startsWith("/") && !files.length) {
      const handled = await runCommand(content);
      if (handled) { setText(""); return; }
    }
    await actions.sendMessage(channel.id, { content, attachments: files.length ? files : undefined, kind: files.some((f) => f.kind === "image") && !content ? "image" : "text", threadParentId });
    if (sounds) playSound("send");
    setText("");
    setFiles([]);
    setPanel(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % suggestions); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + suggestions) % suggestions); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && (mentionCandidates.length || (slash.length && slash[sel]?.cmd !== text.trim())))) { e.preventDefault(); applySuggestion(sel); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
    if (e.key === "ArrowUp" && !text) {
      const mine = [...(db.messages[channel.id] ?? [])].reverse().find((m) => m.authorId === meId && m.kind === "text" && !m.deletedAt);
      if (mine) { e.preventDefault(); actions.setEditing(mine.id); }
    }
    if (e.key === "Escape") { actions.setReplyTo(undefined); setPanel(null); }
  };

  // ——— voice notes ———
  const startRec = async () => {
    const levels: number[] = [];
    setRec({ start: Date.now(), levels });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;
      const sample = (t: number) => {
        if (t - last > 90) {
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length / 140;
          levels.push(Math.min(1, avg + 0.08));
          setRec((r) => (r ? { ...r, levels: [...levels] } : r));
          last = t;
        }
        recorder.current.raf = requestAnimationFrame(sample);
      };
      recorder.current = { mr, chunks: [], stream, ctx, raf: requestAnimationFrame(sample) };
      mr.ondataavailable = (ev) => recorder.current.chunks.push(ev.data);
      mr.start();
    } catch {
      // no mic / permission denied → simulated recording with a synthetic waveform
      const tick = () => {
        levels.push(0.25 + Math.random() * 0.75);
        setRec((r) => (r ? { ...r, levels: [...levels] } : r));
        recorder.current.raf = window.setTimeout(tick, 110) as unknown as number;
      };
      recorder.current = { chunks: [], raf: window.setTimeout(tick, 110) as unknown as number };
    }
  };

  const stopRec = async (send: boolean) => {
    const r = rec;
    const cur = recorder.current;
    cancelAnimationFrame(cur.raf ?? 0);
    clearTimeout(cur.raf);
    setRec(null);
    if (!r) return;
    const duration = Date.now() - r.start;
    const waveform = compressWave(r.levels, 36);
    const finish = async (url: string, size: number) => {
      if (!send || duration < 500) return;
      await actions.sendMessage(channel.id, { content: "", kind: "voice", threadParentId, attachments: [{ id: uid("att"), kind: "audio", name: "voice-note.webm", size, mime: "audio/webm", url, durationMs: duration, waveform }] });
    };
    if (cur.mr && cur.mr.state !== "inactive") {
      cur.mr.onstop = async () => {
        cur.stream?.getTracks().forEach((t) => t.stop());
        void cur.ctx?.close();
        const blob = new Blob(cur.chunks, { type: "audio/webm" });
        const url = blob.size < 1_500_000 ? await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob); }) : "mock";
        await finish(url, blob.size);
      };
      cur.mr.stop();
    } else {
      await finish("mock", Math.round(duration * 4));
    }
  };

  if (readOnly) {
    return <div className="mx-4 mb-4 rounded-2xl border hairline bg-fg/[0.03] px-4 py-3 text-center text-sm text-muted sm:mx-6">📢 Only admins can post in this announcement channel.</div>;
  }

  return (
    <div
      className={cn("relative px-3 pb-3 sm:px-5 safe-bottom", compact && "px-3 pb-3 sm:px-3")}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer.files); }}
    >
      <AnimatePresence>
        {drag && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-3 bottom-3 top-[-120px] z-20 flex items-center justify-center rounded-3xl border-2 border-dashed border-accent bg-accent/10 text-sm font-semibold text-accent backdrop-blur-sm">
            Drop files to upload to {title}
          </motion.div>
        )}
      </AnimatePresence>

      {/* autocomplete */}
      <AnimatePresence>
        {suggestions > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="glass absolute bottom-full left-3 right-3 z-30 mb-1 overflow-hidden rounded-2xl p-1.5 shadow-glass sm:left-5 sm:right-5">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">{slash.length ? "Commands" : "Members"}</p>
            {slash.length
              ? slash.map((c, i) => (
                  <button key={c.cmd} onMouseEnter={() => setSel(i)} onClick={() => applySuggestion(i)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm", sel === i && "bg-accent/15")}>
                    <span className="font-mono font-semibold text-accent">{c.cmd}</span>
                    <span className="text-muted">{c.hint}</span>
                    <span className="ml-auto text-xs text-muted">{c.desc}</span>
                  </button>
                ))
              : mentionCandidates.map((u, i) => (
                  <button key={u!.id} onMouseEnter={() => setSel(i)} onClick={() => applySuggestion(i)} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-sm", sel === i && "bg-accent/15")}>
                    <Avatar user={u} size={24} showStatus ring="ring-elevated" />
                    <span className="font-medium">{u!.displayName}</span>
                    <span className="text-xs text-muted">@{u!.id === ASSISTANT_ID ? "nova" : u!.username}</span>
                  </button>
                ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn("glass overflow-visible rounded-3xl shadow-glass transition focus-within:border-accent/40", muted && "opacity-70")}>
        <AnimatePresence>
          {replyTo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex items-center gap-2 overflow-hidden border-b hairline px-4 py-2 text-xs text-muted">
              Replying to <b className="text-fg">{db.users[replyTo.authorId]?.displayName}</b>
              <span className="truncate">{replyTo.content}</span>
              <button className="ml-auto rounded-full p-0.5 hover:bg-fg/10" onClick={() => actions.setReplyTo(undefined)}><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {files.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b hairline p-3">
            {files.map((f) => (
              <motion.div key={f.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="group relative shrink-0">
                {f.kind === "image" ? (
                  <img src={f.url} alt={f.name} className="h-24 w-24 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-24 w-40 flex-col justify-end rounded-2xl bg-fg/[0.06] p-2.5">
                    <Paperclip size={18} className="mb-auto text-accent2" />
                    <p className="truncate text-xs font-medium">{f.name}</p>
                    <p className="text-[10px] text-muted">{formatBytes(f.size)}</p>
                  </div>
                )}
                <button onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))} className="absolute -right-1.5 -top-1.5 rounded-full bg-danger p-1 text-white shadow" aria-label="Remove">
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1 p-1.5">
          <div className="relative">
            <button className={cn("icon-btn h-10 w-10 rounded-2xl transition", panel === "plus" && "rotate-45 bg-fg/10 text-fg")} onClick={() => setPanel(panel === "plus" ? null : "plus")} aria-label="More">
              <Plus size={20} />
            </button>
            <AnimatePresence>
              {panel === "plus" && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="glass absolute bottom-full left-0 z-30 mb-2 w-56 rounded-2xl p-1.5 shadow-glass">
                  {[
                    { icon: <ImageIcon size={16} />, label: "Upload image", onClick: () => imageInput.current?.click() },
                    { icon: <Paperclip size={16} />, label: "Upload file", onClick: () => fileInput.current?.click() },
                    { icon: <BarChart3 size={16} />, label: "Create poll", onClick: () => actions.openModal("poll", { channelId: channel.id }) },
                    { icon: <span className="text-sm">🧠</span>, label: "Start trivia", onClick: () => void runCommand("/trivia") },
                    { icon: <PenTool size={16} />, label: "Shared whiteboard", onClick: () => actions.openModal("whiteboard", { channelId: channel.id }) },
                    { icon: <Sticker size={16} />, label: "Make a meme", onClick: () => actions.openModal("meme", { channelId: channel.id }) },
                    { icon: <Clock size={16} />, label: "Schedule message", onClick: () => actions.openModal("schedule", { channelId: channel.id, text }) },
                  ].map((i) => (
                    <button key={i.label} onClick={() => { i.onClick(); setPanel(null); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-fg/10">
                      <span className="text-muted">{i.icon}</span> {i.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {rec ? (
            <div className="flex min-h-[40px] flex-1 items-center gap-3 px-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
              <span className="w-10 text-sm tabular-nums text-danger">{formatDuration(Date.now() - rec.start)}</span>
              <div className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden">
                {rec.levels.slice(-60).map((v, i) => <span key={i} className="w-[3px] shrink-0 rounded-full bg-accent" style={{ height: `${Math.max(10, v * 100)}%` }} />)}
              </div>
              <button className="icon-btn text-danger" onClick={() => stopRec(false)} aria-label="Cancel recording"><Trash2 size={18} /></button>
            </div>
          ) : (
            <textarea
              ref={ta}
              rows={1}
              value={text}
              disabled={muted}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); void addFiles(e.clipboardData.files); } }}
              placeholder={muted ? "You are muted" : threadParentId ? "Reply in thread…" : `Message ${channel.kind === "dm" ? "@" : channel.kind === "group-dm" ? "" : "#"}${title}`}
              className="scroll-thin max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-muted/70"
            />
          )}

          {!rec && (
            <>
              <div className="relative hidden sm:block">
                <button className={cn("icon-btn h-10 w-10 rounded-2xl", panel === "gif" && "bg-fg/10 text-fg")} onClick={() => setPanel(panel === "gif" ? null : "gif")} aria-label="GIFs and stickers">
                  <span className="rounded-md border-2 border-current px-0.5 text-[9px] font-black leading-none">GIF</span>
                </button>
                <AnimatePresence>
                  {panel === "gif" && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-full right-0 z-30 mb-2">
                      <GifPicker
                        onGif={(gif) => { void actions.sendMessage(channel.id, { content: gif.title, kind: "gif", gif, threadParentId }); setPanel(null); }}
                        onSticker={(sticker) => { void actions.sendMessage(channel.id, { content: "", kind: "sticker", sticker, threadParentId }); setPanel(null); }}
                        onMeme={() => { actions.openModal("meme", { channelId: channel.id }); setPanel(null); }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <button className={cn("icon-btn h-10 w-10 rounded-2xl", panel === "emoji" && "bg-fg/10 text-fg")} onClick={() => setPanel(panel === "emoji" ? null : "emoji")} aria-label="Emoji">
                  <Smile size={20} />
                </button>
                <AnimatePresence>
                  {panel === "emoji" && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-full right-0 z-30 mb-2">
                      <EmojiPicker custom={server?.customEmojis} onPick={(e) => { setText((t) => t + e); ta.current?.focus(); }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {text.trim() || files.length ? (
            <motion.button initial={{ scale: 0.6, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} whileTap={{ scale: 0.85 }} onClick={() => void submit()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent2 text-white shadow-glow" aria-label="Send">
              <Send size={18} />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => (rec ? void stopRec(true) : void startRec())}
              className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition", rec ? "bg-danger text-white shadow-[0_0_0_6px_rgb(var(--danger)/0.2)]" : "text-muted hover:bg-fg/10 hover:text-fg")}
              aria-label={rec ? "Send voice note" : "Record voice note"}
            >
              {rec ? <Send size={18} /> : <Mic size={20} />}
            </motion.button>
          )}
        </div>
      </div>
      <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

function compressWave(levels: number[], n: number): number[] {
  if (!levels.length) return Array.from({ length: n }, () => 0.3 + Math.random() * 0.6);
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i / n) * levels.length);
    const b = Math.max(a + 1, Math.floor(((i + 1) / n) * levels.length));
    const slice = levels.slice(a, b);
    return slice.reduce((x, y) => x + y, 0) / slice.length || 0.2;
  });
}
