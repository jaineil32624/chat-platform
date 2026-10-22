"use client";

import { Download, FileText, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BUILTIN_GIFS } from "@/lib/content";
import type { Attachment, Message } from "@/lib/types";
import { cn, formatBytes, formatDuration } from "@/lib/utils";

export function GifTile({ gif, size = "md", onClick }: { gif: NonNullable<Message["gif"]>; size?: "sm" | "md"; onClick?: () => void }) {
  const def = BUILTIN_GIFS.find((g) => g.id === gif.id);
  if (gif.url) {
    return <img src={gif.url} alt={gif.title} onClick={onClick} className={cn("rounded-2xl object-cover", size === "sm" ? "h-24 w-full" : "max-h-64 max-w-xs")} />;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br bg-[length:200%_200%] animate-gradient",
        gif.gradient ?? def?.gradient,
        size === "sm" ? "h-24 w-full" : "h-44 w-64",
      )}
      aria-label={gif.title}
    >
      <span className={cn("drop-shadow-xl", size === "sm" ? "text-4xl" : "text-7xl", `gif-${def?.motion ?? "bounce"}`)}>{gif.emoji ?? def?.emoji}</span>
      <span className="absolute bottom-1.5 left-2 rounded-md bg-black/40 px-1.5 text-[10px] font-bold uppercase tracking-wider text-white">GIF</span>
      {size === "md" && <span className="absolute bottom-1.5 right-2 text-xs font-semibold text-white/90 drop-shadow">{gif.title}</span>}
    </button>
  );
}

export function VoicePlayer({ att, mine }: { att: Attachment; mine?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const raf = useRef<number>(0);
  const waveform = att.waveform ?? Array.from({ length: 36 }, (_, i) => 0.3 + Math.abs(Math.sin(i * 1.7)) * 0.7);
  const duration = att.durationMs ?? 4000;
  const simulated = !att.url || att.url === "mock";

  useEffect(() => () => { cancelAnimationFrame(raf.current); audio.current?.pause(); }, []);

  const toggle = () => {
    if (playing) {
      audio.current?.pause();
      cancelAnimationFrame(raf.current);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    const start = performance.now() - progress * duration;
    if (!simulated) {
      audio.current ??= new Audio(att.url);
      audio.current.currentTime = (progress * duration) / 1000;
      void audio.current.play().catch(() => undefined);
    }
    const tick = () => {
      const p = simulated ? (performance.now() - start) / duration : (audio.current!.currentTime * 1000) / duration;
      if (p >= 1) {
        setProgress(0);
        setPlaying(false);
        return;
      }
      setProgress(p);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <div className={cn("flex w-72 max-w-full items-center gap-3 rounded-2xl px-3 py-2.5", mine ? "bg-accent/20" : "bg-fg/[0.06]")}>
      <button onClick={toggle} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-white shadow-glow active:scale-90" aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex h-8 flex-1 items-center gap-[2px]">
        {waveform.map((v, i) => (
          <span key={i} className={cn("w-[3px] rounded-full transition-colors", i / waveform.length < progress ? "bg-accent" : "bg-fg/25")} style={{ height: `${Math.max(12, v * 100)}%` }} />
        ))}
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-muted">{formatDuration(playing ? progress * duration : duration)}</span>
    </div>
  );
}

export function AttachmentView({ att, mine, onOpenImage }: { att: Attachment; mine?: boolean; onOpenImage?: (url: string) => void }) {
  if (att.kind === "image") {
    return (
      <button onClick={() => onOpenImage?.(att.url)} className="group relative block overflow-hidden rounded-2xl border hairline">
        <img src={att.url} alt={att.name} className="max-h-80 max-w-full object-cover transition duration-300 group-hover:scale-[1.02] sm:max-w-sm" style={att.width ? { aspectRatio: `${att.width}/${att.height}` } : undefined} />
      </button>
    );
  }
  if (att.kind === "audio") return <VoicePlayer att={att} mine={mine} />;
  return (
    <div className="flex w-72 max-w-full items-center gap-3 rounded-2xl border hairline bg-fg/[0.04] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent2/15 text-accent2">
        <FileText size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-accent2">{att.name}</p>
        <p className="text-xs text-muted">{formatBytes(att.size)}</p>
      </div>
      <a href={att.url} download={att.name} className="icon-btn" aria-label="Download">
        <Download size={17} />
      </a>
    </div>
  );
}
