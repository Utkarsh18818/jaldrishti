import { fileURLToPath } from "node:url";
import { resolve, relative } from "node:path";
import { rm, mkdir, cp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(projectRoot, "infra/.build");
if (relative(projectRoot, output).replaceAll("\\", "/") !== "infra/.build")
  throw new Error("Unsafe build output path");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    resolve(projectRoot, "node_modules/typescript/bin/tsc"),
    "-p",
    resolve(projectRoot, "infra/tsconfig.lambda.json"),
  ],
  { cwd: projectRoot, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
await writeFile(
  resolve(output, "package.json"),
  JSON.stringify({ private: true, type: "module" }),
);
await cp(
  resolve(projectRoot, "infra/node_modules"),
  resolve(output, "node_modules"),
  { recursive: true },
);
console.log(
  "Lambda artifact: " +
    output +
    " (compiled shared engine + pinned DynamoDB dependencies)",
);
