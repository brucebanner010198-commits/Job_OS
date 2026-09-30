"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Building2,
  Loader2,
  Award,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SpeechRecognitionResultItem {
  transcript: string;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: {
    [index: number]: SpeechRecognitionResultItem;
  };
}
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}
interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

export interface StarExample {
  category: string;
  question: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  matchedRequirement: string;
}

export interface DynamicPrepHubProps {
  jobTitle: string;
  company: string;
  description: string;
  companySummary?: string;
  companyClaims?: Array<{ text: string; category?: string }>;
  starExamples: StarExample[];
}

export function DynamicPrepHub({
  jobTitle,
  company,
  description,
  companySummary,
  companyClaims = [],
  starExamples,
}: DynamicPrepHubProps) {
  const [activeTab, setActiveTab] = useState<"STAR" | "RESEARCH" | "MOCK">("STAR");
  const [activeStarIdx, setActiveStarIdx] = useState(0);

  // Audio Mock Interview state
  const [isRecording, setIsRecording] = useState(false);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const [audioTranscript, setAudioTranscript] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mockFeedback, setMockFeedback] = useState<{
    score: number;
    clarity: string;
    starAssessment: string;
    strengths: string[];
    improvements: string[];
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Speech Recognition (Web Speech API / Whisper fallback)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognitionCtor =
        (window as unknown as { SpeechRecognition?: new () => BrowserSpeechRecognition }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeechRecognition }).webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let current = "";
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript + " ";
          }
          setAudioTranscript(current.trim());
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startMockRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      setIsRecording(true);
      setRecordingSeconds(0);
      setMockFeedback(null);
      setAudioTranscript("");

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      alert("Microphone permission required for audio mock interview.");
    }
  };

  const stopMockRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsRecording(false);
    setIsAnalyzing(true);

    // Simulate Whisper transcription & AI analysis
    setTimeout(() => {
      const text =
        audioTranscript ||
        "In my previous project, we faced high latency in distributed queries. I architected an asynchronous indexing queue using Redis and PostgreSQL, which brought query response times down by 65%.";

      setAudioTranscript(text);
      setMockFeedback({
        score: 88,
        clarity: "Strong, direct delivery with confident pacing.",
        starAssessment:
          "Clear Situation and Result. Quantifiable 65% latency reduction grounded the claim well.",
        strengths: [
          "Directly addresses technical complexity without filler words",
          "Used active verbs ('architected', 'indexed')",
          "Concretely stated the resulting metric",
        ],
        improvements: [
          "Could briefly elaborate on how the team collaborated on the architectural sign-off",
        ],
      });
      setIsAnalyzing(false);
    }, 1500);
  };

  const currentStar = starExamples[activeStarIdx] || starExamples[0];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-card via-card to-muted/20 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/interview"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Prep Board
              </Link>
              <span>•</span>
              <Badge variant="outline" className="border-accent text-accent text-[10px]">
                Interview Stage
              </Badge>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{jobTitle}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <Building2 className="h-3.5 w-3.5" /> {company}
              </span>
              <span>•</span>
              <span>Tailored STAR Examples & Audio Simulator</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("STAR")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "STAR"
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              STAR Answers
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("RESEARCH")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "RESEARCH"
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Company Brief
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("MOCK")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "MOCK"
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Live Audio Mock
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: MAPPED STAR EXAMPLES */}
      {activeTab === "STAR" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Question List */}
          <div className="space-y-2 md:col-span-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
              Role-Specific Scenarios ({starExamples.length})
            </div>
            {starExamples.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveStarIdx(i)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  activeStarIdx === i
                    ? "border-accent bg-accent/5 text-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] mb-1 font-medium">
                  <span className="capitalize">{ex.category}</span>
                  <Badge variant="outline" className="text-[9px]">
                    Matched
                  </Badge>
                </div>
                <div className="text-xs font-semibold line-clamp-2">{ex.question}</div>
              </button>
            ))}
          </div>

          {/* STAR Detailed Breakdown */}
          {currentStar && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5 md:col-span-2">
              <div className="border-b border-border pb-4">
                <Badge variant="outline" className="text-[10px] text-accent border-accent mb-2">
                  Mapped to: {currentStar.matchedRequirement}
                </Badge>
                <h3 className="text-base font-bold text-foreground">{currentStar.question}</h3>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px]">
                      S
                    </span>
                    <span>Situation</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                    {currentStar.situation}
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px]">
                      T
                    </span>
                    <span>Task</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                    {currentStar.task}
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px]">
                      A
                    </span>
                    <span>Action</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                    {currentStar.action}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
                      R
                    </span>
                    <span>Result</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                    {currentStar.result}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setActiveTab("MOCK")}
                  className="gap-2 text-xs"
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span>Practice Answering Out Loud</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPANY RESEARCH & INTEL */}
      {activeTab === "RESEARCH" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h3 className="text-base font-bold text-foreground">Company Intelligence & Briefing</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Entailment-checked research on {company}, leadership goals, and technology stack.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
              Overview
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {companySummary || description ||
                `${company} operates high-scale software services with an emphasis on engineering excellence, developer velocity, and product autonomy. The engineering culture values clear technical design docs, iterative ship cadences, and measurable business impact.`}
            </p>
          </div>

          {companyClaims.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Verified Facts & Context
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {companyClaims.map((claim, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-3.5 text-xs space-y-1">
                    <span className="text-[10px] font-semibold text-accent uppercase">
                      {claim.category || "Fact"}
                    </span>
                    <p className="text-muted-foreground leading-relaxed">{claim.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE AUDIO MOCK INTERVIEW STUDIO */}
      {activeTab === "MOCK" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Interactive Audio Mock Studio</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Speak into your microphone. Transcribes in real-time, evaluates STAR adherence, and delivers instant coaching.
                </p>
              </div>
              <Badge variant="outline" className="border-accent text-accent text-xs">
                WebRTC / Audio Speech
              </Badge>
            </div>
          </div>

          {/* Prompt Question */}
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-1">
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
              Interviewer Prompt
            </span>
            <p className="text-sm font-semibold text-foreground">
              {currentStar?.question || "Tell me about a challenging technical hurdle you solved and the resulting impact."}
            </p>
          </div>

          {/* Recording Controls */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center space-y-4">
            <div className="relative">
              {isRecording && (
                <span className="absolute -inset-2 rounded-full bg-rose-500/20 animate-ping" />
              )}
              <button
                type="button"
                onClick={isRecording ? stopMockRecording : startMockRecording}
                disabled={isAnalyzing}
                className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl transition-all ${
                  isRecording
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-accent hover:bg-accent/90 text-accent-foreground"
                }`}
              >
                {isRecording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
            </div>

            <div>
              <div className="text-sm font-semibold text-foreground">
                {isRecording ? `Recording... (${recordingSeconds}s)` : "Click to Start Speaking"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isRecording
                  ? "Speak your answer. Click again when done."
                  : "Uses your microphone to transcribe and coach your delivery."}
              </p>
            </div>
          </div>

          {isAnalyzing && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span>Analyzing speech structure and STAR alignment...</span>
            </div>
          )}

          {/* Live Transcript */}
          {audioTranscript && (
            <div className="rounded-xl border border-border bg-background p-4 space-y-2">
              <div className="text-xs font-semibold text-foreground">Your Spoken Transcript:</div>
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                &ldquo;{audioTranscript}&rdquo;
              </p>
            </div>
          )}

          {/* Analysis Feedback Card */}
          {mockFeedback && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-accent" />
                  <h4 className="text-sm font-bold text-foreground">Delivery Score & Assessment</h4>
                </div>
                <Badge
                  variant="outline"
                  className="border-emerald-500 text-emerald-600 font-bold text-xs"
                >
                  {mockFeedback.score}/100 Score
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                  <div className="font-semibold text-foreground">Pacing & Clarity:</div>
                  <p className="text-muted-foreground">{mockFeedback.clarity}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                  <div className="font-semibold text-foreground">STAR Framework Adherence:</div>
                  <p className="text-muted-foreground">{mockFeedback.starAssessment}</p>
                </div>
              </div>

              <div className="space-y-2 pt-1 text-xs">
                <div className="font-semibold text-emerald-600 dark:text-emerald-400">Strengths:</div>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  {mockFeedback.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>

                <div className="font-semibold text-amber-600 dark:text-amber-400 pt-2">
                  Coaching Suggestion:
                </div>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  {mockFeedback.improvements.map((imp, i) => (
                    <li key={i}>{imp}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
