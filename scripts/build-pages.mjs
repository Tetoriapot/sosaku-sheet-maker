import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const run = (args) => {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_STATIC_HOSTING: "true",
      VITE_BASE_PATH: process.env.VITE_BASE_PATH || "/sosaku-sheet-maker/",
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
run(["node_modules/typescript/bin/tsc", "-b"]);
run(["node_modules/vite/bin/vite.js", "build"]);
writeFileSync("dist/.nojekyll", "");
