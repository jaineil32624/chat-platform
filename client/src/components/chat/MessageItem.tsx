"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark, Check, CheckCheck, Clock, Copy, Flag, Languages, Lock, MessageSquareText, MoreHorizontal, Pencil, Pin, Reply, SmilePlus, Trash2,
} from "lucide-react";
import { memo, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { can, Perm, topRole } from "@/lib/permissions";
import { isJumboEmoji, renderMarkdown } from "@/lib/markdown";
import type { Channel, Message, Server } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { translate, LANGUAGES } from "@/lib/translate";
import { QUICK_REACTIONS } from "@/lib/content";
import { BADGES } from "@/lib/gamification";
import { Avatar } from "../ui/Avatar";
import { AttachmentView, GifTile } from "./Media";
import { PollCard, TriviaCard } from "./Interactive";
import { EmojiPicker } from "./Pickers";

function StatusTicks({ status }: { status: Message["status"] }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
        className={cn("inline-flex items-center", status === "read" ? "text-accent2" : "text-muted")}
        title={status[0].toUpperCase() + status.slice(1)}
      >
        {status === "sending" ? <Clock size={13} /> : status === "sent" ? <Check size={14} /> : <CheckCheck size={14} />}
      </motion.span>
    </AnimatePresence>
  );
}

interface Props {
  message: Message;
  grouped: boolean;
  channel: Channel;
  server?: Server;
  inThread?: boolean;
}

