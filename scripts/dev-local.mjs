import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const python = resolve(
  root,
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python",
);
const vite = resolve(root, "node_modules/vite/bin/vite.js");
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}

async function checkPort(port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} ist bereits belegt. Beende den dort laufenden Server vor dem gemeinsamen Start.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolvePort));
  });
}

function start(command, args, name) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.once("error", (error) => {
    console.error(`${name} konnte nicht starten: ${error.message}`);
    stop(1);
  });
  child.once("exit", (code) => {
    if (!stopping) {
      console.error(
        `${name} wurde beendet. Die lokale Anwendung wird vollständig gestoppt.`,
      );
      stop(code || 1);
    }
  });
}

async function waitUntilReady(url) {
  const deadline = Date.now() + 120000;
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return true;
    } catch {
      // The child process may still be starting up.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  if (stopping) return false;
  throw new Error(`Server wurde nicht rechtzeitig erreichbar: ${url}`);
}

process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());

try {
  if (!existsSync(python) || !existsSync(vite))
    throw new Error(
      "Lokale Abhängigkeiten fehlen. Richte .venv und node_modules gemäß README.md ein.",
    );
  await checkPort(8000);
  await checkPort(5173);
  console.log("Starte Backend und Oberfläche — Strg+C beendet beide Server.");
  start(
    python,
    ["backend/manage.py", "runserver", "127.0.0.1:8000", "--noreload"],
    "Backend",
  );
  start(
    process.execPath,
    [vite, "--host", "127.0.0.1", "--port", "5173", "--strictPort"],
    "Oberfläche",
  );
  const ready = await Promise.all([
    waitUntilReady("http://127.0.0.1:8000/api/health/"),
    waitUntilReady("http://127.0.0.1:5173/"),
  ]);
  if (!stopping && ready.every(Boolean))
    console.log("CampusZeit ist bereit: http://127.0.0.1:5173");
} catch (error) {
  console.error(error.message);
  stop(1);
}
