"use client";

import { useEffect } from "react";
import { useStore, onEvent, channelTitle } from "@/lib/store";
import type { EventPayloads } from "@/lib/store/reducer";
import { electLeader, getTransport } from "@/lib/transport";
import { startSimulation } from "@/lib/sim/engine";
import { hexToRgbTriplet } from "@/lib/utils";
import { Toaster } from "./ui/Toaster";
import { playSound } from "@/lib/sounds";

/** Boots the app: hydrate storage, apply theme, connect realtime, elect the sim leader. */
export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useStore((s) => s.theme);

  // hydrate persisted state once on the client
  useEffect(() => {
    void useStore.persist.rehydrate();
  }, []);

  // theme → <html> attributes and CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme.mode === "dark" || (theme.mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    root.style.setProperty("--accent", hexToRgbTriplet(theme.accent));
    root.style.setProperty("--accent2", hexToRgbTriplet(theme.accent2));
    root.style.setProperty("--font-scale", String(theme.fontScale));
    root.dataset.glass = String(theme.glass);
    root.dataset.motion = theme.reducedMotion ? "reduced" : "full";
    root.dataset.density = theme.density;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // realtime: remote events → store; one tab runs the bots
  useEffect(() => {
    const t = getTransport();
    const unsub = t.subscribe((ev) => useStore.getState().receive(ev));
    const stopLeader = electLeader(() => startSimulation());
    const bye = () => {
      const s = useStore.getState();
      if (s.sessionUserId) s.dispatch("presence", { userId: s.sessionUserId, status: "offline", lastSeen: Date.now() });
    };
    addEventListener("pagehide", bye);
    return () => {
      unsub();
      stopLeader();
      removeEventListener("pagehide", bye);
    };
  }, []);

  // per-tab effects for the signed-in user: receipts, notifications, sounds
  useEffect(() => {
    return onEvent((ev, local) => {
      const s = useStore.getState();
      const meId = s.sessionUserId;
      if (!meId) return;
      if (ev.type === "message:new") {
        const { message: m } = ev.payload as EventPayloads["message:new"];
        if (m.authorId === meId || m.kind === "system") return;
        const ch = s.db.channels[m.channelId];
        if (!ch) return;
        const isMember = ch.memberIds ? ch.memberIds.includes(meId) : !!(ch.serverId && s.db.servers[ch.serverId]?.memberIds.includes(meId));
        if (!isMember) return;
        const author = s.db.users[m.authorId];
        const viewing = s.activeChannelId === m.channelId && document.visibilityState === "visible";
        // human → human receipts (bots' receipts are produced by the simulation)
        if (!author?.isBot && !local) {
          s.dispatch("message:update", { channelId: m.channelId, id: m.id, patch: { status: viewing ? "read" : "delivered", readBy: viewing ? [meId] : [] } });
        }
        if (viewing) {
          s.markRead(m.channelId);
          return;
        }
        const isDm = ch.kind === "dm" || ch.kind === "group-dm";
        const mentioned = m.mentions?.includes(meId) || m.replyToId && s.db.messages[m.channelId]?.find((x) => x.id === m.replyToId)?.authorId === meId;
        if (isDm || mentioned) {
          const title = isDm ? author?.displayName ?? "New message" : `${author?.displayName} in #${channelTitle(s.db, ch, meId)}`;
          const body = m.kind === "gif" ? "sent a GIF" : m.kind === "voice" ? "🎙️ Voice message" : m.attachments?.length ? "📎 Attachment" : m.content.replace(/[*_`#>|~]/g, "").slice(0, 120);
          s.notify({ title, body, channelId: m.channelId, kind: mentioned ? "mention" : "message", icon: mentioned ? "@" : "💬" });
          s.toast({ title, body, channelId: m.channelId, icon: author?.displayName?.[0] });
          if (s.sounds) playSound(mentioned ? "mention" : "message");
          if (s.desktopNotifications && document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body, tag: m.channelId });
          }
        }
      }
      if (ev.type === "friend:update") {
        const p = ev.payload as EventPayloads["friend:update"];
        if (p.to !== meId || local) return;
        const who = s.db.users[p.from]?.displayName ?? "Someone";
        if (p.state === "outgoing") {
          s.notify({ title: "Friend request", body: `${who} wants to be friends`, kind: "friend", icon: "🤝" });
          s.toast({ title: "New friend request", body: who, icon: "🤝" });
          if (s.sounds) playSound("friend");
        } else if (p.state === "friends") {
          s.notify({ title: "Friend request accepted", body: `You and ${who} are now friends`, kind: "friend", icon: "🎉" });
          s.toast({ title: `${who} accepted your request`, tone: "success", icon: "🎉" });
          s.awardXp(15, "New friend");
        }
      }
    });
  }, []);

  // scheduled messages for this tab's user
  useEffect(() => {
    const t = setInterval(() => {
      const s = useStore.getState();
      const me = s.sessionUserId;
      if (!me) return;
      const due = s.db.scheduled.filter((x) => x.authorId === me && x.sendAt <= Date.now());
      due.forEach((d) => {
        s.cancelScheduled(d.id);
        void s.sendMessage(d.channelId, { content: d.content });
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
