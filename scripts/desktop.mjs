import {spawn} from "node:child_process";
import http from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiPort = process.env.CONTROL_DESK_API_PORT || "8787";
const uiPort = process.env.PORT || "3000";
const uiUrl = `http://127.0.0.1:${uiPort}/`;

function bin(name) {
  return path.join(root, "node_modules", ".bin", name);
}

function run(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    cwd: root,
    env: {...process.env, ...extraEnv},
  });
  return child;
}

function httpOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
  });
}

function waitFor(url, timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await httpOk(url)) {
        resolve(url);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tick, 250);
    };
    void tick();
  });
}

const alreadyUp = await httpOk(uiUrl);
let api;
let ui;
if (!alreadyUp) {
  api = run(bin("tsx"), ["server/index.ts"], {
    CONTROL_DESK_API_PORT: apiPort,
  });
  ui = run(bin("vite"), [`--port=${uiPort}`, "--host=0.0.0.0"]);
}

await waitFor(uiUrl);

const electronBin = process.platform === "win32" ? "electron.cmd" : "electron";
const electronArgs = ["."];
if (process.platform === "linux") electronArgs.push("--no-sandbox");
const electron = run(bin(electronBin), electronArgs, {
  ELECTRON_START_URL: uiUrl,
  ELECTRON_DISABLE_SANDBOX: "1",
});

electron.on("exit", (code) => {
  if (api) api.kill();
  if (ui) ui.kill();
  process.exit(code ?? 0);
});

function shutdown() {
  electron.kill();
  if (api) api.kill();
  if (ui) ui.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
