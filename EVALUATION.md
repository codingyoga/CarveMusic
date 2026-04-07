# CarveMusic — key flow evaluation

Run this after meaningful code changes (chat, playlist, player, API). Goal: catch regressions in the core loop before shipping.

## 1. Automated gate (required)

From the project root:

```bash
npm run verify
```

This runs **unit tests** (`vitest`) and a **production build** (`next build`). Fix any failures before manual checks.

Optional:

```bash
npm run lint
```

Note: the repo may still report pre-existing ESLint issues in some files; treat new errors in files you touched as blockers.

---

## 2. Flow logs (Gemini & API steps)

While running `npm run dev`, look for lines prefixed with **`[CarveMusic]`**.

| Where | What you see |
|-------|----------------|
| **Terminal** (server) | Each chat turn: `api.chat.request` → optional `api.chat.jiosaavn` / `jiosaavn.skip` → `api.chat.gemini` → **`gemini.start`** / **`gemini.done`** / **`gemini.parsed`** (confirms **Google Gemini** ran) → `api.chat.response`. When you use **Play All**, `api.youtube.search.*` shows **YouTube Data API** resolution. |
| **Browser → Console** | `client.chat.send` / `client.chat.response` for `/api/chat`; `client.youtube.*` for video lookup; `client.playlist.remove` for ✕ (no chat API). |

**Enable flags**

- Default: **on in development** (`next dev`).
- **`next start`** or production: add `CARVEMUSIC_DEBUG=1` to `.env.local` for server logs.
- Browser in production builds: `NEXT_PUBLIC_CARVEMUSIC_DEBUG=1`.
- **Log file (server):** add `CARVEMUSIC_LOG_FILE=logs/carvemusic.log` to `.env.local`. Same `[CarveMusic …]` lines are appended; use `tail -f logs/carvemusic.log`. The `logs/` folder is gitignored.

Implementation: `lib/carveDebugLog.ts` (shared + client console); `lib/carveDebugLogFile.ts` (server console + optional file).

---

## 3. Manual checks (dev server)

1. Start the app (API key present in `.env.local`):

   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000).

Use the table below; mark **Pass** / **Fail** and note what broke.

| # | Flow | Steps | Expected |
|---|------|--------|----------|
| A | **First load / greeting** | Fresh load (or refresh). | Conversational greeting appears; input enabled; no stuck loading state. |
| B | **Playlist from chat** | Send a clear playlist request (e.g. “5 classic rock songs for a road trip”). | Assistant returns a **named playlist** with multiple tracks; **Play All** / per-track play controls visible where applicable. |
| C | **Remove track (client-only)** | On the latest playlist card, use **Remove** on one row (✕ / remove control). | Song count drops by 1; that track disappears; **no** full-page reload; **no** new assistant message from remove alone. Optional: DevTools **Network** — no `POST /api/chat` when removing. |
| D | **Follow-up after playlist** | With a playlist still in thread, send unrelated text (e.g. “thanks, suggest one jazz album”). | New assistant reply; chat stays usable. (API should send a **short** history after a playlist turn — see §4.) |
| E | **Play confirmation** | After a playlist message, send a short confirmation (`yes`, `play`, `let’s go`). | Model responds in a way consistent with playing/continuing; no obvious error. |
| F | **Player / queue** (if YouTube resolution works) | **Play All** or play a row with a resolved video. | Player appears and aligns with the list; **next/prev** skip broken/missing videos if your build supports that. |

---

## 4. Optional: Network sanity (after playlist)

After **flow B**, before **flow D**:

1. Open DevTools → **Network**, filter `chat`.
2. Send flow **D** message.
3. Select the latest `POST /api/chat` → **Payload**.

**Expected:** `messages` is **not** a long replay of the entire thread. Typically **one** user message after a playlist turn, unless you sent a play-style confirm (then a small assistant + user pair is expected). Exact shape is covered by `lib/chatApiPayload.test.ts`.

---

## 5. What the automated tests cover

| Area | File |
|------|------|
| Chat API payload (post-playlist, play-confirm, history window) | `lib/chatApiPayload.test.ts` |

Add more `*.test.ts` files under `lib/` (or elsewhere) as you stabilize other pure logic; `vitest.config.ts` already includes `lib/**/*.test.ts`.

---

## Quick copy-paste summary

```bash
npm run verify && npm run dev
```

Then run rows **A–F** in §3. Watch **§2** for `[CarveMusic]` logs (including Gemini).
