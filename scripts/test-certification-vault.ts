import "./lib/use-test-database";
import { saveCertificationDocument, listCertificationDocuments } from "../lib/certifications/vault";
import { getAppContext } from "../lib/app-context";
import fs from "node:fs/promises";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("PASS:", msg);
}

async function testCertificationVault() {
  console.log("Testing Certification Vault...\n");

  const { scope } = await getAppContext();
  const mockPdfBuffer = Buffer.from("%PDF-1.4 Mock AWS Certified Solutions Architect Certificate");

  const doc = await saveCertificationDocument(scope, {
    title: "AWS Certified Solutions Architect",
    issuer: "Amazon Web Services",
    issueDate: "2026-01-15",
    credentialUrl: "https://aws.amazon.com/verification/mock-12345",
    buffer: mockPdfBuffer,
    fileName: "aws-solutions-architect.pdf",
    mimeType: "application/pdf",
  });

  assert(doc.title === "AWS Certified Solutions Architect", "Stores title");
  assert(doc.issuer === "Amazon Web Services", "Stores issuer");
  assert(Boolean(doc.localFilePath), "Stores local file path");

  const fileExists = await fs.stat(doc.localFilePath).then(() => true).catch(() => false);
  assert(fileExists, "File verified to exist in local storage/certifications directory");

  const list = await listCertificationDocuments(scope);
  assert(list.some((d) => d.id === doc.id), "Lists saved certification document");

  console.log("\nCertification vault tests passed successfully!");
}

testCertificationVault().catch((e) => {
  console.error(e);
  process.exit(1);
});
