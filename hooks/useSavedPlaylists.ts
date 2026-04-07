"use client";

import { useState, useCallback, useEffect } from "react";
import { Playlist, SavedPlaylist } from "@/lib/types";

const STORAGE_KEY = "carvemusic_playlists";

export function useSavedPlaylists() {
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSavedPlaylists(JSON.parse(stored));
    } catch {
      // localStorage not available
    }
  }, []);

  const persist = useCallback((playlists: SavedPlaylist[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
      setSavedPlaylists(playlists);
    } catch {
      // localStorage not available
    }
  }, []);

  const savePlaylist = useCallback(
    (playlist: Playlist) => {
      const already = savedPlaylists.some(
        (p) =>
          p.name === playlist.name &&
          p.songs.length === playlist.songs.length
      );
      if (already) return;

      const entry: SavedPlaylist = {
        name: playlist.name,
        songs: playlist.songs.map((s) => ({
          title: s.title,
          artist: s.artist,
          year: s.year || "",
        })),
        timestamp: Date.now(),
      };

      persist([entry, ...savedPlaylists]);
    },
    [savedPlaylists, persist]
  );

  const deletePlaylist = useCallback(
    (index: number) => {
      const next = savedPlaylists.filter((_, i) => i !== index);
      persist(next);
    },
    [savedPlaylists, persist]
  );

  const isPlaylistSaved = useCallback(
    (name: string) => savedPlaylists.some((p) => p.name === name),
    [savedPlaylists]
  );

  return { savedPlaylists, savePlaylist, deletePlaylist, isPlaylistSaved };
}
