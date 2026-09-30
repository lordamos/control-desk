import http from "node:http";
import path from "node:path";
import {handleApi} from "./api.ts";
import {serveStatic} from "./static.ts";

const port = Number(process.env.CONTROL_DESK_API_PORT || process.env.PORT || 8787);
const listenHost = "0.0.0.0";
const staticDir = process.env.CONTROL_DESK_STATIC
  ? path.resolve(process.env.CONTROL_DESK_STATIC)
  : "";

const server = http.createServer(async (req, res) => {
  try {
    const handled = await handleApi(req, res);
    if (handled) return;
    if (staticDir && serveStatic(req, res, staticDir)) return;
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({error: "Not found"}));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({error: message}));
    }
  }
});

server.listen(port, listenHost, () => {
  console.log(`Hermes Control Desk API http://${listenHost}:${port}`);
  if (staticDir) {
    console.log(`Static UI ${staticDir}`);
  }
});
