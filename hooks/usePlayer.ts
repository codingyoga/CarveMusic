"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Playlist, Song } from "@/lib/types";
import { carveDebug } from "@/lib/carveDebugLog";
import { playerQueueMatchesPlaylist } from "@/lib/playlistIdentity";

function firstPlayableIndex(songs: Song[], start: number): number {
  for (let i = start; i < songs.length; i++) {
    if (songs[i]?.videoId) return i;
  }
  for (let i = Math.min(start, songs.length - 1); i >= 0; i--) {
    if (songs[i]?.videoId) return i;
  }
  return 0;
}

export function usePlayer() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const currentIndexRef = useRef(0);
  const resolveGenerationRef = useRef(0);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (songs.length === 0) return;
    if (!songs[currentIndex]?.videoId) {
      const p = firstPlayableIndex(songs, currentIndex);
      if (p !== currentIndex) setCurrentIndex(p);
    }
  }, [songs, currentIndex]);

  const resolveAndPlay = useCallback(
    async (playlist: Playlist, startIndex: number = 0) => {
      const generation = ++resolveGenerationRef.current;
      setIsResolving(true);

      try {
        carveDebug("client.youtube.resolve", {
          step: "fetch POST /api/youtube/search",
          trackCount: playlist.songs.length,
        });

        const res = await fetch("/api/youtube/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songs: playlist.songs }),
        });

        if (!res.ok) throw new Error("YouTube search failed");

        const data = await res.json();
        const all: Song[] = data.songs;

        if (generation !== resolveGenerationRef.current) {
          return;
        }

        const resolved = all.filter((s) => s.videoId).length;
        carveDebug("client.youtube.response", {
          resolvedVideoIds: resolved,
          unresolved: all.length - resolved,
        });

        const anyPlayable = all.some((s: Song) => s.videoId);
        if (!anyPlayable) {
          console.error("No songs found on YouTube");
          return;
        }

        setSongs(all);
        const safeStart = Math.min(
          Math.max(0, startIndex),
          Math.max(0, all.length - 1)
        );
        const playableIdx = firstPlayableIndex(all, safeStart);
        setCurrentIndex(playableIdx);
        setIsPlaying(true);
      } catch (error) {
        console.error("Failed to resolve songs:", error);
      } finally {
        if (generation === resolveGenerationRef.current) {
          setIsResolving(false);
        }
      }
    },
    []
  );

  const playPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((prev) => {
      for (let i = prev + 1; i < songs.length; i++) {
        if (songs[i]?.videoId) return i;
      }
      return prev;
    });
  }, [songs]);

  const prev = useCallback(() => {
    setCurrentIndex((prev) => {
      for (let i = prev - 1; i >= 0; i--) {
        if (songs[i]?.videoId) return i;
      }
      return prev;
    });
  }, [songs]);

  const onTrackEnd = useCallback(() => {
    setCurrentIndex((prev) => {
      for (let i = prev + 1; i < songs.length; i++) {
        if (songs[i]?.videoId) return i;
      }
      setIsPlaying(false);
      return prev;
    });
  }, [songs.length]);

  const jumpTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= songs.length) return;
      const playable = firstPlayableIndex(songs, index);
      if (songs[playable]?.videoId) {
        setCurrentIndex(playable);
        setIsPlaying(true);
      }
    },
    [songs]
  );

  /**
   * Play a row from `playlist`: jump in-queue if this playlist is already resolved,
   * otherwise resolve from YouTube (avoids wrong audio after a new chat playlist).
   */
  const playSongAt = useCallback(
    (playlist: Playlist, index: number) => {
      if (playerQueueMatchesPlaylist(songs, playlist)) {
        jumpTo(index);
      } else {
        void resolveAndPlay(playlist, index);
      }
    },
    [songs, jumpTo, resolveAndPlay]
  );

  /** Removes track at index; indices align with playlist rows (including rows without videoId). */
  const removeSongAt = useCallback((index: number) => {
    setSongs((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = prev.filter((_, j) => j !== index);
      const ci = currentIndexRef.current;
      let newCi = ci;
      if (index < ci) newCi = ci - 1;
      else if (index === ci) {
        if (next.length === 0) newCi = 0;
        else if (index < prev.length - 1)
          newCi = Math.min(index, next.length - 1);
        else newCi = Math.max(0, index - 1);
      }
      const playable = next.length
        ? firstPlayableIndex(next, Math.min(newCi, next.length - 1))
        : 0;
      queueMicrotask(() => {
        currentIndexRef.current = playable;
        setCurrentIndex(playable);
        if (!next.some((s) => s.videoId)) setIsPlaying(false);
      });
      return next;
    });
  }, []);

  return {
    songs,
    currentIndex,
    isPlaying,
    isResolving,
    resolveAndPlay,
    playSongAt,
    playPause,
    next,
    prev,
    onTrackEnd,
    jumpTo,
    removeSongAt,
  };
}
