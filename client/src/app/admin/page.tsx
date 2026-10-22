"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useIsAdmin, useStore } from "@/lib/store";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Splash } from "@/components/ui/Splash";

export default function AdminPage() {
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.sessionUserId);
  const isAdmin = useIsAdmin();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !session) router.replace("/auth/");
  }, [hydrated, session, router]);

  if (!hydrated || !session) return <Splash label="Loading dashboard…" />;
  if (!isAdmin) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
        <span className="text-6xl">🛡️</span>
        <h1 className="font-display text-2xl font-bold">Admins only</h1>
        <p className="max-w-sm text-muted">The first account created on this device (or the demo account) has admin access.</p>
        <Link href="/app/" className="btn-primary">Back to Pulse</Link>
      </div>
    );
  }
  return <AdminDashboard />;
}
