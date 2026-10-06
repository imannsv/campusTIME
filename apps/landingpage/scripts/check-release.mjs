import { readFile } from "node:fs/promises";
import { loadEnv } from "vite";
import { createSiteConfig } from "./site-config.mjs";
const legal = JSON.parse(
  await readFile(new URL("../content/legal.json", import.meta.url), "utf8"),
);
try {
  createSiteConfig(
    {
      ...loadEnv("production", process.cwd(), ""),
      ...process.env,
      PUBLIC_RELEASE: "true",
    },
    legal,
  );
  console.log(
    "Öffentliche Freigabe: Domain, Kontakt und Rechtsinhalte vorhanden.",
  );
} catch (error) {
  console.error(`Öffentliche Freigabe nicht möglich: ${error.message}`);
  process.exitCode = 1;
}
