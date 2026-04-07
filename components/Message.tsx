"use client";

import { ChatMessage } from "@/lib/types";
import MCQButtons from "./MCQButtons";
import PlaylistCard from "./PlaylistCard";

interface MessageProps {
  message: ChatMessage;
  onMCQSelect?: (option: string) => void;
  onPlayAll?: () => void;
  onPlaySong?: (index: number) => void;
  onRemoveSong?: (index: number) => void;
  onSave?: () => void;
  isSaved?: boolean;
  isLatest?: boolean;
  currentTrackIndex?: number;
  isPlaying?: boolean;
}

export default function Message({
  message,
  onMCQSelect,
  onPlayAll,
  onPlaySong,
  onRemoveSong,
  onSave,
  isSaved,
  isLatest = false,
  currentTrackIndex = -1,
  isPlaying = false,
}: MessageProps) {
  const isUser = message.role === "user";
  const parsed = message.parsed;
  const hasPlaylist = parsed?.type === "playlist" && parsed.playlist;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-5 animate-fade-in`}
    >
      <div
        className={`max-w-[88%] ${
          isUser
            ? "bg-[var(--accent)]/15 border border-[var(--accent)]/20 rounded-2xl rounded-br-sm px-4 py-3"
            : ""
        }`}
      >
        <p
          className={`text-[0.9rem] leading-relaxed ${
            isUser ? "text-zinc-200" : "text-zinc-400"
          }`}
        >
          {parsed?.message || message.content}
        </p>

        {parsed?.type === "mcq" &&
          parsed.options &&
          isLatest &&
          onMCQSelect && (
            <MCQButtons options={parsed.options} onSelect={onMCQSelect} />
          )}

        {hasPlaylist && (
          <PlaylistCard
            playlist={parsed!.playlist!}
            currentIndex={currentTrackIndex}
            isPlaying={isPlaying}
            onPlayAll={isLatest ? onPlayAll : undefined}
            onPlaySong={isLatest ? onPlaySong : undefined}
            onRemoveSong={isLatest ? onRemoveSong : undefined}
            onSave={isLatest ? onSave : undefined}
            isSaved={isSaved}
          />
        )}
      </div>
    </div>
  );
}
