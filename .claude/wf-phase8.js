export const meta = {
  name: 'phase8-interview-prep',
  description: 'Build Phase 8 (interview prep: study Q&A + live-voice mocks + cost-cap guard + scoring) against pre-written contracts',
  phases: [
    { title: 'Brains', detail: 'study, persona, guard, score — pure/offline/clock-injected' },
    { title: 'Service & UI', detail: 'pipeline+service+actions, then page+components' },
  ],
}

const SHARED = `
PROJECT: "Job OS" — a local-first Next.js 15 (App Router) + React 19 + TypeScript + Tailshadcn app. cwd is the repo root.
You are building Phase 8 (Interview Prep) against contracts that ALREADY EXIST. Read them first:
  - lib/interview/types.ts      (THE contract — all shapes; import types from here, never redefine them)
  - lib/interview/fixtures.ts   (deterministic test corpus; FIXTURE_NOW is the injected clock)
  - lib/interview/index.ts, voice-live.ts, voice-fixture.ts (the voice seam — already done; do not touch)
Study the existing Phase 7 conventions to match style EXACTLY:
  - A pure brain + its self-check: lib/followup/cadence.ts and scripts/test-followup.ts
  - The only-DB-importer service: lib/warm/service.ts
  - A page + client list: app/(app)/boosters/page.tsx and components/boosters/follow-up-list.tsx

HARD RULES (every agent):
  - Create ONLY the NEW files you are assigned. NEVER edit any shared/contract file, schema, package.json, or another agent's files.
  - NEVER run global commands: no tsc, no next build, no prisma, no npm install, no dev server. Self-verify ONLY by running your own tsx self-check script (npx tsx scripts/<your-test>.ts) when you have one.
  - Import types from "@/lib/interview/types". The "@/..." path alias works under tsx (see scripts/test-followup.ts).
  - Match the house style: a top-of-file comment explaining the module + its safety role; clear names; no new deps.

SAFETY SPINE you must honor:
  - EXTRACTIVE: study model-answers are assembled ONLY from real ProfileFacts. Never invent a metric, company, or experience.
  - SENSITIVE FACTS NEVER LEAVE: any ProfileFact with sensitive===true must be filtered out BEFORE use and must NEVER appear in any guide, persona prompt, opener, or transcript. The fixture sensitive fact text is "chronic health condition" — it must never appear in your output.
  - CLOCK-INJECTED: brains never read the system clock. Time arrives as ISO-8601 string parameters; compute with Date.parse(iso) and an instant's toISOString(). Determinism: no randomness, stable ordering.
`

phase('Brains')

const BRAIN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['file', 'selfCheckScript', 'passed', 'failed', 'summary'],
  properties: {
    file: { type: 'string', description: 'the brain file you created' },
    selfCheckScript: { type: 'string', description: 'the scripts/*.ts self-check you created' },
    passed: { type: 'number' },
    failed: { type: 'number' },
    summary: { type: 'string', description: 'one line on what you built and any caveat' },
  },
}

