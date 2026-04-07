"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl
            px-5 py-3.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]
            outline-none focus:border-[var(--accent-dim)] focus:ring-1
            focus:ring-[var(--accent)]/20 transition-all duration-300
            disabled:opacity-40"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="w-11 h-11 flex items-center justify-center rounded-xl
          bg-[var(--accent)] text-white transition-all duration-200
          hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed
          active:scale-90 shrink-0"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
        </svg>
      </button>
    </form>
  );
}
