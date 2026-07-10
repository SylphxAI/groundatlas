#!/usr/bin/env bun
/**
 * TS audit freshness oracle for GroundAtlas differential parity.
 *
 * Runs `freshnessFingerprint` on TS scan output for the prepared basic fixture
 * corpus. Emits canonical JSON consumed by
 * `crates/groundatlas-scanner/tests/audit_differential.rs`.
 *
 * Fail-closed: requires git + bun (no SKIP-as-pass).
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { freshnessFingerprint } from "../../src/application/audit.ts";
import {
  cleanupScanFixture,
  prepareBasicScanFixture,
  repoRootFrom,
  scanTsOracleAtlas,
} from "../../test/differential/scanFixture.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = repoRootFrom(__dirname);
const CORPUS_PATH = join(__dirname, "fixtures/basic-audit-corpus.json");

interface AuditMutationSpec {
  path: string;
  content: string;
}

interface AuditCaseSpec {
  id: string;
  fixtureSource: string;
  injectSecretFile: string;
  injectSecretContent: string;
  gitInit: boolean;
  outputDir: string;
  mutation?: AuditMutationSpec;
}

interface Corpus {
  corpusVersion: number;
  auditCases: AuditCaseSpec[];
  normalize: {
    generatedAt: string;
    generatorVersion: string;
  };
}

export interface DifferentialAuditCase {
  readonly id: string;
  readonly domain: "audit";
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
}

export interface DifferentialAuditCorpus {
  readonly corpusVersion: number;
  readonly fixtureCorpusHash: string;
  readonly cases: readonly DifferentialAuditCase[];
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

async function loadCorpus(): Promise<Corpus> {
  const raw = await readFile(CORPUS_PATH, "utf8");
  return JSON.parse(raw) as Corpus;
}

async function main(): Promise<void> {
  const corpus = await loadCorpus();
  const fixtureCorpusHash = createHash("sha256").update(JSON.stringify(corpus)).digest("hex");
  const cases: DifferentialAuditCase[] = [];

  for (const caseSpec of corpus.auditCases) {
    const { tempRoot, fixtureRoot } = await prepareBasicScanFixture(REPO_ROOT);
    try {
      const baselineAtlas = await scanTsOracleAtlas(REPO_ROOT, fixtureRoot);
      const baselineFingerprint = freshnessFingerprint(baselineAtlas);

      let currentFingerprint = baselineFingerprint;
      let isStale = false;

      if (caseSpec.mutation) {
        await writeFile(
          join(fixtureRoot, caseSpec.mutation.path),
          caseSpec.mutation.content,
          "utf8",
        );
        const currentAtlas = await scanTsOracleAtlas(REPO_ROOT, fixtureRoot);
        currentFingerprint = freshnessFingerprint(currentAtlas);
        isStale = baselineFingerprint !== currentFingerprint;
      }

      cases.push({
        id: caseSpec.id,
        domain: "audit",
        input: {
          fixtureSource: caseSpec.fixtureSource,
          outputDir: caseSpec.outputDir,
          generatedAt: corpus.normalize.generatedAt,
          generatorVersion: corpus.normalize.generatorVersion,
          mutation: caseSpec.mutation ?? null,
        },
        output: {
          baselineFingerprint,
          currentFingerprint,
          isStale,
        },
      });
    } finally {
      await cleanupScanFixture(tempRoot);
    }
  }

  const payload: DifferentialAuditCorpus = {
    corpusVersion: corpus.corpusVersion,
    fixtureCorpusHash,
    cases,
  };

  process.stdout.write(canonicalJson(payload));
}

await main();