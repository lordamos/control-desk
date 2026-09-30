import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function bin(name) {
  return path.join(root, "node_modules", ".bin", name);
}

run(bin("vite"), ["build"]);
run(bin("esbuild"), [
  "server/index.ts",
  "--bundle",
  "--platform=node",
  "--format=cjs",
  "--outfile=dist-server/index.cjs",
]);
