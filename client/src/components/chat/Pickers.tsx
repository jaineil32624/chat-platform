"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BUILTIN_GIFS, EMOJI_CATEGORIES, STICKER_PACKS } from "@/lib/content";
import type { CustomEmoji, Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GifTile } from "./Media";

const RECENT_KEY = "pulse-recent-emoji";
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
};

export function EmojiPicker({ onPick, custom }: { onPick: (e: string) => void; custom?: CustomEmoji[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);

  const pick = (e: string) => {
    const next = [e, ...recent.filter((x) => x !== e)].slice(0, 16);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    onPick(e);
  };

  const all = useMemo(() => EMOJI_CATEGORIES.flatMap((c) => c.emojis), []);
  const list = q ? all.filter((e) => EMOJI_CATEGORIES.some((c) => c.name.toLowerCase().includes(q.toLowerCase()) && c.emojis.includes(e))) : EMOJI_CATEGORIES[cat].emojis;

  return (
    <div className="glass w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl p-2 shadow-glass" onClick={(e) => e.stopPropagation()}>
      <label className="mb-2 flex items-center gap-2 rounded-xl bg-bg/70 px-3 py-1.5 text-sm">
        <Search size={14} className="text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories…" className="w-full bg-transparent outline-none" />
      </label>
      {!q && (
        <div className="mb-1 flex gap-0.5">
          {EMOJI_CATEGORIES.map((c, i) => (
            <button key={c.name} onClick={() => setCat(i)} title={c.name} className={cn("flex h-8 flex-1 items-center justify-center rounded-lg text-base transition", cat === i ? "bg-accent/20" : "hover:bg-fg/10")}>{c.icon}</button>
          ))}
        </div>
      )}
      <div className="scroll-thin h-56 overflow-y-auto">
        {!q && recent.length > 0 && cat === 0 && (
          <>
            <p className="px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">Recent</p>
            <div className="grid grid-cols-8">
              {recent.map((e) => <EmojiBtn key={`r${e}`} e={e} onClick={() => pick(e)} />)}
            </div>
          </>
        )}
        {!q && custom?.length ? (
          <>
            <p className="px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">Server emoji</p>
            <div className="grid grid-cols-8">
              {custom.map((c) => <EmojiBtn key={c.id} e={c.glyph} title={`:${c.name}:`} onClick={() => pick(c.glyph)} />)}
            </div>
          </>
        ) : null}
        <p className="px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">{q ? "Results" : EMOJI_CATEGORIES[cat].name}</p>
        <div className="grid grid-cols-8">
          {list.map((e, i) => <EmojiBtn key={`${e}${i}`} e={e} onClick={() => pick(e)} />)}
        </div>
      </div>
    </div>
  );
}

function EmojiBtn({ e, onClick, title }: { e: string; onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="flex h-9 items-center justify-center rounded-lg text-xl transition hover:scale-125 hover:bg-fg/10">
      {e}
    </button>
  );
}

interface GiphyItem { id: string; title: string; images: { fixed_height: { url: string } } }

export function GifPicker({ onGif, onSticker, onMeme }: { onGif: (g: NonNullable<Message["gif"]>) => void; onSticker: (s: string) => void; onMeme: () => void }) {
  const [tab, setTab] = useState<"gifs" | "stickers">("gifs");
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<GiphyItem[]>([]);
  const key = process.env.NEXT_PUBLIC_GIPHY_KEY;

  useEffect(() => {
    if (!key || !q) return setRemote([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=12&rating=g`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setRemote(d.data ?? []))
        .catch(() => undefined);
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, key]);

  const builtin = BUILTIN_GIFS.filter((g) => !q || g.title.toLowerCase().includes(q.toLowerCase()) || g.tags.some((t) => t.includes(q.toLowerCase())));

  return (
    <div className="glass w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl p-2 shadow-glass">
      <div className="mb-2 flex gap-1">
        {(["gifs", "stickers"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("flex-1 rounded-lg py-1.5 text-sm font-semibold capitalize", tab === t ? "bg-accent/20 text-fg" : "text-muted hover:bg-fg/10")}>{t}</button>
        ))}
        <button onClick={onMeme} className="flex-1 rounded-lg py-1.5 text-sm font-semibold text-muted hover:bg-fg/10">Meme ✨</button>
      </div>
      {tab === "gifs" ? (
        <>
          <label className="mb-2 flex items-center gap-2 rounded-xl bg-bg/70 px-3 py-1.5 text-sm">
            <Search size={14} className="text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs (party, lol, gg…)" className="w-full bg-transparent outline-none" />
          </label>
          <div className="scroll-thin grid h-64 grid-cols-2 gap-2 overflow-y-auto">
            {remote.map((r) => (
              <button key={r.id} onClick={() => onGif({ id: r.id, title: r.title, url: r.images.fixed_height.url })} className="overflow-hidden rounded-xl">
                <img src={r.images.fixed_height.url} alt={r.title} className="h-24 w-full object-cover" />
              </button>
            ))}
            {builtin.map((g) => (
              <GifTile key={g.id} size="sm" gif={{ id: g.id, title: g.title, emoji: g.emoji, gradient: g.gradient }} onClick={() => onGif({ id: g.id, title: g.title, emoji: g.emoji, gradient: g.gradient })} />
            ))}
          </div>
        </>
      ) : (
        <div className="scroll-thin h-72 overflow-y-auto">
          {STICKER_PACKS.map((p) => (
            <div key={p.name}>
              <p className="px-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">{p.name}</p>
              <div className="grid grid-cols-4 gap-1">
                {p.stickers.map((s) => (
                  <button key={s} onClick={() => onSticker(s)} className="flex h-16 items-center justify-center rounded-xl text-4xl transition hover:scale-110 hover:bg-fg/10">{s}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
