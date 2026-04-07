export interface Song {
  title: string;
  artist: string;
  year: string;
  reason: string;
  videoId?: string;
}

export interface Playlist {
  name: string;
  songs: Song[];
}

export interface SavedPlaylist {
  name: string;
  songs: { title: string; artist: string; year: string }[];
  timestamp: number;
}

export interface AIResponse {
  message: string;
  type: "mcq" | "playlist" | "text";
  options?: string[];
  playlist?: Playlist;
  action?: "play" | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parsed?: AIResponse;
}

export interface PlayerState {
  isPlaying: boolean;
  currentIndex: number;
  playlist: Playlist | null;
}
