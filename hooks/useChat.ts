"use client";

import { useState, useCallback, useRef } from "react";
import { ChatMessage, AIResponse, Playlist } from "@/lib/types";

function summarizeForHistory(m: ChatMessage): { role: string; content: string } {
  if (m.role === "user") {
    return { role: m.role, content: m.content };
  }

  const p = m.parsed;
  if (!p) return { role: m.role, content: m.content };

  if (p.type === "playlist" && p.playlist) {
    const songList = p.playlist.songs
      .map((s) => `"${s.title}" by ${s.artist}`)
      .join(", ");
    return {
      role: m.role,
      content: JSON.stringify({
        message: p.message,
        type: "playlist",
        playlist: { name: p.playlist.name, songs_summary: songList },
      }),
    };
  }

  return {
    role: m.role,
    content: JSON.stringify({ message: p.message, type: p.type, options: p.options }),
  };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [shouldPlay, setShouldPlay] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const history = [...messagesRef.current, userMsg].map(summarizeForHistory);

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);

        const parsed: AIResponse = await res.json();

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
    },
    []
  );

  const startConversation = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Start" }],
        }),
      });

      if (!res.ok) throw new Error("Failed to start");

      const parsed: AIResponse = await res.json();

      const assistantMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: parsed.message,
        parsed,
      };

      setMessages([assistantMsg]);
    } catch (error) {
      console.error("Failed to start conversation:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearShouldPlay = useCallback(() => setShouldPlay(false), []);

  return {
    messages,
    isLoading,
    currentPlaylist,
    shouldPlay,
    sendMessage,
    startConversation,
    clearShouldPlay,
  };
}
