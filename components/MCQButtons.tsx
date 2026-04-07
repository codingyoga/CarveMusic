"use client";

interface MCQButtonsProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}

export default function MCQButtons({
  options,
  onSelect,
  disabled,
}: MCQButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onSelect(option)}
          disabled={disabled}
          className="px-4 py-2 rounded-full text-sm
            text-zinc-300 bg-[var(--surface)] border border-[var(--border)]
            hover:border-[var(--accent-dim)] hover:text-[var(--accent)]
            hover:bg-[var(--surface-hover)]
            transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed
            active:scale-95"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
