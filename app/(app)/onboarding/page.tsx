import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plug, Mic, Target, SendHorizontal } from "lucide-react";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: Mic,
    title: "Master resume",
    href: "/master-resume",
    blurb: "Add it by voice or import. This is your single source of truth.",
  },
  {
    icon: Target,
    title: "Career goals",
    href: "/goals",
    blurb: "Your long-term goal plus milestones that re-rank matches.",
  },
  {
    icon: SendHorizontal,
    title: "Application answers",
    href: "/apply",
    blurb: "Work authorization, salary, and links. Confirm once.",
  },
  {
    icon: Plug,
    title: "Integrations",
    href: "/integrations",
    blurb: "Paste your OpenRouter key, plus ElevenLabs or Gmail if you use them.",
  },
];

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Job OS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete these four steps once. Autopilot then discovers roles, drafts
          briefs, and prepares applications. Auto-submit applies only on the
          autonomous route; all other applications require your approval.
        </p>
      </header>

      <div className="space-y-4">
        {STEPS.map(({ icon: Icon, title, href, blurb }, i) => (
          <Card key={href}>
            <CardContent className="flex items-start gap-4 pt-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Step {i + 1}
                </p>
                <h2 className="font-medium">{title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{blurb}</p>
                <Link href={href} className="mt-2 inline-block">
                  <Button size="sm" variant="outline">
                    Open
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link href="/">
          <Button variant="accent">Go to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