export const MessageItem = memo(function MessageItem({ message: m, grouped, channel, server, inThread }: Props) {
  const users = useStore((s) => s.db.users);
  const channelMessages = useStore((s) => s.db.messages[m.channelId]);
  const savedList = useStore((s) => s.db.saved[s.sessionUserId ?? ""]);
  const meId = useStore((s) => s.sessionUserId)!;
  const editingId = useStore((s) => s.editingId);
  const jumpToId = useStore((s) => s.jumpToId);
  const apiKey = useStore((s) => s.apiKey);
  const actions = useStore.getState();
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showCipher, setShowCipher] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [editText, setEditText] = useState(m.content);
  const ref = useRef<HTMLDivElement>(null);

  const author = users[m.authorId];
  const mine = m.authorId === meId;
  const me = users[meId];
  const role = topRole(server, m.authorId);
  const canManage = can(server, meId, Perm.MANAGE_MESSAGES);
  const canPin = can(server, meId, Perm.PIN_MESSAGES) || !server;
  const replyTo = m.replyToId ? channelMessages?.find((x) => x.id === m.replyToId) : undefined;
  const threadCount = useMemo(() => (inThread ? 0 : (channelMessages ?? []).filter((x) => x.threadParentId === m.id).length), [channelMessages, m.id, inThread]);
  const saved = (savedList ?? []).includes(`${m.channelId}::${m.id}`);
  const lang = me?.language && me.language !== "en" ? me.language : "es";
  const html = useMemo(() => renderMarkdown(m.translated?.[lang] ?? m.content, { users, emojis: server?.customEmojis }), [m.content, m.translated, lang, users, server?.customEmojis]);
  const jumbo = m.kind === "text" && isJumboEmoji(m.content);
  const editing = editingId === m.id;

  if (m.kind === "system" || m.kind === "call") {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-4 py-1.5 text-sm text-muted sm:px-6">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fg/[0.07] text-xs">{m.kind === "call" ? "📞" : "✨"}</span>
        <span className="md" dangerouslySetInnerHTML={{ __html: html }} />
        <span className="text-[11px]">{formatTime(m.createdAt)}</span>
      </motion.div>
    );
  }

  const onContentClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.dataset.spoiler !== undefined) t.classList.toggle("revealed");
    if (t.dataset.user) actions.showProfile(t.dataset.user);
  };

  const doTranslate = async () => {
    setMenu(false);
    if (m.translated?.[lang]) {
      actions.dispatch("message:update", { channelId: m.channelId, id: m.id, patch: { translated: {} } }, { local: true });
      return;
    }
    setTranslating(true);
    try {
      const t = await translate(m.content, lang, apiKey);
      actions.dispatch("message:update", { channelId: m.channelId, id: m.id, patch: { translated: { [lang]: t } } }, { local: true });
    } finally {
      setTranslating(false);
    }
  };

  const toolbar = [
    { icon: <SmilePlus size={16} />, label: "React", onClick: () => setPicker((p) => !p) },
    { icon: <Reply size={16} />, label: "Reply", onClick: () => actions.setReplyTo(m.id) },
    ...(!inThread ? [{ icon: <MessageSquareText size={16} />, label: "Thread", onClick: () => actions.openThread(m.id) }] : []),
    ...(mine && m.kind === "text" ? [{ icon: <Pencil size={16} />, label: "Edit", onClick: () => { setEditText(m.content); actions.setEditing(m.id); } }] : []),
    { icon: <MoreHorizontal size={16} />, label: "More", onClick: () => setMenu((x) => !x) },
  ];

  const menuItems = [
    { icon: <Languages size={15} />, label: m.translated?.[lang] ? "Show original" : `Translate to ${LANGUAGES[lang] ?? lang}`, onClick: doTranslate },
    ...(canPin ? [{ icon: <Pin size={15} />, label: m.pinned ? "Unpin" : "Pin message", onClick: () => actions.togglePin(m.channelId, m.id) }] : []),
    { icon: <Bookmark size={15} />, label: saved ? "Remove from saved" : "Save message", onClick: () => actions.toggleSave(m.channelId, m.id) },
    { icon: <Copy size={15} />, label: "Copy text", onClick: () => navigator.clipboard?.writeText(m.content) },
    ...(m.ciphertext ? [{ icon: <Lock size={15} />, label: showCipher ? "Hide ciphertext" : "View ciphertext", onClick: () => setShowCipher((x) => !x) }] : []),
    ...(!mine ? [{ icon: <Flag size={15} />, label: "Report", onClick: () => actions.reportMessage(m.channelId, m.id, "Reported from message menu"), danger: true }] : []),
    ...(mine || canManage ? [{ icon: <Trash2 size={15} />, label: "Delete", onClick: () => actions.deleteMessage(m.channelId, m.id), danger: true }] : []),
  ];

  return (
    <motion.div
      ref={ref}
      id={`msg-${m.id}`}
      layout="position"
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      onMouseLeave={() => { setPicker(false); setMenu(false); }}
      className={cn(
        "group relative flex gap-3 px-4 transition-colors hover:bg-fg/[0.025] sm:px-6",
        grouped ? "py-0.5" : "mt-3 pt-1.5 pb-0.5",
        m.mentions?.includes(meId) && "border-l-2 border-warn bg-warn/[0.06] hover:bg-warn/10",
        m.pinned && !inThread && "bg-accent/[0.04]",
        jumpToId === m.id && "flash",
      )}
    >
      <div className="w-10 shrink-0">
        {!grouped ? (
          <button onClick={() => actions.showProfile(m.authorId)} className="transition active:scale-95">
            <Avatar user={author} size={40} />
          </button>
        ) : (
          <span className="hidden pt-1 text-right text-[10px] text-muted group-hover:block">{formatTime(m.createdAt)}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {replyTo && (
          <button onClick={() => actions.jumpTo(m.channelId, replyTo.id)} className="mb-0.5 flex max-w-full items-center gap-1.5 text-xs text-muted hover:text-fg">
            <span className="ml-[-22px] mt-2 h-3 w-5 shrink-0 rounded-tl-lg border-l-2 border-t-2 border-fg/20" />
            <Avatar user={users[replyTo.authorId]} size={16} />
            <span className="font-semibold">{users[replyTo.authorId]?.displayName}</span>
            <span className="truncate">{replyTo.deletedAt ? "Original message was deleted" : replyTo.content || "Attachment"}</span>
          </button>
        )}
        {!grouped && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            <button onClick={() => actions.showProfile(m.authorId)} className="font-semibold hover:underline" style={{ color: role?.color && role.position > 1 ? role.color : undefined }}>
              {author?.displayName ?? "Unknown"}
            </button>
            {author?.isBot && <span className="rounded bg-accent px-1 py-px text-[9px] font-bold uppercase text-white">{author.id === "bot_nova" ? "AI" : "BOT"}</span>}
            {author?.badges.slice(0, 2).map((b) => BADGES[b] && <span key={b} title={BADGES[b].label} className="text-xs">{BADGES[b].emoji}</span>)}
            <span className="text-[11px] text-muted">{formatTime(m.createdAt)}</span>
            {m.pinned && <Pin size={11} className="text-accent" />}
            {m.ciphertext && <Lock size={11} className="text-ok" aria-label="End-to-end encrypted" />}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {m.deletedAt ? (
            <motion.p key="deleted" initial={{ opacity: 0, filter: "blur(4px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} className="flex items-center gap-1.5 text-sm italic text-muted">
              <Trash2 size={13} /> This message was deleted
            </motion.p>
          ) : editing ? (
            <motion.form
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={(e) => { e.preventDefault(); if (editText.trim()) actions.editMessage(m.channelId, m.id, editText.trim()); }}
              className="mt-1"
            >
              <textarea
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") actions.setEditing(undefined);
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (editText.trim()) actions.editMessage(m.channelId, m.id, editText.trim()); }
                }}
                className="input min-h-[44px] resize-none"
              />
              <p className="mt-1 text-[11px] text-muted">escape to <button type="button" className="text-accent2" onClick={() => actions.setEditing(undefined)}>cancel</button> · enter to <button className="text-accent2">save</button></p>
            </motion.form>
          ) : (
            <motion.div key={`c-${m.editedAt ?? 0}`} initial={m.editedAt ? { opacity: 0.4 } : false} animate={{ opacity: 1 }}>
              {m.content && m.kind !== "gif" && m.kind !== "sticker" && (
                <div onClick={onContentClick} className={cn("md break-words leading-relaxed text-fg/95", jumbo ? "text-5xl leading-tight" : "text-[15px]", translating && "animate-pulse")}>
                  <span dangerouslySetInnerHTML={{ __html: html }} />
                  {m.editedAt && <span className="ml-1 text-[10px] text-muted">(edited)</span>}
                  {m.translated?.[lang] && <span className="ml-1 text-[10px] text-accent2">· translated</span>}
                </div>
              )}
              {m.kind === "gif" && m.gif && <div className="mt-1"><GifTile gif={m.gif} /></div>}
              {m.kind === "sticker" && <motion.div initial={{ scale: 0.3, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 12 }} className="mt-1 text-7xl drop-shadow-lg">{m.sticker}</motion.div>}
              {m.attachments?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {m.attachments.map((a) => <AttachmentView key={a.id} att={a} mine={mine} onOpenImage={(url) => window.open(url, "_blank")} />)}
                </div>
              ) : null}
              {m.kind === "poll" && m.poll && <PollCard message={m} />}
              {m.kind === "trivia" && m.trivia && <TriviaCard message={m} />}
              {showCipher && m.ciphertext && (
                <motion.pre initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-1.5 max-w-lg overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-ok/30 bg-ok/5 p-2.5 font-mono text-[10px] text-ok">
                  AES-256-GCM · {m.ciphertext}
                </motion.pre>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!!Object.keys(m.reactions ?? {}).length && !m.deletedAt && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            <AnimatePresence initial={false}>
              {Object.entries(m.reactions ?? {}).map(([emoji, reactors]) => {
                const minePick = reactors.includes(meId);
                return (
                  <motion.button
                    layout
                    key={emoji}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => actions.toggleReaction(m.channelId, m.id, emoji)}
                    title={reactors.map((u) => users[u]?.displayName).filter(Boolean).slice(0, 8).join(", ")}
                    className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition", minePick ? "border-accent/60 bg-accent/15" : "hairline bg-fg/[0.04] hover:border-fg/20")}
                  >
                    <span>{emoji}</span>
                    <motion.span key={reactors.length} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cn("text-xs font-semibold tabular-nums", minePick ? "text-accent" : "text-muted")}>{reactors.length}</motion.span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
            <button onClick={() => setPicker(true)} className="flex items-center rounded-full border hairline px-2 py-0.5 text-muted opacity-0 transition hover:text-fg group-hover:opacity-100" aria-label="Add reaction">
              <SmilePlus size={14} />
            </button>
          </div>
        )}

        {threadCount > 0 && (
          <button onClick={() => actions.openThread(m.id)} className="mt-1 flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-accent2 hover:bg-accent2/10">
            <MessageSquareText size={13} /> {threadCount} {threadCount === 1 ? "reply" : "replies"}
          </button>
        )}

        {mine && !m.deletedAt && (
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted">
            <StatusTicks status={m.status} />
            {m.status === "read" && channel.kind === "dm" && <span>Read</span>}
          </div>
        )}
      </div>

      {!m.deletedAt && !editing && (
        <div className="absolute -top-4 right-4 z-10 hidden items-center gap-0.5 rounded-xl border hairline bg-elevated p-0.5 shadow-glass group-hover:flex">
          {QUICK_REACTIONS.slice(0, 3).map((e) => (
            <button key={e} onClick={() => actions.toggleReaction(m.channelId, m.id, e)} className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition hover:scale-110 hover:bg-fg/10">{e}</button>
          ))}
          <span className="mx-0.5 h-5 w-px bg-fg/10" />
          {toolbar.map((t) => (
            <button key={t.label} onClick={t.onClick} title={t.label} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-fg/10 hover:text-fg">{t.icon}</button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {picker && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-4 top-6 z-30">
            <EmojiPicker onPick={(e) => { actions.toggleReaction(m.channelId, m.id, e); setPicker(false); }} custom={server?.customEmojis} />
          </motion.div>
        )}
        {menu && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="glass absolute right-4 top-6 z-30 w-56 rounded-2xl p-1.5 shadow-glass">
            {menuItems.map((i) => (
              <button key={i.label} onClick={() => { i.onClick(); setMenu(false); }} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-fg/10", "danger" in i && i.danger && "text-danger")}>
                {i.icon} {i.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
