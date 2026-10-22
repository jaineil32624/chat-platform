"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DEMO_EMAIL, DEMO_PASSWORD, useStore } from "@/lib/store";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

const COLORS = ["#7c5cff", "#22d3ee", "#f43f5e", "#f59e0b", "#10b981", "#ec4899", "#6366f1", "#14b8a6"];

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function AuthPage() {
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.sessionUserId);
  const users = useStore((s) => s.db.users);
  const { login, register, loginDemo } = useStore.getState();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<false | "form" | "demo">(false);
  const [error, setError] = useState("");

  useEffect(() => { if (hydrated && session) router.replace("/app/"); }, [hydrated, session, router]);

  const online = useMemo(() => Object.values(users).filter((u) => u.isBot && u.status === "online"), [users]);
  const pw = strength(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy("form");
    const r = mode === "login" ? await login(email, password) : await register({ email, password, displayName: displayName || username, username, avatarColor: color });
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Something went wrong");
    else router.push("/app/");
  };

  const demo = async () => {
    setBusy("demo");
    await loginDemo();
    router.push("/app/");
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-bg p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_15%_10%,rgb(var(--accent)/0.3),transparent),radial-gradient(700px_400px_at_90%_90%,rgb(var(--accent2)/0.25),transparent)]" />
      {/* floating avatars of people who are online right now */}
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        {online.slice(0, 14).map((u, i) => (
          <motion.div key={u.id} className="absolute" style={{ left: `${(i * 37) % 92 + 2}%`, top: `${(i * 53) % 85 + 5}%` }} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 0.55, scale: 1, y: [0, -12, 0] }} transition={{ delay: i * 0.08, y: { repeat: Infinity, duration: 4 + (i % 4), ease: "easeInOut" } }}>
            <Avatar user={u} size={34 + (i % 3) * 10} showStatus ring="ring-bg" />
          </motion.div>
        ))}
      </div>

      <Link href="/" className="absolute left-4 top-4 flex items-center gap-1.5 text-sm text-muted hover:text-fg safe-top"><ArrowLeft size={16} /> Home</Link>

      <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", damping: 22 }} className="glass relative w-full max-w-md rounded-[28px] p-7 shadow-glass sm:p-9">
        <div className="flex flex-col items-center text-center">
          <Logo size={56} />
          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <h1 className="mt-4 font-display text-2xl font-extrabold">{mode === "login" ? "Welcome back!" : "Create an account"}</h1>
              <p className="mt-1 text-sm text-muted">{mode === "login" ? "We're so excited to see you again." : "Join 50+ people already chatting on Pulse."}</p>
            </motion.div>
          </AnimatePresence>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ok"><span className="h-2 w-2 animate-pulse rounded-full bg-ok" /> {online.length} people online now</p>
        </div>

        <button onClick={demo} disabled={!!busy} className="btn-primary mt-6 w-full py-3 text-[15px]">
          {busy === "demo" ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} Try the instant demo
        </button>
        <p className="mt-2 text-center text-[11px] text-muted">Demo login: {DEMO_EMAIL} / {DEMO_PASSWORD} (admin access)</p>

        <div className="my-5 flex items-center gap-3 text-xs text-muted"><div className="h-px flex-1 bg-fg/10" /> or {mode === "login" ? "sign in" : "sign up"} with email <div className="h-px flex-1 bg-fg/10" /></div>

        <form onSubmit={submit} className="space-y-3.5">
          <AnimatePresence initial={false}>
            {mode === "register" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-3.5 overflow-hidden">
                <div className="flex items-center gap-3">
                  <Avatar user={{ displayName: displayName || username || "?", avatarColor: color, status: "online", isBot: false }} size={48} />
                  <div className="flex flex-wrap gap-1.5">{COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} className={cn("h-6 w-6 rounded-full transition", color === c && "ring-2 ring-fg ring-offset-2 ring-offset-surface")} style={{ background: c }} aria-label={`Avatar color ${c}`} />)}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className="input" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  <input className="input" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} required={mode === "register"} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <input className="input" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="relative">
            <input className="input pr-11" type={show ? "text" : "password"} placeholder="Password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-fg" aria-label="Toggle password visibility">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
          {mode === "register" && password && (
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className={cn("h-1 flex-1 rounded-full transition", i < pw ? ["bg-danger", "bg-warn", "bg-accent2", "bg-ok"][pw - 1] : "bg-fg/10")} />)}</div>
              <span className="text-[11px] text-muted">{["Weak", "Weak", "Okay", "Good", "Strong"][pw]}</span>
            </div>
          )}
          <AnimatePresence>{error && <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} exit={{ opacity: 0 }} className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</motion.p>}</AnimatePresence>
          <button disabled={!!busy} className="btn w-full bg-fg py-3 text-bg hover:opacity-90">{busy === "form" && <Loader2 className="animate-spin" size={17} />} {mode === "login" ? "Log in" : "Create account"}</button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          {mode === "login" ? "Need an account? " : "Already have an account? "}
          <button className="font-semibold text-accent2 hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Register" : "Log in"}</button>
        </p>
        <p className="mt-4 text-center text-[11px] text-muted">🔒 Passwords are hashed with PBKDF2 · data stays on this device · open a second tab to chat with yourself in real time</p>
      </motion.div>
    </div>
  );
}
