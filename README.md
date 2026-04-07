# CarveMusic

**Tell it how you feel. It builds the playlist.**

CarveMusic is a chat-based playlist curator. Instead of searching for songs, you describe your mood — "I feel like driving on an empty highway at night" — and the AI builds a playlist of songs you'd never find on your own.

It doesn't give you the same 10 popular songs every app does. It digs deeper.

---

### How it works

1. You chat with the AI about your mood (or pick from quick MCQ buttons)
2. It searches the web and a real music database to find songs that actually exist
3. It sequences them into an emotional arc — not a random list, a journey
4. You refine through conversation: "remove track 3", "more like track 5", "too slow"
5. Hit play — songs stream via YouTube right in the app

### What makes it different

- **Mood, not keywords.** You can't type "balcony chai rainy evening" into Spotify. You can here.
- **Real songs, not hallucinated ones.** Gemini + Google Search grounding + JioSaavn data means the AI recommends songs that actually exist with correct titles and artists.
- **Hidden gems over obvious hits.** It prefers the beautiful song from the movie nobody saw over the one everyone already knows.
- **Regional music that works.** Kannada, Hindi, Tamil, Telugu — not just English and Bollywood top 40.
- **Thread following.** "That composer also scored this obscure 1993 film — track 4 is exactly what you need."

### Stack

- Next.js 16 (App Router, TypeScript)
- Google Gemini API (JSON responses; strict pool uses index-picking without Search grounding on that path)
- JioSaavn unofficial API for verified song data (multi-query search + deduped pool)
- YouTube Data API + IFrame Player for playback
- Vitest for unit tests
- Tailwind CSS, dark theme

### Architecture (what we chose and why)

**High-level flow**

1. The client sends chat history to `POST /api/chat`.
2. The server decides whether to **search JioSaavn** (skip for very short or MCQ-style messages).
3. **Artist vs mood routing:** `extractArtistName()` applies regex patterns, then **guardrails** so we do not treat vibe phrases as artists:
   - `isScenarioOnlyArtistFalsePositive` (e.g. “longdrive” scenario words)
   - `isLikelyMoodDescriptorNotArtist` (e.g. “slow kannada acoustic”)
   - `isLikelyEraOrDecadeNotArtist` (e.g. “90s kannada”, “2000s hindi”) while still allowing “Artist Name 90s”
4. **JioSaavn:** artist path uses focused queries; mood path uses **`buildMoodSearchQueries()`** — several queries merged into one deduped list (language, vibes, structured boosts, **decade-specific** `"{lang} {decade} songs"` when the user names eras). Pool is **capped** (`MAX_POOL_SONGS`, see `lib/songPoolPlaylist.ts`).
5. **Gemini:**
   - **Strict pool mode** (when the pool is large enough): the model receives a **numbered catalog** and must return JSON with **`picks: [{ index, reason }]`** only — titles come from JioSaavn, reducing hallucinations. `mapStrictPicksToResponse()` maps indices to songs; a **repair** call runs if the first parse does not yield enough valid picks.
   - **Soft mode** (small or empty pool, or strict mapping failure): the model gets formatted song context as text and may return a normal `playlist.songs` shape.
6. **Curator intent:** `buildCuratorIntentSection()` injects a system-prompt block derived from the last user message (language, scenario vibes, **decade line** via `formatDecadeHintsForCurator`, remaining hints). **`listeningStructuredIntent`** adds a parsed block for **mood-vs-music contrast**, introspective listening, themes, and **playlist arc** (ordering hints + optional strict-pool sequencing note in `lib/ai.ts`).
7. **Logging:** `carveDebugServer` (`lib/carveDebugLogFile.ts`) writes to **`CARVEMUSIC_LOG_FILE`** unconditionally when set; notable tags include **`api.chat.pool.tracks`** (full capped pool, 1-based indices) and **`api.chat.selection.tracks`** (final playlist order and reasons).

**Why this architecture**

- **Strict index picking** ties recommendations to a real catalog and avoids invented track names when the pool is good.
- **Rule-based intent** (no extra LLM call) keeps latency and cost down while encoding contrast, era, and anti–false-artist behavior.
- **Multi-query JioSaavn** improves recall vs a single generic search string.
- **File logs** make production and local debugging traceable without relying only on the terminal.

### Setup

```bash
git clone https://github.com/codingyoga/CarveMusic.git
cd CarveMusic
npm install
```

Create `.env.local`:

```
GEMINI_API_KEY=your-key-from-aistudio.google.com
YOUTUBE_API_KEY=your-youtube-data-api-key
```

Optional — **append every server flow step to a file** (JioSaavn queries, pool size, strict vs soft Gemini path, each Gemini call timing). Look for **`api.chat.pool.tracks`** (full capped pool with titles/artists) and **`api.chat.selection.tracks`** (final playlist order + reasons):

```
CARVEMUSIC_LOG_FILE=logs/flow.log
```

The `logs/` folder is gitignored. Lines look like `[CarveMusic 2026-04-07T…] api.chat.request {"step":"POST /api/chat",…}`. For noisy **terminal** logs in dev, add `CARVEMUSIC_DEBUG=1`.

```bash
npm run dev
```

```bash
npm run verify   # unit tests + production build (CI-style gate)
```

Open `http://localhost:3000`.

### Get API keys

- **Gemini**: [Google AI Studio](https://aistudio.google.com/apikey) — free tier is generous
- **YouTube Data API**: [Google Cloud Console](https://console.cloud.google.com/) — enable YouTube Data API v3, create an API key

### Screenshots

<p align="center">
  <img src="public/screenshots/landing.png" width="260" alt="Mood selection" />
  &nbsp;&nbsp;
  <img src="public/screenshots/mood-flow.png" width="260" alt="Conversational mood flow" />
  &nbsp;&nbsp;
  <img src="public/screenshots/playlist.png" width="260" alt="Generated playlist with player" />
</p>

<p align="center">
  <em>Left:</em> Pick your mood with quick buttons &nbsp;|&nbsp;
  <em>Center:</em> Conversational flow to refine &nbsp;|&nbsp;
  <em>Right:</em> AI-curated playlist with YouTube playback
</p>

---

Built because every music app recommends the same songs and none of them let you just *talk* about how you feel.
