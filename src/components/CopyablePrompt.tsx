"use client";

export default function CopyablePrompt({
  text,
  color = "var(--accent)",
}: {
  text: string;
  color?: string;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 text-center mb-2">Tell your agent:</p>
      <button
        onClick={() => navigator.clipboard.writeText(text)}
        className="w-full group relative bg-[var(--surface-light)] border border-[var(--border)] px-4 py-2.5 text-left transition-all"
        style={{ borderColor: undefined }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
      >
        <code className="text-sm" style={{ color }}>
          {text}
        </code>
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 transition-colors group-hover:brightness-125"
          style={{ color: undefined }}
        >
          copy
        </span>
      </button>
    </div>
  );
}
