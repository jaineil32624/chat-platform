"use client";

import type { Presence, User } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

const STATUS_COLOR: Record<Presence, string> = {
  online: "bg-ok",
  idle: "bg-warn",
  dnd: "bg-danger",
  offline: "bg-muted/60",
};

export const STATUS_LABEL: Record<Presence, string> = { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" };

export function StatusDot({ status, className, ring = "ring-surface" }: { status: Presence; className?: string; ring?: string }) {
  return (
    <span
      aria-label={STATUS_LABEL[status]}
      className={cn("block rounded-full ring-[3px] transition-colors duration-500", ring, STATUS_COLOR[status], status === "online" && "animate-pulse-ring", className)}
    >
      {status === "dnd" && <span className="mx-auto mt-[40%] block h-[20%] w-[60%] rounded bg-surface" />}
    </span>
  );
}

export function Avatar({
  user, size = 40, showStatus = false, className, ring, speaking,
}: { user?: Pick<User, "displayName" | "avatarColor" | "avatarUrl" | "status" | "isBot">; size?: number; showStatus?: boolean; className?: string; ring?: string; speaking?: boolean }) {
  if (!user) return <div className="rounded-full bg-fg/10" style={{ width: size, height: size }} />;
  const dot = Math.max(10, Math.round(size * 0.3));
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <div
        className={cn(
          "flex h-full w-full select-none items-center justify-center overflow-hidden rounded-full font-display font-bold text-white transition-shadow",
          speaking && "ring-[3px] ring-ok ring-offset-2 ring-offset-surface",
        )}
        style={{
          background: user.avatarUrl ? undefined : `linear-gradient(135deg, ${user.avatarColor}, ${shade(user.avatarColor)})`,
          fontSize: size * 0.38,
        }}
      >
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(user.displayName)}
      </div>
      {showStatus && (
        <span className="pointer-events-none absolute -bottom-0.5 -right-0.5" style={{ width: dot, height: dot }}>
          <StatusDot status={user.status} ring={ring} className="h-full w-full" />
        </span>
      )}
    </div>
  );
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 60);
  const g = Math.min(255, ((n >> 8) & 255) + 20);
  const b = Math.min(255, (n & 255) + 40);
  return `rgb(${r}, ${g}, ${b})`;
}
