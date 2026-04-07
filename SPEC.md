# CarveMusic — "Carve your mood into music"

## What It Is

Chat-based AI playlist curator that surprises you with hidden gems. Talk to the AI about your mood — not as a search query, but as a feeling — and it builds a playlist you'd never find on your own.

## Core Philosophy: Surprise from DEPTH, not breadth

CarveMusic isn't a search engine. It does what you'd never do yourself:

1. **Mood Translation** — You can't type "I feel like sitting on a balcony with chai watching it drizzle" into any music app. CarveMusic translates feelings into musical qualities (tempo, instrumentation, vocal style) and finds songs that match.

2. **Thread Following** — The AI follows breadcrumbs: "That song's composer also scored this obscure 1993 film — track 4 has exactly the vibe you're looking for." It discovers connections you wouldn't search for.

3. **Emotional Arc Sequencing** — Songs aren't random. They're sequenced to tell a story: warm entry → build intensity → emotional peak → gentle wind-down.

4. **Pattern Breaking** — Notices when you keep picking the same era/composer and gently pushes you: "You always go for 90s Hamsalekha — have you heard Rajan-Nagendra from the 80s? Same romantic DNA, different era."

5. **Hidden Gem Strategy** — Prefers moderate-popularity songs (quality but not obvious). Songs from lesser-known films with great music, B-side album tracks, non-film compositions.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** (dark theme)
- **Google Gemini API** (gemini-2.5-flash) — chat + song curation with Google Search grounding
- **JioSaavn API** (unofficial) — real song database for verified titles, artists, play counts
- **YouTube Data API v3** — search songs → get video IDs
- **YouTube IFrame Player API** — in-app playback (small visible player)

## Architecture

```
User message
    │
    ▼
┌──────────────────┐
│  API Route        │
│  /api/chat        │
│                   │
│  1. Extract query │
│  2. Search        │◄── JioSaavn API (real songs, play counts)
│     JioSaavn      │
│  3. Call Gemini   │◄── Google Search grounding (web data)
│     with context  │
│  4. Return JSON   │
└──────────────────┘
    │
    ▼
Curated playlist (real songs, mood-matched, surprise-first)
```

**Gemini + Google Search** = the brain (mood understanding, thread following, creative curation, web-verified accuracy)
**JioSaavn** = the song library (verified songs with real titles, artists, albums, play counts)
**YouTube** = the player (playback via embed)

## Users

- Multi-user — anyone with the link
- No accounts — no login required
- YouTube Premium users get ad-free playback (browser-level)

## Conversation Flow

### Phase 1: MCQs (one at a time)

1. **Mood** — Happy / Sad / Energetic / Calm / Nostalgic / Angry
2. **Energy** — Slow & gentle / Steady groove / High energy
3. **Language** — Kannada / Hindi / Tamil / Telugu / English / Mix languages
4. **Discovery** — Familiar favorites / Hidden gems / Surprise me

Also supports free text: "I feel like driving on an empty highway at night"

### Phase 2: Playlist Generation

- AI generates 8-10 songs with a creative playlist name
- Uses Google Search to find real songs + JioSaavn data for verification
- Each song: title, artist, one-line reason (showing musical understanding)
- Prioritizes hidden gems over obvious hits

### Phase 3: Refinement Loop

- "Remove track 3" / "More like track 5" / "Too slow, add something upbeat"
- AI makes surgical edits, maintains emotional arc
- Shows full updated playlist after changes

### Phase 4: Playback

- User says "play it" / "perfect" / "yes"
- YouTube search for each song → iframe player starts
- Auto-advance to next track

### Phase 5: New Session

- "new playlist" / "start over"
- Playlist saved to local storage (if user clicks save)
- Chat resets

## Language Modes

### Default: Single Language (depth)
Stay within the chosen language. If Kannada, every song is Kannada. Surprise comes from digging DEEPER — obscure films, lesser-known composers, B-side tracks.

### Optional: Mix Languages
Triggered by selecting "Mix languages" or saying "surprise me from anywhere". AI pulls from any language, connected by mood and musical DNA.

## AI Response Format

```json
{
  "message": "Display text",
  "type": "mcq | playlist | text",
  "options": ["Option 1", "Option 2"],
  "playlist": {
    "name": "Playlist Name",
    "songs": [
      { "title": "Song", "artist": "Artist", "reason": "Why it fits" }
    ]
  },
  "action": "play | null"
}
```

## Storage

- Local storage only
- Stores: playlist name, track list, timestamp
- Manual save via bookmark button
- No database, no backend persistence

## UI

- Dark theme
- Single page — chat is the entire interface
- Clean, minimal, no sidebar
- MCQ options as clickable buttons
- Player bar fixed at bottom (only visible during playback)
- Saved playlists accessible via header dropdown

## API Keys Required

```
GEMINI_API_KEY=...
YOUTUBE_API_KEY=AI...
```
