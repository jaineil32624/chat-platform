"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ban, MessageCircle, Phone, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import { useIsAdmin, useStore } from "@/lib/store";
import { BADGES, levelProgress, reputationTier } from "@/lib/gamification";
import { ACHIEVEMENTS } from "@/lib/gamification";
import { dmChannelId } from "@/lib/store/reducer";
import { relativeTime } from "@/lib/utils";
import { Avatar, STATUS_LABEL } from "../ui/Avatar";

export function ProfileCard() {
  const userId = useStore((s) => s.profileUserId);
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const actions = useStore.getState();
  const isAdmin = useIsAdmin();
  const u = userId ? db.users[userId] : undefined;
  const rel = u ? db.friends[meId]?.[u.id] : undefined;
  const isMe = u?.id === meId;
  const stats = u ? db.stats[u.id] : undefined;
  const mutual = u ? Object.values(db.servers).filter((s) => s.memberIds.includes(meId) && s.memberIds.includes(u.id)) : [];
  const lp = u ? levelProgress(u.xp) : undefined;
  const tier = u ? reputationTier(u.reputation) : undefined;

  return (
    <AnimatePresence>
      {u && lp && tier && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => actions.showProfile(undefined)} />
          <motion.div
            initial={{ y: 40, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-surface shadow-glass sm:rounded-3xl"
          >
            <div className="relative h-28" style={{ background: `linear-gradient(135deg, ${u.bannerColor}, ${u.avatarColor})` }}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(255,255,255,0.35),transparent_50%)]" />
              <button onClick={() => actions.showProfile(undefined)} className="absolute right-3 top-3 rounded-full bg-black/30 p-1.5 text-white backdrop-blur hover:bg-black/50" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="px-6 pb-6">
              <div className="-mt-12 flex items-end justify-between">
                <div className="rounded-full ring-[6px] ring-surface"><Avatar user={u} size={92} showStatus ring="ring-surface" /></div>
                <div className="flex flex-wrap justify-end gap-1">
                  {u.badges.map((b) => BADGES[b] && (
                    <span key={b} title={`${BADGES[b].label} — ${BADGES[b].description}`} className="flex h-8 w-8 items-center justify-center rounded-xl bg-fg/[0.07] text-base transition hover:scale-110">{BADGES[b].emoji}</span>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
                  {u.displayName}
                  {u.isBot && <span className="rounded bg-accent px-1.5 text-[10px] font-bold text-white">{u.id === "bot_nova" ? "AI" : "BOT"}</span>}
                </h2>
                <p className="text-sm text-muted">@{u.username}{u.pronouns ? ` · ${u.pronouns}` : ""}</p>
                {u.customStatus && <p className="mt-2 text-sm">{u.customStatus}</p>}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-fg/[0.05] p-2.5">
                  <p className="font-display text-xl font-bold gradient-text">{lp.level}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Level</p>
                </div>
                <div className="rounded-2xl bg-fg/[0.05] p-2.5">
                  <p className="font-display text-xl font-bold" style={{ color: tier.color }}>{u.reputation}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{tier.name}</p>
                </div>
                <div className="rounded-2xl bg-fg/[0.05] p-2.5">
                  <p className="font-display text-xl font-bold">{stats?.streak ?? Math.floor(u.xp / 900)}🔥</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Streak</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/10">
                <motion.div className="h-full bg-gradient-to-r from-accent to-accent2" initial={{ width: 0 }} animate={{ width: `${lp.pct * 100}%` }} transition={{ duration: 0.8 }} />
              </div>
              <p className="mt-1 text-right text-[10px] text-muted">{lp.current} / {lp.needed} XP to level {lp.level + 1}</p>

              <div className="mt-4 space-y-3 rounded-2xl bg-bg/60 p-4 text-sm">
                {u.bio && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">About me</p>
                    <p className="mt-1">{u.bio}</p>
                  </div>
                )}
                <div className="flex gap-6">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Member since</p>
                    <p className="mt-1">{new Date(u.joinedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Status</p>
                    <p className="mt-1">{u.status === "offline" ? `Last seen ${relativeTime(u.lastSeen)}` : STATUS_LABEL[u.status]}</p>
                  </div>
                </div>
                {!!u.interests?.length && (
                  <div className="flex flex-wrap gap-1.5">{u.interests.map((i) => <span key={i} className="chip">#{i}</span>)}</div>
                )}
                {!isMe && mutual.length > 0 && (
                  <p className="text-xs text-muted">{mutual.length} mutual server{mutual.length > 1 ? "s" : ""}: {mutual.map((s) => s.icon).join(" ")}</p>
                )}
                {isMe && stats && (
                  <p className="text-xs text-muted">{stats.messages} messages · {stats.achievements.length}/{ACHIEVEMENTS.length} achievements</p>
                )}
              </div>

              {!isMe ? (
                <div className="mt-4 flex gap-2">
                  <button className="btn-primary flex-1" onClick={() => actions.openDm(u.id)}><MessageCircle size={16} /> Message</button>
                  <button className="btn-soft" onClick={() => { actions.openDm(u.id); setTimeout(() => actions.startCall(dmChannelId(meId, u.id), "voice"), 50); }} aria-label="Call"><Phone size={16} /></button>
                  {rel === "friends" ? (
                    <button className="btn-soft" onClick={() => actions.removeFriend(u.id)} title="Remove friend"><UserMinus size={16} /></button>
                  ) : rel === "outgoing" ? (
                    <button className="btn-soft" disabled title="Request sent"><UserCheck size={16} /></button>
                  ) : (
                    <button className="btn-soft" onClick={() => actions.sendFriendRequest(u.id)} title={rel === "incoming" ? "Accept friend request" : "Add friend"}><UserPlus size={16} /></button>
                  )}
                  {isAdmin && u.id !== "bot_nova" && (
                    <button className="btn-soft text-danger" onClick={() => { actions.moderate(u.id, "mute", "Muted from profile", 10 * 60_000); }} title="Mute 10 min"><Ban size={16} /></button>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <button className="btn-primary flex-1" onClick={() => { actions.showProfile(undefined); actions.openModal("settings"); }}>Edit profile</button>
                  <button className="btn-soft" onClick={() => { actions.showProfile(undefined); actions.openModal("achievements"); }}>🏆 Achievements</button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
