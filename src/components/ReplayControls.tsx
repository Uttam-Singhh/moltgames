"use client";

type Speed = 0.5 | 1 | 2 | 3;

interface ReplayControlsProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: Speed;
  isAtStart: boolean;
  isAtEnd: boolean;
  stepLabel: string;
  onTogglePlayPause: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onGoToStep: (step: number) => void;
  onSetSpeed: (speed: Speed) => void;
}

const SPEEDS: Speed[] = [0.5, 1, 2, 3];

export default function ReplayControls({
  currentStep,
  totalSteps,
  isPlaying,
  speed,
  isAtStart,
  isAtEnd,
  stepLabel,
  onTogglePlayPause,
  onStepForward,
  onStepBack,
  onGoToStep,
  onSetSpeed,
}: ReplayControlsProps) {
  const progress = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="bg-[var(--surface)] border-2 border-[var(--border)] p-4 neon-border-blue">
      {/* Step label */}
      <div className="text-center mb-3">
        <span className="arcade-heading text-xs text-[var(--arcade-blue)]">
          {stepLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-2 bg-[var(--surface-light)] border border-[var(--border)] mb-4 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          const step = Math.round(pct * (totalSteps - 1));
          onGoToStep(step);
        }}
      >
        <div
          className="h-full bg-[var(--arcade-blue)] transition-all duration-300"
          style={{ width: `${progress}%`, boxShadow: '0 0 6px rgba(68, 136, 255, 0.5)' }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-center gap-3">
        {/* Step back */}
        <button
          onClick={onStepBack}
          disabled={isAtStart}
          className="w-10 h-10 flex items-center justify-center border-2 border-[var(--border)] bg-[var(--surface-light)] hover:border-[var(--arcade-blue)] hover:neon-border-blue disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg"
          title="Step back"
        >
          &#x23EE;
        </button>

        {/* Play/Pause */}
        <button
          onClick={onTogglePlayPause}
          className="w-12 h-12 flex items-center justify-center border-2 border-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 neon-border transition-all text-xl"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "\u23F8" : "\u25B6"}
        </button>

        {/* Step forward */}
        <button
          onClick={onStepForward}
          disabled={isAtEnd}
          className="w-10 h-10 flex items-center justify-center border-2 border-[var(--border)] bg-[var(--surface-light)] hover:border-[var(--arcade-blue)] hover:neon-border-blue disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg"
          title="Step forward"
        >
          &#x23ED;
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-1 ml-4">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`px-2 py-1 text-xs font-mono border transition-all ${
                speed === s
                  ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)] neon-border"
                  : "border-[var(--border)] text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Step counter */}
      <div className="text-center mt-2 text-xs text-gray-500 font-mono">
        {currentStep + 1} / {totalSteps}
      </div>
    </div>
  );
}
