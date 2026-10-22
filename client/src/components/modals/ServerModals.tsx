"use client";

import { Check, Copy, Hash, Megaphone, Plus, Trash2, Volume2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { PERM_LABELS, Perm, type PermKey, has, toggle } from "@/lib/permissions";
import type { Channel, Role, Server } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { Modal } from "../ui/Modal";
import { Avatar } from "../ui/Avatar";

const ICONS = ["🚀", "🎮", "📚", "🎨", "🎧", "🍕", "⚽", "🌸", "🐉", "💡", "🔥", "🌙", "🧪", "🎬", "🏆", "💜"];
const COLORS = ["#7c5cff", "#22d3ee", "#f43f5e", "#f59e0b", "#10b981", "#ec4899", "#6366f1", "#0ea5e9"];
const TEMPLATES = [
  { id: "community", name: "Community", desc: "General hangout with intros & memes", icon: "🌍" },
  { id: "gaming", name: "Gaming", desc: "LFG, clips and squad voice channels", icon: "🎮" },
  { id: "study", name: "Study group", desc: "Homework help and a focus room", icon: "📚" },
  { id: "club", name: "School club", desc: "Announcements, events and meetings", icon: "🏫" },
];

export function CreateServerModal({ onClose }: { onClose: () => void }) {
  const createServer = useStore((s) => s.createServer);
  const me = useStore((s) => (s.sessionUserId ? s.db.users[s.sessionUserId] : undefined));
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState("community");
  const [name, setName] = useState(`${me?.displayName.split(" ")[0] ?? "My"}'s server`);
  const [icon, setIcon] = useState("🚀");
  const [color, setColor] = useState(COLORS[0]);
  const [description, setDescription] = useState("");
  const [isPublic, setPublic] = useState(true);

  return (
    <Modal open onClose={onClose} title={step === 0 ? "Create a server" : "Customize your server"} subtitle={step === 0 ? "Your server is where you and your friends hang out." : "Give it a personality. You can change this later."}
      footer={step === 0 ? <button className="btn-primary" onClick={() => setStep(1)}>Next</button> : (
        <>
          <button className="btn-ghost" onClick={() => setStep(0)}>Back</button>
          <button className="btn-primary" disabled={!name.trim()} onClick={() => { createServer({ name: name.trim(), icon, color, description, template, isPublic }); onClose(); }}>Create server</button>
        </>
      )}>
      {step === 0 ? (
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => setTemplate(t.id)} className={cn("flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition", template === t.id ? "border-accent bg-accent/10" : "hairline hover:bg-fg/[0.04]")}>
              <span className="text-3xl">{t.icon}</span>
              <div className="flex-1"><p className="font-semibold">{t.name}</p><p className="text-sm text-muted">{t.desc}</p></div>
              {template === t.id && <Check className="text-accent" size={18} />}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-[28px] text-5xl shadow-glow transition" style={{ background: color }}>{icon}</div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Server name</label>
            <input className="input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Description</label>
            <input className="input mt-1.5" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this server about?" maxLength={120} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Icon</label>
            <div className="mt-1.5 grid grid-cols-8 gap-1.5">{ICONS.map((i) => <button key={i} onClick={() => setIcon(i)} className={cn("flex h-10 items-center justify-center rounded-xl text-xl", icon === i ? "bg-accent/25 ring-2 ring-accent" : "bg-fg/[0.05] hover:bg-fg/10")}>{i}</button>)}</div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Color</label>
            <div className="mt-1.5 flex gap-2">{COLORS.map((c) => <button key={c} onClick={() => setColor(c)} className={cn("h-8 w-8 rounded-full transition", color === c && "ring-2 ring-fg ring-offset-2 ring-offset-surface")} style={{ background: c }} aria-label={c} />)}</div>
          </div>
          <label className="flex items-center justify-between rounded-2xl bg-fg/[0.04] p-3 text-sm">
            <span><b>List in Discover</b><br /><span className="text-muted">Anyone can find and join</span></span>
            <input type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent))]" />
          </label>
        </div>
      )}
    </Modal>
  );
}

