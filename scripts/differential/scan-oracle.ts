#!/usr/bin/env bun
/**
 * TS scan oracle for GroundAtlas differential parity.
 *
 * Runs the historical TS scanner (`scanRepository`) on the prepared basic fixture
 * corpus. Emits canonical JSON consumed by
 * `crates/groundatlas-scanner/tests/scan_differential.rs`.
 *
 * Fail-closed: requires git + bun (no SKIP-as-pass).
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupScanFixture,
  loadGoldenAtlas,
  prepareBasicScanFixture,
  repoRootFrom,
  scanTsOracleAtlas,
  sha256File,
  sha256Json,
} from "../../test/differential/scanFixture.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = repoRootFrom(__dirname);
const CORPUS_PATH = join(__dirname, "fixtures/basic-scan-corpus.json");

interface ScanCaseSpec {
  id: string;
  fixtureSource: string;
  injectSecretFile: string;
  injectSecretContent: string;
  gitInit: boolean;
  outputDir: string;
}

interface Corpus {
  corpusVersion: number;
  scanCases: ScanCaseSpec[];
  goldenBaseline: string;
  normalize: {
    generatedAt: string;
    generatorVersion: string;
  };
}

export interface DifferentialCase {
  readonly id: string;
  readonly domain: "scan";
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
}

export interface DifferentialCorpus {
  readonly corpusVersion: number;
  readonly fixtureCorpusHash: string;
  readonly goldenBaselineHash: string;
  readonly cases: readonly DifferentialCase[];
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
  const goldenPath = join(REPO_ROOT, corpus.goldenBaseline);
  const goldenBaselineHash = sha256File(goldenPath);
  const cases: DifferentialCase[] = [];

  for (const caseSpec of corpus.scanCases) {
    const { tempRoot, fixtureRoot } = await prepareBasicScanFixture(REPO_ROOT);
    try {
      const tsAtlas = await scanTsOracleAtlas(REPO_ROOT, fixtureRoot);
      const golden = loadGoldenAtlas(REPO_ROOT);
      const goldenWithRoot = {
        ...golden,
        repository: {
          ...golden.repository,
          root: fixtureRoot,
        },
      };

      if (sha256Json(tsAtlas) !== sha256Json(goldenWithRoot)) {
        console.error(
          `scan-oracle: TS scan diverged from committed golden for case ${caseSpec.id}`,
        );
        process.exit(1);
      }

      cases.push({
        id: caseSpec.id,
        domain: "scan",
        input: {
          fixtureSource: caseSpec.fixtureSource,
          outputDir: caseSpec.outputDir,
          generatedAt: corpus.normalize.generatedAt,
          generatorVersion: corpus.normalize.generatorVersion,
        },
        output: {
          atlas: tsAtlas,
          goldenBaselineHash,
        },
      });
    } finally {
      await cleanupScanFixture(tempRoot);
    }
  }

  const payload: DifferentialCorpus = {
    corpusVersion: corpus.corpusVersion,
    fixtureCorpusHash,
    goldenBaselineHash,
    cases,
  };

  process.stdout.write(canonicalJson(payload));
}

await main();