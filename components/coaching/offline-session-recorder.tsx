"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  Square,
  Pause,
  Play,
  Download,
  Upload,
  RefreshCw,
  FileAudio,
  Volume2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface OfflineSessionRecorderProps {
  onTranscriptChange: (text: string) => void;
  initialTranscript?: string;
  className?: string;
}

type RecordingState = "idle" | "recording" | "paused" | "stopped";

function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

interface SpeechRecognitionEventLike {
  readonly results: {
    readonly length: number;
    [index: number]: {
      [index: number]: { readonly transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
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

export function OfflineSessionRecorder({
  onTranscriptChange,
  initialTranscript = "",
  className,
}: OfflineSessionRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState(initialTranscript);
  const speechSupported = typeof window !== "undefined" && Boolean(getSpeechRecognitionCtor());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const handleTranscriptUpdate = useCallback(
    (newText: string) => {
      setTranscript(newText);
      onTranscriptChange(newText);
    },
    [onTranscriptChange],
  );

  // Clean up timer and media streams on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const startAudioMeter = (stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setVolumeLevel(Math.min(100, Math.round((average / 128) * 100)));
        }
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch {
      // AudioContext meter fallback
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      recorder.start(250); // Collect in 250ms chunks
      setState("recording");
      setDuration(0);

      // Start duration counter
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Start volume level visualization
      startAudioMeter(stream);

      // Start live speech transcription if supported
      const Ctor = getSpeechRecognitionCtor();
      if (Ctor) {
        try {
          const rec = new Ctor();
          recognitionRef.current = rec;
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = "en-US";

          rec.onresult = (event: SpeechRecognitionEventLike) => {
            let fullText = "";
            for (let i = 0; i < event.results.length; i++) {
              fullText += event.results[i][0].transcript + " ";
            }
            handleTranscriptUpdate(fullText.trim());
          };

          rec.onerror = () => {
            // Live speech error fallback
          };

          rec.start();
        } catch {
          // Ignore recognition start errors
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Microphone access error: ${err.message}`
          : "Could not access microphone.",
      );
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.pause();
      setState("paused");
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && state === "paused") {
      mediaRecorderRef.current.resume();
      setState("recording");
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (state === "recording" || state === "paused")) {
      mediaRecorderRef.current.stop();
      setState("stopped");

      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setVolumeLevel(0);
    }
  };

  const resetRecording = () => {
    stopRecording();
    setState("idle");
    setDuration(0);
    setAudioUrl(null);
    setVolumeLevel(0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setState("stopped");
    setErrorMessage(null);
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 shadow-sm space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-3 w-3 rounded-full transition-colors",
              state === "recording"
                ? "bg-destructive animate-pulse"
                : state === "paused"
                ? "bg-warning"
                : state === "stopped"
                ? "bg-success"
                : "bg-muted",
            )}
          />
          <h3 className="text-sm font-semibold tracking-tight">Offline Session Capture</h3>
          <Badge variant="outline" className="text-[10px]">
            100% Local
          </Badge>
        </div>

        <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
          <span>{formatSeconds(duration)}</span>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Live audio level bar */}
      {state === "recording" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5" />
              Microphone activity
            </span>
            <span>{volumeLevel}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-accent transition-all duration-75 ease-out"
              style={{ width: `${Math.max(5, volumeLevel)}%` }}
            />
          </div>
        </div>
      )}

      {/* Recording controls */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {state === "idle" && (
          <Button onClick={startRecording} variant="accent" className="gap-2">
            <Mic className="h-4 w-4" />
            Start Recording
          </Button>
        )}

        {state === "recording" && (
          <>
            <Button onClick={pauseRecording} variant="outline" className="gap-2">
              <Pause className="h-4 w-4" />
              Pause
            </Button>
            <Button onClick={stopRecording} variant="default" className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Square className="h-4 w-4 fill-current" />
              Stop Recording
            </Button>
          </>
        )}

        {state === "paused" && (
          <>
            <Button onClick={resumeRecording} variant="accent" className="gap-2">
              <Play className="h-4 w-4" />
              Resume
            </Button>
            <Button onClick={stopRecording} variant="default" className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Square className="h-4 w-4 fill-current" />
              Stop Recording
            </Button>
          </>
        )}

        {state === "stopped" && (
          <>
            <Button onClick={resetRecording} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Record New Session
            </Button>
            {audioUrl && (
              <a
                href={audioUrl}
                download={`coaching-session-${new Date().toISOString().slice(0, 10)}.webm`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Download Audio
              </a>
            )}
          </>
        )}

        {/* Upload existing audio file */}
        {state === "idle" && (
          <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-xs font-medium hover:bg-muted/40 transition-colors">
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Audio File</span>
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={handleFileUpload}
            />
          </label>
        )}
      </div>

      {/* Audio player preview when stopped */}
      {audioUrl && (
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileAudio className="h-4 w-4 text-accent" />
            <span>Recorded Audio Playback</span>
          </div>
          <audio src={audioUrl} controls className="w-full h-8" />
        </div>
      )}

      {/* Real-time editable transcript */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Captured Transcript (Spoken or Typed)</span>
          {speechSupported && state === "recording" && (
            <span className="text-accent text-[11px] font-medium">Live speech streaming...</span>
          )}
        </div>
        <textarea
          value={transcript}
          onChange={(e) => handleTranscriptUpdate(e.target.value)}
          placeholder="Speak into your microphone or paste notes from today's career check-in..."
          rows={4}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
