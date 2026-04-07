"use client";

import { useEffect, useRef } from "react";
import { ChatMessage } from "@/lib/types";
import Message from "./Message";

interface ChatWindowProps {
  messages: ChatMessage[];
  onMCQSelect: (option: string) => void;
  onPlayAll: () => void;
  onPlaySong: (index: number) => void;
  onRemoveSong: (index: number) => void;
  onSave: () => void;
  isSaved: boolean;
  currentTrackIndex?: number;
  isPlaying?: boolean;
}

export default function ChatWindow({
  messages,
  onMCQSelect,
  onPlayAll,
  onPlaySong,
  onRemoveSong,
  onSave,
  isSaved,
  currentTrackIndex = -1,
  isPlaying = false,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 space-y-1 relative">
      <div className="mood-glow" />

      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full relative z-10">
          <div className="text-center space-y-4">
            <h2 className="text-5xl font-bold gradient-text font-display">
              CarveMusic
            </h2>
            <p className="text-[var(--muted)] text-sm tracking-widest uppercase">
              Carve your mood into music
            </p>
          </div>
        </div>
      )}
      {messages.map((msg, i) => (
        <Message
          key={msg.id}
          message={msg}
          onMCQSelect={onMCQSelect}
          onPlayAll={onPlayAll}
          onPlaySong={onPlaySong}
          onRemoveSong={onRemoveSong}
          onSave={onSave}
          isSaved={isSaved}
          isLatest={i === messages.length - 1}
          currentTrackIndex={currentTrackIndex}
          isPlaying={isPlaying}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
