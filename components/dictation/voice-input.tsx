"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoiceInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
}

/* Minimal local typings for the Web Speech API - the DOM lib does not ship these. */
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceInput(props: VoiceInputProps) {
  const { value, onChange, placeholder, label, rows = 6 } = props;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Keep latest value in a ref so the recognition callback always appends to current text.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const stopRecognition = () => {
    const rec = recognitionRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        // ignore - already stopped
      }
      recognitionRef.current = null;
    }
    setListening(false);
    setInterim("");
  };

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      stopRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendFinal = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const current = valueRef.current;
    const needsSpace = current.length > 0 && !/\s$/.test(current);
    onChange(current + (needsSpace ? " " : "") + trimmed);
  };

  const startListening = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    // Defensive: ensure no stale instance remains.
    stopRecognition();

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) {
          appendFinal(alt.transcript);
        } else {
          interimText += alt.transcript;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = () => {
      stopRecognition();
    };

    rec.onend = () => {
      // Reset state if recognition ends on its own.
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      stopRecognition();
    }
  };

  const toggleListening = () => {
    if (listening) {
      stopRecognition();
    } else {
      startListening();
    }
  };

  return (
    <div className="w-full">
      {label ? (
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={cn(
            "w-full rounded-lg border border-border bg-card p-3 text-sm",
            "outline-none transition focus:ring-2 focus:ring-ring",
            "resize-y leading-relaxed",
            supported && "pr-12",
          )}
        />

        {supported ? (
          <button
            type="button"
            onClick={toggleListening}
            aria-pressed={listening}
            aria-label={listening ? "Stop dictation" : "Start dictation"}
            className={cn(
              "absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center",
              "rounded-md border border-border bg-background text-muted-foreground",
              "transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
              listening && "border-transparent bg-destructive/10 text-destructive",
            )}
          >
            {listening ? (
              <Square className="h-4 w-4" fill="currentColor" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      {supported ? (
        <div className="mt-1.5 flex min-h-[1.25rem] items-center gap-2 text-xs">
          {listening ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
              <span className="text-muted-foreground">Listening…</span>
              <button
                type="button"
                onClick={stopRecognition}
                className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <MicOff className="h-3 w-3" />
                Stop
              </button>
              {interim ? (
                <span className="truncate italic text-muted-foreground/70">
                  {interim}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Tip: use Wispr Flow&apos;s hotkey to dictate cleaned text here, or just type.
        </p>
      )}
    </div>
  );
}

export default VoiceInput;
