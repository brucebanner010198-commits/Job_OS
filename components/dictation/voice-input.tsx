"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { transcribeAudioAction } from "@/app/actions/voice";

export interface VoiceInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
}

type Status = "idle" | "recording" | "transcribing";

/**
 * Textarea with a record button. Audio is recorded in the browser and
 * transcribed by the local speech service on this computer; nothing is sent
 * to a cloud speech API.
 */
export function VoiceInput(props: VoiceInputProps) {
  const { value, onChange, placeholder, label, rows = 6 } = props;

  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    // Client-only probe after mount; SSR has no MediaRecorder.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount probe
    setSupported(typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia));
    return () => recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const append = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const current = valueRef.current;
    const needsSpace = current.length > 0 && !/\s$/.test(current);
    onChange(current + (needsSpace ? " " : "") + trimmed);
  };

  const start = async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked. Allow it in the browser's site settings.");
      return;
    }
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("transcribing");
      try {
        const form = new FormData();
        form.set("audio", new Blob(chunks, { type: recorder.mimeType }));
        append((await transcribeAudioAction(form)).text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Transcription failed.");
      } finally {
        setStatus("idle");
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setStatus("recording");
  };

  const stop = () => recorderRef.current?.state === "recording" && recorderRef.current.stop();

  return (
    <div className="w-full">
      {label ? <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label> : null}

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
            onClick={status === "recording" ? stop : start}
            disabled={status === "transcribing"}
            aria-pressed={status === "recording"}
            aria-label={status === "recording" ? "Stop recording" : "Record a voice note"}
            className={cn(
              "absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center",
              "rounded-md border border-border bg-background text-muted-foreground",
              "transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
              status === "recording" && "border-transparent bg-destructive/10 text-destructive",
            )}
          >
            {status === "recording" ? (
              <Square className="h-4 w-4" fill="currentColor" />
            ) : status === "transcribing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      <p className="mt-1.5 min-h-[1.25rem] text-xs text-muted-foreground" aria-live="polite">
        {error ??
          (status === "recording"
            ? "Recording… press stop when you're done."
            : status === "transcribing"
              ? "Transcribing on this computer…"
              : supported
                ? "Press the mic to talk. Audio is transcribed locally and not stored."
                : "Voice needs a browser with microphone access; you can type instead.")}
      </p>
    </div>
  );
}

export default VoiceInput;
