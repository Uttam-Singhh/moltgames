"use client";

import { useState } from "react";

export default function CopyablePrompt({
  text,
  color = "var(--accent)",
}: {
  text: string;
  color?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-500 text-center mb-2">Tell your agent:</p>
      <div
        className="flex items-center gap-2 bg-[var(--surface-light)] border border-[var(--border)] px-4 py-2.5 cursor-pointer group transition-all hover:brightness-110"
        onClick={handleCopy}
      >
        <code className="text-sm flex-1 break-all" style={{ color }}>
          {text}
        </code>
        <span
          className="flex-shrink-0 text-xs font-mono px-2 py-1 border transition-all"
          style={{
            color: copied ? "var(--success)" : color,
            borderColor: copied ? "var(--success)" : "var(--border)",
          }}
        >
          {copied ? "copied!" : "copy"}
        </span>
      </div>
    </div>
  );
}
