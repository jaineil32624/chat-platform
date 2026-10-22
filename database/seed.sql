-- =============================================================================
-- Pulse — demo seed data
-- =============================================================================
-- Runs automatically after migrations on `supabase db reset` (see supabase/config.toml
-- [db.seed]); otherwise paste into the SQL editor *after* schema.sql.
--
-- Demo logins (email / password):
--   alice@pulse.dev / password123   owner of "Pulse HQ" and "Game Night"
--   bob@pulse.dev   / password123   Moderator in Pulse HQ
--   carol@pulse.dev / password123   member
--   dave@pulse.dev  / password123   member (muted in Pulse HQ for 1 hour)
--
-- Safe to re-run: every insert uses fixed ids + ON CONFLICT DO NOTHING.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Users (profiles are created by the on_auth_user_created trigger)
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('username', u.username, 'display_name', u.display_name),
  now() - u.age, now() - u.age, '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'alice@pulse.dev', 'alice', 'Alice Nguyen', interval '90 days'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bob@pulse.dev',   'bob',   'Bob Martins',  interval '60 days'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'carol@pulse.dev', 'carol', 'Carol Diaz',   interval '30 days'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'dave@pulse.dev',  'dave',  'Dave Okafor',  interval '7 days')
) as u(id, email, username, display_name, age)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('alice@pulse.dev', 'bob@pulse.dev', 'carol@pulse.dev', 'dave@pulse.dev')
on conflict (provider_id, provider) do nothing;

update public.profiles p set
  bio = v.bio, status = v.status::public.presence_status, custom_status = v.custom_status, accent_color = v.accent
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'Building Pulse. Coffee-powered.', 'online', 'Shipping v1', '#7c3aed'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'Keeps the peace.',                'idle',   null,          '#0ea5e9'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'Designer & trivia nerd.',         'dnd',    'In a meeting', '#f97316'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'New here!',                       'offline', null,         '#22c55e')
) as v(id, bio, status, custom_status, accent)
where p.id = v.id;

-- -----------------------------------------------------------------------------
-- Friendships
-- -----------------------------------------------------------------------------
insert into public.friendships (requester_id, addressee_id, status) values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'accepted'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'accepted'),
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'pending')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Servers (handle_new_server adds the owner, @everyone, "Text Channels" and #general)
-- -----------------------------------------------------------------------------
insert into public.servers (id, name, description, owner_id, is_public, invite_code) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Pulse HQ',   'Official community for the Pulse chat platform.', '11111111-1111-4111-8111-111111111111', true,  'pulse-hq'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Game Night', 'Weekly games, trivia and polls.',                 '11111111-1111-4111-8111-111111111111', false, 'game-night')
on conflict (id) do nothing;

insert into public.server_members (server_id, user_id, nickname) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Bob (mod)'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', null),
  ('aaaaaaaa-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', null),
  ('aaaaaaaa-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', null)
on conflict do nothing;

-- Roles. Moderator = VIEW|SEND|MANAGE_MESSAGES|KICK|MUTE|MENTION_EVERYONE|ATTACH|REACT|PIN = 3927
insert into public.roles (id, server_id, name, color, position, permissions, hoist, mentionable) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Admin',     '#ef4444', 3, 4096, true, false),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Moderator', '#0ea5e9', 2, 1|2|4|16|64|256|512|1024|2048, true, true),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'Supporter', '#f59e0b', 1, 1|2|512|1024, false, false)
on conflict (id) do nothing;

insert into public.member_roles (server_id, user_id, role_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0000-4000-8000-000000000002'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'bbbbbbbb-0000-4000-8000-000000000003')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Categories & channels
-- -----------------------------------------------------------------------------
insert into public.channel_categories (id, server_id, name, position) values
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Information', 1),
  ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Voice',       2),
  ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'Staff',       3)
on conflict (id) do nothing;

