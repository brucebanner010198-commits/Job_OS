/**
 * Resume document ingestion: PDF and DOCX text extraction for Path A import.
 *
 * Scanned/image-only PDFs are detected and rejected with a clear message;
 * OCR is deferred to a later phase.
 */

import { JobOSError } from "@/lib/errors/job-os-error";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_TEXT_CHARS = 80;

export type ResumeDocumentFormat = "pdf" | "docx";

export interface ParsedResumeDocument {
  rawText: string;
  format: ResumeDocumentFormat;
  charCount: number;
  hasTextLayer: boolean;
  warnings: string[];
}

const PDF_MIME = new Set(["application/pdf"]);
const DOCX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const DOCX_EXT = /\.docx$/i;
const PDF_EXT = /\.pdf$/i;

function formatFromName(name: string): ResumeDocumentFormat | null {
  if (PDF_EXT.test(name)) return "pdf";
  if (DOCX_EXT.test(name)) return "docx";
  return null;
}

function detectFormat(file: { name: string; type: string }): ResumeDocumentFormat | null {
  if (PDF_MIME.has(file.type) || PDF_EXT.test(file.name)) return "pdf";
  if (DOCX_MIME.has(file.type) || DOCX_EXT.test(file.name)) return "docx";
  return formatFromName(file.name);
}

async function extractPdfText(buffer: Buffer): Promise<{ text: string; hasTextLayer: boolean }> {
  const pdfjs = await import(/* webpackIgnore: true */ "pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }
  const text = pageTexts.join("\n\n").replace(/\r\n/g, "\n").trim();
  return { text, hasTextLayer: text.length >= MIN_TEXT_CHARS };
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return (result.value ?? "").replace(/\r\n/g, "\n").trim();
}

/**
 * Parse an uploaded resume file into plain text for downstream LLM extraction.
 */
export async function parseResumeDocument(file: File): Promise<ParsedResumeDocument> {
  if (!file || file.size === 0) {
    throw JobOSError.invalidArgument({
      domain: "job_os.import",
      reason: "EMPTY_FILE",
      location: "lib/import/parse-document.ts:parseResumeDocument",
      message: "No file selected. Choose a PDF or Word (.docx) resume.",
      remedy: "Select a valid PDF or DOCX file from your file system.",
    });
  }

  if (file.size > MAX_BYTES) {
    throw JobOSError.invalidArgument({
      domain: "job_os.import",
      reason: "FILE_TOO_LARGE",
      location: "lib/import/parse-document.ts:parseResumeDocument",
      message: `File is too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum size is 5 MB.`,
      remedy: "Compress the file or upload a text-only copy below 5 MB.",
      metadata: { sizeBytes: file.size, maxBytes: MAX_BYTES },
    });
  }

  const format = detectFormat(file);
  if (!format) {
    throw JobOSError.invalidArgument({
      domain: "job_os.import",
      reason: "UNSUPPORTED_FORMAT",
      location: "lib/import/parse-document.ts:parseResumeDocument",
      message:
        "Unsupported format. Upload a PDF or Word document (.docx), or paste your resume text below.",
      remedy: "Save your document as PDF or DOCX, or paste the text directly into the text area.",
      metadata: { fileName: file.name, mimeType: file.type },
    });
  }

  if (/\.doc$/i.test(file.name) && !DOCX_EXT.test(file.name)) {
    throw JobOSError.invalidArgument({
      domain: "job_os.import",
      reason: "LEGACY_DOC_FORMAT",
      location: "lib/import/parse-document.ts:parseResumeDocument",
      message:
        "Legacy Word (.doc) files are not supported. Save as .docx or export a PDF, then try again.",
      remedy: "Open the file in Microsoft Word or Google Docs and export as modern .docx or PDF.",
      metadata: { fileName: file.name },
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const warnings: string[] = [];

  if (format === "pdf") {
    let result: { text: string; hasTextLayer: boolean };
    try {
      result = await extractPdfText(buffer);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      throw JobOSError.dataLoss({
        domain: "job_os.import",
        reason: "PDF_PARSE_FAILED",
        location: "lib/import/parse-document.ts:extractPdfText",
        message: `Could not parse this PDF file (${detail}). Try re-saving it or paste your resume below.`,
        remedy: "Re-save the PDF without password protection, or copy and paste the text directly.",
        metadata: { errorDetail: detail },
        cause: err,
      });
    }
    const { text, hasTextLayer } = result;
    if (!hasTextLayer) {
      throw JobOSError.invalidArgument({
        domain: "job_os.import",
        reason: "PDF_NO_TEXT_LAYER",
        location: "lib/import/parse-document.ts:extractPdfText",
        message:
          "This PDF has little or no selectable text. It may be a scanned image. " +
          "Export a text-based PDF from Word or Google Docs, or paste your resume below.",
        remedy: "Export as a vector or text-based PDF from your document editor so text is selectable.",
      });
    }
    if (text.length < MIN_TEXT_CHARS) {
      throw JobOSError.invalidArgument({
        domain: "job_os.import",
        reason: "INSUFFICIENT_TEXT",
        location: "lib/import/parse-document.ts:extractPdfText",
        message:
          "Could not extract enough text from this PDF. Try a different export or paste your resume below.",
        remedy: "Confirm the document contains actual text paragraphs rather than non-text graphics.",
        metadata: { charCount: text.length, minRequired: MIN_TEXT_CHARS },
      });
    }
    return {
      rawText: text,
      format,
      charCount: text.length,
      hasTextLayer,
      warnings,
    };
  }

  const text = await extractDocxText(buffer);
  if (text.length < MIN_TEXT_CHARS) {
    throw JobOSError.invalidArgument({
      domain: "job_os.import",
      reason: "INSUFFICIENT_TEXT",
      location: "lib/import/parse-document.ts:extractDocxText",
      message:
        "Could not extract enough text from this Word document. Try re-saving as .docx or paste your resume below.",
      remedy: "Confirm the document contains actual text paragraphs.",
      metadata: { charCount: text.length, minRequired: MIN_TEXT_CHARS },
    });
  }

  return {
    rawText: text,
    format,
    charCount: text.length,
    hasTextLayer: true,
    warnings,
  };
}
