# Deployment guide

## 1. GitHub Pages (website + Godot web build)

The workflow [`deploy-pages.yml`](../.github/workflows/deploy-pages.yml) runs on every push to `main`. It:

1. exports the Godot project to WebAssembly (`barichello/godot-ci:4.3`)
2. builds the Next.js static export with `NEXT_PUBLIC_BASE_PATH=/<repo>`
3. places the Godot build at `/play/` and publishes everything to Pages

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. With the GitHub CLI:

```bash
gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow
```

## 2. Release artifacts (APK, Windows, Linux, web zip)

```bash
git tag v1.0.0
git push origin v1.0.0
```

[`release.yml`](../.github/workflows/release.yml) then:

| Job | Output |
|---|---|
| `android` | `PulseChat.apk`: Capacitor 7 + Gradle `assembleDebug` (JDK 21), icons from `assets/brand` |
| `godot` | `PulseLite-web.zip`, `PulseLite-windows.zip`, `PulseLite-linux.zip` |
| `web` | `PulseChat-web.zip`, a self-contained static site |
| `publish` | A GitHub Release with all of the above and `docs/RELEASE_NOTES.md` |

You can also trigger it manually from the Actions tab (**Run workflow** with a tag).

> The APK is a debug-signed build for sideloading. For Google Play, add a keystore as repository secrets and switch to `assembleRelease` with a `signingConfig`.

## 3. Vercel / Netlify

- **Root directory:** `client`
- **Build command:** `npm run build`
- **Output directory:** `out`
- **Environment (optional):** `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_GIPHY_KEY`

## 4. Realtime relay (`server/`)

| Platform | Steps |
|---|---|
| Render | New → Blueprint → select the repo (uses `server/render.yaml`) |
| Fly.io | `cd server && fly launch --copy-config && fly deploy` |
| Docker | `docker build -t pulse-relay server && docker run -p 4000:4000 -e CORS_ORIGIN=https://<site> pulse-relay` |

Then set `NEXT_PUBLIC_SOCKET_URL=https://<relay-host>` for the client build. `/health` returns uptime and connection counts.

## 5. Supabase

See [database/README.md](../database/README.md). Apply `database/migrations/0001_init.sql` and then `seed.sql`, and schedule `publish_due_scheduled_messages()` with `pg_cron` if you want server-side scheduled messages.

## Local Android build

```bash
cd client
npm run build
npx cap add android      # first time only
npx cap sync android
npx cap open android     # build and run from Android Studio
```
