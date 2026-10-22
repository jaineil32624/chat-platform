-- =============================================================================
-- Pulse — Supabase / Postgres schema
-- =============================================================================
-- Target: Supabase (Postgres 15+). Relies on Supabase-provided objects:
--   auth.users, auth.uid(), storage.buckets / storage.objects, publication supabase_realtime.
--
-- This file is identical to migrations/0001_init.sql. Apply it once to a fresh project
-- (`supabase db reset` locally, or paste into the SQL editor), then optionally run seed.sql.
--
-- Permission bitfield (roles.permissions, bigint) — must match the client:
--   VIEW_CHANNEL=1  SEND_MESSAGES=2  MANAGE_MESSAGES=4  MANAGE_CHANNELS=8
--   KICK_MEMBERS=16 BAN_MEMBERS=32   MUTE_MEMBERS=64    MANAGE_ROLES=128
--   MENTION_EVERYONE=256 ATTACH_FILES=512 ADD_REACTIONS=1024 PIN_MESSAGES=2048
--   ADMINISTRATOR=4096   (ALL = 8191)
-- =============================================================================

begin;

-- pgcrypto lives in the "extensions" schema on Supabase.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.presence_status   as enum ('online', 'idle', 'dnd', 'offline');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.channel_kind      as enum ('dm', 'group_dm', 'text', 'voice', 'announcement');
create type public.message_kind      as enum ('text', 'gif', 'sticker', 'voice', 'poll', 'trivia', 'system');
create type public.message_status    as enum ('scheduled', 'sending', 'sent', 'delivered', 'read', 'failed');
create type public.moderation_action as enum ('warn', 'mute', 'kick', 'ban');
create type public.report_status     as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.notification_type as enum (
  'mention', 'reply', 'reaction', 'friend_request', 'friend_accept',
  'server_invite', 'moderation', 'achievement', 'system'
);

-- -----------------------------------------------------------------------------
-- Permission reference table (documentation + lookup for clients / SQL)
-- -----------------------------------------------------------------------------
create table public.permissions (
  bit         bigint primary key check (bit > 0 and (bit & (bit - 1)) = 0),
  name        text   not null unique,
  description text   not null
);

insert into public.permissions (bit, name, description) values
  (1,    'VIEW_CHANNEL',     'See channels and read message history'),
  (2,    'SEND_MESSAGES',    'Send messages in text channels'),
  (4,    'MANAGE_MESSAGES',  'Delete others'' messages; post in announcement channels'),
  (8,    'MANAGE_CHANNELS',  'Create, edit and delete channels and categories'),
  (16,   'KICK_MEMBERS',     'Remove members from the server'),
  (32,   'BAN_MEMBERS',      'Ban members from the server'),
  (64,   'MUTE_MEMBERS',     'Time out (mute) members'),
  (128,  'MANAGE_ROLES',     'Create, edit, assign and remove roles'),
  (256,  'MENTION_EVERYONE', 'Use @everyone / @here'),
  (512,  'ATTACH_FILES',     'Upload attachments'),
  (1024, 'ADD_REACTIONS',    'Add reactions to messages'),
  (2048, 'PIN_MESSAGES',     'Pin and unpin messages'),
  (4096, 'ADMINISTRATOR',    'All permissions; bypasses channel restrictions');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Profiles: 1:1 with auth.users, created automatically by handle_new_user().
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text not null unique
                   check (username ~ '^[a-z0-9_.]{2,32}$'),
  display_name   text check (char_length(display_name) between 1 and 64),
  avatar_url     text,
  banner_url     text,
  bio            text check (char_length(bio) <= 500),
  accent_color   text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  status         public.presence_status not null default 'offline',
  custom_status  text check (char_length(custom_status) <= 128),
  xp             bigint not null default 0 check (xp >= 0),
  level          integer not null default 1 check (level >= 1),
  public_key     text,              -- E2EE public key (base64), optional
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Friendships: directed row (requester -> addressee). For 'blocked', requester is the blocker.
create table public.friendships (
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        public.friendship_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
-- At most one relationship per unordered pair.
create unique index friendships_pair_uidx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);

