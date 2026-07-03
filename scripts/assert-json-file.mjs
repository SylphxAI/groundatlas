import { readFileSync } from "node:fs";

const file = process.argv[2];

if (!file) {
  console.error("Usage: node scripts/assert-json-file.mjs <file>");
  process.exit(2);
}

try {
  JSON.parse(readFileSync(file, "utf8"));
  console.log(`JSON artifact is parseable: ${file}`);
} catch (error) {
  console.error(`JSON artifact is not parseable: ${file}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