insert into public.channels (id, server_id, category_id, kind, name, topic, position, is_private, slowmode_seconds, created_by) values
  ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'announcement', 'announcements', 'Release notes and news', 0, false, 0,  '11111111-1111-4111-8111-111111111111'),
  ('dddddddd-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'text',         'rules',         'Be kind.',               1, false, 0,  '11111111-1111-4111-8111-111111111111'),
  ('dddddddd-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', null,                                   'text',         'random',        'Off-topic chatter',      1, false, 5,  '11111111-1111-4111-8111-111111111111'),
  ('dddddddd-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000002', 'voice',        'Lounge',        null,                     0, false, 0,  '11111111-1111-4111-8111-111111111111'),
  ('dddddddd-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000003', 'text',         'mod-chat',      'Staff only',             0, true,  0,  '11111111-1111-4111-8111-111111111111'),
  ('dddddddd-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000002', null,                                   'text',         'trivia',        'Trivia every Friday',    1, false, 0,  '11111111-1111-4111-8111-111111111111'),
  -- DM between alice and bob
  ('dddddddd-0000-4000-8000-0000000000d1', null, null, 'dm', null, null, 0, false, 0, '11111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;

insert into public.channel_members (channel_id, user_id) values
  ('dddddddd-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222'),
  ('dddddddd-0000-4000-8000-0000000000d1', '11111111-1111-4111-8111-111111111111'),
  ('dddddddd-0000-4000-8000-0000000000d1', '22222222-2222-4222-8222-222222222222')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Messages
-- -----------------------------------------------------------------------------
insert into public.messages (id, channel_id, author_id, kind, content, metadata, attachments, reply_to, created_at)
select v.id, coalesce(v.channel_id, g.id), v.author_id, v.kind::public.message_kind, v.content, v.metadata::jsonb, v.attachments::jsonb, v.reply_to, now() - v.ago
from (values
  ('eeeeeeee-0000-4000-8000-000000000001'::uuid, null::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'text',
     'Welcome to **Pulse HQ**! Say hi 👋', '{}', '[]', null::uuid, interval '3 days'),
  ('eeeeeeee-0000-4000-8000-000000000002'::uuid, null, '22222222-2222-4222-8222-222222222222'::uuid, 'text',
     'Hey everyone! Mod here — ping me if you need anything.', '{}', '[]', 'eeeeeeee-0000-4000-8000-000000000001'::uuid, interval '3 days' - interval '5 minutes'),
  ('eeeeeeee-0000-4000-8000-000000000003'::uuid, null, '33333333-3333-4333-8333-333333333333'::uuid, 'gif',
     '', '{"gif":{"url":"https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif","provider":"giphy","width":480,"height":270}}', '[]', null, interval '2 days'),
  ('eeeeeeee-0000-4000-8000-000000000004'::uuid, null, '33333333-3333-4333-8333-333333333333'::uuid, 'text',
     'Here is the new logo concept', '{}',
     '[{"id":"att_1","name":"logo.png","url":"attachments/aaaaaaaa-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333/logo.png","contentType":"image/png","size":48213,"width":512,"height":512}]',
     null, interval '1 day'),
  ('eeeeeeee-0000-4000-8000-000000000005'::uuid, null, '44444444-4444-4444-8444-444444444444'::uuid, 'sticker',
     '', '{"sticker":{"id":"wave","name":"Wave","url":"/stickers/wave.webp"}}', '[]', null, interval '6 hours'),
  ('eeeeeeee-0000-4000-8000-000000000006'::uuid, 'dddddddd-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'text',
     'v1.0 is live: threads, polls, voice messages and the whiteboard. 🎉', '{}', '[]', null, interval '12 hours'),
  ('eeeeeeee-0000-4000-8000-000000000007'::uuid, 'dddddddd-0000-4000-8000-000000000003'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 'voice',
     '', '{"voice":{"durationMs":7400,"waveform":[2,5,9,7,4,8,3,1]}}',
     '[{"id":"att_2","name":"voice.webm","url":"attachments/dddddddd-0000-4000-8000-000000000003/22222222-2222-4222-8222-222222222222/voice.webm","contentType":"audio/webm","size":21004}]',
     null, interval '3 hours'),
  ('eeeeeeee-0000-4000-8000-000000000008'::uuid, 'dddddddd-0000-4000-8000-000000000005'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 'text',
     'Heads up: muted dave for an hour, spam in #random.', '{}', '[]', null, interval '30 minutes'),
  ('eeeeeeee-0000-4000-8000-000000000009'::uuid, 'dddddddd-0000-4000-8000-0000000000d1'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'text',
     'Can you review the moderation dashboard later?', '{}', '[]', null, interval '2 hours'),
  ('eeeeeeee-0000-4000-8000-00000000000a'::uuid, 'dddddddd-0000-4000-8000-0000000000d1'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 'text',
     'Sure, after lunch!', '{}', '[]', 'eeeeeeee-0000-4000-8000-000000000009'::uuid, interval '1 hour 50 minutes'),
  ('eeeeeeee-0000-4000-8000-00000000000b'::uuid, 'dddddddd-0000-4000-8000-000000000006'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'poll',
     'What should we play Friday?', '{}', '[]', null, interval '1 day'),
  ('eeeeeeee-0000-4000-8000-00000000000c'::uuid, 'dddddddd-0000-4000-8000-000000000006'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'trivia',
     'Trivia: Which planet has the most moons?', '{"trivia":{"choices":["Jupiter","Saturn","Uranus","Neptune"],"answerIndex":1,"explanation":"Saturn has 146 confirmed moons (2023)."}}', '[]', null, interval '20 hours'),
  ('eeeeeeee-0000-4000-8000-00000000000d'::uuid, null, null, 'system',
     'dave joined the server.', '{"event":"member_join","userId":"44444444-4444-4444-8444-444444444444"}', '[]', null, interval '7 days')
) as v(id, channel_id, author_id, kind, content, metadata, attachments, reply_to, ago)
cross join lateral (
  select c.id from public.channels c
  where c.server_id = 'aaaaaaaa-0000-4000-8000-000000000001' and c.name = 'general'
  limit 1
) g
order by v.ago desc
on conflict (id) do nothing;

-- Thread reply under the welcome message
insert into public.messages (id, channel_id, author_id, content, thread_parent_id, created_at)
select 'eeeeeeee-0000-4000-8000-00000000000e', m.channel_id, '44444444-4444-4444-8444-444444444444',
       'Thanks for the warm welcome!', m.id, now() - interval '2 days 12 hours'
from public.messages m where m.id = 'eeeeeeee-0000-4000-8000-000000000001'
on conflict (id) do nothing;

-- A scheduled message (visible only to its author until published)
insert into public.messages (id, channel_id, author_id, content, scheduled_for)
values ('eeeeeeee-0000-4000-8000-00000000000f', 'dddddddd-0000-4000-8000-000000000001',
        '11111111-1111-4111-8111-111111111111', 'Reminder: community call starts in 1 hour!', now() + interval '1 day')
on conflict (id) do nothing;

-- Pin the welcome + release note
update public.messages set pinned = true, pinned_at = now(), pinned_by = '11111111-1111-4111-8111-111111111111'
where id in ('eeeeeeee-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000006') and not pinned;

insert into public.reactions (message_id, user_id, emoji) values
  ('eeeeeeee-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '👋'),
  ('eeeeeeee-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', '👋'),
  ('eeeeeeee-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', '🎉'),
  ('eeeeeeee-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '🔥'),
  ('eeeeeeee-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', '🎉')
on conflict do nothing;

insert into public.saved_messages (user_id, message_id, note) values
  ('33333333-3333-4333-8333-333333333333', 'eeeeeeee-0000-4000-8000-000000000006', 'Release notes')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Poll
-- -----------------------------------------------------------------------------
insert into public.polls (id, message_id, question, options, allows_multiple, closes_at, created_by) values
  ('ffffffff-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-00000000000b', 'What should we play Friday?',
   '[{"id":"a","label":"Codenames"},{"id":"b","label":"Among Us"},{"id":"c","label":"Trivia marathon"}]',
   false, now() + interval '3 days', '11111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;

insert into public.poll_votes (poll_id, user_id, option_id) values
  ('ffffffff-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a'),
  ('ffffffff-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'c')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Gamification
-- -----------------------------------------------------------------------------
insert into public.achievements (id, name, description, icon, xp_reward, is_secret) values
  ('first_message',  'Hello, World',     'Send your first message.',               '💬', 10,  false),
  ('first_reaction', 'Reactor',          'React to a message.',                    '😀', 5,   false),
  ('poll_creator',   'Democracy!',       'Create a poll.',                         '📊', 15,  false),
  ('trivia_ace',     'Trivia Ace',       'Answer 10 trivia questions correctly.',  '🧠', 50,  false),
  ('night_owl',      'Night Owl',        'Send a message between 2am and 4am.',    '🦉', 25,  true),
  ('server_founder', 'Founder',          'Create a server.',                       '🏰', 30,  false)
on conflict (id) do nothing;

insert into public.user_achievements (user_id, achievement_id) values
  ('11111111-1111-4111-8111-111111111111', 'first_message'),
  ('11111111-1111-4111-8111-111111111111', 'server_founder'),
  ('11111111-1111-4111-8111-111111111111', 'poll_creator'),
  ('22222222-2222-4222-8222-222222222222', 'first_message'),
  ('33333333-3333-4333-8333-333333333333', 'first_message'),
  ('33333333-3333-4333-8333-333333333333', 'first_reaction')
on conflict do nothing;

-- Extra XP (guarded so re-running the seed does not double-count)
insert into public.xp_events (user_id, server_id, amount, reason)
select v.user_id, 'aaaaaaaa-0000-4000-8000-000000000001', v.amount, 'seed:activity'
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 420),
  ('22222222-2222-4222-8222-222222222222'::uuid, 180),
  ('33333333-3333-4333-8333-333333333333'::uuid, 95)
) as v(user_id, amount)
where not exists (select 1 from public.xp_events where reason = 'seed:activity');

-- -----------------------------------------------------------------------------
-- Moderation & reports
-- -----------------------------------------------------------------------------
insert into public.moderation_actions (id, server_id, target_user_id, moderator_id, action, reason, expires_at) values
  ('99999999-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444',
   '22222222-2222-4222-8222-222222222222', 'warn', 'Please keep #general on-topic.', null),
  ('99999999-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444',
   '22222222-2222-4222-8222-222222222222', 'mute', 'Spam in #random.', now() + interval '1 hour')
on conflict (id) do nothing;

insert into public.reports (id, reporter_id, server_id, message_id, target_user_id, reason, details) values
  ('88888888-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'aaaaaaaa-0000-4000-8000-000000000001',
   'eeeeeeee-0000-4000-8000-000000000005', '44444444-4444-4444-8444-444444444444', 'spam', 'Posted the same sticker 20 times.')
on conflict (id) do nothing;

commit;