create table public.servers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 100),
  description  text check (char_length(description) <= 1000),
  icon_url     text,
  banner_url   text,
  owner_id     uuid not null references public.profiles (id) on delete restrict,
  is_public    boolean not null default false,
  invite_code  text not null unique default encode(extensions.gen_random_bytes(6), 'hex')
                 check (invite_code ~ '^[A-Za-z0-9_-]{4,32}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index servers_owner_idx on public.servers (owner_id);
create index servers_public_idx on public.servers (created_at desc) where is_public;

create table public.server_members (
  server_id  uuid not null references public.servers (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  nickname   text check (char_length(nickname) between 1 and 32),
  joined_at  timestamptz not null default now(),
  primary key (server_id, user_id)
);
create index server_members_user_idx on public.server_members (user_id);

create table public.roles (
  id           uuid primary key default gen_random_uuid(),
  server_id    uuid not null references public.servers (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 64),
  color        text check (color ~ '^#[0-9a-fA-F]{6}$'),
  position     integer not null default 0 check (position >= 0),
  permissions  bigint not null default 0 check (permissions >= 0 and permissions <= 8191),
  is_default   boolean not null default false,   -- the implicit @everyone role
  hoist        boolean not null default false,   -- show separately in member list
  mentionable  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, server_id)
);
create unique index roles_one_default_per_server on public.roles (server_id) where is_default;
create index roles_server_position_idx on public.roles (server_id, position desc);

create table public.member_roles (
  server_id    uuid not null,
  user_id      uuid not null,
  role_id      uuid not null,
  assigned_at  timestamptz not null default now(),
  primary key (user_id, role_id),
  foreign key (server_id, user_id) references public.server_members (server_id, user_id) on delete cascade,
  foreign key (role_id, server_id) references public.roles (id, server_id) on delete cascade
);
create index member_roles_role_idx on public.member_roles (role_id);
create index member_roles_server_user_idx on public.member_roles (server_id, user_id);

create table public.channel_categories (
  id          uuid primary key default gen_random_uuid(),
  server_id   uuid not null references public.servers (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  position    integer not null default 0 check (position >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, server_id)
);
create index channel_categories_server_idx on public.channel_categories (server_id, position);

create table public.channels (
  id                uuid primary key default gen_random_uuid(),
  server_id         uuid references public.servers (id) on delete cascade,
  category_id       uuid,
  kind              public.channel_kind not null default 'text',
  name              text check (char_length(name) between 1 and 100),
  topic             text check (char_length(topic) <= 1024),
  icon_url          text,
  position          integer not null default 0 check (position >= 0),
  is_private        boolean not null default false,  -- server channels: restrict to channel_members
  is_nsfw           boolean not null default false,
  slowmode_seconds  integer not null default 0 check (slowmode_seconds between 0 and 21600),
  created_by        uuid references public.profiles (id) on delete set null,
  last_message_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- DMs live outside servers; everything else lives inside one.
  check ((kind in ('dm', 'group_dm')) = (server_id is null)),
  -- Server channels and group DMs may be named; 1:1 DMs never are.
  check (kind = 'dm' or kind = 'group_dm' or name is not null),
  check (kind <> 'dm' or name is null),
  check (category_id is null or server_id is not null),
  foreign key (category_id, server_id) references public.channel_categories (id, server_id) on delete set null (category_id)
);
create index channels_server_position_idx on public.channels (server_id, category_id, position);
create index channels_last_message_idx on public.channels (last_message_at desc nulls last);

create table public.channel_members (
  channel_id            uuid not null references public.channels (id) on delete cascade,
  user_id               uuid not null references public.profiles (id) on delete cascade,
  joined_at             timestamptz not null default now(),
  last_read_message_id  uuid,   -- FK added after messages is created
  last_read_at          timestamptz,
  muted                 boolean not null default false,
  primary key (channel_id, user_id)
);
create index channel_members_user_idx on public.channel_members (user_id);

create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  channel_id        uuid not null references public.channels (id) on delete cascade,
  author_id         uuid references public.profiles (id) on delete set null,   -- null = system / deleted user
  kind              public.message_kind not null default 'text',
  status            public.message_status not null default 'sent',
  content           text not null default '' check (char_length(content) <= 4000),
  ciphertext        text check (char_length(ciphertext) <= 32768),            -- E2EE body (base64); content must be ''
  attachments       jsonb not null default '[]'::jsonb,
  metadata          jsonb not null default '{}'::jsonb,                       -- gif url, sticker id, trivia data, voice duration...
  mentions          uuid[] not null default '{}',
  mention_everyone  boolean not null default false,
  reply_to          uuid references public.messages (id) on delete set null,
  thread_parent_id  uuid references public.messages (id) on delete cascade,
  pinned            boolean not null default false,
  pinned_at         timestamptz,
  pinned_by         uuid references public.profiles (id) on delete set null,
  scheduled_for     timestamptz,
  edited_at         timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  search            tsvector generated always as (to_tsvector('simple', coalesce(content, ''))) stored,
  check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 10),
  check (jsonb_typeof(metadata) = 'object'),
  check (ciphertext is null or content = ''),
  check (thread_parent_id is null or thread_parent_id <> id),
  check (reply_to is null or reply_to <> id),
  check (pinned = (pinned_at is not null)),
  -- A live text message must carry something.
  check (
    deleted_at is not null
    or kind <> 'text'
    or content <> ''
    or ciphertext is not null
    or jsonb_array_length(attachments) > 0
  )
);
alter table public.channel_members
  add constraint channel_members_last_read_fk
  foreign key (last_read_message_id) references public.messages (id) on delete set null;

create index messages_channel_created_idx on public.messages (channel_id, created_at desc, id desc);
create index messages_thread_idx         on public.messages (thread_parent_id, created_at) where thread_parent_id is not null;
create index messages_reply_idx          on public.messages (reply_to) where reply_to is not null;
create index messages_author_idx         on public.messages (author_id, created_at desc);
create index messages_pinned_idx         on public.messages (channel_id, pinned_at desc) where pinned;
create index messages_scheduled_idx      on public.messages (scheduled_for) where status = 'scheduled';
create index messages_search_idx         on public.messages using gin (search);
create index messages_mentions_idx       on public.messages using gin (mentions);

