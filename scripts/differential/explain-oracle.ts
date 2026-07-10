#!/usr/bin/env bun
/**
 * TS explain oracle for GroundAtlas cli/explain differential parity (rej-010 cycle51).
 *
 * Scores queries against the basic atlas golden fixture (same algorithm as explain.ts).
 * Emits canonical JSON consumed by `crates/groundatlas-scanner/tests/explain_differential.rs`.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AtlasMap, SourceEntry } from "../../src/domain/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");
const CORPUS_PATH = join(__dirname, "fixtures/basic-explain-corpus.json");

interface QuerySpec {
  id: string;
  query: string;
}

interface Corpus {
  corpusVersion: number;
  atlasFixture: string;
  queries: QuerySpec[];
}

export interface DifferentialCase {
  readonly id: string;
  readonly slice: "cli/explain";
  readonly domain: "explain-query";
  readonly input: { query: string };
  readonly output: { paths: string[] };
}

export interface DifferentialCorpus {
  readonly corpusVersion: number;
  readonly fixtureCorpusHash: string;
  readonly atlasGoldenHash: string;
  readonly cases: readonly DifferentialCase[];
}

function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function scoreSource(source: SourceEntry, terms: string[]): number {
  const haystack = `${source.path} ${source.kind} ${source.reason}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function explainQueryOnAtlas(atlas: AtlasMap, query: string): SourceEntry[] {
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  return atlas.sources
    .map((source) => ({ source, score: scoreSource(source, terms) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.source.path.localeCompare(right.source.path),
    )
    .slice(0, 20)
    .map((entry) => entry.source);
}

async function buildCorpus(): Promise<DifferentialCorpus> {
  const corpusRaw = await readFile(CORPUS_PATH, "utf8");
  const corpus = JSON.parse(corpusRaw) as Corpus;
  const atlasPath = join(REPO_ROOT, corpus.atlasFixture);
  const atlasRaw = await readFile(atlasPath, "utf8");
  const atlas = JSON.parse(atlasRaw) as AtlasMap;

  const cases: DifferentialCase[] = [];
  for (const spec of corpus.queries) {
    const matches = explainQueryOnAtlas(atlas, spec.query);
    cases.push({
      id: spec.id,
      slice: "cli/explain",
      domain: "explain-query",
      input: { query: spec.query },
      output: { paths: matches.map((entry) => entry.path) },
    });
  }

  return {
    corpusVersion: corpus.corpusVersion,
    fixtureCorpusHash: sha256Hex(corpusRaw),
    atlasGoldenHash: sha256Hex(atlasRaw),
    cases,
  };
}

const corpus = await buildCorpus();
process.stdout.write(`${JSON.stringify(corpus)}\n`);