const brains = await parallel([
  () => agent(`${SHARED}

YOUR FILE: lib/interview/study.ts  +  self-check: scripts/test-interview-study.ts

Implement:  export function buildStudyGuide(prep: PrepInput): StudyGuide
Behavior:
  - First filter facts: keep only non-sensitive ProfileFacts; set withheldSensitive = number of sensitive facts dropped.
  - Produce EXACTLY STUDY_QUESTION_TARGET (5) QAItem questions that span DISTINCT categories (use BEHAVIORAL, ROLE_SPECIFIC, COMPANY_FIT, MOTIVATION, SITUATIONAL). Pick questions from a built-in canonical bank, lightly specialized by prep.role / prep.company / keywords in prep.jobDescription. Deterministic ordering.
  - For each question assemble a STAR-structured modelAnswer (and starParts) EXTRACTIVELY from the most relevant non-sensitive facts: the answer text is built from real fact text + thin connective scaffolding only. usedFactIds lists exactly the ProfileFact ids drawn on. tip is a short delivery coaching line.
  - provenanceOk = true IFF facts were available AND every question's answer is grounded in >=1 real fact. With zero facts (the Datadog fixture), still emit 5 questions but with generic "fill this in with a real example" scaffolds, usedFactIds=[], and provenanceOk=false.
  - The sensitive fact text must NEVER appear anywhere in the output.

Self-check (scripts/test-interview-study.ts), mirror scripts/test-followup.ts structure (check() helper, print "study N/N", process.exit(1) on any fail). Import fixturePreps/fixtureFacts from "@/lib/interview/fixtures". Assert, for each fixturePrep:
  - exactly 5 questions; categories cover >=4 distinct values;
  - expectGrounded matches guide.provenanceOk;
  - every usedFactId refers to a real non-sensitive fact id present in the prep;
  - the string "chronic health condition" appears in NO question/modelAnswer/tip;
  - withheldSensitive === count of sensitive facts in the prep input;
  - for the grounded prep, at least one modelAnswer contains a real metric substring from a fact (e.g. "40%" or "$20M" or "5M").
Run it and report counts.`, { label: 'brain:study', phase: 'Brains', schema: BRAIN_SCHEMA }),

  () => agent(`${SHARED}

YOUR FILE: lib/interview/persona.ts  +  self-check: scripts/test-interview-persona.ts

Implement:
  export function buildPersona(mode: InterviewMode, prep: PrepInput): AgentPersona
  export function buildPersonas(prep: PrepInput): AgentPersona[]   // the two LIVE personas: [AI_SCREEN, REAL_HR]
Behavior:
  - AI_SCREEN: a robotic, structured first-filter screener (HireVue/Sapia style). name like "Automated screener"; low warmth (~0.15); agentIdEnv "ELEVENLABS_AGENT_AI_SCREEN"; neutral structured opener; systemPrompt instructs: fixed competency questions, neutral affect, no small talk, score on clarity/structure/specificity/fit. Grounded in prep.company/role/jobDescription.
  - REAL_HR: a warm, human per-company hiring manager with HARD multi-angle follow-ups. name like "<company> hiring manager"; high warmth (~0.85); agentIdEnv "ELEVENLABS_AGENT_REAL_HR"; warm opener; systemPrompt grounded in prep.company/role/jobDescription.
  - STUDY: buildPersona(STUDY,..) must be TOTAL (never throw) — return a minimal non-voice persona (warmth 0, agentIdEnv "ELEVENLABS_AGENT_AI_SCREEN", brief facilitator systemPrompt). It is not used for voice.
  - Persona grounding must use ONLY non-sensitive facts; systemPrompt/opener must contain NO sensitive fact text.

Self-check (scripts/test-interview-persona.ts), mirror scripts/test-followup.ts. Using fixturePrep:
  - AI_SCREEN and REAL_HR differ: different warmth, different agentIdEnv, different name, different opener;
  - REAL_HR.warmth > AI_SCREEN.warmth;
  - each live persona.systemPrompt mentions the company AND the role;
  - "chronic health condition" appears in NO field of either persona;
  - buildPersonas(prep).length === 2 and covers exactly AI_SCREEN + REAL_HR;
  - buildPersona("STUDY", prep) returns without throwing.
Run it and report counts.`, { label: 'brain:persona', phase: 'Brains', schema: BRAIN_SCHEMA }),

  () => agent(`${SHARED}

YOUR FILE: lib/interview/guard.ts  +  self-check: scripts/test-interview-guard.ts
This is the COST-CAP / kill-switch engine — the thing that stops live voice (the one real variable cost) from running up a bill. Pure + clock-injected.

Implement:
  export function dayKey(iso: string): string
     // the UTC calendar day "YYYY-MM-DD" of the instant. Compute via Date.parse(iso) then take the first 10 chars of that instant's toISOString(). Never read the system clock.
  export function decideStart(caps: VoiceCaps, usage: DailyUsage): StartDecision
     // dailyRemainingSec = max(0, caps.dailyCapSec - usage.secondsUsed).
     // if dailyRemainingSec <= 0 -> { allowed:false, reason:"Daily voice limit reached — try again tomorrow.", grantedSec:0, dailyRemainingSec:0 }.
     // else grantedSec = min(caps.maxSessionSec, dailyRemainingSec); allowed:true; reason describes the granted budget.
  export function tickSession(grantedSec: number, caps: VoiceCaps, startedAtIso: string, lastActivityIso: string, nowIso: string): SessionTick
     // elapsedSec = floor((Date.parse(nowIso) - Date.parse(startedAtIso)) / 1000); idleSec = floor((Date.parse(nowIso) - Date.parse(lastActivityIso)) / 1000); remainingSec = max(0, grantedSec - elapsedSec).
     // decide in THIS order: remainingSec<=0 -> "hangup"; else idleSec>=caps.idleHangupSec -> "idle_hangup"; else remainingSec<=caps.warnAtRemainingSec -> "warn"; else "continue". Always populate reason.

Self-check (scripts/test-interview-guard.ts), mirror scripts/test-followup.ts. Import DEFAULT_VOICE_CAPS + the fixture usages + FIXTURE_NOW from the contract/fixtures. Assert:
  - dayKey("2026-06-16T12:00:00.000Z") === "2026-06-16";
  - decideStart(caps, fixtureUsageFresh).grantedSec === caps.maxSessionSec and allowed;
  - decideStart(caps, fixtureUsageAtCap).allowed === false and grantedSec === 0 (kill-switch);
  - decideStart(caps, fixtureUsageOver).allowed === false (over cap);
  - decideStart(caps, fixtureUsageUnder).grantedSec === min(maxSessionSec, dailyCapSec-600);
  - tickSession at start (now==started, lastActivity==started) -> "continue";
  - tick with idle >= idleHangupSec -> "idle_hangup";
  - tick with elapsed >= grantedSec -> "hangup";
  - tick with remaining <= warnAtRemainingSec (but >0, not idle) -> "warn".
Build the now/started ISO strings in the test by adding seconds via Date.parse + the standard Date constructor + toISOString(). Run it and report counts.`, { label: 'brain:guard', phase: 'Brains', schema: BRAIN_SCHEMA }),

  () => agent(`${SHARED}

YOUR FILE: lib/interview/score.ts  +  self-check: scripts/test-interview-score.ts
A DETERMINISTIC heuristic scorer of an interview transcript. No LLM, no randomness.

Implement:  export function scoreSession(transcript: TranscriptTurn[], mode: InterviewMode, prep?: PrepInput): SessionScore
Analyze CANDIDATE turns only (role==="candidate"). Sub-scores 0..100:
  - structure: reward presence + ordering of STAR cues (situation/task/action/result language); strong STAR -> high.
  - specificity: reward concrete signals — digits/percentages/currency and proper nouns (capitalized multi-letter tokens), plus any prep fact terms present; more -> higher.
  - clarity: penalize filler density. Treat these as filler: um, uh, like, you know, sort of, kind of, i guess, honestly, basically, i mean. Also penalize answers that are too short or ramble without substance.
  - fit: reward candidate referencing the role/company or prep.jobDescription keywords (when prep given); neutral baseline otherwise.
  - overall: weighted blend (structure + specificity weighted highest).
  - starFixes: when structure is weak, emit concrete per-answer STAR rewrite guidance (non-empty array). notes: short positives/observations. flags: short chips actually detected, from {"filler","no metrics","rambling","vague","strong STAR","specific"}.
Must be deterministic and rank a STAR-structured, metric-rich answer FAR above a vague rambling one on structure+specificity.

Self-check (scripts/test-interview-score.ts), mirror scripts/test-followup.ts. Import fixtureStrongTranscript, fixtureWeakTranscript, fixturePrep. Assert:
  - strong.structure > weak.structure + 20; strong.specificity > weak.specificity + 20; strong.overall > weak.overall;
  - all sub-scores within 0..100;
  - weak.starFixes.length > 0 and weak.flags includes "filler";
  - strong.flags includes "specific" OR "strong STAR";
  - scoreSession is deterministic: two calls on the same input deep-equal.
Run it and report counts.`, { label: 'brain:score', phase: 'Brains', schema: BRAIN_SCHEMA }),
])

