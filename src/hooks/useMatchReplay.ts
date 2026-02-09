"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Speed = 0.5 | 1 | 2 | 3;

interface UseMatchReplayOptions {
  totalSteps: number;
}

interface UseMatchReplayReturn {
  currentStep: number;
  isPlaying: boolean;
  speed: Speed;
  isAtStart: boolean;
  isAtEnd: boolean;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  goToStep: (step: number) => void;
  setSpeed: (speed: Speed) => void;
  reset: () => void;
}

export function useMatchReplay({
  totalSteps,
}: UseMatchReplayOptions): UseMatchReplayReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState<Speed>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAtStart = currentStep === 0;
  const isAtEnd = currentStep >= totalSteps - 1;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    clearTimer();
  }, [clearTimer]);

  const play = useCallback(() => {
    if (totalSteps <= 1) return;
    setCurrentStep((prev) => {
      // If at end, restart from beginning
      if (prev >= totalSteps - 1) return 0;
      return prev;
    });
    setIsPlaying(true);
  }, [totalSteps]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const stepForward = useCallback(() => {
    pause();
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [pause, totalSteps]);

  const stepBack = useCallback(() => {
    pause();
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, [pause]);

  const goToStep = useCallback(
    (step: number) => {
      pause();
      setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
    },
    [pause, totalSteps]
  );

  const setSpeed = useCallback((newSpeed: Speed) => {
    setSpeedState(newSpeed);
  }, []);

  const reset = useCallback(() => {
    pause();
    setCurrentStep(0);
  }, [pause]);

  // Auto-advance timer
  useEffect(() => {
    clearTimer();
    if (!isPlaying) return;

    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= totalSteps - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2000 / speed);

    return clearTimer;
  }, [isPlaying, speed, totalSteps, clearTimer]);

  // Pause when reaching the end
  useEffect(() => {
    if (isAtEnd && isPlaying) {
      pause();
    }
  }, [isAtEnd, isPlaying, pause]);

  return {
    currentStep,
    isPlaying,
    speed,
    isAtStart,
    isAtEnd,
    play,
    pause,
    togglePlayPause,
    stepForward,
    stepBack,
    goToStep,
    setSpeed,
    reset,
  };
}
