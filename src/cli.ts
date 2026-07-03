#!/usr/bin/env node

import path from "node:path";
import packageJson from "../package.json" with { type: "json" };

import { auditAtlas } from "./application/audit.js";
import { ensureConfig, loadConfig } from "./application/config.js";
import { explainQuery } from "./application/explain.js";
import { inspectFleet } from "./application/fleet.js";
import { writeAtlas } from "./application/generate.js";
import { analyzeImpact } from "./application/impact.js";
import { scanRepository } from "./application/scan.js";
import { parseArgs } from "./cli/args.js";
import { helpText } from "./cli/help.js";
import {
  renderFleetReport,
  renderImpact,
  renderRisks,
  renderSourceTable,
} from "./renderers/markdown.js";

const { version } = packageJson;

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);

  if (args.command === "help") {
    console.log(helpText());
    return 0;
  }

  if (args.command === "version") {
    console.log(version);
    return 0;
  }

  const cwd = path.resolve(args.cwd);

  if (args.command === "init") {
    const config = await ensureConfig(cwd, args.outputDir);
    const atlas = await scanRepository({ cwd, outputDir: config.outputDir });
    const written = await writeAtlas(path.join(cwd, config.outputDir), atlas);
    console.log(`GroundAtlas initialized ${config.outputDir}/`);
    for (const file of written) console.log(`- ${path.relative(cwd, file)}`);
    return atlas.risks.some((risk) => risk.severity === "error") ? 1 : 0;
  }

  const config = await loadConfig(cwd, args.outputDir);

  if (args.command === "update") {
    const atlas = await scanRepository({ cwd, outputDir: config.outputDir });
    const written = await writeAtlas(path.join(cwd, config.outputDir), atlas);
    console.log(`GroundAtlas updated ${config.outputDir}/`);
    for (const file of written) console.log(`- ${path.relative(cwd, file)}`);
    return atlas.risks.some((risk) => risk.severity === "error") ? 1 : 0;
  }

  if (args.command === "scan") {
    const atlas = await scanRepository({ cwd, outputDir: config.outputDir });
    if (args.json) {
      console.log(JSON.stringify(atlas, null, 2));
    } else {
      console.log(renderSourceTable(atlas.sources.filter((source) => source.canonical)));
      if (atlas.risks.length > 0) console.log(`\n${renderRisks(atlas.risks)}`);
    }
    return atlas.risks.some((risk) => risk.severity === "error") ? 1 : 0;
  }

  if (args.command === "audit") {
    const result = await auditAtlas(cwd, config.outputDir);
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.ok) {
      console.log("GroundAtlas audit passed.");
    } else {
      console.error(renderRisks(result.issues));
    }
    return result.ok ? 0 : 1;
  }

  if (args.command === "explain") {
    if (!args.query) throw new Error("explain requires a query.");
    const matches = await explainQuery(cwd, config.outputDir, args.query);
    if (args.json) {
      console.log(JSON.stringify(matches, null, 2));
    } else {
      console.log(renderSourceTable(matches));
    }
    return matches.length > 0 ? 0 : 1;
  }

  if (args.command === "impact") {
    const atlas = await scanRepository({ cwd, outputDir: config.outputDir });
    const impact = await analyzeImpact(cwd, args.since, atlas);
    if (args.json) {
      console.log(JSON.stringify(impact, null, 2));
    } else {
      console.log(renderImpact(impact));
    }
    return 0;
  }

  if (args.command === "fleet") {
    const report = await inspectFleet({
      cwd,
      paths: args.values,
      outputDir: args.outputDir,
      requireAtlas: args.requireAtlas,
      strict: args.strict,
    });
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(renderFleetReport(report));
    }
    const hasBlocked = report.summary.blocked > 0;
    const hasWarnings = report.summary.warning > 0;
    return hasBlocked || (args.strict && hasWarnings) ? 1 : 0;
  }

  return 1;
}

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