create table public.reactions (
  message_id  uuid not null references public.messages (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 64),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index reactions_message_idx on public.reactions (message_id, emoji);

create table public.saved_messages (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  message_id  uuid not null references public.messages (id) on delete cascade,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index saved_messages_user_idx on public.saved_messages (user_id, created_at desc);

create table public.polls (
  id               uuid primary key default gen_random_uuid(),
  message_id       uuid not null unique references public.messages (id) on delete cascade,
  question         text not null check (char_length(question) between 1 and 300),
  -- [{ "id": "a", "label": "Pizza" }, ...]
  options          jsonb not null check (
                     jsonb_typeof(options) = 'array'
                     and jsonb_array_length(options) between 2 and 10
                   ),
  allows_multiple  boolean not null default false,
  is_anonymous     boolean not null default false,
  closes_at        timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.poll_votes (
  poll_id     uuid not null references public.polls (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  option_id   text not null check (char_length(option_id) between 1 and 64),
  created_at  timestamptz not null default now(),
  primary key (poll_id, user_id, option_id)
);
create index poll_votes_poll_option_idx on public.poll_votes (poll_id, option_id);

create table public.achievements (
  id           text primary key check (id ~ '^[a-z0-9_]{2,64}$'),   -- slug, e.g. 'first_message'
  name         text not null,
  description  text not null,
  icon         text,
  xp_reward    integer not null default 0 check (xp_reward >= 0),
  is_secret    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.user_achievements (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  achievement_id  text not null references public.achievements (id) on delete cascade,
  unlocked_at     timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.xp_events (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  server_id          uuid references public.servers (id) on delete set null,
  amount             integer not null check (amount <> 0 and amount between -100000 and 100000),
  reason             text not null check (char_length(reason) between 1 and 64),
  source_message_id  uuid references public.messages (id) on delete set null,
  created_at         timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);
create index xp_events_server_idx on public.xp_events (server_id, created_at desc) where server_id is not null;

create table public.moderation_actions (
  id              uuid primary key default gen_random_uuid(),
  server_id       uuid not null references public.servers (id) on delete cascade,
  target_user_id  uuid not null references public.profiles (id) on delete cascade,
  moderator_id    uuid references public.profiles (id) on delete set null,
  action          public.moderation_action not null,
  reason          text check (char_length(reason) <= 1000),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  revoked_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  check (target_user_id <> moderator_id),
  -- warnings and kicks are instantaneous; mutes must expire; bans may be permanent.
  check (action not in ('warn', 'kick') or expires_at is null),
  check (action <> 'mute' or expires_at is not null),
  check (expires_at is null or expires_at > created_at),
  check (revoked_by is null or revoked_at is not null)
);
create index moderation_active_idx
  on public.moderation_actions (server_id, target_user_id, action)
  where revoked_at is null;
create index moderation_server_created_idx on public.moderation_actions (server_id, created_at desc);

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references public.profiles (id) on delete set null,
  server_id       uuid references public.servers (id) on delete cascade,
  message_id      uuid references public.messages (id) on delete set null,
  target_user_id  uuid references public.profiles (id) on delete cascade,
  reason          text not null check (reason in ('spam', 'harassment', 'hate', 'nsfw', 'self_harm', 'impersonation', 'other')),
  details         text check (char_length(details) <= 2000),
  status          public.report_status not null default 'open',
  resolved_by     uuid references public.profiles (id) on delete set null,
  resolved_at     timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (message_id is not null or target_user_id is not null),
  check ((status in ('resolved', 'dismissed')) = (resolved_at is not null))
);
create index reports_server_status_idx on public.reports (server_id, status, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.notification_type not null,
  title       text not null check (char_length(title) <= 200),
  body        text check (char_length(body) <= 1000),
  data        jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  actor_id    uuid references public.profiles (id) on delete set null,
  server_id   uuid references public.servers (id) on delete cascade,
  channel_id  uuid references public.channels (id) on delete cascade,
  message_id  uuid references public.messages (id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- Ephemeral typing state, published via Supabase Realtime. Clients upsert while typing.
create table public.typing_indicators (
  channel_id  uuid not null references public.channels (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '8 seconds',
  primary key (channel_id, user_id)
);
create index typing_expires_idx on public.typing_indicators (expires_at);

-- =============================================================================
-- Helper functions (SECURITY DEFINER so RLS policies can call them without recursion)
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Turn a string into a uuid, or null if it is not one (used by storage policies).
create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.is_server_member(p_server uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.server_members
    where server_id = p_server and user_id = p_user
  );
$$;

-- True if the user currently has an active (unexpired, unrevoked) sanction of the given type.
create or replace function public.has_active_sanction(p_server uuid, p_user uuid, p_action public.moderation_action)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.moderation_actions
    where server_id = p_server
      and target_user_id = p_user
      and action = p_action
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

-- Effective permission bitfield of a user in a server.
-- Owner and ADMINISTRATOR resolve to ALL (8191). Non-members get 0.
create or replace function public.member_permissions(p_server uuid, p_user uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_perms bigint;
begin
  if p_user is null then
    return 0;
  end if;

  select owner_id into v_owner from public.servers where id = p_server;
  if v_owner is null then
    return 0;
  end if;
  if v_owner = p_user then
    return 8191;
  end if;

  if not exists (select 1 from public.server_members where server_id = p_server and user_id = p_user) then
    return 0;
  end if;

  select coalesce(bit_or(r.permissions), 0) into v_perms
  from public.roles r
  where r.server_id = p_server
    and (
      r.is_default
      or exists (select 1 from public.member_roles mr where mr.role_id = r.id and mr.user_id = p_user)
    );

  if (v_perms & 4096) <> 0 then
    return 8191;
  end if;
  return v_perms;
end;
$$;

-- has_permission(server, perm): does the *current* user hold every bit in `perm` on `server`?
create or replace function public.has_permission(p_server uuid, p_perm bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (public.member_permissions(p_server, auth.uid()) & p_perm) = p_perm;
$$;

-- Explicit-user overload (service code, triggers).
create or replace function public.has_permission(p_server uuid, p_user uuid, p_perm bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (public.member_permissions(p_server, p_user) & p_perm) = p_perm;
$$;

create or replace function public.is_channel_member(p_channel uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.channel_members
    where channel_id = p_channel and user_id = p_user
  );
$$;

-- Channel-scoped permission check for the current user.
--  * DMs / group DMs: members get conversational permissions; management of a group DM
--    (MANAGE_CHANNELS / MANAGE_MESSAGES) is reserved to its creator.
--  * Server channels: server permission, plus private-channel membership.
create or replace function public.channel_has_permission(p_channel uuid, p_perm bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  c     record;
  v_member_perms constant bigint := 1 | 2 | 256 | 512 | 1024 | 2048;
begin
  if v_uid is null then
    return false;
  end if;

  select id, server_id, kind, is_private, created_by into c
  from public.channels where id = p_channel;
  if not found then
    return false;
  end if;

  if c.server_id is null then
    if not public.is_channel_member(p_channel, v_uid) then
      return false;
    end if;
    if (p_perm & ~v_member_perms) = 0 then
      return true;
    end if;
    return c.kind = 'group_dm' and c.created_by = v_uid;
  end if;

  if not public.has_permission(c.server_id, v_uid, 1 | p_perm) then
    return false;
  end if;
  if c.is_private
     and not public.has_permission(c.server_id, v_uid, 8)
     and not public.is_channel_member(p_channel, v_uid) then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.can_view_channel(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.channel_has_permission(p_channel, 1);
$$;

-- Can the current user post in a channel right now (permission, mute, announcement, DM blocks)?
create or replace function public.can_send_message(p_channel uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  c     record;
begin
  if not public.channel_has_permission(p_channel, 2) then
    return false;
  end if;

  select server_id, kind into c from public.channels where id = p_channel;

  if c.server_id is not null then
    if public.has_active_sanction(c.server_id, v_uid, 'mute') then
      return false;
    end if;
    if c.kind = 'announcement' and not public.has_permission(c.server_id, v_uid, 4) then
      return false;
    end if;
    return true;
  end if;

  -- 1:1 DM: refuse if either side has blocked the other.
  if c.kind = 'dm' and exists (
    select 1
    from public.channel_members cm
    join public.friendships f
      on f.status = 'blocked'
     and ((f.requester_id = v_uid and f.addressee_id = cm.user_id)
       or (f.addressee_id = v_uid and f.requester_id = cm.user_id))
    where cm.channel_id = p_channel and cm.user_id <> v_uid
  ) then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.message_channel(p_message uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select channel_id from public.messages where id = p_message;
$$;

-- Can the current user see this message (channel visibility + scheduled-message privacy)?
create or replace function public.can_view_message(p_message uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.messages m
    where m.id = p_message
      and public.can_view_channel(m.channel_id)
      and (m.status <> 'scheduled' or m.author_id = auth.uid())
  );
$$;

-- Does the current user hold any moderation permission (KICK | BAN | MUTE) on the server?
create or replace function public.is_moderator(p_server uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (public.member_permissions(p_server, auth.uid()) & (16 | 32 | 64)) <> 0;
$$;

-- =============================================================================
-- Trigger functions
-- =============================================================================

-- Create a profile for every new auth user. Username comes from user metadata when valid
-- and free, otherwise "user_<8 hex>".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate text;
  v_username  text;
begin
  v_candidate := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^A-Za-z0-9_.]', '', 'g'));
  if v_candidate ~ '^[a-z0-9_.]{2,32}$'
     and not exists (select 1 from public.profiles where username = v_candidate) then
    v_username := v_candidate;
  else
    v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    v_username,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', ''), 64), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- New server: owner joins, @everyone role, default category + #general.
create or replace function public.handle_new_server()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category uuid;
begin
  insert into public.server_members (server_id, user_id) values (new.id, new.owner_id)
  on conflict do nothing;

  insert into public.roles (server_id, name, position, permissions, is_default)
  values (new.id, '@everyone', 0, 1 | 2 | 512 | 1024, true);   -- VIEW | SEND | ATTACH | REACT

  insert into public.channel_categories (server_id, name, position)
  values (new.id, 'Text Channels', 0)
  returning id into v_category;

  insert into public.channels (server_id, category_id, kind, name, position, created_by)
  values (new.id, v_category, 'text', 'general', 0, new.owner_id);
  return new;
end;
$$;

-- Only admins may create/modify roles that carry ADMINISTRATOR; the default role must stay default.
create or replace function public.guard_role_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
     and (new.permissions & 4096) <> 0
     and (tg_op = 'INSERT' or (old.permissions & 4096) = 0)
     and not public.has_permission(new.server_id, 4096) then
    raise exception 'only administrators can grant ADMINISTRATOR' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.server_id <> old.server_id or new.is_default <> old.is_default) then
    raise exception 'server_id and is_default are immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.guard_default_role_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Allowed when the whole server is being deleted (cascade).
  if old.is_default and exists (select 1 from public.servers where id = old.server_id) then
    raise exception 'the @everyone role cannot be deleted' using errcode = '22023';
  end if;
  return old;
end;
$$;

-- The owner cannot leave or be removed while the server exists.
create or replace function public.guard_owner_membership()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.servers where id = old.server_id and owner_id = old.user_id) then
    raise exception 'the server owner cannot leave; transfer ownership or delete the server'
      using errcode = '22023';
  end if;
  return old;
end;
$$;

-- Friendship state machine.
create or replace function public.guard_friendship()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'accepted' and auth.uid() is not null then
      raise exception 'friend requests start as pending' using errcode = '22023';
    end if;
    return new;
  end if;

  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'friendship participants are immutable' using errcode = '22023';
  end if;
  if auth.uid() is null then
    return new;   -- service role
  end if;
  if old.status = 'pending' and new.status = 'accepted' and auth.uid() <> old.addressee_id then
    raise exception 'only the addressee can accept a friend request' using errcode = '42501';
  end if;
  if new.status = 'blocked' and old.status <> 'blocked' and auth.uid() <> old.requester_id then
    raise exception 'use block_user() to block' using errcode = '42501';
  end if;
  if old.status = 'blocked' and new.status <> 'blocked' then
    raise exception 'delete the block instead of updating it' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.notify_friendship()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (user_id, type, title, actor_id, data)
    values (new.addressee_id, 'friend_request', 'New friend request', new.requester_id,
            jsonb_build_object('requester_id', new.requester_id));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, type, title, actor_id, data)
    values (new.requester_id, 'friend_accept', 'Friend request accepted', new.addressee_id,
            jsonb_build_object('addressee_id', new.addressee_id));
  end if;
  return new;
end;
$$;

-- Messages: insert-time validation.
create or replace function public.before_message_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_parent_channel uuid;
begin
  if new.kind = 'system' and auth.uid() is not null then
    raise exception 'system messages can only be created by the server' using errcode = '42501';
  end if;

  if new.reply_to is not null then
    select channel_id into v_parent_channel from public.messages where id = new.reply_to;
    if v_parent_channel is distinct from new.channel_id then
      raise exception 'reply_to must reference a message in the same channel' using errcode = '22023';
    end if;
  end if;

  if new.thread_parent_id is not null then
    select channel_id into v_parent_channel from public.messages where id = new.thread_parent_id;
    if v_parent_channel is distinct from new.channel_id then
      raise exception 'thread_parent_id must reference a message in the same channel' using errcode = '22023';
    end if;
  end if;

  if new.scheduled_for is not null and new.scheduled_for > now() then
    new.status := 'scheduled';
  elsif new.status = 'scheduled' then
    new.status := 'sent';
  end if;

  new.pinned := false;
  new.pinned_at := null;
  new.pinned_by := null;
  new.edited_at := null;
  new.deleted_at := null;
  return new;
end;
$$;

-- Messages: who may change what; maintain edited_at / pinned_at; scrub soft-deleted content.
create or replace function public.guard_message_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_body_changed boolean;
begin
  if new.channel_id <> old.channel_id
     or new.author_id is distinct from old.author_id
     or new.created_at <> old.created_at then
    raise exception 'channel_id, author_id and created_at are immutable' using errcode = '22023';
  end if;

  v_body_changed := (new.content, new.attachments, new.metadata, new.ciphertext, new.kind, new.mentions)
                    is distinct from
                    (old.content, old.attachments, old.metadata, old.ciphertext, old.kind, old.mentions);

  if v_uid is not null then   -- service role bypasses these checks
    if v_body_changed or (new.scheduled_for, new.reply_to, new.thread_parent_id)
                         is distinct from (old.scheduled_for, old.reply_to, old.thread_parent_id) then
      if v_uid is distinct from old.author_id then
        raise exception 'only the author can edit a message' using errcode = '42501';
      end if;
      if old.deleted_at is not null then
        raise exception 'deleted messages cannot be edited' using errcode = '22023';
      end if;
    end if;
    if new.deleted_at is distinct from old.deleted_at then
      if old.deleted_at is not null then
        raise exception 'deleted messages cannot be restored' using errcode = '22023';
      end if;
      if v_uid is distinct from old.author_id and not public.channel_has_permission(old.channel_id, 4) then
        raise exception 'MANAGE_MESSAGES required to delete others'' messages' using errcode = '42501';
      end if;
    end if;
    if new.pinned is distinct from old.pinned and not public.channel_has_permission(old.channel_id, 2048) then
      raise exception 'PIN_MESSAGES required' using errcode = '42501';
    end if;
  end if;

  if v_body_changed and old.deleted_at is null and new.deleted_at is null then
    new.edited_at := now();
  end if;

  -- Rescheduling or publishing a scheduled message.
  if new.status = 'scheduled' and (new.scheduled_for is null or new.scheduled_for <= now()) then
    new.status := 'sent';
  end if;

  if new.pinned and not old.pinned then
    new.pinned_at := now();
    new.pinned_by := v_uid;
  elsif not new.pinned then
    new.pinned_at := null;
    new.pinned_by := null;
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    new.content     := '';
    new.ciphertext  := null;
    new.attachments := '[]'::jsonb;
    new.metadata    := '{}'::jsonb;
    new.mentions    := '{}';
    new.pinned      := false;
    new.pinned_at   := null;
    new.pinned_by   := null;
  end if;
  return new;
end;
$$;

-- Messages: side effects after insert (channel activity + reply/mention notifications).
create or replace function public.after_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent_author uuid;
  v_server uuid;
  v_preview text := left(new.content, 140);
begin
  if new.status = 'scheduled' then
    return null;
  end if;

  select server_id into v_server from public.channels where id = new.channel_id;
  update public.channels set last_message_at = new.created_at
  where id = new.channel_id and (last_message_at is null or last_message_at < new.created_at);

  if new.reply_to is not null then
    select author_id into v_parent_author from public.messages where id = new.reply_to;
    if v_parent_author is not null and v_parent_author is distinct from new.author_id then
      insert into public.notifications (user_id, type, title, body, actor_id, server_id, channel_id, message_id)
      values (v_parent_author, 'reply', 'New reply', v_preview, new.author_id, v_server, new.channel_id, new.id);
    end if;
  end if;

  insert into public.notifications (user_id, type, title, body, actor_id, server_id, channel_id, message_id)
  select distinct t.uid, 'mention'::public.notification_type, 'You were mentioned', v_preview,
         new.author_id, v_server, new.channel_id, new.id
  from unnest(new.mentions) as t(uid)
  where t.uid is distinct from new.author_id
    and t.uid is distinct from v_parent_author
    and exists (select 1 from public.profiles p where p.id = t.uid);

  return null;
end;
$$;

-- Poll votes: valid option, open poll, single choice unless allows_multiple.
create or replace function public.guard_poll_vote()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p record;
begin
  select id, options, allows_multiple, closes_at into p from public.polls where id = new.poll_id;
  if not found then
    raise exception 'poll not found' using errcode = '23503';
  end if;
  if p.closes_at is not null and p.closes_at <= now() then
    raise exception 'poll is closed' using errcode = '22023';
  end if;
  if not (p.options @> jsonb_build_array(jsonb_build_object('id', new.option_id))) then
    raise exception 'unknown poll option %', new.option_id using errcode = '22023';
  end if;
  if not p.allows_multiple then
    delete from public.poll_votes
    where poll_id = new.poll_id and user_id = new.user_id and option_id <> new.option_id;
  end if;
  return new;
end;
$$;

-- XP: keep profiles.xp / level in sync. level = floor(sqrt(xp / 100)) + 1.
create or replace function public.apply_xp_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set xp    = greatest(0, xp + new.amount),
      level = floor(sqrt(greatest(0, xp + new.amount) / 100.0))::int + 1
  where id = new.user_id;
  return null;
end;
$$;

create or replace function public.on_achievement_unlocked()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a record;
begin
  select name, xp_reward into a from public.achievements where id = new.achievement_id;
  if a.xp_reward > 0 then
    insert into public.xp_events (user_id, amount, reason)
    values (new.user_id, a.xp_reward, 'achievement:' || new.achievement_id);
  end if;
  insert into public.notifications (user_id, type, title, data)
  values (new.user_id, 'achievement', 'Achievement unlocked: ' || a.name,
          jsonb_build_object('achievement_id', new.achievement_id));
  return null;
end;
$$;

-- Moderation: validate target, apply kick/ban, notify target.
create or replace function public.before_moderation_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.servers where id = new.server_id and owner_id = new.target_user_id) then
    raise exception 'the server owner cannot be moderated' using errcode = '42501';
  end if;
  if auth.uid() is not null then
    new.moderator_id := auth.uid();
    -- Moderators cannot act on someone with ADMINISTRATOR unless they are the owner.
    if public.has_permission(new.server_id, new.target_user_id, 4096)
       and not exists (select 1 from public.servers where id = new.server_id and owner_id = auth.uid()) then
      raise exception 'cannot moderate an administrator' using errcode = '42501';
    end if;
  end if;
  new.revoked_at := null;
  new.revoked_by := null;
  return new;
end;
$$;

create or replace function public.after_moderation_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.action in ('kick', 'ban') then
    delete from public.server_members where server_id = new.server_id and user_id = new.target_user_id;
  end if;
  insert into public.notifications (user_id, type, title, body, actor_id, server_id, data)
  values (
    new.target_user_id, 'moderation',
    case new.action
      when 'warn' then 'You received a warning'
      when 'mute' then 'You have been muted'
      when 'kick' then 'You were removed from a server'
      when 'ban'  then 'You were banned from a server'
    end,
    new.reason, new.moderator_id, new.server_id,
    jsonb_build_object('action', new.action, 'expires_at', new.expires_at, 'moderation_id', new.id)
  );
  return null;
end;
$$;

create or replace function public.guard_moderation_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (new.server_id, new.target_user_id, new.action, new.created_at, new.moderator_id)
     is distinct from (old.server_id, old.target_user_id, old.action, old.created_at, old.moderator_id) then
    raise exception 'only reason, expires_at and revocation can change' using errcode = '22023';
  end if;
  if new.revoked_at is not null and old.revoked_at is null then
    new.revoked_by := coalesce(auth.uid(), new.revoked_by);
  end if;
  return new;
end;
$$;

create or replace function public.guard_report_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status in ('resolved', 'dismissed') and old.status not in ('resolved', 'dismissed') then
    new.resolved_at := now();
    new.resolved_by := coalesce(auth.uid(), new.resolved_by);
  elsif new.status not in ('resolved', 'dismissed') then
    new.resolved_at := null;
    new.resolved_by := null;
  end if;
  return new;
end;
$$;

-- Typing rows always live for 8 seconds from the last upsert.
create or replace function public.touch_typing_indicator()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.started_at := now();
  else
    new.started_at := old.started_at;
  end if;
  new.expires_at := now() + interval '8 seconds';
  return new;
end;
$$;

-- =============================================================================
-- Triggers
-- =============================================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at           before update on public.profiles           for each row execute function public.set_updated_at();
create trigger friendships_set_updated_at        before update on public.friendships        for each row execute function public.set_updated_at();
create trigger servers_set_updated_at            before update on public.servers            for each row execute function public.set_updated_at();
create trigger roles_set_updated_at              before update on public.roles              for each row execute function public.set_updated_at();
create trigger channel_categories_set_updated_at before update on public.channel_categories for each row execute function public.set_updated_at();
create trigger channels_set_updated_at           before update on public.channels           for each row execute function public.set_updated_at();
create trigger messages_set_updated_at           before update on public.messages           for each row execute function public.set_updated_at();
create trigger polls_set_updated_at              before update on public.polls              for each row execute function public.set_updated_at();
create trigger reports_set_updated_at            before update on public.reports            for each row execute function public.set_updated_at();

create trigger servers_after_insert       after insert on public.servers for each row execute function public.handle_new_server();
create trigger roles_guard                before insert or update on public.roles for each row execute function public.guard_role_change();
create trigger roles_guard_delete         before delete on public.roles for each row execute function public.guard_default_role_delete();
create trigger server_members_guard_owner before delete on public.server_members for each row execute function public.guard_owner_membership();

create trigger friendships_guard  before insert or update on public.friendships for each row execute function public.guard_friendship();
create trigger friendships_notify after insert or update on public.friendships for each row execute function public.notify_friendship();

-- Triggers of the same timing fire alphabetically; "a_" keeps the guard ahead of set_updated_at.
create trigger messages_a_before_insert before insert on public.messages for each row execute function public.before_message_insert();
create trigger messages_a_guard_update  before update on public.messages for each row execute function public.guard_message_update();
create trigger messages_after_insert    after insert  on public.messages for each row execute function public.after_message_insert();

create trigger typing_touch before insert or update on public.typing_indicators for each row execute function public.touch_typing_indicator();
create trigger poll_votes_guard before insert on public.poll_votes for each row execute function public.guard_poll_vote();

create trigger xp_events_apply after insert on public.xp_events for each row execute function public.apply_xp_event();
create trigger user_achievements_unlocked after insert on public.user_achievements for each row execute function public.on_achievement_unlocked();

create trigger moderation_before_insert before insert on public.moderation_actions for each row execute function public.before_moderation_insert();
create trigger moderation_after_insert  after insert on public.moderation_actions for each row execute function public.after_moderation_insert();
create trigger moderation_guard_update  before update on public.moderation_actions for each row execute function public.guard_moderation_update();

create trigger reports_guard_update before update on public.reports for each row execute function public.guard_report_update();

-- =============================================================================
-- RPC functions (callable via supabase.rpc)
-- =============================================================================

-- Join a server by invite code. Returns the server id.
create or replace function public.join_server_by_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_server uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select id into v_server from public.servers where invite_code = p_code;
  if v_server is null then
    raise exception 'invalid invite' using errcode = 'P0002';
  end if;
  if public.has_active_sanction(v_server, v_uid, 'ban') then
    raise exception 'you are banned from this server' using errcode = '42501';
  end if;
  insert into public.server_members (server_id, user_id) values (v_server, v_uid)
  on conflict do nothing;
  return v_server;
end;
$$;

-- Find or create the 1:1 DM channel between the current user and p_other.
create or replace function public.create_dm(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_channel uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_other is null or p_other = v_uid then
    raise exception 'invalid recipient' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.friendships
    where status = 'blocked'
      and ((requester_id = v_uid and addressee_id = p_other) or (requester_id = p_other and addressee_id = v_uid))
  ) then
    raise exception 'cannot message this user' using errcode = '42501';
  end if;

  select c.id into v_channel
  from public.channels c
  join public.channel_members a on a.channel_id = c.id and a.user_id = v_uid
  join public.channel_members b on b.channel_id = c.id and b.user_id = p_other
  where c.kind = 'dm'
  limit 1;

  if v_channel is null then
    insert into public.channels (kind, created_by) values ('dm', v_uid) returning id into v_channel;
    insert into public.channel_members (channel_id, user_id) values (v_channel, v_uid), (v_channel, p_other);
  end if;
  return v_channel;
end;
$$;

-- Create a group DM with the given members (creator is added automatically).
create or replace function public.create_group_dm(p_members uuid[], p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_channel uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if coalesce(array_length(p_members, 1), 0) < 1 or array_length(p_members, 1) > 9 then
    raise exception 'group DMs have 2-10 members' using errcode = '22023';
  end if;
  insert into public.channels (kind, name, created_by) values ('group_dm', nullif(p_name, ''), v_uid)
  returning id into v_channel;
  insert into public.channel_members (channel_id, user_id)
  select v_channel, u from (select distinct unnest(p_members || v_uid) as u) s
  where exists (select 1 from public.profiles where id = s.u);
  return v_channel;
end;
$$;

-- Block a user: replaces any existing relationship with (me -> them, blocked).
create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_target is null or p_target = v_uid then
    raise exception 'invalid block' using errcode = '22023';
  end if;
  delete from public.friendships
  where (requester_id = v_uid and addressee_id = p_target)
     or (requester_id = p_target and addressee_id = v_uid);
  insert into public.friendships (requester_id, addressee_id, status) values (v_uid, p_target, 'blocked');
end;
$$;

-- Toggle a reaction. Returns true if added, false if removed. Runs with caller's RLS.
create or replace function public.toggle_reaction(p_message uuid, p_emoji text)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.reactions
  where message_id = p_message and user_id = auth.uid() and emoji = p_emoji;
  if found then
    return false;
  end if;
  insert into public.reactions (message_id, user_id, emoji) values (p_message, auth.uid(), p_emoji);
  return true;
end;
$$;

-- Full-text message search. Runs with caller's RLS, so only visible messages are returned.
create or replace function public.search_messages(
  p_query      text,
  p_server     uuid        default null,
  p_channel    uuid        default null,
  p_author     uuid        default null,
  p_has        text        default null,   -- 'attachment' | 'link' | 'pinned' | 'poll'
  p_before     timestamptz default null,
  p_after      timestamptz default null,
  p_limit      integer     default 25,
  p_offset     integer     default 0
)
returns table (
  id uuid, channel_id uuid, server_id uuid, author_id uuid, content text,
  kind public.message_kind, created_at timestamptz, rank real, headline text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select case when coalesce(trim(p_query), '') = '' then null
                else websearch_to_tsquery('simple', p_query) end as tsq
  )
  select m.id, m.channel_id, c.server_id, m.author_id, m.content, m.kind, m.created_at,
         case when q.tsq is null then 0 else ts_rank(m.search, q.tsq) end::real as rank,
         case when q.tsq is null then left(m.content, 200)
              else ts_headline('simple', m.content, q.tsq, 'MaxFragments=2, MaxWords=20, MinWords=5') end as headline
  from public.messages m
  join public.channels c on c.id = m.channel_id
  cross join q
  where m.deleted_at is null
    and m.status <> 'scheduled'
    and (q.tsq is null or m.search @@ q.tsq)
    and (p_server  is null or c.server_id = p_server)
    and (p_channel is null or m.channel_id = p_channel)
    and (p_author  is null or m.author_id = p_author)
    and (p_before  is null or m.created_at < p_before)
    and (p_after   is null or m.created_at > p_after)
    and (
      p_has is null
      or (p_has = 'attachment' and jsonb_array_length(m.attachments) > 0)
      or (p_has = 'link'       and m.content ~* 'https?://')
      or (p_has = 'pinned'     and m.pinned)
      or (p_has = 'poll'       and m.kind = 'poll')
    )
  order by rank desc, m.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Daily analytics for a server (ADMINISTRATOR only).
create or replace function public.get_server_analytics(p_server uuid, p_days integer default 30)
returns table (day date, messages bigint, active_users bigint, new_members bigint, reactions bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.has_permission(p_server, 4096) then
    raise exception 'ADMINISTRATOR required' using errcode = '42501';
  end if;
  return query
  with days as (
    select generate_series(current_date - (least(greatest(p_days, 1), 365) - 1), current_date, interval '1 day')::date as day
  ),
  msg as (
    select m.created_at::date as day, count(*) as messages, count(distinct m.author_id) as active_users
    from public.messages m
    join public.channels c on c.id = m.channel_id
    where c.server_id = p_server
      and m.created_at >= current_date - (least(greatest(p_days, 1), 365) - 1)
      and m.deleted_at is null
    group by 1
  ),
  mem as (
    select joined_at::date as day, count(*) as new_members
    from public.server_members
    where server_id = p_server and joined_at >= current_date - (least(greatest(p_days, 1), 365) - 1)
    group by 1
  ),
  rx as (
    select r.created_at::date as day, count(*) as reactions
    from public.reactions r
    join public.messages m on m.id = r.message_id
    join public.channels c on c.id = m.channel_id
    where c.server_id = p_server and r.created_at >= current_date - (least(greatest(p_days, 1), 365) - 1)
    group by 1
  )
  select d.day,
         coalesce(msg.messages, 0),
         coalesce(msg.active_users, 0),
         coalesce(mem.new_members, 0),
         coalesce(rx.reactions, 0)
  from days d
  left join msg on msg.day = d.day
  left join mem on mem.day = d.day
  left join rx  on rx.day  = d.day
  order by d.day;
end;
$$;

-- Publish scheduled messages whose time has come. Run every minute with pg_cron:
--   select cron.schedule('publish-scheduled', '* * * * *', 'select public.publish_due_scheduled_messages()');
create or replace function public.publish_due_scheduled_messages()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  with due as (
    update public.messages
    set status = 'sent'
    where status = 'scheduled' and scheduled_for <= now()
    returning channel_id, scheduled_for
  ), latest as (
    select channel_id, max(scheduled_for) as ts from due group by channel_id
  ), touch as (
    update public.channels c set last_message_at = greatest(coalesce(c.last_message_at, l.ts), l.ts)
    from latest l where c.id = l.channel_id
    returning 1
  )
  select count(*) into v_count from due;
  return v_count;
end;
$$;

-- Remove stale typing rows (also safe to call from pg_cron).
create or replace function public.prune_typing_indicators()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  with d as (delete from public.typing_indicators where expires_at < now() returning 1)
  select count(*)::int from d;
$$;

-- Maintenance functions: service role / pg_cron only.
revoke execute on function public.publish_due_scheduled_messages() from public, anon, authenticated;
revoke execute on function public.prune_typing_indicators() from public, anon, authenticated;
grant  execute on function public.publish_due_scheduled_messages() to service_role;
grant  execute on function public.prune_typing_indicators() to service_role;
-- Arbitrary-user permission lookups: not for anonymous callers.
revoke execute on function public.member_permissions(uuid, uuid) from public, anon;
revoke execute on function public.has_permission(uuid, uuid, bigint) from public, anon;
grant  execute on function public.member_permissions(uuid, uuid) to authenticated, service_role;
grant  execute on function public.has_permission(uuid, uuid, bigint) to authenticated, service_role;

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.permissions        enable row level security;
alter table public.profiles           enable row level security;
alter table public.friendships        enable row level security;
alter table public.servers            enable row level security;
alter table public.server_members     enable row level security;
alter table public.roles              enable row level security;
alter table public.member_roles       enable row level security;
alter table public.channel_categories enable row level security;
alter table public.channels           enable row level security;
alter table public.channel_members    enable row level security;
alter table public.messages           enable row level security;
alter table public.reactions          enable row level security;
alter table public.saved_messages     enable row level security;
alter table public.polls              enable row level security;
alter table public.poll_votes         enable row level security;
alter table public.achievements       enable row level security;
alter table public.user_achievements  enable row level security;
alter table public.xp_events          enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.reports            enable row level security;
alter table public.notifications      enable row level security;
alter table public.typing_indicators  enable row level security;

-- permissions (reference data)
create policy "permissions: readable by everyone" on public.permissions
  for select to anon, authenticated using (true);

-- profiles
create policy "profiles: readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- friendships (blocked rows are invisible to the blocked user)
create policy "friendships: participants read" on public.friendships
  for select to authenticated
  using (requester_id = auth.uid() or (addressee_id = auth.uid() and status <> 'blocked'));
create policy "friendships: send request" on public.friendships
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
create policy "friendships: participants update" on public.friendships
  for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "friendships: participants delete" on public.friendships
  for delete to authenticated
  using (requester_id = auth.uid() or (addressee_id = auth.uid() and status <> 'blocked'));

-- servers
create policy "servers: public or member read" on public.servers
  for select to authenticated using (is_public or public.is_server_member(id));
create policy "servers: create as owner" on public.servers
  for insert to authenticated with check (owner_id = auth.uid());
create policy "servers: admins update" on public.servers
  for update to authenticated using (public.has_permission(id, 4096)) with check (public.has_permission(id, 4096));
create policy "servers: owner deletes" on public.servers
  for delete to authenticated using (owner_id = auth.uid());

-- server_members
create policy "server_members: members read roster" on public.server_members
  for select to authenticated using (public.is_server_member(server_id));
create policy "server_members: join public servers" on public.server_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.servers s where s.id = server_id and s.is_public)
    and not public.has_active_sanction(server_id, auth.uid(), 'ban')
  );
create policy "server_members: update own nickname" on public.server_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "server_members: leave or kick" on public.server_members
  for delete to authenticated using (user_id = auth.uid() or public.has_permission(server_id, 16));

-- roles
create policy "roles: members read" on public.roles
  for select to authenticated using (public.is_server_member(server_id));
create policy "roles: managers insert" on public.roles
  for insert to authenticated with check (public.has_permission(server_id, 128));
create policy "roles: managers update" on public.roles
  for update to authenticated using (public.has_permission(server_id, 128)) with check (public.has_permission(server_id, 128));
create policy "roles: managers delete" on public.roles
  for delete to authenticated using (public.has_permission(server_id, 128));

-- member_roles
create policy "member_roles: members read" on public.member_roles
  for select to authenticated using (public.is_server_member(server_id));
create policy "member_roles: managers assign" on public.member_roles
  for insert to authenticated with check (public.has_permission(server_id, 128));
create policy "member_roles: managers remove" on public.member_roles
  for delete to authenticated using (public.has_permission(server_id, 128));

-- channel_categories
create policy "categories: members read" on public.channel_categories
  for select to authenticated using (public.is_server_member(server_id));
create policy "categories: managers write" on public.channel_categories
  for all to authenticated using (public.has_permission(server_id, 8)) with check (public.has_permission(server_id, 8));

-- channels
create policy "channels: visible channels" on public.channels
  for select to authenticated using (public.can_view_channel(id));
create policy "channels: managers create server channels" on public.channels
  for insert to authenticated
  with check (server_id is not null and public.has_permission(server_id, 8) and created_by = auth.uid());
create policy "channels: managers update" on public.channels
  for update to authenticated
  using (public.channel_has_permission(id, 8))
  with check (public.channel_has_permission(id, 8));
create policy "channels: managers delete" on public.channels
  for delete to authenticated using (public.channel_has_permission(id, 8));

-- channel_members
create policy "channel_members: visible channel rosters" on public.channel_members
  for select to authenticated using (user_id = auth.uid() or public.can_view_channel(channel_id));
create policy "channel_members: managers add" on public.channel_members
  for insert to authenticated with check (public.channel_has_permission(channel_id, 8));
create policy "channel_members: update own read state" on public.channel_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "channel_members: leave or remove" on public.channel_members
  for delete to authenticated using (user_id = auth.uid() or public.channel_has_permission(channel_id, 8));

-- messages
create policy "messages: members read their channels" on public.messages
  for select to authenticated
  using (public.can_view_channel(channel_id) and (status <> 'scheduled' or author_id = auth.uid()));
create policy "messages: send" on public.messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_send_message(channel_id)
    and (jsonb_array_length(attachments) = 0 or public.channel_has_permission(channel_id, 512))
    and (not mention_everyone or public.channel_has_permission(channel_id, 256))
  );
-- Field-level rules (author-only edits, MANAGE_MESSAGES deletes, PIN_MESSAGES pins) are
-- enforced by guard_message_update().
create policy "messages: authors and moderators update" on public.messages
  for update to authenticated
  using (
    author_id = auth.uid()
    or public.channel_has_permission(channel_id, 4)
    or public.channel_has_permission(channel_id, 2048)
  )
  with check (public.can_view_channel(channel_id));
create policy "messages: authors and moderators hard-delete" on public.messages
  for delete to authenticated
  using (author_id = auth.uid() or public.channel_has_permission(channel_id, 4));

-- reactions
create policy "reactions: visible with message" on public.reactions
  for select to authenticated using (public.can_view_message(message_id));
create policy "reactions: add" on public.reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_view_message(message_id)
    and public.channel_has_permission(public.message_channel(message_id), 1024)
  );
create policy "reactions: remove own or moderate" on public.reactions
  for delete to authenticated
  using (user_id = auth.uid() or public.channel_has_permission(public.message_channel(message_id), 4));

-- saved_messages
create policy "saved: own" on public.saved_messages
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_view_message(message_id));

-- polls
create policy "polls: visible with message" on public.polls
  for select to authenticated using (public.can_view_message(message_id));
create policy "polls: message author creates" on public.polls
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.messages m where m.id = message_id and m.author_id = auth.uid())
  );
create policy "polls: creator updates" on public.polls
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

-- poll_votes (anonymous polls: you only see your own votes; tallies via get_poll_results())
create policy "poll_votes: read" on public.poll_votes
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.polls p
      where p.id = poll_id and not p.is_anonymous and public.can_view_message(p.message_id)
    )
  );
create policy "poll_votes: vote" on public.poll_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.polls p where p.id = poll_id and public.can_view_message(p.message_id))
  );
create policy "poll_votes: retract own" on public.poll_votes
  for delete to authenticated using (user_id = auth.uid());

-- achievements / user_achievements / xp_events: read-only for users; written by service role / triggers
create policy "achievements: readable" on public.achievements
  for select to authenticated using (not is_secret or exists (
    select 1 from public.user_achievements ua where ua.achievement_id = achievements.id and ua.user_id = auth.uid()
  ));
create policy "user_achievements: readable" on public.user_achievements
  for select to authenticated using (true);
create policy "xp_events: own" on public.xp_events
  for select to authenticated using (user_id = auth.uid());

-- moderation_actions
create policy "moderation: moderators and target read" on public.moderation_actions
  for select to authenticated using (target_user_id = auth.uid() or public.is_moderator(server_id));
create policy "moderation: moderators act" on public.moderation_actions
  for insert to authenticated
  with check (
    case action
      when 'warn' then public.is_moderator(server_id)
      when 'mute' then public.has_permission(server_id, 64)
      when 'kick' then public.has_permission(server_id, 16)
      when 'ban'  then public.has_permission(server_id, 32)
    end
  );
create policy "moderation: moderators revoke" on public.moderation_actions
  for update to authenticated
  using (
    case action
      when 'warn' then public.is_moderator(server_id)
      when 'mute' then public.has_permission(server_id, 64)
      when 'kick' then public.has_permission(server_id, 16)
      when 'ban'  then public.has_permission(server_id, 32)
    end
  )
  with check (true);

-- reports
create policy "reports: file" on public.reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
    and (message_id is null or public.can_view_message(message_id))
  );
create policy "reports: reporter or moderators read" on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or (server_id is not null and public.has_permission(server_id, 4)));
create policy "reports: moderators triage" on public.reports
  for update to authenticated
  using (server_id is not null and public.has_permission(server_id, 4))
  with check (server_id is not null and public.has_permission(server_id, 4));