export function InviteModal({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const meId = useStore((s) => s.sessionUserId)!;
  const updateServer = useStore((s) => s.updateServer);
  const toast = useStore((s) => s.toast);
  const server = db.servers[serverId];
  const [invited, setInvited] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const code = useMemo(() => `pulse.gg/${serverId.slice(-6)}`, [serverId]);
  if (!server) return null;
  const friends = Object.entries(db.friends[meId] ?? {}).filter(([, s]) => s === "friends").map(([id]) => db.users[id]).filter(Boolean);
  const candidates = (friends.length ? friends : Object.values(db.users).filter((u) => u.isBot).slice(0, 12)).filter((u) => !q || u.displayName.toLowerCase().includes(q.toLowerCase()));

  const invite = (id: string) => {
    setInvited((x) => [...x, id]);
    // bots accept invitations after a short pause
    setTimeout(() => {
      const s = useStore.getState().db.servers[serverId];
      if (!s || s.memberIds.includes(id)) return;
      updateServer({ ...s, memberIds: [...s.memberIds, id], memberRoles: { ...s.memberRoles, [id]: [] } });
      const first = s.channelIds.find((c) => useStore.getState().db.channels[c]?.kind === "text");
      if (first) useStore.getState().dispatch("message:new", { message: { id: uid("msg"), channelId: first, authorId: id, kind: "system", content: `👋 **${db.users[id]?.displayName}** joined the server.`, createdAt: Date.now(), status: "sent" } });
      toast({ title: `${db.users[id]?.displayName} joined ${s.name}`, tone: "success" });
    }, 1500 + Math.random() * 3000);
  };

  return (
    <Modal open onClose={onClose} title={`Invite friends to ${server.name}`}>
      <input className="input" placeholder="Search for friends" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="scroll-thin mt-3 max-h-72 space-y-1 overflow-y-auto">
        {candidates.map((u) => {
          const member = server.memberIds.includes(u.id);
          const done = invited.includes(u.id);
          return (
            <div key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-fg/[0.04]">
              <Avatar user={u} size={34} showStatus ring="ring-surface" />
              <span className="flex-1 truncate text-sm font-medium">{u.displayName}</span>
              <button disabled={member || done} onClick={() => invite(u.id)} className={cn("btn py-1.5 text-xs", member ? "text-muted" : done ? "bg-ok/20 text-ok" : "border border-ok/60 text-ok hover:bg-ok hover:text-white")}>{member ? "Member" : done ? "Sent" : "Invite"}</button>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">Or send an invite link</p>
      <div className="mt-1.5 flex gap-2">
        <input readOnly value={code} className="input font-mono" />
        <button className="btn-primary" onClick={() => { navigator.clipboard?.writeText(code); toast({ title: "Invite link copied" }); }}><Copy size={15} /> Copy</button>
      </div>
    </Modal>
  );
}

export function CreateChannelModal({ serverId, categoryId, onClose }: { serverId: string; categoryId?: string; onClose: () => void }) {
  const createChannel = useStore((s) => s.createChannel);
  const server = useStore((s) => s.db.servers[serverId]);
  const [kind, setKind] = useState<Channel["kind"]>("text");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [cat, setCat] = useState(categoryId ?? server?.categories[0]?.id);
  const types: [Channel["kind"], React.ReactNode, string, string][] = [
    ["text", <Hash key="t" />, "Text", "Messages, images, GIFs, polls"],
    ["voice", <Volume2 key="v" />, "Voice", "Hang out with voice & video"],
    ["announcement", <Megaphone key="a" />, "Announcement", "Only admins can post"],
  ];
  return (
    <Modal open onClose={onClose} title="Create channel" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!name.trim()} onClick={() => { createChannel(serverId, { name: name.trim(), kind, categoryId: cat, topic }); onClose(); }}>Create</button></>}>
      <div className="space-y-2">
        {types.map(([k, icon, label, desc]) => (
          <button key={k} onClick={() => setKind(k)} className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left", kind === k ? "border-accent bg-accent/10" : "hairline hover:bg-fg/[0.04]")}>
            <span className="text-muted">{icon}</span>
            <div className="flex-1"><p className="font-semibold">{label}</p><p className="text-xs text-muted">{desc}</p></div>
            <span className={cn("h-4 w-4 rounded-full border-2", kind === k ? "border-accent bg-accent" : "border-fg/30")} />
          </button>
        ))}
      </div>
      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Channel name</label>
      <input autoFocus className="input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "voice" ? "Hangout" : "new-channel"} maxLength={32} />
      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Topic</label>
      <input className="input mt-1.5" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Optional" />
      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-muted">Category</label>
      <select className="input mt-1.5" value={cat} onChange={(e) => setCat(e.target.value)}>
        {server?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </Modal>
  );
}

export function ServerSettingsModal({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const db = useStore((s) => s.db);
  const actions = useStore.getState();
  const server = db.servers[serverId];
  const [tab, setTab] = useState<"overview" | "roles" | "channels" | "members" | "emoji">("overview");
  const [draft, setDraft] = useState<Server>(server);
  const [roleId, setRoleId] = useState(server?.roles[server.roles.length - 1]?.id);
  if (!server) return null;
  const save = (next: Server) => { setDraft(next); actions.updateServer(next); };
  const role = draft.roles.find((r) => r.id === roleId);

  const setRole = (patch: Partial<Role>) => save({ ...draft, roles: draft.roles.map((r) => (r.id === roleId ? { ...r, ...patch } : r)) });

  return (
    <Modal open onClose={onClose} title={`${server.icon} ${server.name} — Settings`} wide>
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto">
        {(["overview", "roles", "channels", "members", "emoji"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-semibold capitalize", tab === t ? "bg-accent/20 text-fg" : "text-muted hover:bg-fg/5")}>{t}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div><label className="text-xs font-bold uppercase tracking-wider text-muted">Name</label><input className="input mt-1.5" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={() => save(draft)} /></div>
          <div><label className="text-xs font-bold uppercase tracking-wider text-muted">Description</label><textarea className="input mt-1.5" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onBlur={() => save(draft)} /></div>
          <div className="flex flex-wrap gap-2">{ICONS.map((i) => <button key={i} onClick={() => save({ ...draft, icon: i })} className={cn("h-10 w-10 rounded-xl text-xl", draft.icon === i ? "bg-accent/25 ring-2 ring-accent" : "bg-fg/[0.05]")}>{i}</button>)}</div>
          <div className="flex gap-2">{COLORS.map((c) => <button key={c} onClick={() => save({ ...draft, color: c })} className={cn("h-8 w-8 rounded-full", draft.color === c && "ring-2 ring-fg ring-offset-2 ring-offset-surface")} style={{ background: c }} aria-label={c} />)}</div>
          <label className="flex items-center justify-between rounded-2xl bg-fg/[0.04] p-3 text-sm"><b>Listed in Discover</b><input type="checkbox" checked={draft.isPublic} onChange={(e) => save({ ...draft, isPublic: e.target.checked })} className="h-5 w-5" /></label>
        </div>
      )}

      {tab === "roles" && (
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div className="space-y-1">
            {[...draft.roles].sort((a, b) => b.position - a.position).map((r) => (
              <button key={r.id} onClick={() => setRoleId(r.id)} className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm", roleId === r.id ? "bg-fg/10" : "hover:bg-fg/5")}>
                <span className="h-3 w-3 rounded-full" style={{ background: r.color }} /> <span className="truncate">{r.name}</span>
              </button>
            ))}
            <button onClick={() => { const r: Role = { id: uid("role"), name: "New role", color: "#a78bfa", permissions: Perm.VIEW_CHANNEL | Perm.SEND_MESSAGES, position: draft.roles.length }; save({ ...draft, roles: [...draft.roles, r] }); setRoleId(r.id); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-accent hover:bg-accent/10"><Plus size={14} /> Create role</button>
          </div>
          {role && (
            <div>
              <div className="flex gap-2">
                <input className="input" value={role.name} disabled={role.name === "@everyone"} onChange={(e) => setRole({ name: e.target.value })} />
                <input type="color" value={role.color} onChange={(e) => setRole({ color: e.target.value })} className="h-11 w-14 cursor-pointer rounded-xl bg-transparent" />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!role.hoist} onChange={(e) => setRole({ hoist: e.target.checked })} /> Display members separately</label>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">Permissions</p>
              <div className="mt-2 divide-y divide-fg/5 rounded-2xl bg-fg/[0.03]">
                {(Object.keys(Perm) as PermKey[]).map((k) => {
                  const on = (role.permissions & Perm[k]) === Perm[k];
                  return (
                    <label key={k} className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm">
                      <span>{PERM_LABELS[k]}{k === "ADMINISTRATOR" && <span className="ml-2 text-xs text-warn">grants every permission</span>}</span>
                      <button type="button" onClick={() => setRole({ permissions: toggle(role.permissions, Perm[k]) })} className={cn("relative h-6 w-11 rounded-full transition", on ? "bg-ok" : "bg-fg/20")}>
                        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
                      </button>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">Effective: {has(role.permissions, Perm.ADMINISTRATOR) ? "all permissions" : `${role.permissions.toString(2).split("").filter((b) => b === "1").length} permissions`} · bitfield {role.permissions}</p>
            </div>
          )}
        </div>
      )}

      {tab === "channels" && (
        <div className="space-y-4">
          {draft.categories.map((cat) => (
            <div key={cat.id}>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{cat.name}</p>
              <div className="mt-1.5 space-y-1">
                {draft.channelIds.map((id) => db.channels[id]).filter((c) => c?.categoryId === cat.id).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-xl bg-fg/[0.04] px-3 py-2 text-sm">
                    {c.kind === "voice" ? <Volume2 size={15} /> : <Hash size={15} />} <span className="flex-1">{c.name}</span>
                    <button className="icon-btn h-7 w-7 hover:text-danger" onClick={() => { actions.deleteChannel(c.id); setDraft(useStore.getState().db.servers[serverId]); }} aria-label="Delete channel"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="btn-soft" onClick={() => { const name = prompt("Category name"); if (name) save({ ...draft, categories: [...draft.categories, { id: uid("cat"), name }] }); }}><Plus size={15} /> Add category</button>
        </div>
      )}

      {tab === "members" && (
        <div className="scroll-thin max-h-[50vh] space-y-1 overflow-y-auto">
          {draft.memberIds.map((id) => db.users[id]).filter(Boolean).map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-fg/[0.04]">
              <Avatar user={u} size={32} showStatus ring="ring-surface" />
              <span className="flex-1 truncate text-sm font-medium">{u.displayName}</span>
              <select className="rounded-lg bg-fg/[0.06] px-2 py-1 text-xs" value={draft.memberRoles[u.id]?.find((r) => r !== `${serverId}:member`) ?? ""} onChange={(e) => save({ ...draft, memberRoles: { ...draft.memberRoles, [u.id]: e.target.value ? [e.target.value] : [] } })}>
                <option value="">No role</option>
                {draft.roles.filter((r) => r.name !== "@everyone").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {u.id !== draft.ownerId && (
                <>
                  <button className="btn py-1 text-xs text-warn hover:bg-warn/10" onClick={() => actions.moderate(u.id, "mute", "Muted by server admin", 10 * 60_000, serverId)}>Mute</button>
                  <button className="btn py-1 text-xs text-danger hover:bg-danger/10" onClick={() => { actions.moderate(u.id, "ban", "Banned by server admin", undefined, serverId); setDraft(useStore.getState().db.servers[serverId]); }}>Ban</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "emoji" && (
        <div>
          <p className="text-sm text-muted">Custom emoji can be used as <code className="rounded bg-fg/10 px-1">:name:</code> in this server.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(draft.customEmojis ?? []).map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-xl bg-fg/[0.04] p-2 text-sm"><span className="text-2xl">{e.glyph}</span><span className="flex-1 truncate">:{e.name}:</span>
                <button className="hover:text-danger" onClick={() => save({ ...draft, customEmojis: draft.customEmojis?.filter((x) => x.id !== e.id) })} aria-label="Remove"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const name = String(f.get("name")).toLowerCase().replace(/[^a-z0-9_]/g, ""); const glyph = String(f.get("glyph")); if (name && glyph) save({ ...draft, customEmojis: [...(draft.customEmojis ?? []), { id: uid("emo"), name, glyph }] }); e.currentTarget.reset(); }}>
            <input name="glyph" className="input w-20 text-center text-xl" placeholder="🦄" maxLength={4} />
            <input name="name" className="input" placeholder="emoji_name" />
            <button className="btn-primary">Add</button>
          </form>
        </div>
      )}
    </Modal>
  );
}
