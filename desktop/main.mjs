import {app, BrowserWindow, dialog, shell} from "electron";
import fs from "node:fs";
import http from "node:http";
import {createRequire} from "node:module";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
void here;
const DEV_URL = process.env.ELECTRON_START_URL || "http://127.0.0.1:3000";
const PACKAGED_PORT = process.env.CONTROL_DESK_API_PORT || "18787";

function logLine(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    const logPath = path.join(app.getPath("userData"), "desktop.log");
    fs.mkdirSync(path.dirname(logPath), {recursive: true});
    fs.appendFileSync(logPath, line);
  } catch {
    /* ignore */
  }
  console.log(message);
}

function waitForHttp(url, timeoutMs = 20_000) {
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
        setTimeout(tick, 200);
      });
    };
    tick();
  });
}

function resolvePackagedFile(...parts) {
  const fromApp = path.join(app.getAppPath(), ...parts);
  if (fs.existsSync(fromApp)) return fromApp;
  const unpacked = path.join(process.resourcesPath, "app.asar.unpacked", ...parts);
  if (fs.existsSync(unpacked)) return unpacked;
  return fromApp;
}

function startPackagedServer() {
  const distUi = resolvePackagedFile("dist");
  const serverJs = resolvePackagedFile("dist-server", "index.cjs");
  process.env.CONTROL_DESK_API_PORT = PACKAGED_PORT;
  process.env.CONTROL_DESK_STATIC = distUi;
  logLine(`appPath=${app.getAppPath()}`);
  logLine(`server=${serverJs} exists=${fs.existsSync(serverJs)}`);
  logLine(`static=${distUi} exists=${fs.existsSync(distUi)}`);
  const require = createRequire(import.meta.url);
  require(serverJs);
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
  try {
    const url = app.isPackaged ? startPackagedServer() : DEV_URL;
    logLine(`waiting for ${url} packaged=${app.isPackaged}`);
    await waitForHttp(url);
    logLine(`ready ${url}`);
    await createWindow(url);
  } catch (err) {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    logLine(`FATAL ${message}`);
    dialog.showErrorBox(
      "Hermes Control Desk failed to start",
      `${message}\n\nLog: ${path.join(app.getPath("userData"), "desktop.log")}`,
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

