/**
 * Text-to-speech via Web Speech API
 */

import { useState, useCallback, useEffect } from "react";

export interface SpeechOptions {
  rate?: number;
  voice?: string;
  lang?: string;
  onEnd?: () => void;
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const refreshVoices = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    try {
      setVoices(speechSynthesis.getVoices());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      setVoices(speechSynthesis.getVoices());
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = useCallback((text: string, options?: SpeechOptions) => {
    if (!("speechSynthesis" in window)) {
      console.warn("Speech synthesis not supported");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate ?? 0.9;
    utterance.pitch = 1;
    if (options?.lang) {
      utterance.lang = options.lang;
    }

    if (options?.voice) {
      const voice = speechSynthesis.getVoices().find(
        (v) => v.name === options.voice || v.lang === options.voice
      );
      if (voice) utterance.voice = voice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      options?.onEnd?.();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      options?.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  /**
   * iOS/iPadOS browsers often require one user-gesture speech call before
   * subsequent programmatic speak() calls are allowed.
   */
  const unlock = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    if (isUnlocked) return;
    try {
      const warmup = new SpeechSynthesisUtterance(" ");
      warmup.volume = 0;
      warmup.rate = 1;
      warmup.pitch = 1;
      warmup.onstart = () => setIsUnlocked(true);
      warmup.onend = () => setIsUnlocked(true);
      warmup.onerror = () => setIsUnlocked(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(warmup);
      // Some browsers populate additional voices only after a user-gesture speech call.
      refreshVoices();
    } catch {
      // Ignore warmup errors; manual playback can still work.
    }
  }, [isUnlocked, refreshVoices]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, voices, unlock, isUnlocked, refreshVoices };
}
