---
name: Job OS Competitive Landscape Research
status: complete
repo: /Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS
updated: 2026-06-18
sources: web research (June 2026), Job OS master execution plan, GitHub/README verification where noted
---

# Job OS — Competitive Landscape Research

> **Scope:** Competitive analysis for Job OS as a local-first AI job-search operating system.  
> **Method:** Extensive web search, official pricing pages where accessible, third-party reviews (marked as such), GitHub README verification for OSS projects.  
> **Legend:** ✅ = strong / built-in · ◐ = partial / add-on / limited · — = absent or not a focus · **V** = verified from primary source · **I** = inference from reviews/aggregators

---

## 1. Executive Summary

Job OS sits at an unusual intersection: **full-stack job-search OS** (discover → score → brief → tailor → apply → track → warm-path → interview) with **local-first privacy**, **cited company intel**, and **ethics-gated autopilot** (AUTONOMOUS-only auto-submit). No single competitor covers this entire surface with the same architecture.

The market splits into five clusters:

| Cluster | Representative products | What they optimize for | Job OS overlap |
|---------|-------------------------|------------------------|----------------|
| **OSS / self-hosted** | [Career Ops](https://github.com/santifer/career-ops), [JobsHunt](https://github.com/ramakrishnanayyappan/jobshunt), [CareerPulse](https://github.com/tcpsyn/CareerPulse), [Jobs Optima](https://github.com/l3lackcurtains/jobs-optima), [ApplyPilot](https://github.com/Pickle-Pixel/ApplyPilot), [openapply](https://pypi.org/project/openapply/) | Privacy, BYOK LLM, CLI or Docker deploy | **Highest** — closest philosophical peers |
| **AI-native SaaS** | Teal, Rezi, Jobscan, Wonsulting, AIApply, Sonara, LoopCV, LazyApply, Massive | Resume ATS, tracker CRM, volume auto-apply | Module-by-module overlap; none match local-first + cited briefs |
| **CRM trackers** | Huntr, Teal tracker, Notion/Airtable templates | Pipeline organization | Job OS Gmail propose-only track is **more conservative** than most |
| **Apply automation** | Simplify Copilot, LazyApply, browser extensions | Form fill / spray-and-pray | Job OS Phase 5 cooperative handoff is **differentiated** |
| **Interview voice** | Yoodli, Pramp/Exponent, Interviewing.io, ElevenLabs ConvAI, Hume EVI | Delivery coaching vs live human mocks | Job OS dual-persona (AI_SCREEN + REAL_HR) is **unique** among job tools |

### Strategic headline

- **Career Ops** is the most visible OSS peer and explicitly positions against Teal/Huntr/Jobscan ([career-ops.org/compare](https://career-ops.org/)). It is **CLI-first** (Claude Code / multi-CLI), publishes its scoring rubric, and **never auto-submits** — human-in-the-loop by design. Job OS is **app-first**, adds Gmail sync, warm-path, cited briefs, and **selective** AUTONOMOUS autopilot.
- **SaaS auto-apply** (LazyApply, Sonara, Massive, AIApply) wins on **volume and polish** but loses on **privacy, provenance, and trust** — poor Trustpilot signals on several (Massive ~1.9★, LazyApply ~2.4★ per third-party reviews **I**).
- **Teal + Simplify** own the **free-tier CRM + extension** mindshare; Job OS cannot win a Chrome Web Store land grab — it should win **power-user local control + defensible briefs + ethical autopilot**.
- **Company intel:** Paid databases (Harmonic ~$25k/yr **I**, PitchBook enterprise, Crunchbase Pro $49–99/mo **V**) are overkill for candidates. Job OS's **web-research + SEC EDGAR + citation guard** (Phase 2) is a credible **free, defensible** alternative — aligned with the master plan's Crunchbase removal.
- **Interview voice:** ElevenLabs ConvAI is proven at scale (e.g. Apna 7.5M+ interview minutes **V** per [ElevenLabs blog](https://elevenlabs.io/blog/apna-interview-agents)). Yoodli/Hume optimize **delivery**, not **role-specific HR simulation**. Job OS's persona split + OSS Pipecat fallback is differentiated.

### Pricing landscape (verified ranges, June 2026)

| Tier | Examples | Typical cost |
|------|----------|--------------|
| Free forever | Teal tracker, Simplify autofill, Huntr (100 jobs), LoopCV limited, Rezi/Kickresume limited | $0 |
| Budget AI suite | WonsultingAI Premium | **$19.99/mo** **V** |
| Mid resume/tracker | Teal+, Rezi Pro, Jobscan quarterly, Huntr Pro | **$26–50/mo** **V** |
| Auto-apply mid | Sonara annual, LoopCV Pro, AIApply toolkit | **$20–74/mo** **V/I** |
| Auto-apply premium | Massive, AIApply auto bundles, JobCopilot Elite | **$55–149/mo** **I** |
| Spray-and-pray annual | LazyApply Premium | **$149/yr** **V** |
| Enterprise intel | Harmonic, PitchBook | **$25k+/yr** **I** |
| Job OS (inference) | OSS data layer + BYOK OpenRouter/ElevenLabs | **~$5–40/mo** API costs **I** (usage-dependent) |

---

## 2. Feature Comparison Matrix

**Rows:** Primary competitors + Job OS.  
**Columns:** Job OS modules from master execution plan.

| Product | Local / self-host | Master resume | Goals → score | Discover jobs | Cited company briefs | Tailor resume/CL | Apply automation | Gmail / email track | Warm-path / network | Interview prep voice | Multi-profile | OSS data layer |
|---------|:-----------------:|:-------------:|:-------------:|:-------------:|:--------------------:|:----------------:|:----------------:|:-------------------:|:-------------------:|:--------------------:|:-------------:|:--------------:|
| **Job OS** | ✅ | ✅ | ✅ | ◐ | ◐ (Phase 2) | ✅ | ◐ (AUTONOMOUS only) | ◐ propose-only | ◐ drafts | ◐ ElevenLabs+Pipecat | ◐ | ✅ |
| **Career Ops** ([santifer](https://github.com/santifer/career-ops)) | ✅ MIT | ✅ cv.md | ✅ 6-dim rubric | ✅ portal scan | — | ✅ PDF | ◐ form draft, no submit | — | ◐ LinkedIn outreach draft | ◐ STAR bank | ◐ | ✅ |
| **JobsHunt** ([repo](https://github.com/ramakrishnanayyappan/jobshunt)) | ✅ MIT | ✅ vault | ✅ structured eval | — | — | ✅ ATS tailor | — | — | — | ◐ hints | ◐ | ✅ |
| **CareerPulse** | ✅ | ✅ | ✅ AI score | ✅ 14 boards | — | ✅ | ◐ extension autofill | — | ◐ contacts | — | — | ✅ |
| **Jobs Optima** | ✅ MIT | ✅ | ◐ match | ✅ scanner | — | ✅ | ◐ extension | — | — | — | — | ✅ |
| **ApplyPilot** | ✅ | ◐ | ✅ | ✅ 5+ boards | — | ✅ | ✅ full auto | — | — | — | ◐ | ✅ |
| **openapply** | ✅ MIT | ✅ | ✅ | ◐ | — | ✅ | ◐ HITL | — | — | — | — | ✅ |
| **MR.Jobs** | ✅ MIT | ✅ | ✅ | ✅ 7+ sources | — | ✅ | ✅ Playwright | ◐ email | — | — | — | ✅ |
| **reactive-resume** | ✅ MIT | ✅ builder only | — | — | — | — export | — | — | — | — | ✅ multi-resume | ✅ |
| **Teal** | — | ✅ | ◐ keyword match | ◐ clip jobs | — | ✅ AI | — manual submit | ◐ | ◐ CRM | ◐ study | ✅ | — |
| **Huntr** | — | ✅ | ◐ | ◐ clip | — | ✅ Pro | ◐ autofill | — | ✅ contacts | — | — | — |
| **Simplify** | — | ✅ | ◐ | ◐ board | — | ✅ Simplify+ | ◐ autofill only | ◐ tracker | — | — | — | — |
| **Jobscan** | — | ◐ | — | ◐ board | — | ✅ ATS focus | — | ◐ tracker | — | — | — | — |
| **Rezi** | — | ✅ | ◐ | ◐ US tech board | — | ✅ | — | — | — | ◐ mock | — | — |
| **WonsultingAI** | — | ✅ | ◐ | ✅ JobBoardAI | — | ✅ | ◐ AutoApplyAI | ◐ tracker | ✅ NetworkAI | ✅ InterviewAI | — | — |
| **LazyApply** | — | ◐ profiles | — | ◐ filters | — | — | ✅ extension | ◐ dashboard | ◐ referral emails | — | ✅ 5–20 profiles | — |
| **Sonara** | — | ✅ | ✅ | ✅ | — | ◐ | ✅ cloud | ◐ dashboard | — | — | — | — |
| **LoopCV** | — | ✅ | ✅ | ✅ 30+ boards | — | ✅ | ✅ server-side | ◐ | ◐ recruiter email | — | ◐ A/B CVs | — |
| **AIApply** | — | ✅ | ✅ | ✅ | — | ✅ | ✅ credits | ◐ | — | ✅ Interview Buddy | — | — |
| **Massive** | — | ✅ | ✅ | ✅ | — | ✅ | ✅ mobile autopilot | ◐ | — | — | — | — |
| **JobCopilot** | — | ✅ | ✅ | ✅ 300k+ pages | — | ✅ | ✅ extension | ◐ | ◐ recruiter credits | ◐ mock | ◐ 3 copilots | — |
| **Yoodli** | — | — | — | — | — | — | — | — | — | ✅ delivery | — | — |
| **Pramp / Exponent** | — | — | — | — | — | — | — | — | — | ✅ peer live | — | — |
| **Interviewing.io** | — | — | — | — | — | — | — | — | — | ✅ human SWE | — | — |
| **Harmonic / Crunchbase** | — | — | — | — | ◐ funding intel | — | — | — | ◐ people | — | — | — |

---

## 3. Per-Product Notes

### 3.1 Open-source / self-hosted

#### Career Ops (santifer/career-ops) — **primary OSS benchmark**
| Field | Detail |
|-------|--------|
| **URL** | https://github.com/santifer/career-ops · https://career-ops.org |
| **License** | MIT **V** |
| **Pricing** | Free OSS; cost = AI CLI subscription (Claude Code, etc.) **V** |
| **Strengths** | Massive community traction (50k+ GitHub stars **V**); 14 skill modes; zero-token portal scanner (Greenhouse/Ashby/Lever); published 6-dimension rubric; batch parallel eval; Go TUI dashboard; `/career-ops apply` form drafting; interview story bank; negotiation scripts; multi-CLI (Claude, Codex, Gemini, Copilot) **V** |
| **Weaknesses** | CLI-not-app UX; no Gmail sync; no cited company brief agent; **never auto-submits** (by design); tied to AI coding CLI workflow; trademark policy on "career-ops" brand **V** |
| **Relevance** | **Highest** — closest narrative competitor. Job OS should cite/compare explicitly. Differentiate: Next.js app, pgvector RAG, Gmail track, warm-path, AUTONOMOUS-only autopilot, ElevenLabs voice, cited briefs. |

*Note:* Fork [PunithVT/career-ops](https://github.com/punithvt/career-ops) adds multi-user self-hosted web UI on AWS — different deployment model than santifer CLI original.

#### JobsHunt (ramakrishnanayyappan/jobshunt)
| Field | Detail |
|-------|--------|
| **URL** | https://github.com/ramakrishnanayyappan/jobshunt |
| **License** | MIT **V** |
| **Pricing** | Free; BYOK LLM **V** |
| **Strengths** | Local-first FastAPI+React; resume vault; structured JSON evaluation (dimensions, gaps, story candidates); desktop installers (DMG) **V**; YAML/JSON on disk |
| **Weaknesses** | Early stage (3 stars **V**); no job discovery engine; no apply automation; no Gmail; single maintainer |
| **Relevance** | **High** for evaluation/tailor patterns; mentioned in research scope as explicit OSS peer. Job OS exceeds on pipeline breadth. |

#### CareerPulse (tcpsyn/CareerPulse)
| Field | Detail |
|-------|--------|
| **URL** | https://github.com/tcpsyn/CareerPulse |
| **License** | OSS (check repo LICENSE) |
| **Strengths** | 14 job boards; Ollama local inference; Chrome extension autofill; hiring-manager contact finder **V** |
| **Weaknesses** | Python monolith; less modular than Job OS adapter seams |
| **Relevance** | Reference for `lib/jobs/sources/` breadth and extension handoff patterns. |

#### Jobs Optima (l3lackcurtains/jobs-optima)
| Field | Detail |
|-------|--------|
| **URL** | https://github.com/l3lackcurtains/jobs-optima |
| **License** | MIT **V** |
| **Strengths** | Full loop marketing (optimize → scan → track → autofill); Next.js 16 + NestJS; multi-provider AI **V** |
| **Weaknesses** | MongoDB/Redis stack vs Job OS Postgres/pgvector; no voice; no Gmail ethics layer |
| **Relevance** | Architectural peer; validates market demand for self-hosted full-loop tools. |

#### ApplyPilot (Pickle-Pixel/ApplyPilot)
| Field | Detail |
|-------|--------|
| **URL** | https://github.com/Pickle-Pixel/ApplyPilot |
| **License** | MIT **V** (warns about name-squatting sites) |
| **Strengths** | 6-stage autonomous pipeline; JobSpy + 48 Workday portals; Claude Code browser submit; live dashboard **V** |
| **Weaknesses** | Aggressive full-auto ethics; no human cooperative handoff; no cited briefs; AGPL/MIT confusion in README marketing **I** |
| **Relevance** | **Counter-position** for Job OS AUTONOMOUS-only + ASSISTED review gate. Study `lib/apply/` failure modes (CAPTCHA, essays). |

#### openapply (PyPI)
| Field | Detail |
|-------|--------|
| **URL** | https://pypi.org/project/openapply/ |
| **License** | MIT **V** |
| **Strengths** | 100% local Ollama; terminal-first; SQLite; HITL by design **V** |
| **Weaknesses** | Beta 0.1.2; CLI only; no web UI |
| **Relevance** | Validates "OpenApply" naming space; Job OS is not a CLI agent — complementary positioning. |

#### MR.Jobs, JobSync, JobOps, agenticjobsearchlocal, OpenOrbit, AutoApply
| Product | Notes |
|---------|-------|
| [MR.Jobs](https://github.com/humancto/mr-jobs) | Python FastAPI; 7+ sources; Playwright apply; MIT; very early **V** |
| [JobSync](https://github.com/Gsync/jobsync) | Next.js tracker + AI assistant; Docker; resume PDF **V** |
| [JobOps](https://github.com/DaKheera47/job-ops) | HN showcase; JD snapshots at apply time; Ollama; webhook automation **V** |
| [agenticjobsearchlocal](https://github.com/Nikhil-Kasam/agenticjobsearchlocal) | Fully local RAG + Celery; pause-before-submit **V** |
| [OpenOrbit](https://github.com/locdinhki/openorbit) | Electron; Patchright stealth; 4 AI providers; CRM **V** |
| [AutoApply](https://github.com/AbhishekMandapmalvi/AutoApply) | 6 ATS platforms; local `~/.autoapply/` **V** |

#### reactive-resume
| Field | Detail |
|-------|--------|
| **URL** | https://github.com/amruthpillai/reactive-resume · https://rxresu.me |
| **License** | MIT **V** |
| **Pricing** | Free hosted + self-host **V** |
| **Relevance** | Resume **builder** only — not job OS. Job OS could export compatible JSON **P2** enhancement. |

---

### 3.2 AI-native job tools

#### Teal
| Field | Detail |
|-------|--------|
| **URL** | https://www.tealhq.com |
| **Pricing** | Free: unlimited tracking, limited AI credits **V**. Teal+: ~$29/mo, $79/qtr, $13/wk, $179/yr (sources vary) **V/I** |
| **Gated** | Unlimited AI bullets, match scorer, ATS scan, templates **V** |
| **Strengths** | Best-in-class free tracker; Chrome extension 4.9★ **I**; 650k–2M users **I**; Kanban CRM |
| **Weaknesses** | No auto-apply; AI credits exhaust quickly on free tier **V**; cloud-only |
| **Relevance** | CRM UX benchmark for `app/(app)/track/` and onboarding. |

#### Huntr
| Field | Detail |
|-------|--------|
| **URL** | https://huntr.co/pricing |
| **Pricing** | Free: 100 jobs **V**. Pro: $40/mo, $90/qtr, $160/6mo **V** |
| **Strengths** | Mature Kanban CRM; contact management; autofill extension |
| **Weaknesses** | Auto-apply immature **I**; AI behind $40/mo |
| **Relevance** | Contact-centric tracking vs Job OS Gmail proposal model. |

#### Simplify
| Field | Detail |
|-------|--------|
| **URL** | https://simplify.jobs · [Chrome extension](https://chromewebstore.google.com/detail/simplify-copilot-autofill/pbanhockgagggenencehbnadejlgchfc) |
| **Pricing** | Copilot autofill free forever **V**. Simplify+: $39.99/mo, $19.99/wk, $89.99/qtr **V** |
| **Strengths** | 100M+ applications claimed **V**; 100+ ATS autofill; YC W21 **I** |
| **Weaknesses** | Not auto-apply — user clicks Submit **V**; privacy policy staleness concerns in reviews **I** |
| **Relevance** | Cooperative handoff competitor for ASSISTED route; study ATS coverage list for `lib/apply/driver-playwright.ts`. |

#### Jobscan
| Field | Detail |
|-------|--------|
| **URL** | https://www.jobscan.co |
| **Pricing** | Free: ~5 scans/mo **V**. Premium: $49.95/mo or $89.95/qtr **V** |
| **Strengths** | ATS-vendor-specific tips (Workday, Greenhouse, etc.) **V**; deep keyword matching |
| **Weaknesses** | Expensive; desktop-first; not a job OS |
| **Relevance** | Keyword/scoring ideas for `lib/scoring/` — Job OS uses embeddings + goals, not keyword-only. |

#### Rezi
| Field | Detail |
|-------|--------|
| **URL** | https://rezi.ai/pricing |
| **Pricing** | Free (1 resume, 3 PDFs) **V**. Pro $29/mo. Lifetime $149 **V** |
| **Strengths** | ATS score 23 factors; interview practice; cover letters |
| **Weaknesses** | US tech job board only **I**; cloud |
| **Relevance** | Resume scoring UX; Job OS bullet frameworks (TEAL, XYZ) are more rigorous on provenance. |

#### Kickresume
| Field | Detail |
|-------|--------|
| **URL** | https://www.kickresume.com |
| **Pricing** | Free limited; Premium ~$4.50–19/mo by billing **V** |
| **Strengths** | GPT-4.1 writer; 40+ templates; career map; student free 6mo **I** |
| **Weaknesses** | AI credit limits; design-first vs truth-first |
| **Relevance** | Template/export only. |

#### WonsultingAI
| Field | Detail |
|-------|--------|
| **URL** | https://www.wonsulting.com/wonsultingai |
| **Pricing** | Free tier capped **V**. Premium $19.99/mo **V** |
| **Strengths** | NetworkAI cold outreach; InterviewAI; AutoApplyAI (premium) **I**; coaching upsell |
| **Weaknesses** | Cloud; "100% interviews guaranteed" marketing **V** — trust concern |
| **Relevance** | Warm-path draft competitor (`lib/warm/`). Job OS stays draft-only — ethical advantage. |

#### LazyApply
| Field | Detail |
|-------|--------|
| **URL** | https://lazyapply.com |
| **Pricing** | $99/$149/$999 per year only **V**. No monthly, no trial **V** |
| **Strengths** | High volume Easy Apply; multi-profile |
| **Weaknesses** | No tailoring; Trustpilot ~2.4★ **I**; refund complaints **I** |
| **Relevance** | Anti-pattern for Job OS quality-over-volume positioning. |

#### Sonara
| Field | Detail |
|-------|--------|
| **URL** | https://www.sonara.ai |
| **Pricing** | $2.95 trial → $23.95/4 weeks **V**; $71.40/yr **V** |
| **Strengths** | Cheap annual; daily digest |
| **Weaknesses** | 25–40% silent failure rate cited in reviews **I**; auto-renewal trap **I** |
| **Relevance** | Cloud autopilot benchmark; Job OS should publish apply success metrics. |

#### LoopCV
| Field | Detail |
|-------|--------|
| **URL** | https://www.loopcv.pro/pricing |
| **Pricing** | Free forever (limited apps) **V**; from €9.99/mo **V** |
| **Strengths** | Server-side apply; A/B CV testing; recruiter email outreach |
| **Weaknesses** | EU-centric **I**; credit limits |
| **Relevance** | Autopilot orchestrator reference for Phase 6. |

#### AIApply
| Field | Detail |
|-------|--------|
| **URL** | https://aiapply.co |
| **Pricing** | Toolkit ~$29/mo; Auto-apply from ~$74/mo or credit packs **I**; pricing often in-app only **I** |
| **Strengths** | Broad feature bundle; Interview Buddy |
| **Weaknesses** | Dual pricing confusion **I**; no free auto-apply trial **I** |
| **Relevance** | Full-stack SaaS aspirational competitor. |

#### Massive (formerly UseMassive)
| Field | Detail |
|-------|--------|
| **URL** | https://trymassive.ai |
| **Pricing** | ~$49–99/mo tiers reported **I**; 4-day CC trial **I**; 14-day refund policy stated **V** |
| **Strengths** | Mobile-first UX **I** |
| **Weaknesses** | Trustpilot ~1.9★ **I**; Workday failure reports **I** |
| **Relevance** | UX polish target for mobile nav; not ethics model. |

#### JobCopilot
| Field | Detail |
|-------|--------|
| **URL** | https://jobcopilot.com |
| **Pricing** | ~$8.90–12.90/week (**~$39–56/mo**) **V/I** |
| **Strengths** | Review mode vs full auto **V**; 4.2★ Trustpilot **I** |
| **Weaknesses** | Weekly billing; scam job exposure concerns **I** |
| **Relevance** | **Review mode** parallels Job OS ASSISTED/MANUAL gates. |

---

### 3.3 CRM-style job trackers

| Solution | Pricing | Strengths | Weaknesses |
|----------|---------|-----------|------------|
| **Notion templates** | Free–$30 template purchases **I** | Infinitely customizable | No AI, no autofill, manual |
| **Airtable** | Free tier; Plus $20/seat/mo **I** | Relational, views | Not job-specific; setup tax |
| **Google Sheets** | Free | Universal | No automation |
| **Teal / Huntr** | See above | Purpose-built | Cloud lock-in |

**Job OS angle:** Gmail-synced propose-only status (`lib/gmail/`, `lib/track/`) is **safer** than auto-status but **less convenient** than Huntr drag-and-drop — document this tradeoff in onboarding.

---

### 3.4 Apply automation

| Approach | Examples | Job OS stance |
|----------|----------|---------------|
| Browser extension autofill | Simplify, Huntr, LazyApply | ASSISTED route + future extension **P2** |
| Headed Playwright | Job OS `lib/apply/driver-playwright.ts`, ApplyPilot, AutoApply | Core — cooperative handoff Phase 5 |
| Cloud autonomous agent | Sonara, LoopCV, Massive | AUTONOMOUS-only subset |
| CLI browser agent | Career Ops `/career-ops apply` | Draft-only, no submit |

**Verified gap:** No competitor combines **live browser cooperative handoff** + **provenance-checked LLM essays** + **route classification** (AUTONOMOUS/ASSISTED/MANUAL) **I** — Job OS master plan Phase 5 is a moat if shipped.

---

### 3.5 Interview prep voice

| Product | Format | Pricing | vs Job OS |
|---------|--------|---------|-----------|
| [Yoodli](https://yoodli.ai/pricing) | Delivery analytics (pace, fillers) | Free 5 sessions; Pro ~$8/mo ann.; Advanced ~$20/mo **V** | Job OS adds **role personas**, not just delivery |
| [Pramp](https://www.pramp.com) / Exponent | Peer live | Free peer **I**; Exponent ~$79/mo **I** | Human unpredictability; no company context |
| [Interviewing.io](https://interviewing.io) | Anonymous SWE mocks | ~$179+/session **I** | Premium human signal; expensive |
| [ElevenLabs ConvAI](https://elevenlabs.io/conversational-ai) | Full voice agent | Usage-based; Job OS caps 30/60 min **V** (plan) | **Job OS primary** — AI_SCREEN vs REAL_HR |
| [Hume EVI](https://www.hume.ai/pricing) | Empathic STS | Free 5 EVI min; Creator $14/mo **V** | Emotion layer — optional eval **P2** |
| [ai-mock-interview](https://github.com/FranciscoMoretti/ai-mock-interview) | OSS ElevenLabs sample | MIT **V** | Reference implementation |

---

### 3.6 Company intel

| Source | Access | Fit for Job OS briefs |
|--------|--------|----------------------|
| [Crunchbase](https://support.crunchbase.com/hc/en-us/articles/360062989313) Free | Basic profiles; search capped at 5 results **V** | **Dropped** per master plan — aggregator, paywalled depth |
| Crunchbase Pro | $49/mo annual **V** | Too expensive for personal use |
| [Harmonic](https://harmonic.ai/pricing) | No free tier; enterprise pricing **V/I** | Overkill; API/warehouse focus |
| PitchBook | Enterprise **I** | Same |
| SEC EDGAR Form D | Free **V** | **Job OS Phase 2** — US funding |
| Web-research agent | BYOK OpenRouter | **Job OS Phase 2** — cited claims |
| Wikipedia / official / news | Free | **Built** partial in `lib/brief/` |
| [SearXNG](https://github.com/searxng/searxng) | Self-host | Optional metasearch in plan |

---

## 4. SWOT Analysis — Job OS vs Combined Competitive Set

### Strengths
- **Only local-first full-stack OS** with Postgres/pgvector, Prisma, and adapter seams for jobs/brief/voice/apply **V** (repo)
- **Provenance-first** tailoring and brief citation guard — most SaaS tools optimize keywords without source quotes **I**
- **Ethical autopilot tiering** — AUTONOMOUS-only auto-submit; Gmail propose-only; warm-path draft-only **V** (master plan)
- **Dual voice personas** (AI_SCREEN + REAL_HR) with OSS Pipecat fallback — unique in category **I**
- **OSS data layer** (Remotive, RemoteOK, Arbeitnow, Jobicy, EDGAR) — no vendor lock-in on discovery **V** (plan)
- **Integrations portal** (Phase 1) — cleaner BYOK than `.env` for non-technical users **V** (plan)

### Weaknesses
- **Not shipped:** cooperative handoff, autopilot orchestrator, Knowledge Notebook, web-research brief agent **V** (plan)
- **No Chrome extension** — loses "save job in 2 clicks" vs Teal/Simplify/Huntr **I**
- **Setup friction** — Docker Postgres, API keys vs Teal signup **I**
- **Single-user local Mac default** — no multi-user hosted story (vs PunithVT career-ops fork) **I**
- **ElevenLabs cost** — session caps needed; SaaS bundles hide marginal cost **V** (plan risk register)

### Opportunities
- **Career Ops audience overflow** — CLI users wanting GUI + Gmail + voice **I**
- **Privacy regulation / AI resume backlash** — local-first narrative rising **I**
- **Post-Crunchbase brief stack** — cite SEC + primary sources as trust feature **V** (plan rationale)
- **Cooperative apply** as answer to spray-and-pray backlash **I**
- **Reactive Resume import** — JSON resume interchange **P2**

### Threats
- **Career Ops** mindshare in OSS (50k stars) may define "job search OS" before Job OS ships broadly **V**
- **Simplify free autofill** sets expectation that apply assistance is $0 **V**
- **ATS arms race** — LinkedIn/Workday bot detection hurts all auto-apply **I**
- **Feature commoditization** — every SaaS adds AI resume + tracker **I**
- **Maintenance burden** — Playwright drivers break on ATS UI changes **I** (industry-wide)

---

## 5. Gap Analysis — What Competitors Do Better

| Gap | Who does it better | Severity for Job OS |
|-----|-------------------|---------------------|
| Chrome job clipper / 1-click save | Teal, Huntr, Simplify | **High** — acquisition funnel |
| Free tier with zero setup | Teal tracker, Simplify autofill | **High** — onboarding |
| Published apply volume / success metrics | LoopCV, AIApply marketing | **Medium** — trust |
| ATS keyword scanner UX | Jobscan, Teal+ | **Medium** — `lib/scoring/` explainability |
| Peer human mocks | Pramp, Interviewing.io | **Medium** — voice is AI-only |
| Mobile polish | Massive | **Low** — desktop-first OK for v1 |
| Multi-user hosted deploy | PunithVT/career-ops | **Low** — personal use case |
| Recruiter email blast | LoopCV, LazyApply referrals | **Low** — intentionally out of scope |
| Instant PDF resume design | reactive-resume, Kickresume | **Medium** — Job OS ATS-first |
| Zero-token job portal scan | Career Ops (150+ companies) | **High** — Job OS uses APIs not GH/Ashby scan |
| Brand / community | Career Ops, Teal | **High** |

---

## 6. Differentiation Opportunities

### 6.1 Local-first + privacy
- **Message:** "Your master resume, applications, and briefs live in your Postgres — not a venture-backed resume database."
- **Proof points:** Desktop keychain (`lib/secrets/keychain.ts`), no telemetry, Apache/MIT/BSD ship bundle **V**
- **Beat:** Teal, Huntr, Wonsulting, all cloud auto-apply tools

### 6.2 Cited company briefs (not Crunchbase)
- **Message:** "Every funding claim links to SEC EDGAR or a primary URL — or it stays unverified."
- **Implementation:** `lib/brief/source-web-research.ts`, `source-edgar.ts`, citation guard **V** (plan)
- **Beat:** Crunchbase free (shallow), Harmonic (inaccessible), AI hallucination in ChatGPT research

### 6.3 AUTONOMOUS-only autopilot ethics
- **Message:** "AI submits only when the route is safe; you always confirm ASSISTED applications and Gmail status."
- **Implementation:** `lib/apply/router.ts`, `lib/autopilot/policy.ts` **V** (plan)
- **Beat:** ApplyPilot, LazyApply, Massive full-auto; align philosophically with Career Ops but add *selective* automation

### 6.4 Multi-profile / multi-goal
- **Message:** "One OS, multiple search personas (e.g., IC vs EM) with goal-aware discovery."
- **Implementation:** extend `lib/goals/`, profile variants, LazyApply-style routing **P1**
- **Beat:** Most tools = one profile; LazyApply Ultimate = 20 profiles without tailoring depth

### 6.5 OSS data layer + premium AI/voice
- **Message:** "Free job sources and EDGAR; pay only for OpenRouter/ElevenLabs you choose."
- **Implementation:** `lib/jobs/sources/`, integrations portal **V**
- **Beat:** $29–74/mo SaaS bundles; Career Ops still needs paid Claude Code

### 6.6 Cooperative Playwright handoff
- **Message:** "Watch AI fill the form — take over for CAPTCHA or weird questions — hand back when ready."
- **Implementation:** Phase 5 `lib/apply/session-service.ts` **V**
- **Beat:** Simplify (manual submit only), cloud bots (black box)

### 6.7 Knowledge Notebook RAG
- **Message:** "Apply essays grounded in your profile entries — not invented metrics."
- **Implementation:** Phase 3 `lib/knowledge/` **V**
- **Beat:** Generic AIApply essay filler; Job OS provenance tests (`npm run test:provenance`)

---

## 7. Draft Enhancement Recommendations

Prioritized against competitive gaps. Reference Job OS file seams from master plan.

### P0 — Ship before marketing "Job OS" broadly

| # | Enhancement | Rationale | Implementation notes |
|---|-------------|-----------|----------------------|
| P0-1 | **Integrations portal** (Phase 1) | Every competitor hides API cost; Job OS should make BYOK delightful | `lib/integrations/registry.ts`, `lib/secrets/composite.ts`, unify `getSecret()` in voice/jsearch |
| P0-2 | **Web-research + EDGAR briefs** (Phase 2) | Core differentiator vs Crunchbase/SaaS | `lib/brief/source-web-research.ts`, `source-edgar.ts`, remove Crunchbase from `lib/brief/sources.ts` |
| P0-3 | **OSS job sources** (Phase 2) | Career Ops wins on portal scan; Job OS needs breadth on public APIs | `lib/jobs/sources/remoteok.ts`, `arbeitnow.ts`, `jobicy.ts`, register in `index.ts` |
| P0-4 | **Cooperative apply handoff** (Phase 5) | No competitor has this; counters Simplify/manual fatigue | `lib/apply/session-service.ts`, `state-machine.ts` PAUSED/HANDOFF, `components/apply/apply-workspace.tsx` |
| P0-5 | **Autopilot orchestrator** (Phase 6) | LoopCV/Sonara ship "set and forget"; Job OS needs ethical version | `lib/autopilot/orchestrator.ts`, `policy.ts`, extend `scripts/run-catchup.ts` |
| P0-6 | **Onboarding wizard** (Phase 6) | Teal/Simplify win on time-to-first-value | `app/(app)/onboarding/page.tsx` — profile, goals, answers, integrations |

### P1 — Competitive parity + moat deepening

| # | Enhancement | Rationale | Implementation notes |
|---|-------------|-----------|----------------------|
| P1-1 | **Knowledge Notebook RAG** (Phase 3) | Ground essays vs AIApply/Wonsulting | `lib/knowledge/index.ts`, `retrieve.ts`, wire to `lib/apply/fields-llm.ts` |
| P1-2 | **Pipecat OSS voice fallback** (Phase 4) | Cost vs ElevenLabs; OSS credibility | `lib/interview/voice-local.ts`, `docker-compose.voice.yml`, chain in `lib/interview/index.ts` |
| P1-3 | **Multi-profile / goal-aware discovery** | LazyApply profiles; Career Ops single CV | Extend `lib/goals/service.ts`, autopilot queries, resume variant picker in tailor flow |
| P1-4 | **Greenhouse/Ashby/Lever zero-token scanner** | Career Ops' killer feature Job OS lacks | New `lib/jobs/sources/greenhouse.ts` etc. — REST APIs, no LLM; register in `sources/index.ts` |
| P1-5 | **Scoring explainability panel** | Jobscan/Teal show keyword gaps | UI on pipeline: show embedding + goal weights from `lib/scoring/score.ts` |
| P1-6 | **Apply success telemetry (local)** | Counter Sonara failure-rate narrative | Local metrics in apply sessions: submitted / paused / failed by ATS — `lib/apply/types.ts` |

### P2 — Nice-to-have / later

| # | Enhancement | Rationale | Implementation notes |
|---|-------------|-----------|----------------------|
| P2-1 | **Chrome clipper extension** | Teal/Simplify acquisition | Separate `extension/` WXT project → POST to Job OS API |
| P2-2 | **reactive-resume JSON import** | 38k★ resume builder interchange | `lib/profile/import-reactive-resume.ts` |
| P2-3 | **Hume EVI eval adapter** | Emotion feedback layer | Optional `VoiceSource` in `lib/interview/index.ts` |
| P2-4 | **Notion/Airtable export** | CRM users want escape hatch | Export track data from `lib/track/` |
| P2-5 | **Career Ops rubric import** | Bridge CLI users | Parser for career-ops evaluation YAML → Job OS scores |
| P2-6 | **Desktop Tauri bundle** | MR.Jobs/JobsHunt ship DMG | `src-tauri/` track (out of scope unless requested) |

---

## 8. API Cost Model (Job OS vs SaaS)

**Inference — not verified billing for Job OS specifically.**

| Workload | Provider | Rough unit cost | Job OS mitigation |
|----------|----------|-----------------|-------------------|
| Scoring + tailor | OpenRouter | ~$0.01–0.05/job **I** | `MODEL_CHEAP` for brief extract |
| Brief web-research | OpenRouter | ~$0.02–0.10/company **I** | Cache in `CompanyBrief` |
| Embeddings | OpenRouter 1536-dim | ~$0.0001/chunk **I** | pgvector, no re-embed |
| Voice interview | ElevenLabs ConvAI | Usage-based **V** | 30 min/session, 60 min/day caps |
| Voice fallback | Pipecat local | Electricity only **I** | CPU dev-only label |
| Job discovery | Remotive/RemoteOK/etc. | $0 **V** | Default free sources |
| Optional JSearch | RapidAPI | Paid tier **I** | Portal toggle |

**SaaS comparison:** Teal+ $29/mo + AIApply auto $74/mo = **$103/mo** for less privacy **I**. Job OS heavy user might spend **$15–40/mo** on APIs **I** with local data ownership.

---

## 9. Proposed Additions to Master Execution Plan

Append as **Phase 2b**, **Phase 5b**, **Phase 7** (or integrate into existing phases per priority).

### Phase 2b — ATS portal scanner (zero-token discovery)
**Goal:** Close Career Ops discovery gap without LLM cost.

| Task | Files |
|------|-------|
| Greenhouse Job Board API adapter | `lib/jobs/sources/greenhouse.ts` |
| Ashby public postings adapter | `lib/jobs/sources/ashby.ts` |
| Lever postings adapter | `lib/jobs/sources/lever.ts` |
| Company list config UI | `app/(app)/settings/target-companies/` or extend goals |
| Tests | extend `scripts/test-jobs-sources.ts` |

**Acceptance:** Scan 10 configured companies returns jobs with zero OpenRouter tokens.

---

### Phase 5b — Apply telemetry + ATS coverage matrix
**Goal:** Publish trustworthy apply stats (competitive response to Sonara/Massive).

| Task | Files |
|------|-------|
| Per-session outcome enum | `lib/apply/types.ts` |
| Local metrics aggregator | `lib/apply/metrics.ts` |
| Dashboard widget | `app/(app)/page.tsx` |
| Document supported ATS routes | `docs/ats-coverage.md` |

**Acceptance:** After 10 apply sessions, dashboard shows success/pause/fail rates by route type.

---

### Phase 7 — Chrome clipper + external imports (optional)
**Goal:** Teal/Simplify-style job capture without cloud tracker.

| Task | Files |
|------|-------|
| WXT extension scaffold | `extension/` (new) |
| Save-job API route | `app/api/jobs/capture/route.ts` |
| reactive-resume import | `lib/profile/import-reactive-resume.ts` |
| Career Ops eval import | `lib/profile/import-career-ops.ts` |

**Acceptance:** Clip job from LinkedIn → appears in pipeline with description stored.

---

### New stress-test rows (Section 7 of master plan)

| Area | Scenario | Pass |
|------|----------|------|
| Discovery | GH/Ashby scan 10 companies | Jobs ingested, 0 LLM calls |
| Brief | EDGAR Form D for US startup | Cited funding claim |
| Apply | ASSISTED + user takeover | No submit until human confirms |
| Voice | 30 min cap | Blocked at cap |
| Privacy | Export all data | Single JSON archive local |

---

### New execution todos

| ID | Phase | Task | Priority |
|----|-------|------|----------|
| p2b-portal-scan | 2b | Zero-token GH/Ashby/Lever scanners | P1 |
| p5b-apply-metrics | 5b | Local apply telemetry dashboard | P1 |
| p7-clipper | 7 | Chrome job clipper extension | P2 |
| p7-imports | 7 | reactive-resume + Career Ops import | P2 |

---

## 10. Competitive Positioning Statement (draft)

> **Job OS** is the local-first job-search operating system for candidates who want AI speed without uploading their career to a SaaS database. It discovers jobs from open APIs, scores them against stated goals, builds **cited** company briefs from primary sources, tailors materials with provenance checks, and applies through a **cooperative browser** — auto-submitting only when the route is truly autonomous. Gmail tracking and warm intros stay **human-confirmed**. Interview prep uses realistic **AI_SCREEN** and **REAL_HR** voice personas, with an open-source fallback. You bring your own AI keys; your data stays on your Mac.

---

## 11. Sources & Verification Notes

### Primary sources consulted
- Job OS master execution plan (local)
- GitHub READMEs: Career Ops, JobsHunt, CareerPulse, Jobs Optima, ApplyPilot, openapply, reactive-resume, MR.Jobs, ai-mock-interview
- Official pricing: [Teal](https://www.tealhq.com), [Huntr](https://huntr.co/pricing), [Simplify](https://simplify.jobs), [Jobscan](https://www.jobscan.co), [Rezi](https://rezi.ai/pricing), [Wonsulting](https://www.wonsulting.com/wonsultingai), [LazyApply](https://lazyapply.com), [LoopCV](https://www.loopcv.pro/pricing), [Yoodli](https://yoodli.ai/pricing), [Hume](https://www.hume.ai/pricing), [Crunchbase Support](https://support.crunchbase.com/hc/en-us/articles/360062989313), [Harmonic](https://harmonic.ai/pricing), [ElevenLabs](https://elevenlabs.io/conversational-ai)

### Third-party reviews (treat as **I** where cited)
- remotejobassistant.com, resumly.ai, noxjobs.com, wobo.ai, jobcopilot.com, toolchase.com, usesprout.com

### Repo hooks/memory
- No `.cursor/hooks` or agent memory files referenced Career Ops or JobsHunt beyond the master plan superseding `free_alternatives_research_54b785cd.plan.md` **V**.
- **Career Ops** is the explicitly nameable OSS competitor from web research and Job OS plan context; **JobsHunt** verified at [ramakrishnanayyappan/jobshunt](https://github.com/ramakrishnanayyappan/jobshunt).

---

*Research completed 2026-06-18. Re-verify SaaS pricing on official sites before external publication — several products gate pricing behind login (AIApply, Massive tiers).*
