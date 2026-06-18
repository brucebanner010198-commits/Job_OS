/**
 * Web-research brief adapter validation gate.
 * Run: npm run test:brief-web-research
 */
import { fetchSources } from "@/lib/brief/sources";
import { fetchWebResearchSources } from "@/lib/brief/source-web-research";
import { fetchEdgarSources } from "@/lib/brief/source-edgar";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function main(): Promise<void> {
  console.log("\nbrief web-research - offline adapters:");

  const web = await fetchWebResearchSources({ name: "Acme AI", domain: "acmeai.com" });
  check("web-research returns array (may be empty offline)", Array.isArray(web));

  const edgar = await fetchEdgarSources({ name: "Acme AI" });
  check("EDGAR without user-agent returns []", edgar.length === 0);

  const merged = await fetchSources({ name: "Acme AI", domain: "acmeai.com" });
  check("fetchSources for Acme AI has fixture sources", merged.length >= 2);

  const kinds = new Set(merged.map((s) => s.kind));
  check("≥2 independent source kinds for Acme", kinds.size >= 2);

  const hasCrunchbase = merged.some((s) => s.url.includes("crunchbase"));
  check("Crunchbase not in default pipeline", !hasCrunchbase);

  console.log(`\nbrief-web-research ${passed}/${passed + failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
