import {app, BrowserWindow, shell} from "electron";
import {spawn} from "node:child_process";
import http from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const DEV_URL = process.env.ELECTRON_START_URL || "http://127.0.0.1:3000";
const PACKAGED_PORT = process.env.CONTROL_DESK_API_PORT || "18787";

let serverChild = null;

function waitForHttp(url, timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(url);
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function startPackagedServer() {
  const distUi = path.join(root, "dist");
  const serverJs = path.join(root, "dist-server", "index.cjs");
  serverChild = spawn(process.execPath, [serverJs], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      CONTROL_DESK_API_PORT: PACKAGED_PORT,
      CONTROL_DESK_STATIC: distUi,
    },
    stdio: "inherit",
  });
  return `http://127.0.0.1:${PACKAGED_PORT}/`;
}

async function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Hermes Control Desk",
    backgroundColor: "#0b0f14",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.webContents.setWindowOpenHandler(({url: target}) => {
    void shell.openExternal(target);
    return {action: "deny"};
  });
  await win.loadURL(url);
}

app.whenReady().then(async () => {
  const url = app.isPackaged ? startPackagedServer() : DEV_URL;
  await waitForHttp(url);
  await createWindow(url);
});

app.on("window-all-closed", () => {
  if (serverChild) serverChild.kill();
  app.quit();
});

process.on("exit", () => {
  if (serverChild) serverChild.kill();
});
