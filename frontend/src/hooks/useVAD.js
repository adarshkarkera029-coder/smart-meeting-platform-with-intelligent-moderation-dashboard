import { useEffect, useRef, useState } from "react";

const RMS_THRESHOLD = 0.028;
const SPEECH_CONFIRM_MS = 140;
const SILENCE_HANGOVER_MS = 750;
const MIN_SPEECH_MS = 400;
const MAX_UTTERANCE_MS = 8000;
const FFT_SIZE = 2048;

/**
 * Client-side Voice Activity Detection with confirmation + hangover so
 * brief noise spikes don't open a recorder, and mid-sentence pauses don't
 * shatter real speech into tiny fragments.
 *
 * Tuned so short pauses do not shatter one sentence into many dashboard rows.
 */
export function useVAD(stream, { onSpeechStart, onSpeechEnd, enabled = true } = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [level, setLevel] = useState(0);

  const callbacksRef = useRef({ onSpeechStart, onSpeechEnd });
  callbacksRef.current = { onSpeechStart, onSpeechEnd };

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const confirmTimerRef = useRef(null);
  const speakingRef = useRef(false);
  const speechStartedAtRef = useRef(0);

  useEffect(() => {
    if (!stream || !enabled) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    const buffer = new Float32Array(analyser.fftSize);
    let cancelled = false;

    const clearConfirm = () => {
      if (confirmTimerRef.current) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
    };

    const beginSpeech = () => {
      if (speakingRef.current) return;
      speakingRef.current = true;
      speechStartedAtRef.current = Date.now();
      setIsSpeaking(true);
      callbacksRef.current.onSpeechStart?.();
    };

    const endSpeech = () => {
      if (!speakingRef.current) return;
      const duration = Date.now() - speechStartedAtRef.current;
      speakingRef.current = false;
      setIsSpeaking(false);
      silenceTimerRef.current = null;
      callbacksRef.current.onSpeechEnd?.({
        durationMs: duration,
        tooShort: duration < MIN_SPEECH_MS,
      });
    };

    const startTick = () => {
      if (cancelled) return;
      analyser.getFloatTimeDomainData(buffer);
      let sumSquares = 0;
      let peak = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i];
        sumSquares += v * v;
        const abs = Math.abs(v);
        if (abs > peak) peak = abs;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      setLevel(Math.min(1, rms * 8));

      const isLoud = rms > RMS_THRESHOLD && peak > 0.038;

      if (isLoud) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        // Force-split long continuous speech so transcription can start early
        if (
          speakingRef.current &&
          Date.now() - speechStartedAtRef.current >= MAX_UTTERANCE_MS
        ) {
          endSpeech();
          beginSpeech();
        } else if (!speakingRef.current && !confirmTimerRef.current) {
          confirmTimerRef.current = setTimeout(() => {
            confirmTimerRef.current = null;
            beginSpeech();
          }, SPEECH_CONFIRM_MS);
        }
      } else {
        clearConfirm();
        if (speakingRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(endSpeech, SILENCE_HANGOVER_MS);
        }
      }

      rafRef.current = requestAnimationFrame(startTick);
    };

    if (audioCtx.state === "suspended") {
      audioCtx.resume().then(startTick).catch(() => {});
    } else {
      startTick();
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      clearConfirm();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      source.disconnect();
      analyser.disconnect();
      audioCtx.close();
      speakingRef.current = false;
      setIsSpeaking(false);
      setLevel(0);
    };
  }, [stream, enabled]);

  return { isSpeaking, level };
}
