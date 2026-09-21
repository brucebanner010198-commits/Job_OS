export interface RejectionReplyInput {
  candidateName: string;
  company: string;
  jobTitle: string;
  recruiterName?: string | null;
  originalSubject?: string;
}

export interface RejectionReplyDraft {
  subject: string;
  body: string;
}

/**
 * Builds a graceful, professional acknowledgment reply to a rejection notice.
 * Grounded strictly in candidate and company facts without corporate jargon.
 */
export function buildRejectionReply(input: RejectionReplyInput): RejectionReplyDraft {
  const greeting = input.recruiterName?.trim()
    ? `Dear ${input.recruiterName.trim()},`
    : `Dear Hiring Team at ${input.company},`;

  const subject = input.originalSubject?.startsWith("Re:")
    ? input.originalSubject
    : input.originalSubject
      ? `Re: ${input.originalSubject}`
      : `Thank you - ${input.jobTitle} application at ${input.company}`;

  const body = [
    greeting,
    "",
    `Thank you for following up regarding the ${input.jobTitle} role at ${input.company}. While I am disappointed not to move forward at this stage, I genuinely appreciate your team taking the time to review my background and share this update.`,
    "",
    `I have great respect for what ${input.company} is building and would welcome the opportunity to stay in touch for future openings that match my engineering and technical leadership experience.`,
    "",
    "Thank you again for your time and consideration. I wish you and the team all the best.",
    "",
    "Best regards,",
    input.candidateName || "Candidate",
  ].join("\n");

  return { subject, body };
}
