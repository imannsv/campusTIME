// This fixed port belongs to the disposable Wiki fixture, never the LFH database.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await fs.mkdir(".playwright/resource-previews", { recursive: true });
try {
  await page.goto("http://127.0.0.1:5186/");
  await page.getByLabel("Passwort", { exact: true }).fill("WikiBuildOnly2026!");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Arbeitsbereiche" });
  await nav.getByRole("button", { name: "Lehrendenübersicht", exact: true }).click();
  let overview = page.getByRole("region", { name: "Lehrendenübersicht", exact: true });
  await overview.locator(".resource-timeline-row").first().waitFor();
  await overview.getByLabel("Nur mit Belegung").check();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "shared/wiki/images/teachers-timeline.png", animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".playwright/resource-previews/teachers-mobile.png", animations: "disabled" });
  await overview.getByRole("button", { name: "Datum auswählen", exact: true }).click();
  await page.screenshot({ path: ".playwright/resource-previews/calendar-mobile.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav.getByRole("button", { name: "Räume", exact: true }).click();
  await page.getByRole("button", { name: "Raumbelegung", exact: true }).click();
  overview = page.getByRole("region", { name: "Raumbelegung", exact: true });
  await overview.locator(".resource-timeline-row").first().waitFor();
  await page.screenshot({ path: "shared/wiki/images/rooms-timeline.png", animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".playwright/resource-previews/rooms-mobile.png", animations: "disabled" });
  console.log("Resource timeline illustrations captured from the temporary fixture.");
} finally {
  await browser.close();
}
