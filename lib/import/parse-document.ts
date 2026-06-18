/**
 * Resume document ingestion — PDF and DOCX text extraction for Path A import.
 *
 * Scanned/image-only PDFs are detected and rejected with a clear message;
 * OCR is deferred to a later phase.
 */

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
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = (result.text ?? "").replace(/\r\n/g, "\n").trim();
    return { text, hasTextLayer: text.length >= MIN_TEXT_CHARS };
  } finally {
    await parser.destroy();
  }
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
    throw new Error("No file selected. Choose a PDF or Word (.docx) resume.");
  }

  if (file.size > MAX_BYTES) {
    throw new Error(
      `File is too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum size is 5 MB.`,
    );
  }

  const format = detectFormat(file);
  if (!format) {
    throw new Error(
      "Unsupported format. Upload a PDF or Word document (.docx), or paste your resume text below.",
    );
  }

  if (/\.doc$/i.test(file.name) && !DOCX_EXT.test(file.name)) {
    throw new Error(
      "Legacy Word (.doc) files are not supported. Save as .docx or export a PDF, then try again.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const warnings: string[] = [];

  if (format === "pdf") {
    const { text, hasTextLayer } = await extractPdfText(buffer);
    if (!hasTextLayer) {
      throw new Error(
        "This PDF has little or no selectable text — it may be a scanned image. " +
          "Export a text-based PDF from Word or Google Docs, or paste your resume below.",
      );
    }
    if (text.length < MIN_TEXT_CHARS) {
      throw new Error(
        "Could not extract enough text from this PDF. Try a different export or paste your resume below.",
      );
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
    throw new Error(
      "Could not extract enough text from this Word document. Try re-saving as .docx or paste your resume below.",
    );
  }

  return {
    rawText: text,
    format,
    charCount: text.length,
    hasTextLayer: true,
    warnings,
  };
}
