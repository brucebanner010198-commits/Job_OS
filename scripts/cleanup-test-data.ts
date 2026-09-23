/**
 * Lists test-fixture and table-of-contents rows that leaked into the real
 * profile before tests were isolated (see scripts/lib/use-test-database.ts).
 * Deletes nothing unless run with --apply. Take a backup first:
 *   docker exec jobos-db pg_dump -U jobos -d jobos -Fc > .backups/before-cleanup.dump
 *
 * Run: npx tsx scripts/cleanup-test-data.ts            (list only)
 *      npx tsx scripts/cleanup-test-data.ts --apply    (delete the listed rows)
 */
import { db } from "@/lib/db";

const apply = process.argv.includes("--apply");

async function main() {
  const certs = await db.certificationDocument.findMany({
    where: { credentialUrl: { contains: "verification/mock-" } },
  });
  const entries = (await db.profileEntry.findMany()).filter((e) => {
    const data = JSON.stringify(e.data);
    const note = e.sourceNote ?? "";
    return (
      data.includes("Jane Doe Senior Backend Engineer") ||
      note.startsWith("Acme Corp (2020") ||
      note.startsWith("Uploaded certification file: aws-solutions-architect.pdf") ||
      /(\. ){5,}/.test(note) || // table-of-contents lines imported as entries
      /(\. ){5,}/.test(data)
    );
  });

  console.log(`Test certificates: ${certs.length}`);
  for (const c of certs) console.log(`  ${c.id}  ${c.title}  ${c.credentialUrl}`);
  console.log(`Test or table-of-contents resume entries: ${entries.length}`);
  for (const e of entries) console.log(`  ${e.id}  ${e.kind.padEnd(13)} ${(e.sourceNote ?? "").slice(0, 60)}`);

  if (!apply) {
    console.log("\nNothing deleted. Re-run with --apply to delete these rows.");
    return;
  }
  await db.$transaction([
    db.certificationDocument.deleteMany({ where: { id: { in: certs.map((c) => c.id) } } }),
    db.profileEntry.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } }),
  ]);
  console.log(`\nDeleted ${certs.length} certificates and ${entries.length} entries.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
