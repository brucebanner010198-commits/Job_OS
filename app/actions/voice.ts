"use server";

import { requireAccessForMutation } from "@/lib/auth/require-access";
import { transcribeLocally } from "@/lib/voice/transcribe";

/** Transcribes one recording on this machine and returns the text. */
export async function transcribeAudioAction(formData: FormData): Promise<{ text: string }> {
  await requireAccessForMutation();
  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return { text: "" };
  return { text: await transcribeLocally(await audio.arrayBuffer()) };
}
