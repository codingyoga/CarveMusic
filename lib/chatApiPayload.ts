import { ChatMessage, Playlist } from "@/lib/types";

export const HISTORY_WINDOW = 12;

export const PLAY_CONFIRM_RE =
  /^(yes|yep|yeah|sure|ok|okay|play|go|start|let'?s go|perfect|do it)\b/i;

export function summarizeForHistory(m: ChatMessage): { role: string; content: string } {
  if (m.role === "user") {
    return { role: m.role, content: m.content };
  }

  const p = m.parsed;
  if (!p) return { role: m.role, content: m.content };

  if (p.type === "playlist" && p.playlist) {
    const songList = p.playlist.songs
      .map((s) => `"${s.title}" by ${s.artist}`)
      .join(", ");
    return {
      role: m.role,
      content: JSON.stringify({
        message: p.message,
        type: "playlist",
        playlist: { name: p.playlist.name, songs_summary: songList },
      }),
    };
  }

  return {
    role: m.role,
    content: JSON.stringify({ message: p.message, type: p.type, options: p.options }),
  };
}

export function buildApiMessages(
  priorMessages: ChatMessage[],
  userContent: string,
  playlistForPlayConfirm: Playlist | null
): { role: string; content: string }[] {
  const lastAssistant = [...priorMessages]
    .reverse()
    .find((m) => m.role === "assistant");

  const afterPlaylist =
    lastAssistant?.parsed?.type === "playlist" &&
    Boolean(lastAssistant.parsed.playlist);

  if (afterPlaylist) {
    if (PLAY_CONFIRM_RE.test(userContent.trim()) && playlistForPlayConfirm) {
      const summary = summarizeForHistory(lastAssistant!);
      return [
        { role: "assistant", content: summary.content },
        { role: "user", content: userContent },
      ];
    }
    return [{ role: "user", content: userContent }];
  }

  const windowed = priorMessages.slice(-HISTORY_WINDOW);
  return [...windowed.map(summarizeForHistory), { role: "user", content: userContent }];
}
