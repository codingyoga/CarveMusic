"use client";

import { useState, useCallback, useRef } from "react";
import { ChatMessage, AIResponse, Playlist } from "@/lib/types";
import { buildApiMessages } from "@/lib/chatApiPayload";
import { carveDebug, truncateForLog } from "@/lib/carveDebugLog";

function lastAssistantPlaylistMessage(
  messages: ChatMessage[]
): ChatMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.parsed?.type === "playlist" && m.parsed.playlist) {
      return m;
    }
  }
  return undefined;
}

const WELCOME_TEXT =
  "Hey! What are we listening to today? A mood, an artist, a memory — tell me anything.";

/** Stable id + same initial tree on server and client (avoids hydration mismatch from useEffect seeding). */
const INITIAL_GREETING: ChatMessage = {
  id: "carve-welcome",
  role: "assistant",
  content: WELCOME_TEXT,
  parsed: {
    message: WELCOME_TEXT,
    type: "text",
  },
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [shouldPlay, setShouldPlay] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const currentPlaylistRef = useRef<Playlist | null>(null);
  messagesRef.current = messages;
  currentPlaylistRef.current = currentPlaylist;

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const prior = messagesRef.current;
      const apiMessages = buildApiMessages(
        prior,
        content,
        currentPlaylistRef.current
      );

      carveDebug("client.chat.send", {
        step: "fetch POST /api/chat",
        turnsSentToApi: apiMessages.length,
        lastOutgoingPreview: apiMessages.length
          ? truncateForLog(
              String(apiMessages[apiMessages.length - 1]?.content ?? ""),
              120
            )
          : null,
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);

      const parsed: AIResponse = await res.json();

      carveDebug("client.chat.response", {
        step: "API JSON received",
        type: parsed.type,
        action: parsed.action ?? null,
        playlistSongCount: parsed.playlist?.songs?.length ?? 0,
        messagePreview: truncateForLog(parsed.message ?? "", 100),
      });

      if (!parsed || !parsed.message) {
        throw new Error("Invalid response format");
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: parsed.message,
        parsed,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (parsed.playlist) {
        setCurrentPlaylist(parsed.playlist);
      }

      if (parsed.action === "play" && parsed.playlist) {
        setCurrentPlaylist(parsed.playlist);
        setShouldPlay(true);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Something went wrong. Try again?",
        parsed: {
          message: "Something went wrong. Try again?",
          type: "text",
        },
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeSongFromCurrentPlaylist = useCallback((index: number) => {
    carveDebug("client.playlist.remove", {
      step: "client-only (no /api/chat)",
      index,
    });
    setCurrentPlaylist((pl) => {
      if (!pl || index < 0 || index >= pl.songs.length) return pl;
      const songs = pl.songs.filter((_, i) => i !== index);
      return { ...pl, songs };
    });

    setMessages((prev) => {
      const lastPl = lastAssistantPlaylistMessage(prev);
      if (!lastPl?.parsed?.playlist) return prev;
      const songs = lastPl.parsed.playlist.songs.filter((_, i) => i !== index);
      const updated: AIResponse = {
        ...lastPl.parsed,
        playlist: { ...lastPl.parsed.playlist, songs },
      };
      return prev.map((m) =>
        m.id === lastPl.id
          ? {
              ...m,
              content: updated.message,
              parsed: updated,
            }
          : m
      );
    });
  }, []);

  const startConversation = useCallback(() => {
    setMessages([INITIAL_GREETING]);
  }, []);

  const clearShouldPlay = useCallback(() => setShouldPlay(false), []);

  return {
    messages,
    isLoading,
    currentPlaylist,
    shouldPlay,
    sendMessage,
    removeSongFromCurrentPlaylist,
    startConversation,
    clearShouldPlay,
  };
}
