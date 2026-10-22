// Public links used across the landing page, README and downloads section.
export const REPO = process.env.NEXT_PUBLIC_REPO ?? "jaineil32624/chat-platform";
export const REPO_URL = `https://github.com/${REPO}`;
export const [OWNER, NAME] = REPO.split("/");
export const PAGES_URL = `https://${OWNER}.github.io/${NAME}/`;
export const RELEASE_URL = `${REPO_URL}/releases/latest`;
export const dl = (file: string) => `${REPO_URL}/releases/latest/download/${file}`;

export const DOWNLOADS = [
  { id: "web", label: "Play in browser", sub: "Next.js web app · no install", href: "app/", icon: "🌐", internal: true },
  { id: "apk", label: "Android APK", sub: "Capacitor build · Android 7+", href: dl("PulseChat.apk"), icon: "🤖" },
  { id: "godot-web", label: "Pulse Lite (Godot) — Web", sub: "Godot 4 client in your browser", href: "play/", icon: "🎮", internal: true },
  { id: "godot-win", label: "Pulse Lite — Windows", sub: "Godot 4 desktop build (.zip)", href: dl("PulseLite-windows.zip"), icon: "🪟" },
  { id: "godot-linux", label: "Pulse Lite — Linux", sub: "Godot 4 desktop build (.zip)", href: dl("PulseLite-linux.zip"), icon: "🐧" },
  { id: "source", label: "Source code", sub: "GitHub repository", href: REPO_URL, icon: "📦" },
] as const;
