# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-10-22

### Added
- Event-sourced chat platform: servers, channels, DMs, group DMs, threads, replies, reactions, pins, saved messages, search, translation, scheduled messages
- Rich media: GIFs, stickers, images, files, voice notes, meme generator
- Simulation engine with 56 AI personas, leader-elected across tabs
- Real-time transport: BroadcastChannel, plus a Socket.IO relay server
- Authentication with PBKDF2, simulated E2EE with AES-256-GCM and safety numbers
- Role and permission system, server settings, moderation, admin dashboard
- Gamification: XP, levels, streaks, achievements, badges, reputation
- Mini activities: polls, trivia, shared whiteboard, voice/video/screen-share UI
- Nova AI assistant (offline, or Claude)
- Themes, glassmorphism, responsive mobile layouts, landing page
- Supabase schema with RLS, OpenAPI spec, realtime protocol docs
- Android APK (Capacitor) and Pulse Lite (Godot 4.3) builds via GitHub Actions
- Vitest, Playwright and node:test suites; CI, Pages deploy and release workflows
