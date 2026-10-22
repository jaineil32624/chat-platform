import Anthropic from "@anthropic-ai/sdk";
import { JOKES } from "./replies";
import { TRIVIA } from "../content";
import { pick } from "../utils";

// Nova — the built-in assistant bot. Works fully offline with a rule-based
// brain; when the user supplies their own Claude API key (Settings → AI) it
// answers with Claude instead. The key stays in this browser only.

const SYSTEM_PROMPT = `You are Nova, the friendly built-in assistant inside "Pulse", a chat app.
Keep replies short and conversational (1-4 sentences), like a chat message. Use light emoji sparingly.
You can explain Pulse features: servers, channels, DMs, threads, reactions, polls (/poll), trivia (/trivia),
whiteboard, voice notes, GIFs, stickers, scheduled messages, pinned/saved messages, themes, XP and achievements.`;

export const HELP_TEXT = `**Here's what I can do** ✨
• \`/poll Question | Option A | Option B\` — start a poll
• \`/trivia\` — start a trivia round (first correct answer wins XP)
• \`/roll\`, \`/flip\` — dice & coin flip
• \`/shrug\`, \`/tableflip\` — classics
• \`/schedule 10m Your message\` — send later
• \`/nick New Name\` — change display name
• \`/translate es\` — translate the last message
Ask me for a **joke**, a **fact**, **math** like \`12*(4+3)\`, or **the time**.`;

const FACTS = [
  "Honey never spoils — archaeologists found 3,000-year-old honey that was still edible. 🍯",
  "Octopuses have three hearts and blue blood. 🐙",
  "The first computer bug was an actual moth found in a Harvard Mark II in 1947. 🐛",
  "A day on Venus is longer than its year. 🪐",
  "Bananas are berries, but strawberries aren't. 🍌",
  "The Eiffel Tower can grow ~15 cm taller in summer due to heat expansion. 🗼",
];

/** Safe arithmetic evaluator (no eval): + - * / % ^ and parentheses. */
export function calc(expr: string): number | null {
  const tokens = expr.replace(/\s+/g, "").match(/\d+(\.\d+)?|[+\-*/%^()]/g);
  if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) return null;
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const parsePrimary = (): number => {
    const t = next();
    if (t === "(") {
      const v = parseExpr();
      if (next() !== ")") throw new Error("paren");
      return v;
    }
    if (t === "-") return -parsePrimary();
    const n = Number(t);
    if (Number.isNaN(n)) throw new Error("nan");
    return n;
  };
  const parsePow = (): number => {
    const base = parsePrimary();
    if (peek() === "^") { next(); return base ** parsePow(); }
    return base;
  };
  const parseTerm = (): number => {
    let v = parsePow();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next();
      const r = parsePow();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  };
  const parseExpr = (): number => {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = parseExpr();
    return i === tokens.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function offlineAssistantReply(text: string, userName: string): string {
  const t = text.trim();
  const lower = t.toLowerCase();
  const math = t.replace(/^(what('?s| is)|calc(ulate)?|compute)\s*/i, "").replace(/[?=]+$/, "");
  if (/^[\d\s+\-*/%^().]+$/.test(math) && /\d/.test(math) && /[+\-*/%^]/.test(math)) {
    const v = calc(math);
    if (v !== null) return `🧮 \`${math.trim()}\` = **${Math.round(v * 1e6) / 1e6}**`;
  }
  if (/\b(help|commands|what can you do)\b/.test(lower)) return HELP_TEXT;
  if (/\bjoke\b/.test(lower)) return `😄 ${pick(JOKES)}`;
  if (/\bfact\b/.test(lower)) return `💡 ${pick(FACTS)}`;
  if (/\btime\b/.test(lower)) return `🕒 It's ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} where you are.`;
  if (/\b(date|day is it|today)\b/.test(lower)) return `📅 Today is ${new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`;
  if (/\btrivia|quiz\b/.test(lower)) { const q = pick(TRIVIA); return `🧠 Quick one: ${q.q} (hint: it starts with "${q.choices[q.answer][0]}") — or type \`/trivia\` for a full round!`; }
  if (/\b(level|xp|achievement)/.test(lower)) return "⭐ You earn XP for chatting, reacting, voice notes, polls and trivia. Open your profile to see your level, badges and achievements!";
  if (/\b(theme|dark mode|light mode|color)/.test(lower)) return "🎨 Open **Settings → Appearance** to switch dark/light mode, pick an accent color, wallpaper, glass effects and density.";
  if (/\b(encrypt|e2e|secure|privacy)/.test(lower)) return "🔒 DMs on Pulse are encrypted with AES-GCM keys derived per conversation (simulated E2EE). Click the lock icon in a DM header to compare safety numbers.";
  if (/\b(hi|hello|hey|yo)\b/.test(lower)) return `Hey ${userName.split(" ")[0]}! 👋 I'm Nova. Type **help** to see what I can do.`;
  if (/\b(who are you|what are you)\b/.test(lower)) return "I'm Nova ✨ — Pulse's built-in assistant. I run offline by default, or with Claude if you add an API key in Settings → AI.";
  return pick([
    "Interesting! Tell me more 🤔",
    "I'm running in offline mode right now — add a Claude API key in **Settings → AI** and I'll get a lot smarter. Meanwhile, try asking for a joke, a fact, or some math!",
    "Good question! Type **help** to see everything I can do.",
  ]);
}

export async function claudeAssistantReply(
  apiKey: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  // Server-side refusal fallback is enabled (beta) so a declined request is
  // transparently retried on a fallback model instead of failing.
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: history.slice(-20),
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (response.stop_reason === "refusal") return "Sorry, I can't help with that one. 🙏";
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "🤔";
}
