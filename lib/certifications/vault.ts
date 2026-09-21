import { db } from "@/lib/db";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";
import type { AppScope } from "@/lib/profiles/types";
import { addEntries } from "@/lib/profile/service";
import fs from "node:fs/promises";
import path from "node:path";

export interface SaveCertificationInput {
  title: string;
  issuer?: string;
  issueDate?: Date | string;
  credentialUrl?: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export interface CertificationView {
  id: string;
  title: string;
  issuer?: string | null;
  issueDate?: string | null;
  credentialUrl?: string | null;
  localFilePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

/**
 * Saves a certification or diploma file (PDF, image, doc) locally,
 * records it in the CertificationDocument vault, and syncs a structured
 * CERTIFICATION entry into the master profile facts.
 */
export async function saveCertificationDocument(
  scope: AppScope,
  input: SaveCertificationInput,
): Promise<CertificationView> {
  const dir = path.join(process.cwd(), "storage", "certifications");
  await fs.mkdir(dir, { recursive: true });

  const safeName = input.fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const localFileName = `${scope.userId}_${Date.now()}_${safeName}`;
  const localFilePath = path.join(dir, localFileName);

  await fs.writeFile(localFilePath, input.buffer);

  const issueDateParsed = input.issueDate ? new Date(input.issueDate) : null;

  // Add a ProfileEntry so this certification is part of the master CV
  await addEntries(scope, [
    {
      kind: "CERTIFICATION",
      data: {
        title: input.title,
        issuer: input.issuer,
        year: issueDateParsed ? issueDateParsed.getFullYear().toString() : undefined,
        credentialUrl: input.credentialUrl,
        localFile: localFileName,
      },
      sourceNote: `Uploaded certification file: ${input.fileName}`,
    },
  ]);

  const doc = await db.certificationDocument.create({
    data: {
      ...scopeData(scope),
      title: input.title,
      issuer: input.issuer,
      issueDate: issueDateParsed,
      credentialUrl: input.credentialUrl,
      localFilePath,
      fileSize: input.buffer.length,
      mimeType: input.mimeType,
      profileEntryId: null,
    },
  });

  return {
    id: doc.id,
    title: doc.title,
    issuer: doc.issuer,
    issueDate: doc.issueDate?.toISOString(),
    credentialUrl: doc.credentialUrl,
    localFilePath: doc.localFilePath,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listCertificationDocuments(
  scope: AppScope,
): Promise<CertificationView[]> {
  const docs = await db.certificationDocument.findMany({
    where: scopeWhere(scope),
    orderBy: { createdAt: "desc" },
  });

  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    issuer: d.issuer,
    issueDate: d.issueDate?.toISOString(),
    credentialUrl: d.credentialUrl,
    localFilePath: d.localFilePath,
    fileSize: d.fileSize,
    mimeType: d.mimeType,
    createdAt: d.createdAt.toISOString(),
  }));
}
