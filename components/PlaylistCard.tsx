"use client";

import { Playlist } from "@/lib/types";

interface PlaylistCardProps {
  playlist: Playlist;
  currentIndex?: number;
  isPlaying?: boolean;
  onPlayAll?: () => void;
  onPlaySong?: (index: number) => void;
  onRemoveSong?: (index: number, title: string, artist: string) => void;
  onSave?: () => void;
  isSaved?: boolean;
}

export default function PlaylistCard({
  playlist,
  currentIndex = -1,
  isPlaying = false,
  onPlayAll,
  onPlaySong,
  onRemoveSong,
  onSave,
  isSaved = false,
}: PlaylistCardProps) {
  return (
    <div className="mt-4 rounded-2xl border border-[var(--border)] playlist-card glow-accent overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-zinc-100 font-display truncate">
            {playlist.name}
          </h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {playlist.songs.length} songs
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onSave && (
            <button
              onClick={onSave}
              className={`w-8 h-8 flex items-center justify-center rounded-full
                transition-all duration-200 active:scale-90
                ${
                  isSaved
                    ? "text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--accent)]"
                }`}
              title={isSaved ? "Saved" : "Save playlist"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={isSaved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          )}
          {onPlayAll && (
            <button
              onClick={onPlayAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full
                bg-[var(--accent)] text-white text-xs font-medium
                hover:brightness-110 transition-all duration-200 active:scale-95"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              Play All
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-[var(--border)]/50">
        {playlist.songs.map((song, i) => {
          const isCurrent = i === currentIndex;
          return (
            <div
              key={`${song.title}-${song.artist}-${i}`}
              className={`group px-5 py-3 flex items-start gap-3 transition-all duration-200 stagger-item`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {onPlaySong ? (
                <button
                  onClick={() => onPlaySong(i)}
                  className={`mt-0.5 w-6 h-6 flex items-center justify-center shrink-0
                    rounded-full transition-all duration-200
                    ${
                      isCurrent && isPlaying
                        ? "text-[var(--accent)]"
                        : "text-[var(--muted)] hover:text-[var(--accent)]"
                    }`}
                >
                  {isCurrent && isPlaying ? (
                    <span className="text-xs">♫</span>
                  ) : (
                    <>
                      <span className="text-xs group-hover:hidden">
                        {i + 1}
                      </span>
                      <svg
                        className="hidden group-hover:block"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </>
                  )}
                </button>
              ) : (
                <span
                  className={`text-xs mt-1 w-6 text-center shrink-0 ${
                    isCurrent ? "text-[var(--accent)]" : "text-[var(--muted)]"
                  }`}
                >
                  {isCurrent && isPlaying ? "♫" : i + 1}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm truncate ${
                    isCurrent
                      ? "text-[var(--accent)] font-medium"
                      : "text-zinc-200"
                  }`}
                >
                  {song.title}
                </p>
                <p className="text-xs text-[var(--muted)] truncate mt-0.5">
                  {song.artist}
                </p>
                {song.reason && (
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed italic">
                    {song.reason}
                  </p>
                )}
              </div>

              {onRemoveSong && (
                <button
                  onClick={() => onRemoveSong(i, song.title, song.artist)}
                  className="mt-1 w-5 h-5 flex items-center justify-center shrink-0
                    text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100
                    transition-all duration-200"
                  title="Remove song"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
