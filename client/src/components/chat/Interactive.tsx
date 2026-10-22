"use client";

import { motion } from "framer-motion";
import { BarChart3, Brain, Check, Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "../ui/Avatar";

export function PollCard({ message }: { message: Message }) {
  const poll = message.poll!;
  const meId = useStore((s) => s.sessionUserId)!;
  const users = useStore((s) => s.db.users);
  const vote = useStore((s) => s.votePoll);
  const total = poll.options.reduce((n, o) => n + o.votes.length, 0);
  const voted = poll.options.some((o) => o.votes.includes(meId));
  const max = Math.max(...poll.options.map((o) => o.votes.length));

  return (
    <div className="mt-1 w-full max-w-md overflow-hidden rounded-2xl border hairline bg-fg/[0.03]">
      <div className="flex items-center gap-2 border-b hairline bg-gradient-to-r from-accent/15 to-accent2/10 px-4 py-3">
        <BarChart3 size={17} className="text-accent" />
        <p className="flex-1 font-semibold">{poll.question}</p>
      </div>
      <div className="space-y-2 p-3">
        {poll.options.map((o) => {
          const pct = total ? (o.votes.length / total) * 100 : 0;
          const mine = o.votes.includes(meId);
          return (
            <button key={o.id} onClick={() => vote(message.channelId, message.id, o.id)} className={cn("relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm transition hover:border-accent/50", mine ? "border-accent/70" : "hairline")}>
              <motion.div className={cn("absolute inset-y-0 left-0", mine ? "bg-accent/30" : o.votes.length === max && total ? "bg-accent2/20" : "bg-fg/[0.07]")} initial={{ width: 0 }} animate={{ width: voted || total ? `${pct}%` : 0 }} transition={{ type: "spring", stiffness: 90, damping: 18 }} />
              <div className="relative flex items-center gap-2">
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border-2", mine ? "border-accent bg-accent text-white" : "border-fg/30")}>{mine && <Check size={12} strokeWidth={3} />}</span>
                <span className="flex-1 font-medium">{o.label}</span>
                <div className="flex -space-x-1.5">
                  {o.votes.slice(0, 3).map((v) => <Avatar key={v} user={users[v]} size={18} className="ring-2 ring-surface rounded-full" />)}
                </div>
                {(voted || total > 0) && <span className="w-10 text-right text-xs font-semibold tabular-nums text-muted">{Math.round(pct)}%</span>}
              </div>
            </button>
          );
        })}
      </div>
      <p className="px-4 pb-3 text-xs text-muted">{total} vote{total === 1 ? "" : "s"} · {poll.multi ? "Multiple choice" : "Single choice"} · tap to {voted ? "change" : "vote"}</p>
    </div>
  );
}

export function TriviaCard({ message }: { message: Message }) {
  const t = message.trivia!;
  const meId = useStore((s) => s.sessionUserId)!;
  const users = useStore((s) => s.db.users);
  const answer = useStore((s) => s.answerTrivia);
  const mine = t.answeredBy[meId];
  const done = mine !== undefined || !!t.winnerId;
  const winner = t.winnerId ? users[t.winnerId] : undefined;

  return (
    <div className="mt-1 w-full max-w-md overflow-hidden rounded-2xl border border-warn/30 bg-gradient-to-br from-warn/10 via-transparent to-accent/10">
      <div className="flex items-center gap-2 px-4 pt-3 text-xs font-bold uppercase tracking-wider text-warn">
        <Brain size={15} /> Trivia · {t.category}
      </div>
      <p className="px-4 pb-2 pt-1 font-semibold">{t.question}</p>
      <div className="grid grid-cols-1 gap-2 p-3 pt-1 sm:grid-cols-2">
        {t.choices.map((c, i) => {
          const isAnswer = done && i === t.answer;
          const isWrongPick = mine === i && i !== t.answer;
          const pickers = Object.entries(t.answeredBy).filter(([, v]) => v === i).map(([u]) => u);
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              disabled={mine !== undefined}
              onClick={() => answer(message.channelId, message.id, i)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition",
                isAnswer ? "border-ok bg-ok/20" : isWrongPick ? "border-danger bg-danger/15" : "hairline bg-fg/[0.04] hover:border-warn/60 hover:bg-warn/10",
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-fg/10 text-xs font-bold">{"ABCD"[i]}</span>
              <span className="flex-1">{c}</span>
              {pickers.length > 0 && <span className="text-[10px] text-muted">{pickers.length}</span>}
            </motion.button>
          );
        })}
      </div>
      {winner && (
        <div className="flex items-center gap-2 border-t border-warn/20 px-4 py-2 text-sm">
          <Trophy size={15} className="text-warn" />
          <Avatar user={winner} size={20} />
          <span><b>{winner.displayName}</b> got it first!</span>
        </div>
      )}
    </div>
  );
}
