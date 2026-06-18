import { z } from "zod";

/**
 * A tailored resume is EXTRACTIVE: every claim-bearing element carries the ids
 * of the MasterProfile entries it was derived from. Nothing may be invented;
 * the provenance guard (./provenance.ts) enforces it before anything is usable.
 */

const dateMMYYYY = z
  .string()
  .regex(/^(0[1-9]|1[0-2])\/\d{4}$|^Present$/, "Use MM/YYYY or 'Present'");

export const bulletSchema = z.object({
  text: z.string().min(1),
  /** MasterProfile entry ids this bullet is grounded in (≥1 required). */
  sources: z.array(z.string()).min(1),
});

export const experienceSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  start: dateMMYYYY,
  end: dateMMYYYY,
  bullets: z.array(bulletSchema).min(1),
  sources: z.array(z.string()).min(1),
});

export const educationSchema = z.object({
  degree: z.string().min(1),
  institution: z.string().min(1),
  location: z.string().optional(),
  end: z.string().optional(),
  detail: z.string().optional(),
  sources: z.array(z.string()).min(1),
});

export const skillGroupSchema = z.object({
  name: z.string().min(1),
  skills: z.array(z.string().min(1)).min(1),
  sources: z.array(z.string()).min(1),
});

export const summarySchema = z.object({
  text: z.string().min(1),
  sources: z.array(z.string()).min(1),
});

export const tailoredResumeSchema = z.object({
  name: z.string().min(1),
  /** the target job title, used as the headline under the name */
  headline: z.string().min(1),
  contact: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).optional(),
  }),
  summary: summarySchema.optional(),
  experience: z.array(experienceSchema),
  education: z.array(educationSchema),
  skills: z.array(skillGroupSchema),
  /** JD concepts the resume legitimately reflects (for the match read-out). */
  keywordsMatched: z.array(z.string()).optional(),
  /** target metadata */
  forJobTitle: z.string(),
  forCompany: z.string(),
});

export type Bullet = z.infer<typeof bulletSchema>;
export type ResumeExperience = z.infer<typeof experienceSchema>;
export type ResumeEducation = z.infer<typeof educationSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type TailoredResume = z.infer<typeof tailoredResumeSchema>;
