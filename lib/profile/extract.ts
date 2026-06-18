/**
 * Master-profile extraction.
 *
 * Turns spoken career updates or pasted resumes into typed, structured
 * profile entries via the LLM. Extraction is the ONLY place we let the model
 * shape free text into facts - everything downstream (resume tailoring, cover
 * letters) is extractive over these facts and never invents new ones.
 *
 * Protected-class / private "life facts" (health, family, disability,
 * religion, etc.) are tagged sensitive:true so the redaction layer can withhold
 * them before any text leaves the machine.
 */
import { z } from "zod";
import { chatJson } from "@/lib/ai/openrouter";
import { bulletFrameworkPromptBlock } from "@/lib/resume/bullet-frameworks";

/** The nine entry kinds, mirrored from Prisma's ProfileEntryKind enum. */
const ENTRY_KIND = z.enum([
  "CONTACT",
  "SUMMARY",
  "EXPERIENCE",
  "EDUCATION",
  "PROJECT",
  "SKILL",
  "ACHIEVEMENT",
  "CERTIFICATION",
  "LIFE_FACT",
]);

/**
 * One extracted entry. `title` is a short human label for the entry; `data`
 * is a structured object whose shape depends on `kind`.
 */
const extractedEntrySchema = z.object({
  kind: ENTRY_KIND,
  title: z.string(),
  data: z.any(),
  sensitive: z.boolean(),
});

export const extractedEntriesSchema = z.object({
  entries: z.array(extractedEntrySchema),
});

export type ExtractedEntry = z.infer<typeof extractedEntrySchema>;
export type Extracted = z.infer<typeof extractedEntriesSchema>;

const SENSITIVE_RULE =
  "Mark any health condition, disability, family/marital/parental status, " +
  "pregnancy, age, race or ethnicity, national origin, religion, sexual " +
  "orientation, gender identity, political affiliation, or other private " +
  "protected-class information as a LIFE_FACT entry with sensitive:true. " +
  "Everything that is a normal, public-facing career fact is sensitive:false.";

const SHAPE_RULE =
  "Data shapes by kind: " +
  'CONTACT -> { name?, email?, phone?, location?, links?: string[] }; ' +
  'SUMMARY -> { text }; ' +
  'EXPERIENCE -> { title, company, location?, start?, end?, bullets: string[] }; ' +
  'EDUCATION -> { degree, institution, location?, end?, detail? }; ' +
  'PROJECT -> { name, description?, link?, bullets?: string[] }; ' +
  'SKILL -> { name, skills: string[] }; ' +
  'ACHIEVEMENT -> { text }; ' +
  'CERTIFICATION -> { name, issuer?, year? }; ' +
  'LIFE_FACT -> { text }. ' +
  "Only include fields you actually have evidence for - never invent " +
  "employers, titles, dates, metrics, or skills that are not stated.";

const BULLET_RULE =
  "For EXPERIENCE and PROJECT bullets, rewrite each achievement into polished " +
  "resume prose using exactly one bullet framework (X-Y-Z, TEAL, APR, STAR, CAR, " +
  "PAR, BAR, SOAR, LPS, or ELITE). Preserve every fact and metric verbatim; " +
  "never add content. " +
  bulletFrameworkPromptBlock();

const RESPONSE_RULE =
  'Respond ONLY with JSON of the form { "entries": [ { "kind", "title", ' +
  '"data", "sensitive" } ] }. Use the exact uppercase kind strings.';

/**
 * Parse a SHORT spoken career update into typed entries.
 * Cheap tier; low temperature for stable structure.
 */
export async function extractFromDictation(text: string): Promise<Extracted> {
  const system =
    "You extract structured career facts from a short spoken update. " +
    "Be faithful and extractive: capture only what the speaker actually " +
    "said, do not embellish. " +
    SHAPE_RULE +
    " " +
    BULLET_RULE +
    " " +
    SENSITIVE_RULE +
    " " +
    RESPONSE_RULE;

  const { value } = await chatJson(extractedEntriesSchema, {
    task: "extractProfile",
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
  });
  return value;
}

/**
 * Parse a FULL resume paste into many typed entries: one EXPERIENCE per role
 * (with bullets), one EDUCATION per degree, a SKILL group, CONTACT, SUMMARY if
 * present, and PROJECT / CERTIFICATION / ACHIEVEMENT as found.
 * Cheap tier; very low temperature.
 */
export async function extractFromResume(text: string): Promise<Extracted> {
  const system =
    "You parse a full resume into structured career facts. Produce one " +
    "EXPERIENCE entry per role (each with its bullets), one EDUCATION entry " +
    "per degree, a single SKILL group entry collecting the skills, a CONTACT " +
    "entry, and a SUMMARY entry if the resume has a summary/objective. Add " +
    "PROJECT, CERTIFICATION, and ACHIEVEMENT entries wherever present. " +
    "Be strictly extractive: copy titles, employers, dates, and metrics " +
    "exactly as written and never invent any that are not on the resume. " +
    SHAPE_RULE +
    " " +
    BULLET_RULE +
    " " +
    SENSITIVE_RULE +
    " " +
    RESPONSE_RULE;

  const { value } = await chatJson(extractedEntriesSchema, {
    task: "parseResume",
    temperature: 0.1,
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
  });
  return value;
}
