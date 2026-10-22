"use client";

import { Bell, Bot, Database, LogOut, Moon, Palette, Sun, User as UserIcon, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useMe, useStore } from "@/lib/store";
import { ACCENT_PRESETS } from "@/lib/content";
import { LANGUAGES } from "@/lib/translate";
import { cn, compressImage } from "@/lib/utils";
import { Modal } from "../ui/Modal";
import { Avatar } from "../ui/Avatar";

type Tab = "profile" | "appearance" | "notifications" | "ai" | "data";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const me = useMe()!;
  const theme = useStore((s) => s.theme);
  const apiKey = useStore((s) => s.apiKey);
  const sounds = useStore((s) => s.sounds);
  const desktop = useStore((s) => s.desktopNotifications);
  const actions = useStore.getState();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");
  const [p, setP] = useState({ displayName: me.displayName, bio: me.bio, pronouns: me.pronouns ?? "", customStatus: me.customStatus ?? "", avatarColor: me.avatarColor, bannerColor: me.bannerColor, language: me.language ?? "en" });
  const [key, setKey] = useState(apiKey ?? "");
  const file = useRef<HTMLInputElement>(null);

  const tabs: [Tab, string, React.ReactNode][] = [
    ["profile", "My profile", <UserIcon key="u" size={16} />],
    ["appearance", "Appearance", <Palette key="p" size={16} />],
    ["notifications", "Notifications", <Bell key="b" size={16} />],
    ["ai", "AI & Translation", <Bot key="a" size={16} />],
    ["data", "Privacy & data", <Database key="d" size={16} />],
  ];

  const exportData = () => {
    const blob = new Blob([JSON.stringify(useStore.getState().db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pulse-export-${Date.now()}.json`;
    a.click();
  };

  return (
    <Modal open onClose={onClose} title="Settings" wide="xl" className="sm:h-[80vh]">
      <div className="flex flex-col gap-5 sm:flex-row">
        <nav className="no-scrollbar -mx-1 flex shrink-0 gap-1 overflow-x-auto sm:w-48 sm:flex-col">
          {tabs.map(([t, label, icon]) => (
            <button key={t} onClick={() => setTab(t)} className={cn("flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium", tab === t ? "bg-accent/20 text-fg" : "text-muted hover:bg-fg/5 hover:text-fg")}>{icon}{label}</button>
          ))}
          <button onClick={() => { actions.logout(); onClose(); router.push("/auth/"); }} className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10 sm:mt-4"><LogOut size={16} /> Log out</button>
        </nav>

        <div className="min-w-0 flex-1">
          {tab === "profile" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                <Field label="Display name"><input className="input" value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} maxLength={32} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Pronouns"><input className="input" value={p.pronouns} onChange={(e) => setP({ ...p, pronouns: e.target.value })} placeholder="they/them" /></Field>
                  <Field label="Language"><select className="input" value={p.language} onChange={(e) => setP({ ...p, language: e.target.value })}><option value="en">English</option>{Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                </div>
                <Field label="Custom status"><input className="input" value={p.customStatus} onChange={(e) => setP({ ...p, customStatus: e.target.value })} placeholder="🎧 vibing" maxLength={60} /></Field>
                <Field label="About me"><textarea className="input min-h-[90px]" value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} maxLength={190} /></Field>
                <div className="flex gap-6">
                  <Field label="Avatar color"><input type="color" value={p.avatarColor} onChange={(e) => setP({ ...p, avatarColor: e.target.value })} className="h-10 w-16 cursor-pointer rounded-lg bg-transparent" /></Field>
                  <Field label="Banner color"><input type="color" value={p.bannerColor} onChange={(e) => setP({ ...p, bannerColor: e.target.value })} className="h-10 w-16 cursor-pointer rounded-lg bg-transparent" /></Field>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => { actions.updateProfile({ ...p, pronouns: p.pronouns || undefined, customStatus: p.customStatus || undefined }); actions.toast({ title: "Profile saved ✨", tone: "success" }); }}>Save changes</button>
                  <button className="btn-soft" onClick={() => file.current?.click()}>Upload avatar</button>
                  {me.avatarUrl && <button className="btn-ghost" onClick={() => actions.updateProfile({ avatarUrl: undefined })}>Remove</button>}
                </div>
                <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const { url } = await compressImage(f, 256, 0.85); actions.updateProfile({ avatarUrl: url }); }} />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Preview</p>
                <div className="overflow-hidden rounded-3xl bg-bg shadow-glass">
                  <div className="h-20" style={{ background: `linear-gradient(135deg, ${p.bannerColor}, ${p.avatarColor})` }} />
                  <div className="px-4 pb-4">
                    <div className="-mt-9 inline-block rounded-full ring-4 ring-bg"><Avatar user={{ ...me, avatarColor: p.avatarColor, displayName: p.displayName || me.displayName }} size={68} showStatus ring="ring-bg" /></div>
                    <p className="mt-2 font-display text-lg font-bold">{p.displayName}</p>
                    <p className="text-xs text-muted">@{me.username}{p.pronouns && ` · ${p.pronouns}`}</p>
                    {p.customStatus && <p className="mt-2 text-sm">{p.customStatus}</p>}
                    {p.bio && <p className="mt-2 rounded-xl bg-fg/[0.05] p-2.5 text-xs">{p.bio}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "appearance" && (
            <div className="space-y-6">
              <Field label="Theme">
                <div className="grid grid-cols-3 gap-2">
                  {([["dark", <Moon key="d" size={18} />], ["light", <Sun key="l" size={18} />], ["system", <Monitor key="s" size={18} />]] as const).map(([m, icon]) => (
                    <button key={m} onClick={() => actions.setTheme({ mode: m })} className={cn("flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold capitalize transition", theme.mode === m ? "border-accent bg-accent/10" : "hairline hover:bg-fg/[0.04]")}>
                      <div className={cn("flex h-14 w-full items-center justify-center rounded-xl", m === "dark" ? "bg-[#0b0b14] text-white" : m === "light" ? "bg-[#f4f5fb] text-black" : "bg-gradient-to-r from-[#0b0b14] to-[#f4f5fb] text-accent")}>{icon}</div>
                      {m}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Accent">
                <div className="flex flex-wrap gap-2">
                  {ACCENT_PRESETS.map((a) => (
                    <button key={a.name} onClick={() => actions.setTheme({ accent: a.accent, accent2: a.accent2 })} className={cn("flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm", theme.accent === a.accent ? "border-fg/50" : "hairline")}>
                      <span className="h-6 w-6 rounded-full" style={{ background: `linear-gradient(135deg, ${a.accent}, ${a.accent2})` }} /> {a.name}
                    </button>
                  ))}
                  <label className="flex items-center gap-2 rounded-full border hairline px-3 py-1 text-sm">Custom <input type="color" value={theme.accent} onChange={(e) => actions.setTheme({ accent: e.target.value })} className="h-6 w-8 cursor-pointer bg-transparent" /><input type="color" value={theme.accent2} onChange={(e) => actions.setTheme({ accent2: e.target.value })} className="h-6 w-8 cursor-pointer bg-transparent" /></label>
                </div>
              </Field>
              <Field label="Wallpaper">
                <div className="grid grid-cols-4 gap-2">
                  {(["aurora", "mesh", "grid", "none"] as const).map((w) => (
                    <button key={w} onClick={() => actions.setTheme({ wallpaper: w })} className={cn("rounded-2xl border p-2 text-xs font-semibold capitalize", theme.wallpaper === w ? "border-accent" : "hairline")}>
                      <div className="mb-1.5 h-12 rounded-xl bg-bg" style={{ backgroundImage: w === "aurora" ? "radial-gradient(circle at 20% 0%, rgb(var(--accent)/.5), transparent 60%), radial-gradient(circle at 100% 30%, rgb(var(--accent2)/.4), transparent 60%)" : w === "mesh" ? "radial-gradient(at 20% 20%, rgb(var(--accent)/.4), transparent 50%), radial-gradient(at 80% 80%, rgb(var(--accent2)/.4), transparent 50%)" : w === "grid" ? "linear-gradient(rgb(var(--line)/.15) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line)/.15) 1px, transparent 1px)" : "none", backgroundSize: w === "grid" ? "10px 10px" : undefined }} />
                      {w}
                    </button>
                  ))}
                </div>
              </Field>
              <Toggle label="Glassmorphism" desc="Frosted, translucent surfaces" on={theme.glass} onChange={(v) => actions.setTheme({ glass: v })} />
              <Toggle label="Reduce motion" desc="Minimize animations" on={theme.reducedMotion} onChange={(v) => actions.setTheme({ reducedMotion: v })} />
              <Field label={`Text size · ${Math.round(theme.fontScale * 100)}%`}>
                <input type="range" min={0.85} max={1.2} step={0.05} value={theme.fontScale} onChange={(e) => actions.setTheme({ fontScale: Number(e.target.value) })} className="w-full accent-[rgb(var(--accent))]" />
              </Field>
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-3">
              <Toggle label="Sounds" desc="Play sounds for messages, mentions and friend requests" on={sounds} onChange={(v) => actions.setPrefs({ sounds: v })} />
              <Toggle label="Desktop notifications" desc="Show system notifications when Pulse is in the background" on={desktop} onChange={async (v) => {
                if (v && "Notification" in window && Notification.permission !== "granted") {
                  const r = await Notification.requestPermission();
                  if (r !== "granted") return actions.toast({ title: "Notifications blocked by the browser", tone: "warn" });
                }
                actions.setPrefs({ desktopNotifications: v });
              }} />
              <p className="rounded-2xl bg-fg/[0.04] p-4 text-sm text-muted">You'll be notified for DMs, @mentions, replies to your messages, friend requests, level-ups and achievements.</p>
            </div>
          )}

          {tab === "ai" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/15 to-accent2/10 p-4">
                <p className="font-semibold">✨ Nova AI assistant</p>
                <p className="mt-1 text-sm text-muted">Nova works offline with a rule-based brain. Add your own Claude API key to power Nova and message translation with Claude. Your key is stored only in this browser and sent directly to Anthropic.</p>
              </div>
              <Field label="Claude API key">
                <input type="password" className="input font-mono" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-..." autoComplete="off" />
              </Field>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => { actions.setApiKey(key); actions.toast({ title: key ? "Claude connected — Nova is smarter now 🧠" : "Key removed", tone: "success" }); }}>Save key</button>
                {apiKey && <button className="btn-ghost text-danger" onClick={() => { setKey(""); actions.setApiKey(undefined); }}>Remove</button>}
              </div>
              <p className="text-xs text-muted">Status: {apiKey ? "🟢 Using Claude (claude-opus-5-5)" : "⚪ Offline mode"}</p>
            </div>
          )}

          {tab === "data" && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-fg/[0.04] p-4 text-sm">
                <p className="font-semibold">🔒 How your data is handled</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                  <li>Everything is stored locally in your browser (localStorage). Nothing leaves your device unless you connect the optional realtime server.</li>
                  <li>Passwords are hashed with PBKDF2-SHA256 (100k iterations) + a per-user salt.</li>
                  <li>DMs are encrypted with AES-256-GCM using per-conversation derived keys (simulated E2EE for demonstration).</li>
                </ul>
              </div>
              <button className="btn-soft w-full justify-start" onClick={exportData}>⬇️ Export my data (JSON)</button>
              <button className="btn-soft w-full justify-start text-danger" onClick={() => { if (confirm("Reset the entire simulation? All accounts and messages on this device will be erased.")) { actions.resetDemo(); onClose(); router.push("/auth/"); } }}>♻️ Reset simulation</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-fg/[0.04] p-4">
      <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted">{desc}</p></div>
      <button onClick={() => onChange(!on)} className={cn("relative h-7 w-12 shrink-0 rounded-full transition", on ? "bg-ok" : "bg-fg/20")} aria-pressed={on} aria-label={label}>
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}
