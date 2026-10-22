"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { WALLPAPERS } from "@/lib/content";
import { ServerRail } from "./ServerRail";
import { Sidebar } from "./Sidebar";
import { ChatView } from "../chat/ChatView";
import { RightPanel } from "../panels/RightPanel";
import { FriendsView } from "../social/FriendsView";
import { DiscoverView } from "../social/DiscoverView";
import { ProfileCard } from "../social/ProfileCard";
import { ModalHost } from "../modals/ModalHost";
import { CallOverlay } from "../call/CallOverlay";

export function AppShell() {
  const activeServerId = useStore((s) => s.activeServerId);
  const activeChannelId = useStore((s) => s.activeChannelId);
  const homeView = useStore((s) => s.homeView);
  const channel = useStore((s) => (s.activeChannelId ? s.db.channels[s.activeChannelId] : undefined));
  const mobileNav = useStore((s) => s.mobileNav);
  const wallpaper = useStore((s) => s.theme.wallpaper);
  const setMobileNav = useStore((s) => s.setMobileNav);
  const call = useStore((s) => s.call);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); s.setRightPanel("search"); }
      if (mod && e.key === "/") { e.preventDefault(); s.openModal("shortcuts"); }
      if (mod && e.key === ",") { e.preventDefault(); s.openModal("settings"); }
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const list = s.activeServerId === "home"
          ? Object.values(s.db.channels).filter((c) => c.memberIds?.includes(s.sessionUserId!)).map((c) => c.id)
          : s.db.servers[s.activeServerId]?.channelIds.filter((c) => s.db.channels[c]?.kind !== "voice") ?? [];
        const i = list.indexOf(s.activeChannelId ?? "");
        const next = list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length];
        if (next) { e.preventDefault(); s.openChannel(next); }
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  // when the window regains focus, mark the visible channel read
  useEffect(() => {
    const onVis = () => {
      const s = useStore.getState();
      if (document.visibilityState === "visible" && s.activeChannelId) s.markRead(s.activeChannelId);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const main = channel && channel.kind !== "voice" ? (
    <ChatView key={channel.id} channel={channel} />
  ) : activeServerId === "home" && homeView === "discover" ? (
    <DiscoverView />
  ) : (
    <FriendsView />
  );

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-bg">
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: WALLPAPERS[wallpaper], backgroundSize: wallpaper === "grid" ? "32px 32px" : undefined }} />

      {/* desktop navigation */}
      <div className="relative hidden lg:flex">
        <ServerRail />
        <Sidebar />
      </div>

      {/* mobile navigation drawer */}
      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNav(false)} />
            <motion.div className="fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-[340px] shadow-2xl lg:hidden" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <ServerRail />
              <div className="min-w-0 flex-1"><Sidebar /></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="relative flex min-w-0 flex-1">
        <motion.div key={activeChannelId ?? homeView} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} className="flex min-w-0 flex-1">
          {main}
        </motion.div>
        <RightPanel />
      </main>

      <AnimatePresence>{call && <CallOverlay />}</AnimatePresence>
      <ProfileCard />
      <ModalHost />
    </div>
  );
}
