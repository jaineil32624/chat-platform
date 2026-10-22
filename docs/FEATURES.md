# Feature reference

A checklist of everything Pulse implements, with where to find it in the code.

## Accounts & profiles
| Feature | Where |
|---|---|
| Register / login / logout, password strength meter | `app/auth/page.tsx`, `store.register/login/logout` |
| Instant demo account (admin) | `store.loginDemo` |
| PBKDF2 password hashing | `lib/crypto.ts` |
| Profiles: display name, pronouns, bio, status, colors, avatar upload, language | `modals/SettingsModal.tsx` |
| Profile cards with level, reputation tier, badges, mutual servers | `social/ProfileCard.tsx` |
| Presence: online / idle / DND / invisible, last seen | `shell/UserPanel.tsx`, `ui/Avatar.tsx` |

## Messaging
| Feature | Where |
|---|---|
| DMs, group DMs, channels | `store.openDm/createGroupDm`, `chat/ChatView.tsx` |
| Text, emoji (jumbo), GIFs, stickers, images, files, voice notes | `chat/Composer.tsx`, `chat/Media.tsx` |
| Sent → delivered → read, edited, deleted | `chat/MessageItem.tsx` (`StatusTicks`), `store/reducer.ts` |
| Replies, threads, pins, saved messages | `MessageItem.tsx`, `panels/RightPanel.tsx` |
| Reactions with counts and reactor tooltips | `MessageItem.tsx` |
| Markdown, spoilers, mentions, custom emoji | `lib/markdown.ts` |
| Search with filters | `reducer.searchMessages`, `RightPanel.tsx` |
| Translation | `lib/translate.ts` |
| Scheduled messages | `modals/ActivityModals.tsx`, `Providers.tsx` |
| Slash commands with autocomplete | `Composer.tsx` |
| Drafts per channel, drag-and-drop, paste, ↑ to edit last | `Composer.tsx` |
| Simulated E2EE, ciphertext viewer, safety numbers | `lib/crypto.ts`, `EncryptionModal` |

## Communities
| Feature | Where |
|---|---|
| Server creation from templates | `modals/ServerModals.tsx` |
| Categories, text / voice / announcement channels | `shell/Sidebar.tsx` |
| Roles, permission editor, hoisted roles, role colors | `ServerSettingsModal`, `lib/permissions.ts` |
| Invites, member roles, mute and ban | `InviteModal`, `ServerSettingsModal` |
| Custom server emoji | `ServerSettingsModal` (emoji tab) |
| Discover page | `social/DiscoverView.tsx` |
| Friends: requests, block, active now | `social/FriendsView.tsx` |

## Real-time & simulation
| Feature | Where |
|---|---|
| Event-sourced reducer | `lib/store/reducer.ts` |
| BroadcastChannel and Socket.IO transport | `lib/transport.ts`, `server/` |
| Leader election for bots | `transport.electLeader` |
| 56 personas, replies, reactions, votes, trivia, DMs, friend requests | `lib/sim/*` |
| Typing indicators with avatars | `chat/ChatView.tsx` (`TypingIndicator`) |
| Notifications, toasts, sounds, desktop notifications | `Providers.tsx`, `ui/Toaster.tsx`, `lib/sounds.ts` |

## Engagement
| Feature | Where |
|---|---|
| XP, levels, streaks, milestones, achievements, badges, reputation | `lib/gamification.ts`, `AchievementsModal` |
| Polls | `chat/Interactive.tsx`, `PollModal` |
| Trivia | `Interactive.tsx`, `lib/content.ts` |
| Shared whiteboard | `WhiteboardModal` |
| Meme generator | `MemeModal` |
| Voice / video / screen-share UI | `call/CallOverlay.tsx` |
| Nova AI | `lib/sim/assistant.ts` |

## Admin
| Feature | Where |
|---|---|
| KPIs, charts, insights, live feed | `admin/AdminDashboard.tsx` |
| Users table with mute / ban | same |
| Reports queue, moderation log | same |

## UI / UX
| Feature | Where |
|---|---|
| Dark / light / system, accents, wallpapers, glass, font scale, reduced motion | `SettingsModal`, `Providers.tsx`, `globals.css` |
| Responsive layout and mobile drawer | `shell/AppShell.tsx` |
| Keyboard shortcuts | `AppShell.tsx`, `ShortcutsModal` |
| Landing page with live preview | `landing/Landing.tsx` |
