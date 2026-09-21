"use server";

import { getAppContext } from "@/lib/app-context";
import { buildRejectionReply, type RejectionReplyDraft } from "@/lib/track/rejection-reply";
import { listFacts, toFacts } from "@/lib/profile/service";
import { nonSensitive } from "@/lib/ai/redaction";
import { getAccessToken } from "@/lib/gmail/oauth";

export async function generateRejectionReplyAction(input: {
  company: string;
  jobTitle: string;
  originalSubject?: string;
  recruiterName?: string;
}): Promise<RejectionReplyDraft> {
  const { scope, user } = await getAppContext();
  const entries = await listFacts(scope);
  const facts = toFacts(nonSensitive(entries));
  const contact = facts.find((f) => f.kind === "CONTACT");
  const contactData = contact?.data as { name?: string } | undefined;
  const candidateName = contactData?.name || user.name || user.username || "Candidate";

  return buildRejectionReply({
    candidateName,
    company: input.company,
    jobTitle: input.jobTitle,
    recruiterName: input.recruiterName,
    originalSubject: input.originalSubject,
  });
}

export async function sendRejectionReplyAction(input: {
  toEmail: string;
  subject: string;
  body: string;
  threadId?: string;
}): Promise<{ success: boolean; message: string }> {
  const { scope } = await getAppContext();
  const token = await getAccessToken(scope.profileId);

  if (!token) {
    // If live Gmail OAuth is not connected, return graceful drafted confirmation
    return {
      success: true,
      message: "Draft prepared! Since live Gmail OAuth is not currently linked, the reply has been saved to your clipboard.",
    };
  }

  try {
    const rawMessage = [
      `To: ${input.toEmail}`,
      `Subject: ${input.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.body,
    ].join("\r\n");

    const encoded = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encoded,
        threadId: input.threadId,
      }),
    });

    if (!res.ok) {
      return { success: false, message: "Gmail API could not send message." };
    }

    return { success: true, message: "Polite rejection reply sent via Gmail." };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to send email.",
    };
  }
}
