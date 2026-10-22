import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-bg text-center">
      <span className="text-7xl">🛰️</span>
      <h1 className="font-display text-3xl font-bold">Lost in space</h1>
      <p className="text-muted">This page doesn&apos;t exist.</p>
      <Link href="/" className="btn-primary">Take me home</Link>
    </div>
  );
}
