# Pulse Lite (Godot 4.3)

Pulse Lite is a small companion client for **Pulse**, the chat platform simulation in this repo. The main app is the Next.js web app; this folder is a standalone Godot 4.3 project. It doesn't talk to the web app's backend. All chat activity is simulated locally by more than 50 bot users.

## Open and run

1. Install **Godot 4.3 stable** (standard build; .NET isn't needed).
2. In the Project Manager, choose **Import**, select `godot/project.godot` and open it.
3. Press **F5**. The main scene is `res://scenes/Main.tscn`.

The project uses the **GL Compatibility** renderer, so it runs on older GPUs and in the browser (WebGL 2).

## Project layout

| Path | Purpose |
| --- | --- |
| `project.godot` | Project config: 1280x800 window, `canvas_items` stretch with `expand` aspect, GL Compatibility renderer |
| `scenes/Main.tscn` | A single root `Control` with `scripts/main.gd` attached |
| `scripts/main.gd` | Builds the whole UI in code and runs the app: login, servers, channels, messages, commands, XP, toasts |
| `scripts/sim.gd` | Bot generation, presence simulation and the keyword-intent reply engine |
| `scripts/data.gd` | Static content: names, personas, servers and channels, reply templates, trivia, jokes |
| `scripts/theme_builder.gd` | StyleBoxFlat and Theme helpers for the dark glass look |
| `scripts/avatar.gd` | Circle avatar drawn in code, with initials and a presence dot |
| `scripts/ticks.gd` | Sent / delivered / read check marks drawn in code |
| `export_presets.cfg` | Three export presets: `Web`, `Windows Desktop`, `Linux` |

The scripts load each other with `preload()`, not `class_name`. A fresh CI checkout therefore doesn't depend on Godot's global class cache.

## Controls

- **Login:** type a display name, pick an avatar color, then press **Enter Pulse** (or Enter).
- **Left rail:** switch between servers. Channels are listed per server, and the **Direct Messages** section holds the bots (PulseBot, TriviaBot, Luna, Byte).
- **Composer:** type a message and press **Enter** or click **Send**.
- **@mentions:** for example, `@Ava` makes that user reply. When a bot mentions you, the message is highlighted and you get a toast.
- **Reactions:** click a reaction pill under a message to add yours, or click it again to remove it.
- **Polls:** click an option to vote. You can change your vote.
- **Small windows:** below 1000 px wide the member list hides. Below 700 px the channel list hides and a **Channels** button in the chat header shows or hides it.

## Slash commands

| Command | What it does |
| --- | --- |
| `/help` | Lists the commands |
| `/roll`, `/roll 20`, `/roll 2d6` | Rolls dice (default 1d6) |
| `/flip` | Flips a coin |
| `/poll Question\|Option A\|Option B` | Starts a poll with 2 to 6 options and vote buttons. Bots vote over time |
| `/trivia` | TriviaBot asks a question. The first correct answer within 30 s wins +50 XP. Bots compete in server channels |
| `/joke` | PulseBot tells a joke |
| `/status online\|idle\|dnd\|offline` | Sets your presence |
| `/clear` | Clears the current channel's local history |

In the TriviaBot DM, typing `play` also starts a round.

## Simulation features

- **Bots:** 56 generated users with personas (gamer, student, artist, developer, music lover, foodie, meme lord, athlete, bookworm). Each has a color, initials and an activity.
- **Presence:** online, idle, do-not-disturb and offline change every few seconds. The member list groups users by status.
- **Replies:** bots answer using keyword intents (greetings, questions, games, music, homework, coding, food, jokes, thanks, compliments, feeling down, goodbyes, plus a fallback). Users whose persona matches the topic are more likely to answer.
- **Typing indicator:** shows "Ava is typing..." with animated dots.
- **Ambient chatter:** bots post in every channel on timers. Channels you're not viewing get unread badges, and servers show a total. Occasional toasts, DMs and random reactions appear.
- **Message status:** your own messages go from Sent to Delivered to Read, shown as check marks.
- **XP and levels:** you earn XP from messages, reactions, polls, dice and trivia. Leveling up shows an animated toast.
- **Daily streak:** visiting on consecutive days grows the streak, and the first visit each day gives +20 XP.
- **Saving:** the profile, XP, level, streak and status are saved to `user://pulse_save.json`. On the web build that file lives in the browser's IndexedDB.

## Exporting (CI)

Exports run in the `barichello/godot-ci:4.3` image, which includes the editor binary and export templates. Run these from the repo root:

```bash
mkdir -p build/godot/web build/godot/windows build/godot/linux
# First import, so .godot/ (the import cache) exists:
godot --headless --path godot --import
godot --headless --path godot --export-release "Web"             ../build/godot/web/index.html
godot --headless --path godot --export-release "Windows Desktop" ../build/godot/windows/PulseLite.exe
godot --headless --path godot --export-release "Linux"           ../build/godot/linux/PulseLite.x86_64
```

Notes:

- **Output paths:** they are relative to the project folder (`godot/`), so the builds land in `<repo>/build/godot/...`. The output directories must already exist.
- **Web:** `variant/thread_support=false` uses the single-threaded web template. The build runs on GitHub Pages without COOP/COEP headers.
- **Windows:** the `.pck` is embedded (`binary_format/embed_pck=true`), and code signing and rcedit are off (`codesign/enable=false`, `application/modify_resources=false`). That lets headless Linux CI export without wine or rcedit. As a result, the `.exe` keeps Godot's default icon.
- **Linux:** the `.pck` is also embedded, so the output is a single file.
- **Export templates in GitHub Actions:** with `container: barichello/godot-ci:4.3`, `$HOME` may not be `/root`. If the export can't find templates, copy them first:
  `mkdir -p ~/.local/share/godot/export_templates && cp -r /root/.local/share/godot/export_templates/* ~/.local/share/godot/export_templates/`

## Known limitations

- **No emoji:** the web build has no system fonts, so the default font can't render emoji. Reactions use text tokens such as `+1`, `lol`, `<3` and `GG`.
- **No networking:** this is a local simulation, and all other users are bots.
