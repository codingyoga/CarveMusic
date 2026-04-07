"use client";

import { useEffect, useRef } from "react";
import { SavedPlaylist } from "@/lib/types";

interface SavedPlaylistsProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: SavedPlaylist[];
  onLoad: (playlist: SavedPlaylist) => void;
  onDelete: (index: number) => void;
}

export default function SavedPlaylists({
  isOpen,
  onClose,
  playlists,
  onLoad,
  onDelete,
}: SavedPlaylistsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 w-72 max-h-80 overflow-y-auto
        rounded-2xl border border-[var(--border)] bg-[var(--surface)]
        shadow-xl shadow-black/40 z-50 animate-fade-in"
    >
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
          Saved Playlists
        </p>
      </div>

      {playlists.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-zinc-600">No saved playlists yet</p>
          <p className="text-xs text-zinc-700 mt-1">
            Save a playlist using the bookmark icon
          </p>
        </div>
      ) : (
        <div className="py-1">
          {playlists.map((pl, i) => (
            <div
              key={`${pl.name}-${pl.timestamp}`}
              className="group px-4 py-3 hover:bg-[var(--surface-hover)]
                transition-colors cursor-pointer flex items-center justify-between"
              onClick={() => {
                onLoad(pl);
                onClose();
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-200 truncate font-display">
                  {pl.name}
                </p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {pl.songs.length} songs ·{" "}
                  {new Date(pl.timestamp).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(i);
                }}
                className="w-6 h-6 flex items-center justify-center shrink-0
                  text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100
                  transition-all duration-200"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
