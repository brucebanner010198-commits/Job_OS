"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hand } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { confirmSubmittedAction, continueAfterHumanAction } from "@/app/actions/apply";

interface AttentionItem {
  id: string;
  state: "PAUSED" | "HANDOFF";
  company: string;
  title: string;
  since: string;
  instruction: string;
  canContinue: boolean;
  leftForYou: string[];
}

const POLL_MS = 4000;
const DISMISS_KEY = "jobos.takeover.dismissed";

function readDismissed(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * "Human, please take over": shown on every page while an application is
 * waiting on the user (a human-only step, or review and submit). Polls a small
 * local endpoint; also fires a browser notification when one is allowed.
 */
export function HumanTakeover() {
  const router = useRouter();
  const [items, setItems] = useState<AttentionItem[]>([]);
  // Nothing renders until the first poll returns, so reading storage here is hydration-safe.
  const [dismissed, setDismissed] = useState<Record<string, string>>(readDismissed);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seen = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/apply/attention", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { items: AttentionItem[] };
      setItems(body.items);
      for (const item of body.items) {
        const key = `${item.id}:${item.state}:${item.since}`;
        if (seen.current.has(key)) continue;
        seen.current.add(key);
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
          new Notification("Human, please take over", { body: `${item.company}: ${item.instruction}` });
        }
      }
    } catch {
      /* offline or restarting; try again next tick */
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void poll(), 0);
    const t = setInterval(() => void poll(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [poll]);

  const visible = items.filter((i) => dismissed[i.id] !== `${i.state}:${i.since}`);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = visible.length ? `(${visible.length}) ${base}` : base;
  }, [visible.length]);

  if (visible.length === 0) return null;
  const item = visible[0]!;

  function later() {
    const next = { ...dismissed, [item.id]: `${item.state}:${item.since}` };
    setDismissed(next);
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* private mode: dismiss for this page view only */
    }
  }

  function continueRun() {
    setMessage(null);
    start(async () => {
      const r = await continueAfterHumanAction(item.id);
      if (r.message) setMessage(r.message);
      await poll();
      router.refresh();
    });
  }

  function submitted() {
    setMessage(null);
    start(async () => {
      await confirmSubmittedAction(item.id);
      await poll();
      router.refresh();
    });
  }

  function enableAlerts() {
    if (typeof Notification !== "undefined") void Notification.requestPermission();
  }

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="takeover-title"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-xl border-2 border-[var(--warning)] bg-card p-4 shadow-2xl md:inset-x-auto md:right-6"
    >
      <div className="flex items-start gap-3">
        <Hand className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p id="takeover-title" className="text-base font-semibold">
            Human, please take over
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {item.company}: {item.title}
          </p>
          <p className="mt-2 text-sm">{item.instruction}</p>
          {item.state === "PAUSED" && (
            <p className="mt-1 text-xs text-muted-foreground">
              When you&apos;re done, press Continue and the app carries on from that page.
            </p>
          )}
          {item.leftForYou.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {item.leftForYou.map((q, i) => (
                <li key={i}>• {q}</li>
              ))}
            </ul>
          )}
          {message && <p className="mt-2 text-xs text-[var(--warning)]">{message}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {item.state === "PAUSED" && (
              <Button size="sm" variant="accent" onClick={continueRun} disabled={pending}>
                {pending ? "Checking…" : "Continue"}
              </Button>
            )}
            {item.state === "HANDOFF" && (
              <Button size="sm" variant="accent" onClick={submitted} disabled={pending}>
                I submitted it
              </Button>
            )}
            <Link href="/apply" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Open Apply
            </Link>
            <Button size="sm" variant="ghost" onClick={later} disabled={pending}>
              Later
            </Button>
            {typeof Notification !== "undefined" && Notification.permission === "default" && (
              <Button size="sm" variant="ghost" onClick={enableAlerts}>
                Alert me in other tabs
              </Button>
            )}
          </div>
          {visible.length > 1 && (
            <p className="mt-2 text-xs text-muted-foreground">{visible.length - 1} more waiting.</p>
          )}
        </div>
      </div>
    </div>
  );
}
