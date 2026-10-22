import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", weight: ["600", "700", "800"], display: "swap" });
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Pulse — Real-time chat, simulated",
  description: "A production-grade chat platform simulation: servers, DMs, threads, reactions, voice notes, polls, trivia and 50+ AI-driven users.",
  icons: { icon: `${base}/favicon.svg`, apple: `${base}/icon-192.png` },
  manifest: `${base}/manifest.webmanifest`,
  openGraph: { title: "Pulse Chat", description: "A real-time chat platform simulation", images: [`${base}/og.png`] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b14" },
    { media: "(prefers-color-scheme: light)", color: "#f4f5fb" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
