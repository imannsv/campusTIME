import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--outDir",
    ".playwright/wiki",
    "--host",
    "127.0.0.1",
    "--port",
    "5186",
    "--strictPort",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, CAMPUS_API_URL: "http://127.0.0.1:8123" },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
