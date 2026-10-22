"use client";

import { motion } from "framer-motion";
import { Maximize2, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, ScreenShare, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { channelTitle, useStore } from "@/lib/store";
import { cn, formatDuration, pick } from "@/lib/utils";
import { Avatar } from "../ui/Avatar";

// Voice / video / screen-share call UI. Your own camera and screen use real
// getUserMedia / getDisplayMedia streams when permitted; other participants
// are simulated with animated tiles and voice-activity detection.

export function CallOverlay() {
  const call = useStore((s) => s.call)!;
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const { updateCall, endCall } = useStore.getState();
  const [now, setNow] = useState(Date.now());
  const [min, setMin] = useState(false);
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const camRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const channel = db.channels[call.channelId];

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    // simulated voice activity
    const v = setInterval(() => {
      const others = useStore.getState().call?.participants.filter((p) => p !== meId) ?? [];
      updateCall({ speakingId: Math.random() < 0.7 && others.length ? pick(others) : undefined });
    }, 1400);
    return () => { clearInterval(t); clearInterval(v); };
  }, [meId, updateCall]);

  useEffect(() => {
    let cancelled = false;
    if (call.camera && !camStream && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true }).then((s) => (cancelled ? s.getTracks().forEach((t) => t.stop()) : setCamStream(s))).catch(() => undefined);
    }
    if (!call.camera && camStream) { camStream.getTracks().forEach((t) => t.stop()); setCamStream(null); }
    return () => { cancelled = true; };
  }, [call.camera]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (camRef.current) camRef.current.srcObject = camStream; }, [camStream, min]);
  useEffect(() => { if (screenRef.current) screenRef.current.srcObject = screenStream; }, [screenStream, min]);
  useEffect(() => () => { camStream?.getTracks().forEach((t) => t.stop()); screenStream?.getTracks().forEach((t) => t.stop()); }, [camStream, screenStream]);

  const toggleScreen = async () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      updateCall({ screen: false });
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      s.getVideoTracks()[0].addEventListener("ended", () => { setScreenStream(null); updateCall({ screen: false }); });
      setScreenStream(s);
    } catch { /* simulated share */ }
    updateCall({ screen: true });
  };

  const hangUp = () => {
    camStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    endCall();
  };

  const title = channel ? channelTitle(db, channel, meId) : "Call";
  const elapsed = formatDuration(now - call.startedAt);

  const controls = (
    <div className="flex items-center justify-center gap-2">
      <CtlBtn on={!call.muted} onClick={() => updateCall({ muted: !call.muted })} label={call.muted ? "Unmute" : "Mute"}>{call.muted ? <MicOff size={20} /> : <Mic size={20} />}</CtlBtn>
      <CtlBtn on={call.camera} onClick={() => updateCall({ camera: !call.camera })} label="Camera">{call.camera ? <Video size={20} /> : <VideoOff size={20} />}</CtlBtn>
      <CtlBtn on={call.screen} onClick={toggleScreen} label="Share screen" accent>{call.screen ? <ScreenShare size={20} /> : <MonitorUp size={20} />}</CtlBtn>
      <button onClick={hangUp} className="flex h-12 w-14 items-center justify-center rounded-2xl bg-danger text-white shadow-lg transition hover:brightness-110 active:scale-95" aria-label="Leave call"><PhoneOff size={20} /></button>
    </div>
  );

  if (min) {
    return (
      <motion.div drag dragMomentum={false} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="glass fixed bottom-24 right-4 z-50 w-72 cursor-grab rounded-3xl p-3 shadow-glass active:cursor-grabbing">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />
          <p className="flex-1 truncate text-sm font-semibold">{title}</p>
          <span className="text-xs tabular-nums text-muted">{elapsed}</span>
          <button className="icon-btn h-7 w-7" onClick={() => setMin(false)} aria-label="Expand"><Maximize2 size={14} /></button>
        </div>
        <div className="mb-3 flex -space-x-2">{call.participants.slice(0, 6).map((p) => <Avatar key={p} user={db.users[p]} size={32} speaking={call.speakingId === p} className="rounded-full ring-2 ring-surface" />)}</div>
        <div className="scale-90">{controls}</div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex flex-col bg-[#07070d]/95 text-white backdrop-blur-xl safe-top safe-bottom">
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ok" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold">{call.kind === "video" ? "Video call" : "Voice"} · {title}</p>
          <p className="text-xs text-white/60">{elapsed} · {call.participants.length} participants · 🔒 encrypted (simulated)</p>
        </div>
        <button className="icon-btn text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setMin(true)} aria-label="Minimize"><Minimize2 size={18} /></button>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 px-4 pb-4">
        {call.screen && (
          <div className="relative hidden flex-[2] overflow-hidden rounded-3xl bg-black ring-1 ring-white/10 md:block">
            {screenStream ? (
              <video ref={screenRef} autoPlay muted playsInline className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,#1e1b4b,#0e7490)]">
                <ScreenShare size={56} className="opacity-70" />
                <p className="text-sm text-white/70">You are sharing your screen (simulated)</p>
              </div>
            )}
            <span className="absolute left-3 top-3 rounded-lg bg-danger px-2 py-0.5 text-xs font-bold">LIVE</span>
          </div>
        )}
        <div className={cn("grid min-h-0 flex-1 auto-rows-fr gap-3", call.participants.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : call.participants.length <= 4 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3")}>
          {call.participants.map((p) => {
            const u = db.users[p];
            const isMe = p === meId;
            const speaking = call.speakingId === p && !(isMe && call.muted);
            return (
              <motion.div layout key={p} className={cn("relative flex items-center justify-center overflow-hidden rounded-3xl ring-2 transition", speaking ? "ring-ok" : "ring-white/5")} style={{ background: `radial-gradient(circle at 50% 40%, ${u?.avatarColor}55, #111118 70%)` }}>
                {isMe && camStream ? (
                  <video ref={camRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
                ) : (
                  <motion.div animate={speaking ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ repeat: speaking ? Infinity : 0, duration: 0.9 }}>
                    <Avatar user={u} size={88} speaking={speaking} />
                  </motion.div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-xl bg-black/50 px-2.5 py-1 text-xs font-semibold backdrop-blur">
                  {isMe && call.muted && <MicOff size={12} className="text-danger" />}
                  {u?.displayName}{isMe && " (you)"}
                </div>
                {speaking && (
                  <div className="absolute right-3 top-3 flex h-4 items-end gap-0.5">
                    {[0, 1, 2, 3].map((i) => <span key={i} className="w-1 animate-wave rounded-full bg-ok" style={{ height: "100%", animationDelay: `${i * 0.12}s` }} />)}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
      <div className="pb-6">{controls}</div>
    </motion.div>
  );
}

function CtlBtn({ on, onClick, children, label, accent }: { on: boolean; onClick: () => void; children: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={cn("flex h-12 w-12 items-center justify-center rounded-2xl transition active:scale-95", on ? (accent ? "bg-accent text-white" : "bg-white/15 text-white hover:bg-white/25") : "bg-white text-black hover:bg-white/90")}>
      {children}
    </button>
  );
}
