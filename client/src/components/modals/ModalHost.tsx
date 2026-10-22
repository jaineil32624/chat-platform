"use client";

import { useStore } from "@/lib/store";
import { CreateChannelModal, CreateServerModal, InviteModal, ServerSettingsModal } from "./ServerModals";
import { SettingsModal } from "./SettingsModal";
import { AchievementsModal, EncryptionModal, MemeModal, NewDmModal, PollModal, ScheduleModal, ShortcutsModal, WhiteboardModal } from "./ActivityModals";

export function ModalHost() {
  const modal = useStore((s) => s.modal);
  const close = useStore((s) => s.closeModal);
  if (!modal) return null;
  const p = (modal.props ?? {}) as Record<string, string>;
  switch (modal.kind) {
    case "createServer": return <CreateServerModal onClose={close} />;
    case "invite": return <InviteModal serverId={p.serverId} onClose={close} />;
    case "createChannel": return <CreateChannelModal serverId={p.serverId} categoryId={p.categoryId} onClose={close} />;
    case "serverSettings": return <ServerSettingsModal serverId={p.serverId} onClose={close} />;
    case "settings": return <SettingsModal onClose={close} />;
    case "poll": return <PollModal channelId={p.channelId} question={p.question} onClose={close} />;
    case "whiteboard": return <WhiteboardModal channelId={p.channelId} onClose={close} />;
    case "schedule": return <ScheduleModal channelId={p.channelId} text={p.text} onClose={close} />;
    case "meme": return <MemeModal channelId={p.channelId} onClose={close} />;
    case "encryption": return <EncryptionModal channelId={p.channelId} onClose={close} />;
    case "shortcuts": return <ShortcutsModal onClose={close} />;
    case "achievements": return <AchievementsModal onClose={close} />;
    case "newDm": return <NewDmModal onClose={close} />;
    default: return null;
  }
}
