import fs from "node:fs";
import path from "node:path";
import type {IncomingMessage, ServerResponse} from "node:http";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function safeFile(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0] || "/");
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\//, "");
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root))) return null;
  return resolved;
}

export function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const urlPath = req.url || "/";
  if (urlPath.startsWith("/api")) return false;

  let file = safeFile(root, urlPath);
  if (!file) return false;

  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(root, "index.html");
  }
  if (!fs.existsSync(file)) return false;

  const ext = path.extname(file).toLowerCase();
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  fs.createReadStream(file).pipe(res);
  return true;
}
