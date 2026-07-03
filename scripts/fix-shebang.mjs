import { chmod, readFile, writeFile } from "node:fs/promises";

const path = "dist/cli.js";
const content = await readFile(path, "utf8");
const shebang = "#!/usr/bin/env node\n";
await writeFile(path, content.startsWith(shebang) ? content : `${shebang}${content}`);
await chmod(path, 0o755);