const brainOk = brains.filter(Boolean)
log(`Brains done: ${brainOk.map(b => `${b.file.split('/').pop()} ${b.passed}/${b.passed + b.failed}`).join(', ')}`)

phase('Service & UI')

const WAVE2_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['files', 'summary'],
  properties: {
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

const serviceUi = await parallel([
  () => agent(`${SHARED}

The four brains now EXIST and are verified: lib/interview/study.ts (buildStudyGuide), lib/interview/persona.ts (buildPersona/buildPersonas), lib/interview/guard.ts (dayKey/decideStart/tickSession), lib/interview/score.ts (scoreSession). The voice seam exists: lib/interview/index.ts exports getVoiceSource() + voiceStatus().

YOUR FILES (create only these):
  1) lib/interview/pipeline.ts  — PURE (no @/lib/db). Export:
       processInterviewPreps(preps: PrepInput[], opts?): InterviewPrepView[]  — for each prep build its StudyGuide via buildStudyGuide and assemble an InterviewPrepView (status defaults to "INTERVIEWING" unless caller maps it; sessions=[]; fromInvite/interviewAt from opts when present).
       previewInterview(): InterviewBoardView — built from @/lib/interview/fixtures fixturePreps (map their fromInvite), using voiceStatus() and DEFAULT_VOICE_CAPS; dailyRemainingSec = caps.dailyCapSec (no usage offline). This is the OFFLINE preview the page falls back to. Mirror lib/warm/pipeline.ts (previewWarm).
  2) lib/interview/service.ts — the ONLY file here that imports @/lib/db. Mirror lib/warm/service.ts exactly in spirit. Export:
       getInterviewBoard(userId): Promise<InterviewBoardView>
          - prep targets = the user's Applications with status in (APPLIED, INTERVIEWING, OFFER), include job; map company/role/applicationId/status. Also mark fromInvite=true + set interviewAt when an InboxItem with category "INTERVIEW_INVITE" (or a StatusProposal toStatus "INTERVIEWING") links that application (read InboxItem.event JSON start when present).
          - for each target, load a persisted StudyGuide (unique by userId+company) if present else build one via buildStudyGuide from the user's ProfileEntries (map ProfileEntry rows -> ProfileFact: id, kind, a flattened text from data, sensitive flag from the row's sensitive column). NEVER include sensitive entries' text beyond the flag.
          - load prior InterviewSession rows for the application (most recent first) -> SessionView[].
          - voice = voiceStatus(); caps = DEFAULT_VOICE_CAPS; dailyRemainingSec = decideStart(caps, today's usage).dailyRemainingSec where today's VoiceUsage row is looked up by dayKey(current ISO). Use the real clock for "now" the same way lib/warm/service.ts stamps decidedAt (standard Date -> toISOString()).
       generateStudyGuide(userId, company, applicationId|null): Promise<void> — build via buildStudyGuide from the user's non-sensitive ProfileFacts + the linked job's title/description; upsert the unique (userId, company) StudyGuide; persist provenanceOk verbatim.
       startLiveSession(userId, applicationId|null, company, role|null, mode): Promise<{ decision, grant, persona, sessionId }> — load today's VoiceUsage; decision = decideStart(caps, usage). If !allowed return { decision, grant:null, persona:null, sessionId:null } (NO session created, NO grant minted — protects the bill). Else: build persona via buildPersona(mode, prep), mint grant via getVoiceSource().grant(mode, persona, decision.grantedSec), create an InterviewSession (state IN_PROGRESS, startedAt now), return all. STUDY mode never mints a live grant.
       finishSession(userId, sessionId, transcript: TranscriptTurn[], durationSec, mode): Promise<void> — score via scoreSession(transcript, mode), persist transcript+score+durationSec+endedAt+state COMPLETED. For LIVE modes (AI_SCREEN/REAL_HR) increment today's VoiceUsage (upsert by userId+dayKey(now): secondsUsed += durationSec, sessions += 1).
       abortSession(userId, sessionId): Promise<void> — set state ABORTED, endedAt now.
       re-export previewInterview from "@/lib/interview/pipeline".
     GUARDED + NEVER-THROW like warm/service.ts where it reads.
  3) app/actions/interview.ts — "use server". Thin wrappers over the service using getPrimaryUser() (from "@/lib/user") + revalidatePath("/interview"):
       generateStudyGuideAction(company, applicationId|null)
       startSessionAction(company, applicationId|null, role|null, mode) -> returns the {decision, grant, persona, sessionId} (serializable) so the client can run the session
       finishSessionAction(sessionId, transcript, durationSec, mode)
       abortSessionAction(sessionId)
     These RETURN values (not void) — the client calls them from onClick handlers, never from a <form action>.

Do NOT build the page or components (another agent owns those). Do NOT run tsc/build. You may write a tiny scripts/test-interview-pipeline.ts that imports previewInterview and asserts it returns >=1 prep each with a guide of 5 questions, and run it with tsx to sanity-check the pure pipeline (no DB). Report the files you created.`, { label: 'interview-data', phase: 'Service & UI', schema: WAVE2_SCHEMA }),

  () => agent(`${SHARED}

YOU BUILD THE UI. The page reads a board via a service (getInterviewBoard) with an offline fallback previewInterview(): InterviewBoardView. Shapes are in lib/interview/types.ts. Server actions (in app/actions/interview.ts, being written in parallel) are: generateStudyGuideAction, startSessionAction (returns {decision, grant, persona, sessionId}), finishSessionAction(sessionId, transcript, durationSec, mode), abortSessionAction(sessionId). Import the ACTIONS by name; assume their signatures as given.

Reference the EXACT patterns in app/(app)/boosters/page.tsx (safeDb + preview fallback, force-dynamic, DbBanner, sample-preview vs live badge) and components/boosters/follow-up-list.tsx + components/boosters/salary-coach.tsx (client components, Copy buttons, useTransition, router.refresh, NEVER pass a non-void server action to <form action> — call actions inside onClick handlers; this caused a TS2322 in Phase 6).

YOUR FILES (create only these):
  1) app/(app)/interview/page.tsx — SERVER component. export const dynamic="force-dynamic". safeDb(getInterviewBoard(getPrimaryUser().id)) with previewInterview() fallback when dbError OR preps.length===0 (usePreview flag, sample-preview badge). Header explains: Study is always free + offline; live voice (AI-screen + real-HR) is capped and runs zero-cost mock sessions until configured. Render a voice-status card (board.voice.detail; configured vs mock badge; show dailyRemainingSec as minutes). Then a list of prep cards via a client component <InterviewBoard preps={...} voice readOnly={usePreview} caps dailyRemainingSec/>. Import service from "@/lib/interview/service" and previewInterview from there too. Keep dates as ISO in props.
  2) components/interview/study-guide.tsx — presentational ("use client" ok). Renders a StudyGuide: provenance badge (grounded vs "fill in your examples" when !provenanceOk), and the 5 QAItems as an accordion/list — question + category badge + the STAR model answer (show starParts when present) + tip + a Copy button for the answer. If withheldSensitive>0, show a small reassurance note ("N sensitive facts kept private — never used"). Never render raw fact ids.
  3) components/interview/mock-session.tsx — "use client". THE live-session surface, given a prep (company, role, applicationId) + mode + readOnly + caps + dailyRemainingSec. Flow:
        - A mode picker is on the parent card; this component runs ONE chosen live mode (AI_SCREEN or REAL_HR).
        - MIC PRE-FLIGHT: before starting, probe navigator.mediaDevices.getUserMedia({audio:true}); on success show "mic ready", on failure show a clear fallback notice ("No mic — running in text/mock mode"). Never crash if mediaDevices is undefined.
        - START: call startSessionAction(...). If decision.allowed===false, show the block reason (daily kill-switch) and stop. Else you receive a grant. If grant.provider==="fixture" (or signedUrl===""), PLAY grant.mock: reveal turns on a timer into a live transcript view, show a COST METER counting down grantedSec (and the daily minutes remaining), and honor an idle/limit auto-stop. When the script ends (or the user clicks End), call finishSessionAction(sessionId, accumulatedTranscript, elapsedSec, mode) and render <ScoreCard/> with the returned/whatever score. (Live ElevenLabs WebRTC via signedUrl is a documented SEAM — when signedUrl is non-empty, show "Live voice ready (connect the @elevenlabs/react SDK here)" and still allow the mock fallback; do NOT add the dependency.)
        - readOnly (sample preview) disables Start with a tooltip ("connect a database to run a real session"); the mock can still be previewed.
     Use useTransition + clear, calm styling consistent with the boosters components.
  4) components/interview/score-card.tsx — presentational. Renders a SessionScore: the four sub-scores (clarity/structure/specificity/fit) as labeled bars + the overall number prominently, the flags as chips, notes, and starFixes as an actionable list. Reuse Badge/Card/Button from "@/components/ui/*".

Keep everything renderable with NO database (the preview path). Do NOT run tsc/build. Report the files you created.`, { label: 'interview-ui', phase: 'Service & UI', schema: WAVE2_SCHEMA }),
])

const uiOk = serviceUi.filter(Boolean)
log(`Service & UI done: ${uiOk.flatMap(r => r.files).length} files created`)

return {
  brains: brains.map(b => b && { file: b.file, passed: b.passed, failed: b.failed }),
  serviceUi: uiOk.map(r => r.summary),
}
