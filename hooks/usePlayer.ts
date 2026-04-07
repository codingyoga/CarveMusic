"use client";

import { useState, useCallback } from "react";
import { Playlist, Song } from "@/lib/types";

export function usePlayer() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const resolveAndPlay = useCallback(
    async (playlist: Playlist, startIndex: number = 0) => {
      setIsResolving(true);

      try {
        const res = await fetch("/api/youtube/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songs: playlist.songs }),
        });

        if (!res.ok) throw new Error("YouTube search failed");

        const data = await res.json();
        const resolved: Song[] = data.songs.filter(
          (s: Song) => s.videoId !== null
        );

        if (resolved.length === 0) {
          console.error("No songs found on YouTube");
          return;
        }

        setSongs(resolved);
        const safeIndex = Math.min(startIndex, resolved.length - 1);
        setCurrentIndex(safeIndex);
        setIsPlaying(true);
      } catch (error) {
        console.error("Failed to resolve songs:", error);
      } finally {
        setIsResolving(false);
      }
    },
    []
  );

  const playPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev < songs.length - 1) return prev + 1;
      return prev;
    });
  }, [songs.length]);

  const prev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  const onTrackEnd = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev < songs.length - 1) return prev + 1;
      setIsPlaying(false);
      return prev;
    });
  }, [songs.length]);

  const jumpTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < songs.length) {
        setCurrentIndex(index);
        setIsPlaying(true);
      }
    },
    [songs.length]
  );

  return {
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
  };
}
