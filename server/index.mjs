import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createStore } from "./storage.mjs";
import { createApi } from "./api.mjs";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};
export function buildServer({
  store,
  allowedOrigins = [],
  staticDir = "dist",
  writeLimit,
  readLimit,
} = {}) {
  const api = createApi({ store, allowedOrigins, writeLimit, readLimit });
  const root = resolve(staticDir);
  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      await api(req, res);
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    try {
      const requested = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (requested !== root && !requested.startsWith(root + sep)) {
        res.writeHead(404);
        res.end();
        return;
      }
      let file = requested;
      try {
        if (!(await stat(file)).isFile()) file = resolve(root, "index.html");
      } catch {
        if (extname(file)) {
          res.writeHead(404);
          res.end();
          return;
        }
        file = resolve(root, "index.html");
      }
      const data = await readFile(file);
      res.setHeader(
        "Content-Type",
        mime[extname(file)] || "application/octet-stream",
      );
      res.setHeader(
        "Cache-Control",
        extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
      );
      res.writeHead(200);
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("画面を表示できません。pnpm buildを実行してください。");
    }
  });
}
export function serverConfig(env = process.env) {
  const port = Number(env.API_PORT || 8787);
  const host = env.API_HOST || "127.0.0.1";
  const origins = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    ...(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  ];
  if (env.PUBLIC_ORIGIN) origins.push(new URL(env.PUBLIC_ORIGIN).origin);
  return { port, host, allowedOrigins: origins };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const config = serverConfig();
  const store = createStore();
  const server = buildServer({ store, ...config });
  server.listen(config.port, config.host, () =>
    console.log(`創作シートメーカー: http://${config.host}:${config.port}`),
  );
  const shutdown = () =>
    server.close(() => {
      store.close();
      process.exit(0);
    });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
