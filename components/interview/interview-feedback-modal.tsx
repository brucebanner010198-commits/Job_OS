"use client";

import { useState, useTransition } from "react";
import { MessageSquare, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveDictationAction } from "@/app/actions/profile";

export function InterviewFeedbackModal({
  isOpen,
  onClose,
  company,
  role,
}: {
  isOpen: boolean;
  onClose: () => void;
  company: string;
  role: string;
}) {
  const [sentiment, setSentiment] = useState<"positive" | "neutral" | "challenging">("positive");
  const [questionsAsked, setQuestionsAsked] = useState("");
  const [reflection, setReflection] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const summaryText = `Interview Feedback for ${role} at ${company}:
Sentiment: ${sentiment.toUpperCase()}
Questions Asked:
${questionsAsked}
Candidate Reflection:
${reflection}`;

      await saveDictationAction(summaryText);
      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Post-Interview Debrief</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {role} at {company}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {submitted ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-600 dark:text-emerald-400 text-xs">
            <Check className="h-5 w-5 shrink-0" />
            <span>Thank you! Your interview feedback has been saved and factored into your career intelligence.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">How do you feel it went?</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "positive", label: "Strong / Positive" },
                  { id: "neutral", label: "Neutral / Fair" },
                  { id: "challenging", label: "Tough / Challenging" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSentiment(s.id as "positive" | "neutral" | "challenging")}
                    className={`rounded-lg border p-2.5 text-center text-xs transition-all ${
                      sentiment === s.id
                        ? "border-primary bg-primary/10 text-foreground font-medium"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Key questions or challenges the interviewers asked
              </label>
              <Textarea
                value={questionsAsked}
                onChange={(e) => setQuestionsAsked(e.target.value)}
                placeholder="e.g. Asked about optimizing cold start times in serverless, and how I handled a cross-team priority conflict."
                rows={3}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                What went well and what would you improve next time?
              </label>
              <Textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="e.g. My architectural explanation was solid, but I could have stated the database indexing trade-offs sooner."
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending || !questionsAsked.trim()} className="gap-2 text-xs">
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving debrief...
                  </>
                ) : (
                  "Save debrief"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
