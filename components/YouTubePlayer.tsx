"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Song } from "@/lib/types";

interface YouTubePlayerProps {
  songs: Song[];
  currentIndex: number;
  isPlaying: boolean;
  onTrackEnd: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function YouTubePlayer({
  songs,
  currentIndex,
  isPlaying,
  onTrackEnd,
  onPlayPause,
  onNext,
  onPrev,
}: YouTubePlayerProps) {
  const playerRef = useRef<YT.Player | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const containerRef = useRef<HTMLDivElement>(null);
  const [apiReady, setApiReady] = useState(false);
  /** Bumps when iframe fires onReady so we retry play/pause sync (fixes first paint before getPlayerState exists). */
  const [playerReadyTick, setPlayerReadyTick] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (window.YT) {
      setApiReady(true);
      return;
    }

    window.onYouTubeIframeAPIReady = () => setApiReady(true);

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
      if (playerRef.current?.getDuration) {
        setDuration(playerRef.current.getDuration());
      }
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const trySyncPlayPause = useCallback(() => {
    const p = playerRef.current;
    if (!p?.getPlayerState) return;
    try {
      const state = p.getPlayerState();
      if (isPlayingRef.current && state !== window.YT.PlayerState.PLAYING) {
        p.playVideo();
      } else if (!isPlayingRef.current && state === window.YT.PlayerState.PLAYING) {
        p.pauseVideo();
      }
    } catch {
      /* iframe not ready */
    }
  }, []);

  useEffect(() => {
    if (!apiReady || !songs[currentIndex]?.videoId) return;

    if (playerRef.current) {
      playerRef.current.loadVideoById(songs[currentIndex].videoId!);
      setCurrentTime(0);
      queueMicrotask(() => {
        trySyncPlayPause();
        setTimeout(trySyncPlayPause, 150);
      });
      return;
    }

    playerRef.current = new window.YT.Player("yt-player", {
      height: "90",
      width: "160",
      videoId: songs[currentIndex].videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        /** iOS Safari: required for inline embed playback */
        playsinline: 1,
      },
      events: {
        onReady: () => {
          setPlayerReadyTick((t) => t + 1);
          trySyncPlayPause();
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            onTrackEnd();
          }
          if (event.data === window.YT.PlayerState.PLAYING) {
            startTimer();
          } else {
            stopTimer();
          }
        },
      },
    });

    return () => stopTimer();
  }, [apiReady, currentIndex, songs, onTrackEnd, startTimer, stopTimer, trySyncPlayPause]);

  useEffect(() => {
    trySyncPlayPause();
  }, [isPlaying, currentIndex, playerReadyTick, trySyncPlayPause]);

  const currentSong = songs[currentIndex];
  if (!currentSong) return null;

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-xl
        pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div
        className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-3 touch-manipulation sm:gap-4 sm:px-4
          pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))]"
      >
        <div
          ref={containerRef}
          className="w-[80px] h-[45px] rounded-lg overflow-hidden shrink-0 bg-[var(--surface)] border border-[var(--border)]"
        >
          <div id="yt-player" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200 truncate">
                {currentSong.title}
              </p>
              <p className="text-xs text-[var(--muted)] truncate">
                {currentSong.artist}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onPrev}
                disabled={currentIndex === 0}
                className="text-zinc-500 hover:text-zinc-200 disabled:text-zinc-800 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>
              <button
                onClick={onPlayPause}
                className="w-8 h-8 flex items-center justify-center rounded-full
                  bg-[var(--accent)] text-white hover:brightness-110 transition-all active:scale-90"
              >
                {isPlaying ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                onClick={onNext}
                disabled={currentIndex === songs.length - 1}
                className="text-zinc-500 hover:text-zinc-200 disabled:text-zinc-800 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-zinc-600 w-7 text-right tabular-nums">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 h-[3px] bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-600 w-7 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
