"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { AppShell } from "@/components/shell/AppShell";
import { Splash } from "@/components/ui/Splash";

export default function AppPage() {
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.sessionUserId);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !session) router.replace("/auth/");
  }, [hydrated, session, router]);

  if (!hydrated || !session) return <Splash />;
  return <AppShell />;
}
