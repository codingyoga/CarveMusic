"use client";

import { useEffect, useCallback, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { usePlayer } from "@/hooks/usePlayer";
import { useSavedPlaylists } from "@/hooks/useSavedPlaylists";
import ChatWindow from "@/components/ChatWindow";
import ChatInput from "@/components/ChatInput";
import YouTubePlayer from "@/components/YouTubePlayer";
import SavedPlaylists from "@/components/SavedPlaylists";
import { SavedPlaylist, Playlist } from "@/lib/types";

export default function Home() {
  const {
    messages,
    isLoading,
    currentPlaylist,
    shouldPlay,
    sendMessage,
    startConversation,
    clearShouldPlay,
  } = useChat();

  const {
    songs,
    currentIndex,
    isPlaying,
    isResolving,
    resolveAndPlay,
    playPause,
    next,
    prev,
    onTrackEnd,
    jumpTo,
  } = usePlayer();

  const { savedPlaylists, savePlaylist, deletePlaylist, isPlaylistSaved } =
    useSavedPlaylists();

  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    startConversation();
  }, [startConversation]);

  useEffect(() => {
    if (shouldPlay && currentPlaylist) {
      resolveAndPlay(currentPlaylist);
      clearShouldPlay();
    }
  }, [shouldPlay, currentPlaylist, resolveAndPlay, clearShouldPlay]);

  const handleMCQSelect = useCallback(
    (option: string) => sendMessage(option),
    [sendMessage]
  );

  const handlePlayAll = useCallback(() => {
    if (currentPlaylist) resolveAndPlay(currentPlaylist, 0);
  }, [currentPlaylist, resolveAndPlay]);

  const handlePlaySong = useCallback(
    (index: number) => {
      if (songs.length > 0) {
        jumpTo(index);
      } else if (currentPlaylist) {
        resolveAndPlay(currentPlaylist, index);
      }
    },
    [songs.length, currentPlaylist, resolveAndPlay, jumpTo]
  );

  const handleRemoveSong = useCallback(
    (index: number, title: string, artist: string) => {
      sendMessage(`[REMOVE] Remove "${title}" by ${artist} from the playlist`);
    },
    [sendMessage]
  );

  const handleSave = useCallback(() => {
    if (currentPlaylist) savePlaylist(currentPlaylist);
  }, [currentPlaylist, savePlaylist]);

  const handleLoadSaved = useCallback(
    (saved: SavedPlaylist) => {
      const playlist: Playlist = {
        name: saved.name,
        songs: saved.songs.map((s) => ({
          ...s,
          reason: "",
        })),
      };
      resolveAndPlay(playlist, 0);
    },
    [resolveAndPlay]
  );

  const showPlayer = songs.length > 0;
  const isSaved = currentPlaylist
    ? isPlaylistSaved(currentPlaylist.name)
    : false;

  return (
    <div className="h-dvh flex flex-col bg-[var(--background)]">
      <header className="shrink-0 border-b border-[var(--border)] px-4 py-3 relative z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <span className="text-base font-semibold text-zinc-200 font-display">
              CarveMusic
            </span>
          </div>

          <div className="flex items-center gap-3 relative">
            <p className="text-xs text-[var(--muted)] hidden sm:block tracking-wide">
              Carve your mood into music
            </p>
            <button
              onClick={() => setShowSaved(!showSaved)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg
                transition-all duration-200 hover:bg-[var(--surface)]
                ${showSaved ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-zinc-300"}`}
              title="Saved playlists"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            <SavedPlaylists
              isOpen={showSaved}
              onClose={() => setShowSaved(false)}
              playlists={savedPlaylists}
              onLoad={handleLoadSaved}
              onDelete={deletePlaylist}
            />
          </div>
        </div>
      </header>

      <main
        className={`flex-1 flex flex-col max-w-2xl mx-auto w-full overflow-hidden ${
          showPlayer ? "pb-[96px]" : ""
        }`}
      >
        <ChatWindow
          messages={messages}
          onMCQSelect={handleMCQSelect}
          onPlayAll={handlePlayAll}
          onPlaySong={handlePlaySong}
          onRemoveSong={handleRemoveSong}
          onSave={handleSave}
          isSaved={isSaved}
          currentTrackIndex={showPlayer ? currentIndex : -1}
          isPlaying={isPlaying}
        />

        {(isLoading || isResolving) && (
          <div className="px-4 pb-3">
            <div className="flex gap-1.5 items-center text-[var(--muted)]">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              <span className="text-xs ml-2 text-[var(--muted)]">
                {isResolving ? "Finding songs on YouTube..." : "Curating..."}
              </span>
            </div>
          </div>
        )}

        <div className="shrink-0 px-4 py-3 border-t border-[var(--border)]">
          <ChatInput
            onSend={sendMessage}
            disabled={isLoading || isResolving}
            placeholder={
              isResolving
                ? "Finding songs..."
                : isLoading
                ? "Curating..."
                : "Tell me your mood or type anything..."
            }
          />
        </div>
      </main>

      {showPlayer && (
        <YouTubePlayer
          songs={songs}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          onTrackEnd={onTrackEnd}
          onPlayPause={playPause}
          onNext={next}
          onPrev={prev}
        />
      )}
    </div>
  );
}
