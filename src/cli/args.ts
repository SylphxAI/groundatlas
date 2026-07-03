export type CommandName =
  | "audit"
  | "explain"
  | "help"
  | "impact"
  | "init"
  | "scan"
  | "update"
  | "version";

export type ParsedArgs = {
  command: CommandName;
  cwd: string;
  outputDir?: string;
  json: boolean;
  query?: string;
  since: string;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const command = normalizeCommand(args.shift());
  let cwd = process.cwd();
  let outputDir: string | undefined;
  let json = false;
  let since = "HEAD";
  const rest: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--cwd") {
      cwd = requireValue(args, ++index, "--cwd");
      continue;
    }
    if (arg === "--out" || arg === "--output-dir") {
      outputDir = requireValue(args, ++index, arg);
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--since") {
      since = requireValue(args, ++index, "--since");
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { command: "help", cwd, outputDir, json, since };
    }
    rest.push(arg ?? "");
  }

  return { command, cwd, outputDir, json, query: rest.join(" ").trim(), since };
}

function normalizeCommand(command: string | undefined): CommandName {
  switch (command) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return "help";
    case "--version":
    case "-v":
    case "version":
      return "version";
    case "validate":
      return "audit";
    case "query":
      return "explain";
    case "map":
    case "export":
      return "update";
    case "ingest":
      return "scan";
    case "audit":
    case "explain":
    case "impact":
    case "init":
    case "scan":
    case "update":
      return command;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function requireValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}