-- notifications (created by triggers / service role)
create policy "notifications: own read" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: own delete" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- typing_indicators
create policy "typing: visible channels" on public.typing_indicators
  for select to authenticated using (public.can_view_channel(channel_id));
create policy "typing: set own" on public.typing_indicators
  for insert to authenticated with check (user_id = auth.uid() and public.can_send_message(channel_id));
create policy "typing: refresh own" on public.typing_indicators
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "typing: clear own" on public.typing_indicators
  for delete to authenticated using (user_id = auth.uid());

-- Poll tallies that respect anonymity (counts only).
create or replace function public.get_poll_results(p_poll uuid)
returns table (option_id text, votes bigint, voted_by_me boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_message uuid;
begin
  select message_id into v_message from public.polls where id = p_poll;
  if v_message is null or not public.can_view_message(v_message) then
    raise exception 'poll not found' using errcode = 'P0002';
  end if;
  return query
  select o ->> 'id',
         count(v.user_id),
         coalesce(bool_or(v.user_id = auth.uid()), false)
  from public.polls p
  cross join lateral jsonb_array_elements(p.options) as o
  left join public.poll_votes v on v.poll_id = p.id and v.option_id = o ->> 'id'
  where p.id = p_poll
  group by o ->> 'id';
end;
$$;

-- =============================================================================
-- Storage: attachments (private) and avatars (public)
-- Object path convention:
--   attachments/{channel_id}/{user_id}/{uuid}-{filename}
--   avatars/{user_id}/{filename}
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attachments', 'attachments', false, 26214400,  -- 25 MiB
   array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif',
         'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/wav',
         'application/pdf', 'text/plain', 'application/zip', 'application/json']),
  ('avatars', 'avatars', true, 5242880,               -- 5 MiB
   array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "attachments: read in visible channels" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and public.can_view_channel(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "attachments: upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.can_send_message(public.try_uuid((storage.foldername(name))[1]))
    and public.channel_has_permission(public.try_uuid((storage.foldername(name))[1]), 512)
  );
create policy "attachments: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "avatars: public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars: write own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================================
-- Realtime
-- =============================================================================
-- Full row images so UPDATE/DELETE payloads include channel_id (needed for filters).
alter table public.messages          replica identity full;
alter table public.reactions         replica identity full;
alter table public.typing_indicators replica identity full;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['messages', 'reactions', 'typing_indicators', 'notifications', 'poll_votes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

commit;
