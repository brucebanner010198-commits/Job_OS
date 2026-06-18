/**
 * Parse-document unit tests (no LLM, no DB).
 * Run: npm run test:resume-import
 */

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function main() {
  const { parseResumeDocument } = await import("@/lib/import/parse-document");

  console.log("\nparse-document — validation:");

  const emptyRejected = await parseResumeDocument(
    new File([], "resume.pdf", { type: "application/pdf" }),
  ).then(
    () => false,
    (e) => e instanceof Error && e.message.includes("No file"),
  );
  check("rejects empty file", emptyRejected);

  const unsupportedRejected = await parseResumeDocument(
    new File([Buffer.from("hello")], "notes.txt", { type: "text/plain" }),
  ).then(
    () => false,
    (e) => e instanceof Error && e.message.includes("Unsupported format"),
  );
  check("rejects unsupported extension", unsupportedRejected);

  const legacyDocRejected = await parseResumeDocument(
    new File([Buffer.from("fake")], "resume.doc", { type: "application/msword" }),
  ).then(
    () => false,
    (e) => e instanceof Error && e.message.includes(".docx"),
  );
  check("rejects legacy .doc", legacyDocRejected);

  const tinyPdfRejected = await parseResumeDocument(
    new File([Buffer.from("%PDF-1.4 minimal")], "tiny.pdf", { type: "application/pdf" }),
  ).then(
    () => false,
    (e) => e instanceof Error,
  );
  check("rejects invalid or image-only PDF", tinyPdfRejected);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
