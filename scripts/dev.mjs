import { createServer as createViteServer } from "vite";
import { buildServer, serverConfig } from "../server/index.mjs";
import { createStore } from "../server/storage.mjs";
const config = serverConfig();
const store = createStore();
let api;
let vite;
try {
  vite = await createViteServer({ server: { host: "127.0.0.1" } });
  await vite.listen();
  // Register the configured frontend origin with the sharing API.
  for (const url of vite.resolvedUrls.local)
    config.allowedOrigins.push(new URL(url).origin);
  api = buildServer({ store, ...config });
  await new Promise((resolve, reject) => {
    api.once("error", reject);
    api.listen(config.port, config.host, resolve);
  });
  console.log(`共有API: http://${config.host}:${config.port}`);
  vite.printUrls();
} catch (error) {
  console.error(`開発サーバーを起動できません: ${error.message}`);
  await vite?.close();
  store.close();
  process.exit(1);
}
let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  await vite.close();
  await new Promise((resolve) => api.close(resolve));
  store.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
