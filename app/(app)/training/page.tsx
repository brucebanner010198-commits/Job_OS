import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  FileText,
  MessagesSquare,
  PenLine,
  SendHorizontal,
  Target,
  Upload,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const MODULES = [
  {
    href: "/setup",
    icon: Upload,
    title: "Setup & import",
    teaches: "Import a resume, capture your master resume by voice, and set your career goals",
    tag: "Foundation",
  },
  {
    href: "/master-resume",
    icon: FileText,
    title: "Resume 101 (standards)",
    teaches: "Resume-scanner rules, skim layout, single-column Fortune 500 format, and bullets with numbers",
    tag: "Resume",
  },
  {
    href: "/resume",
    icon: PenLine,
    title: "Tailor & cover letter",
    teaches: "Tailoring per job and a Fortune 500 cover letter checklist (250 to 400 words, hook then proof)",
    tag: "Materials",
  },
  {
    href: "/goals",
    icon: Target,
    title: "Dream company targeting",
    teaches: "Goals, a dream company board, briefs, gap analysis, and tailoring, in one flow",
    tag: "Strategy",
  },
  {
    href: "/companies",
    icon: Building2,
    title: "Company brief + HR hints",
    teaches: "Cited research, leadership context, and recruiter and hiring-manager contacts (drafts only)",
    tag: "Intel",
  },
  {
    href: "/apply",
    icon: SendHorizontal,
    title: "Apply guidance",
    teaches: "Route badges (autonomous, assisted, manual), the autopilot policy, and a human review step",
    tag: "Apply",
  },
  {
    href: "/track",
    icon: BookOpen,
    title: "Rejection transparency",
    teaches: "Gmail suggestions only, sorted rejection reasons, and coach notes with fixes",
    tag: "Track",
  },
  {
    href: "/interview",
    icon: MessagesSquare,
    title: "Interview readiness",
    teaches: "A readiness check, study guides, and AI-screen and real-HR voice prep",
    tag: "Interview",
  },
  {
    href: "/warm-path",
    icon: Users,
    title: "Warm-path outreach",
    teaches: "Ranked connections and intro drafts built from real text. You send them, never spam",
    tag: "Network",
  },
] as const;

export default function TrainingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader
        title="Job training hub"
        description="Your full job-training kit: resume, cover letter, gap analysis, apply guidance, interview prep, and clear reasons for rejections. Materials follow Fortune 500 skim standards, so you improve and recruiters can scan them faster."
      />

      <div className="mb-6 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">Ethical limits:</strong> Gmail
        status moves are suggestions only. Warm-path and HR outreach give you
        research and drafts. You review and send from your own accounts. No
        LinkedIn scraping or automated messaging.
      </div>

      <div className="grid gap-4">
        {MODULES.map(({ href, icon: Icon, title, teaches, tag }) => (
          <Link key={href} href={href} className="group block">
            <Card className="transition-colors hover:border-primary/40 hover:bg-muted/20">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
                <Badge variant="muted">{tag}</Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 pt-0">
                <p className="text-sm text-muted-foreground">{teaches}</p>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
