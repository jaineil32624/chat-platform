import type { CustomEmoji, User } from "./types";

// Minimal, XSS-safe chat markdown: everything is HTML-escaped first, then a
// small set of patterns is turned into markup. Supports **bold**, *italic*,
// ~~strike~~, `code`, ```blocks```, ||spoilers||, > quotes, # headings,
// links, @mentions, #channels and :custom_emoji:.

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface MarkdownContext {
  users?: Record<string, User>;
  emojis?: CustomEmoji[];
  highlight?: string;
}

export function renderMarkdown(src: string, ctx: MarkdownContext = {}): string {
  const blocks: string[] = [];
  let s = escapeHtml(src);
  // fenced code first, so nothing inside is transformed
  s = s.replace(/```(?:\w+\n)?([\s\S]*?)```/g, (_, code) => {
    blocks.push(`<pre><code>${code.replace(/^\n/, "")}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    blocks.push(`<code>${code}</code>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  s = s
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\|\|([^|]+)\|\|/g, '<span class="spoiler" data-spoiler>$1</span>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  if (ctx.users) {
    const byName = new Map<string, User>();
    for (const u of Object.values(ctx.users)) {
      byName.set(u.username.toLowerCase(), u);
      byName.set(u.displayName.split(" ")[0].toLowerCase(), u);
    }
    s = s.replace(/(^|\s)@([\w.]+)/g, (m, pre, name) => {
      if (name.toLowerCase() === "everyone" || name.toLowerCase() === "here") return `${pre}<span class="mention">@${name}</span>`;
      const u = byName.get(name.toLowerCase());
      return u ? `${pre}<span class="mention" data-user="${u.id}">@${escapeHtml(u.displayName)}</span>` : m;
    });
  }
  if (ctx.emojis?.length) {
    s = s.replace(/:([a-z0-9_]+):/gi, (m, name) => {
      const e = ctx.emojis!.find((x) => x.name === name.toLowerCase());
      return e ? `<span title=":${name}:" class="inline-block scale-125">${e.glyph}</span>` : m;
    });
  }
  if (ctx.highlight) {
    const q = ctx.highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`(?![^<]*>)(${q})`, "gi"), '<mark class="rounded bg-warn/40 text-fg">$1</mark>');
  }
  s = s.replace(/\n/g, "<br/>");
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
}

/** True when a message is only 1–3 emoji — rendered "jumbo" like modern messengers. */
export function isJumboEmoji(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 24) return false;
  const stripped = t.replace(/[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}\s]/gu, "");
  if (stripped.length) return false;
  const count = [...t.matchAll(/\p{Extended_Pictographic}/gu)].length;
  return count > 0 && count <= 3;
}
