"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/app-context";
import {
  saveCertificationDocument,
  listCertificationDocuments,
  type CertificationView,
} from "@/lib/certifications/vault";

import { requireAccessForMutation, requireAccessForRead } from "@/lib/auth/require-access";

export async function uploadCertificationAction(
  formData: FormData,
): Promise<CertificationView> {
  await requireAccessForMutation();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please select a certification document or PDF file.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File is too large. Maximum size is 10 MB.");
  }

  const title = (formData.get("title") as string)?.trim() || file.name.replace(/\.[^/.]+$/, "");
  const issuer = (formData.get("issuer") as string)?.trim() || undefined;
  const credentialUrl = (formData.get("credentialUrl") as string)?.trim() || undefined;
  const issueDate = (formData.get("issueDate") as string)?.trim() || undefined;

  const { scope } = await getAppContext();
  const buffer = Buffer.from(await file.arrayBuffer());

  const doc = await saveCertificationDocument(scope, {
    title,
    issuer,
    issueDate,
    credentialUrl,
    buffer,
    fileName: file.name,
    mimeType: file.type || "application/pdf",
  });

  revalidatePath("/master-resume");
  return doc;
}

export async function listCertificationsAction(): Promise<CertificationView[]> {
  await requireAccessForRead();
  const { scope } = await getAppContext();
  return listCertificationDocuments(scope);
}
