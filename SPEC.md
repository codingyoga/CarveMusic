# CarveMusic — "Carve your mood into music"

## What It Is

Chat-based AI playlist curator. Talk to the AI about your mood, it builds a playlist, you refine it through conversation, and songs play via YouTube embed.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** (dark theme)
- **OpenAI API** (GPT-4o) — chat + song curation
- **YouTube Data API v3** — search songs → get video IDs
- **YouTube IFrame Player API** — in-app playback (small visible player)

## Users

- Multi-user — anyone with the link can use it
- No accounts — no login required in the app
- YouTube Premium users get ad-free playback automatically (browser-level)
- Max 5 users can use the app concurrently (personal use)

## Conversation Flow

### Phase 1: MCQs (3-4 questions, one at a time)

1. **Mood** — Happy / Sad / Energetic / Calm / Nostalgic / Angry
2. **Energy** — Slow & gentle / Steady groove / High energy
3. **Genre** — Indie/Alt / R&B/Soul / Electronic / Bollywood / Kannada / Rock / Mix it up
4. **Discovery** — Familiar favorites / Hidden gems / Both

### Phase 2: Playlist Generation

- AI returns 8-10 songs with a creative playlist name
- Each song: title, artist, one-line reason
- Shown as a playlist card in the chat

### Phase 3: Refinement Loop

User can chat to modify the playlist:
- "Remove track 3"
- "I don't like that one"
- "More like track 5"
- "Too slow, add something upbeat"
- "Add some 90s Kannada songs"

AI updates the playlist and shows the updated card.

### Phase 4: Playback

- User says "play it" / "perfect" / "yes"
- App searches YouTube for each song, gets video IDs
- YouTube iframe player starts playing (small visible player at bottom)
- Songs auto-advance to the next track when one ends

### Phase 5: New Session

- User says "new playlist" / "start over"
- Playlist name saved to local storage
- Chat resets, MCQs start again

## AI Behavior (System Prompt)

- Acts as a music curator with deep, eclectic taste
- Asks MCQs one at a time as clickable buttons
- Returns structured JSON responses (parseable by frontend)
- Playlist names are creative/evocative (not generic)
- Max 2 songs per artist
- Mix well-known (60%) with deeper cuts (40%)
- Sequences songs for emotional arc
- On refinement: surgical edits, not full rebuild
- If a song isn't found on YouTube, suggests alternative

## AI Response Format

Every AI response is a JSON object:

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

## Playback

- YouTube IFrame Player API (client-side, no API key needed)
- YouTube Data API v3 for search (server-side, API key in .env)
- Small visible player at bottom of screen (YouTube ToS requires visibility)
- Auto-queue: next song plays when current one ends
- 2-3 second gap between songs is expected

## Storage

- Local storage only
- Stores: playlist name, track list, timestamp
- No database, no backend persistence

## UI

- Dark theme
- Single page — chat is the entire interface
- Clean, minimal, no sidebar, no playlist history screen
- MCQ options rendered as clickable buttons in chat
- Player bar fixed at bottom (only visible during playback)

## API Keys Required

```
OPENAI_API_KEY=sk-...
YOUTUBE_API_KEY=AI...
```
