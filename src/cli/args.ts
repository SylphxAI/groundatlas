export type CommandName =
  | "audit"
  | "explain"
  | "fleet"
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
  values: string[];
  since: string;
  strict: boolean;
  requireAtlas: boolean;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const command = normalizeCommand(args.shift());
  let cwd = process.cwd();
  let outputDir: string | undefined;
  let json = false;
  let since = "HEAD";
  let strict = false;
  let requireAtlas = false;
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
    if (arg === "--strict") {
      strict = true;
      continue;
    }
    if (arg === "--require-atlas") {
      requireAtlas = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return {
        command: "help",
        cwd,
        outputDir,
        json,
        query: "",
        values: [],
        since,
        strict,
        requireAtlas,
      };
    }
    rest.push(arg ?? "");
  }

  return {
    command,
    cwd,
    outputDir,
    json,
    query: rest.join(" ").trim(),
    values: rest,
    since,
    strict,
    requireAtlas,
  };
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
    case "inventory":
    case "score":
      return "fleet";
    case "audit":
    case "explain":
    case "fleet":
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
